'use server'

import { randomUUID, createHash } from 'node:crypto'

import { revalidatePath } from 'next/cache'

import { computeDose } from '@/lib/domain/dose/computeDose'
import { eventCostFromVial } from '@/lib/domain/cost/cost'
import { suggestCycleAction } from '@/lib/domain/cycles/suggest'
import { distributionMean } from '@/lib/domain/uncertainty/sample'
import { simulateEffectiveDose } from '@/lib/domain/uncertainty/monteCarlo'
import { parseQuantity } from '@/lib/domain/units/types'
import { toCanonicalMassMg, toCanonicalVolumeMl } from '@/lib/domain/units/canonicalize'
import type { Distribution } from '@/lib/domain/uncertainty/types'
import {
  completeCycleInstance,
  createCycleInstance,
  getActiveCycleForSubstance,
  getCycleRuleForSubstance,
  getLastCycleForSubstance,
} from '@/lib/repos/cyclesRepo'
import { requireData, requireOk } from '@/lib/repos/errors'
import { getBioavailabilitySpec } from '@/lib/repos/bioavailabilitySpecsRepo'
import { listComponentModifierSpecs } from '@/lib/repos/componentModifierSpecsRepo'
import { listDistributionsById, distributionRowToDomain } from '@/lib/repos/distributionsRepo'
import { getDeviceCalibration } from '@/lib/repos/deviceCalibrationsRepo'
import { getLastEventEnrichedForSubstance } from '@/lib/repos/eventsRepo'
import { listFormulationComponents } from '@/lib/repos/formulationComponentsRepo'
import { getFormulationEnrichedById } from '@/lib/repos/formulationsRepo'
import { listFormulationModifierSpecs } from '@/lib/repos/formulationModifierSpecsRepo'
import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { getActiveVialForFormulation } from '@/lib/repos/vialsRepo'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

type Compartment = Extract<Database['public']['Enums']['compartment_t'], 'systemic' | 'cns'>

type CanonicalDistSpec = {
  id: string
  value_type: Database['public']['Enums']['distribution_value_type_t']
  dist_type: Database['public']['Enums']['distribution_dist_type_t']
  p1: number | null
  p2: number | null
  p3: number | null
  min_value: number | null
  max_value: number | null
  units: string | null
}

type CanonicalModelSnapshot = {
  version: 1
  formulation_id: string
  substance_id: string | null
  route_id: string | null
  device_id: string | null
  calibration:
    | {
        source: 'vial_override' | 'device_calibration'
        unit_label: string
        dist: CanonicalDistSpec
        mean_volume_ml_per_unit: number
      }
    | null
  compartments: Partial<
    Record<
      Compartment,
      {
        base_fraction: CanonicalDistSpec | null
        multipliers: CanonicalDistSpec[]
        missing: string[]
      }
    >
  >
}

export type CreateEventState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string; eventId: string }

function hashToSeed53(input: string): bigint {
  const digest = createHash('sha256').update(input).digest()
  let x = 0n
  for (let i = 0; i < 8; i++) {
    x = (x << 8n) + BigInt(digest[i] ?? 0)
  }
  return x & ((1n << 53n) - 1n)
}

function deriveSeed(seed: bigint, label: string): bigint {
  return hashToSeed53(`${seed.toString()}|${label}`)
}

function distToSpec(dist: Database['public']['Tables']['distributions']['Row']): CanonicalDistSpec {
  return {
    id: dist.id,
    value_type: dist.value_type,
    dist_type: dist.dist_type,
    p1: dist.p1,
    p2: dist.p2,
    p3: dist.p3,
    min_value: dist.min_value,
    max_value: dist.max_value,
    units: dist.units,
  }
}

function compartmentsForSubstance(substance: { target_compartment_default: Database['public']['Enums']['compartment_t'] } | null): Compartment[] {
  if (!substance) return ['systemic']
  switch (substance.target_compartment_default) {
    case 'cns':
      return ['cns']
    case 'both':
      return ['systemic', 'cns']
    case 'systemic':
    default:
      return ['systemic']
  }
}

function safeVialContentMassMg(vial: Database['public']['Tables']['vials']['Row'] | null): number | null {
  if (!vial) return null
  try {
    return toCanonicalMassMg(Number(vial.content_mass_value), vial.content_mass_unit)
  } catch {
    return null
  }
}

function safeVialTotalVolumeMl(vial: Database['public']['Tables']['vials']['Row'] | null): number | null {
  if (!vial) return null
  if (vial.total_volume_value == null || vial.total_volume_unit == null) return null
  try {
    return toCanonicalVolumeMl(Number(vial.total_volume_value), vial.total_volume_unit)
  } catch {
    return null
  }
}

export async function seedDemoDataAction(): Promise<void> {
  const supabase = await createClient()
  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) {
    throw new Error('Not authenticated.')
  }

  // 1) Substance + route
  const substanceUpsert = await supabase
    .from('substances')
    .upsert(
      {
        user_id: user.id,
        canonical_name: 'demo_substance',
        display_name: 'Demo substance',
        family: 'peptide',
        target_compartment_default: 'systemic',
      },
      { onConflict: 'user_id,canonical_name' },
    )
    .select('*')
    .single()
  const substance = requireData(substanceUpsert.data, substanceUpsert.error, 'demo.substance.upsert')

  const routeUpsert = await supabase
    .from('routes')
    .upsert(
      {
        user_id: user.id,
        name: 'demo_route_subq',
        default_input_kind: 'mass',
        default_input_unit: 'mg',
        supports_device_calibration: false,
      },
      { onConflict: 'user_id,name' },
    )
    .select('*')
    .single()
  const route = requireData(routeUpsert.data, routeUpsert.error, 'demo.route.upsert')

  // 2) Formulation
  const formulationUpsert = await supabase
    .from('formulations')
    .upsert(
      {
        user_id: user.id,
        substance_id: substance.id,
        route_id: route.id,
        name: 'Demo formulation',
        is_default_for_route: true,
      },
      { onConflict: 'user_id,substance_id,route_id,name' },
    )
    .select('*')
    .single()
  const formulation = requireData(
    formulationUpsert.data,
    formulationUpsert.error,
    'demo.formulation.upsert',
  )

  // 3) Active vial (if missing)
  const activeVialRes = await supabase
    .from('vials')
    .select('*')
    .eq('formulation_id', formulation.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()
  requireOk(activeVialRes.error, 'demo.vials.select_active')
  if (!activeVialRes.data) {
    const vialInsert = await supabase.from('vials').insert({
      user_id: user.id,
      substance_id: substance.id,
      formulation_id: formulation.id,
      status: 'active',
      content_mass_value: 10,
      content_mass_unit: 'mg',
      total_volume_value: 10,
      total_volume_unit: 'mL',
      concentration_mg_per_ml: 1,
      cost_usd: 100,
    })
    requireOk(vialInsert.error, 'demo.vials.insert')
  }

  // 4) Distributions + specs (systemic only)
  const existingBaseDistRes = await supabase
    .from('distributions')
    .select('*')
    .eq('name', 'DEMO: base BA systemic')
    .eq('value_type', 'fraction')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  requireOk(existingBaseDistRes.error, 'demo.dists.select_base')

  let baseDist = existingBaseDistRes.data
  if (!baseDist) {
    const insertRes = await supabase
      .from('distributions')
      .insert({
        user_id: user.id,
        name: 'DEMO: base BA systemic',
        value_type: 'fraction',
        dist_type: 'beta_pert',
        p1: 0.1,
        p2: 0.3,
        p3: 0.6,
        units: 'fraction',
        quality_score: 1,
        evidence_summary: 'Demo only',
      })
      .select('*')
      .single()

    baseDist = requireData(insertRes.data, insertRes.error, 'demo.dists.insert_base')
  }

  const baseSpecUpsert = await supabase.from('bioavailability_specs').upsert(
    {
      user_id: user.id,
      substance_id: substance.id,
      route_id: route.id,
      compartment: 'systemic',
      base_fraction_dist_id: baseDist.id,
      notes: 'Demo only',
    },
    { onConflict: 'user_id,substance_id,route_id,compartment' },
  )
  requireOk(baseSpecUpsert.error, 'demo.bioavailability_specs.upsert')

  revalidatePath('/today')
}

export async function createEventAction(
  prevState: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  void prevState

  const formulationId = String(formData.get('formulation_id') ?? '').trim()
  const inputText = String(formData.get('input_text') ?? '').trim()

  if (!formulationId) return { status: 'error', message: 'Missing formulation.' }
  if (!inputText) return { status: 'error', message: 'Missing dose input.' }

  const supabase = await createClient()
  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) return { status: 'error', message: 'Not authenticated.' }

  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))

  const formulationEnriched = await getFormulationEnrichedById(supabase, {
    formulationId,
  })
  if (!formulationEnriched) {
    return { status: 'error', message: 'Formulation not found.' }
  }

  const compartments = compartmentsForSubstance(formulationEnriched.substance)
  const eventId = randomUUID()
  const eventTs = new Date().toISOString()

  let parsed: ReturnType<typeof parseQuantity>
  try {
    parsed = parseQuantity(inputText)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  const activeVial = await getActiveVialForFormulation(supabase, {
    formulationId,
  })

  // Calibration for device-units inputs.
  let calibrationDistSpec: CanonicalDistSpec | null = null
  let calibrationMean: number | null = null
  let calibrationSource: 'vial_override' | 'device_calibration' | null = null

  if (parsed.kind === 'device_units') {
    const routeId = formulationEnriched.formulation.route_id
    const deviceId = formulationEnriched.formulation.device_id
    const unitLabel = parsed.normalizedUnit

    const distId =
      activeVial?.volume_ml_per_unit_override_dist_id ??
      (deviceId
        ? (await getDeviceCalibration({
            supabase,
            deviceId,
            routeId,
            unitLabel,
          }))?.volume_ml_per_unit_dist_id ?? null
        : null)

    if (!distId) {
      return {
        status: 'error',
        message:
          'Device-units input requires a calibration (set a device calibration or a per-vial override).',
      }
    }

    const distRows = await listDistributionsById(supabase, { distributionIds: [distId] })
    const distRow = distRows[0]
    if (!distRow) {
      return { status: 'error', message: 'Calibration distribution not found.' }
    }

    const domain = distributionRowToDomain(distRow)
    if (domain.valueType !== 'volume_ml_per_unit') {
      return { status: 'error', message: 'Calibration distribution has the wrong value_type.' }
    }

    calibrationDistSpec = distToSpec(distRow)
    calibrationMean = distributionMean(domain)
    calibrationSource =
      activeVial?.volume_ml_per_unit_override_dist_id != null ? 'vial_override' : 'device_calibration'
  }

  const vialContentMassMg = safeVialContentMassMg(activeVial)
  const vialTotalVolumeMl = safeVialTotalVolumeMl(activeVial)

  let doseMassMg: number | null
  let doseVolumeMl: number | null

  try {
    const doseRes = computeDose({
      inputText,
      inputKind: parsed.kind,
      inputValue: parsed.value,
      inputUnit: parsed.unit,
      vial: activeVial
        ? {
            contentMassMg: vialContentMassMg,
            totalVolumeMl: vialTotalVolumeMl,
            concentrationMgPerMl: activeVial.concentration_mg_per_ml,
          }
        : null,
      volumeMlPerDeviceUnit: calibrationMean,
    })
    doseMassMg = doseRes.doseMassMg
    doseVolumeMl = doseRes.doseVolumeMl
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  // Device-units inputs must be canonicalizable to a numeric dose to be saved.
  if (parsed.kind === 'device_units' && doseVolumeMl == null) {
    return {
      status: 'error',
      message:
        'Could not compute dose from device units (missing or invalid calibration).',
    }
  }

  const costUsd = eventCostFromVial({
    doseMassMg,
    doseVolumeMl,
    vialContentMassMg,
    vialTotalVolumeMl,
    vialCostUsd: activeVial?.cost_usd ?? null,
  })

  // Resolve distributions needed for MC.
  const multipliersByCompartment = new Map<Compartment, string[]>()
  const baseFractionDistIdByCompartment = new Map<Compartment, string | null>()
  const missingByCompartment = new Map<Compartment, string[]>()

  for (const compartment of compartments) {
    const missing: string[] = []

    const baseSpec = formulationEnriched.substance && formulationEnriched.route
      ? await getBioavailabilitySpec({
          supabase,
          substanceId: formulationEnriched.substance.id,
          routeId: formulationEnriched.route.id,
          compartment,
        })
      : null

    if (!baseSpec) {
      baseFractionDistIdByCompartment.set(compartment, null)
      missing.push('missing_base_bioavailability_spec')
    } else {
      baseFractionDistIdByCompartment.set(compartment, baseSpec.base_fraction_dist_id)
    }

    const compartmentsForModifiers: Database['public']['Enums']['compartment_t'][] = [compartment, 'both']

    const formulationMods = await listFormulationModifierSpecs({
      supabase,
      formulationId,
      compartments: compartmentsForModifiers,
    })
    const formulationMultiplierIds = formulationMods.map((m) => m.multiplier_dist_id)

    const components = await listFormulationComponents({ supabase, formulationId })
    const componentIds = components.map((c) => c.id)
    const componentSpecs = await listComponentModifierSpecs({
      supabase,
      formulationComponentIds: componentIds,
      compartments: compartmentsForModifiers,
    })

    const componentMultiplierIds: string[] = []
    for (const c of components) {
      const specsForComponent = componentSpecs.filter(
        (s) =>
          s.formulation_component_id === c.id &&
          (s.compartment === compartment || s.compartment === 'both'),
      )
      if (specsForComponent.length > 0) {
        componentMultiplierIds.push(...specsForComponent.map((s) => s.multiplier_dist_id))
      } else if (c.modifier_dist_id) {
        componentMultiplierIds.push(c.modifier_dist_id)
      }
    }

    const multiplierIds = [...formulationMultiplierIds, ...componentMultiplierIds]
    multipliersByCompartment.set(compartment, multiplierIds)
    missingByCompartment.set(compartment, missing)
  }

  // Fetch all referenced distributions in one round trip.
  const allDistIds: string[] = []
  if (calibrationDistSpec) allDistIds.push(calibrationDistSpec.id)
  for (const compartment of compartments) {
    const baseId = baseFractionDistIdByCompartment.get(compartment)
    if (baseId) allDistIds.push(baseId)
    allDistIds.push(...(multipliersByCompartment.get(compartment) ?? []))
  }

  const distRows = await listDistributionsById(supabase, { distributionIds: [...new Set(allDistIds)] })
  const distRowById = new Map(distRows.map((d) => [d.id, d] as const))

  // Build canonical snapshot first (needed for deterministic seeding).
  const snapshot: CanonicalModelSnapshot = {
    version: 1,
    formulation_id: formulationId,
    substance_id: formulationEnriched.substance?.id ?? null,
    route_id: formulationEnriched.route?.id ?? null,
    device_id: formulationEnriched.device?.id ?? null,
    calibration:
      calibrationDistSpec && calibrationMean != null && calibrationSource
        ? {
            source: calibrationSource,
            unit_label: parsed.normalizedUnit,
            dist: calibrationDistSpec,
            mean_volume_ml_per_unit: calibrationMean,
          }
        : null,
    compartments: {},
  }

  for (const compartment of compartments) {
    const missing = missingByCompartment.get(compartment) ?? []
    const baseId = baseFractionDistIdByCompartment.get(compartment) ?? null
    const baseRow = baseId ? distRowById.get(baseId) ?? null : null

    if (baseId && !baseRow) {
      missing.push('missing_base_bioavailability_distribution')
    }

    const multiplierIds = multipliersByCompartment.get(compartment) ?? []
    const multiplierSpecs: CanonicalDistSpec[] = []
    for (const id of multiplierIds) {
      const row = distRowById.get(id)
      if (!row) {
        missing.push('missing_multiplier_distribution')
        continue
      }
      multiplierSpecs.push(distToSpec(row))
    }
    multiplierSpecs.sort((a, b) => a.id.localeCompare(b.id))

    snapshot.compartments[compartment] = {
      base_fraction: baseRow ? distToSpec(baseRow) : null,
      multipliers: multiplierSpecs,
      // Keep snapshot stable for deterministic MC seeding.
      missing: Array.from(new Set(missing)).sort(),
    }
  }

  const canonicalJson = JSON.stringify(snapshot)
  const mcSeed = hashToSeed53(`${user.id}|${eventId}|${canonicalJson}`)
  const mcSeedNumber = Number(mcSeed)

  const n = profile.default_simulation_n
  let mcN: number | null = null

  let systemic: { p05: number; p50: number; p95: number } | null = null
  let cns: { p05: number; p50: number; p95: number } | null = null

  if (doseMassMg != null) {
    for (const compartment of compartments) {
      const baseId = baseFractionDistIdByCompartment.get(compartment) ?? null
      const baseRow = baseId ? distRowById.get(baseId) ?? null : null
      if (!baseRow) continue

      const baseDist = distributionRowToDomain(baseRow)
      if (baseDist.valueType !== 'fraction') continue

      const multiplierIds = multipliersByCompartment.get(compartment) ?? []
      const multiplierDists: Distribution[] = []
      for (const id of multiplierIds) {
        const row = distRowById.get(id)
        if (!row) continue
        const d = distributionRowToDomain(row)
        if (d.valueType !== 'multiplier') continue
        multiplierDists.push(d)
      }
      multiplierDists.sort((a, b) => a.id.localeCompare(b.id))

      const pct = simulateEffectiveDose({
        doseMg: doseMassMg,
        baseFractionDist: baseDist,
        multiplierDists,
        n,
        seed: deriveSeed(mcSeed, compartment),
      })

      mcN = n
      if (compartment === 'systemic') systemic = pct
      if (compartment === 'cns') cns = pct
    }
  }

  // Cycle assignment (MVP scaffolding): automatically assigns the new event to an active cycle and
  // auto-starts a first/new cycle when rules indicate it should. The full UX in the ExecPlan adds
  // a default-yes prompt for "new cycle?" rather than always auto-starting.
  let cycleInstanceId: string | null = null
  const substanceId = formulationEnriched.substance?.id ?? null
  if (substanceId) {
    try {
      const [cycleRule, lastEvent, activeCycle, lastCycle] = await Promise.all([
        getCycleRuleForSubstance(supabase, { substanceId }),
        getLastEventEnrichedForSubstance(supabase, { substanceId }),
        getActiveCycleForSubstance(supabase, { substanceId }),
        getLastCycleForSubstance(supabase, { substanceId }),
      ])

      const gapDaysThreshold =
        cycleRule?.gap_days_to_suggest_new_cycle ?? profile.cycle_gap_default_days
      const autoStartFirstCycle = cycleRule?.auto_start_first_cycle ?? true

      const lastEventTs = lastEvent?.ts ? new Date(lastEvent.ts) : null
      const newEventTs = new Date(eventTs)

      const action = suggestCycleAction({
        lastEventTs,
        newEventTs,
        gapDaysThreshold,
        autoStartFirstCycle,
      })

      const nextCycleNumber = (lastCycle?.cycle_number ?? 0) + 1

      if (action === 'suggest_new_cycle') {
        if (activeCycle) {
          const activeStartTs = new Date(activeCycle.start_ts)
          const endCandidate = lastEventTs ?? newEventTs
          const safeEnd = endCandidate.getTime() < activeStartTs.getTime() ? activeStartTs : endCandidate

          await completeCycleInstance(supabase, {
            cycleInstanceId: activeCycle.id,
            endTs: safeEnd.toISOString(),
          })
        }

        const newCycle = await createCycleInstance(supabase, {
          substanceId,
          cycleNumber: nextCycleNumber,
          startTs: eventTs,
          status: 'active',
          goal: null,
          notes: null,
        })
        cycleInstanceId = newCycle.id
      } else if (activeCycle) {
        cycleInstanceId = activeCycle.id
      } else if (action === 'start_first_cycle') {
        const newCycle = await createCycleInstance(supabase, {
          substanceId,
          cycleNumber: nextCycleNumber,
          startTs: eventTs,
          status: 'active',
          goal: null,
          notes: null,
        })
        cycleInstanceId = newCycle.id
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { status: 'error', message: `Cycle assignment failed: ${msg}` }
    }
  }

  const insertRes = await supabase.from('administration_events').insert({
    id: eventId,
    ts: eventTs,
    formulation_id: formulationId,
    vial_id: activeVial?.id ?? null,
    cycle_instance_id: cycleInstanceId,
    input_text: inputText,
    input_value: parsed.value,
    input_unit: parsed.unit,
    input_kind: parsed.kind,
    dose_mass_mg: doseMassMg,
    dose_volume_ml: doseVolumeMl,
    eff_systemic_p05_mg: systemic?.p05 ?? null,
    eff_systemic_p50_mg: systemic?.p50 ?? null,
    eff_systemic_p95_mg: systemic?.p95 ?? null,
    eff_cns_p05_mg: cns?.p05 ?? null,
    eff_cns_p50_mg: cns?.p50 ?? null,
    eff_cns_p95_mg: cns?.p95 ?? null,
    mc_n: mcN,
    mc_seed: mcN ? mcSeedNumber : null,
    model_snapshot: snapshot,
    cost_usd: costUsd,
  })

  if (insertRes.error) {
    return { status: 'error', message: `Failed to save event: ${insertRes.error.message}` }
  }

  revalidatePath('/today')
  return { status: 'success', message: 'Saved.', eventId }
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim()
  if (!eventId) return

  const supabase = await createClient()
  const res = await supabase
    .from('administration_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', eventId)
    .is('deleted_at', null)

  requireOk(res.error, 'administration_events.soft_delete')
  revalidatePath('/today')
  revalidatePath('/analytics')
}

export async function restoreEventAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim()
  if (!eventId) return

  const supabase = await createClient()
  const res = await supabase
    .from('administration_events')
    .update({ deleted_at: null })
    .eq('id', eventId)
    .not('deleted_at', 'is', null)

  requireOk(res.error, 'administration_events.restore')
  revalidatePath('/today')
  revalidatePath('/analytics')
}
