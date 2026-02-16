import { createHash, randomUUID } from 'node:crypto'

import { computeDose } from '@/lib/domain/dose/computeDose'
import { eventCostFromVial } from '@/lib/domain/cost/cost'
import { suggestCycleAction } from '@/lib/domain/cycles/suggest'
import { distributionMean } from '@/lib/domain/uncertainty/sample'
import { simulateEffectiveDose } from '@/lib/domain/uncertainty/monteCarlo'
import { parseQuantity, type ParsedQuantity, type QuantityKind } from '@/lib/domain/units/types'
import { toCanonicalMassMg, toCanonicalVolumeMl } from '@/lib/domain/units/canonicalize'
import type { Distribution } from '@/lib/domain/uncertainty/types'
import {
  completeCycleInstance,
  createCycleInstance,
  deleteCycleInstanceHard,
  getActiveCycleForSubstance,
  getCycleRuleForSubstance,
  getLastCycleForSubstance,
  reopenCycleInstance,
} from '@/lib/repos/cyclesRepo'
import { getBioavailabilitySpec } from '@/lib/repos/bioavailabilitySpecsRepo'
import { listComponentModifierSpecs } from '@/lib/repos/componentModifierSpecsRepo'
import { listDistributionsById, distributionRowToDomain } from '@/lib/repos/distributionsRepo'
import { getDeviceCalibration } from '@/lib/repos/deviceCalibrationsRepo'
import { getLastEventEnrichedForSubstance } from '@/lib/repos/eventsRepo'
import { listFormulationComponents } from '@/lib/repos/formulationComponentsRepo'
import { getFormulationEnrichedById } from '@/lib/repos/formulationsRepo'
import { listFormulationModifierSpecs } from '@/lib/repos/formulationModifierSpecsRepo'
import { ensureMyProfile, getMyProfile, type ProfileRow } from '@/lib/repos/profilesRepo'
import { getActiveVialForFormulation, getVialById, type VialRow } from '@/lib/repos/vialsRepo'
import type { Database } from '@/lib/supabase/database.types'
import type { DbClient } from '@/lib/repos/types'
import { safeTimeZone, utcIsoFromTodayLocalTime } from '@/lib/time/timeZone'

import { applyExplicitCompartmentOverrides } from './explicitOverrides'

export type Compartment = Extract<Database['public']['Enums']['compartment_t'], 'systemic' | 'cns'>

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
        source: 'vial_override' | 'device_calibration' | 'input_override'
        unit_label: string
        dist: CanonicalDistSpec | null
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

export type SessionCreateInput = {
  formulationId: string
  formulationName?: string
  inputText?: string
  inputKind?: QuantityKind
  inputValue?: number
  inputUnit?: string
  normalizedUnit?: string
  preferStructured?: boolean
  cycleDecision?: 'auto' | 'new_cycle' | 'continue_cycle'
  timeHHMM?: string
  ts?: string
  timezone?: string
  notes?: string | null
  tags?: string[]
  vialId?: string | null
  concentrationMgPerMl?: number
  vialContentMassMg?: number
  vialTotalVolumeMl?: number
  volumeMlPerDeviceUnit?: number
  preferDirectConcentration?: boolean
  doseMgOverride?: number | null
  compartment?: Compartment | 'both'
  baseFractionDistId?: string
  multiplierDistIds?: string[]
  systemicBaseFractionDistId?: string
  cnsBaseFractionDistId?: string
  systemicMultiplierDistIds?: string[]
  cnsMultiplierDistIds?: string[]
  mcN?: number
  mcSeed?: number | 'auto'
  deterministicSeedMode?: boolean
  strictModelCoverage?: boolean
  dryRun?: boolean
}

export type SessionComputation = {
  eventId: string
  eventTs: string
  formulationId: string
  vialId: string | null
  cycleInstanceId: string | null
  inputText: string
  inputKind: QuantityKind
  inputValue: number
  inputUnit: string
  doseMassMg: number | null
  doseVolumeMl: number | null
  effectiveDose: {
    systemic: { p05: number; p50: number; p95: number } | null
    cns: { p05: number; p50: number; p95: number } | null
  }
  mcN: number | null
  mcSeed: number | null
  modelSnapshot: CanonicalModelSnapshot
  costUsd: number | null
  notes: string | null
  tags: string[]
  warnings: string[]
}

export type SessionCreateResult =
  | { status: 'error'; message: string; warnings: string[] }
  | { status: 'confirm_new_cycle'; message: string; warnings: string[]; preview: SessionComputation }
  | { status: 'success'; message: string; warnings: string[]; saved: boolean; session: SessionComputation }

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

function compartmentsForSubstance(
  substance: { target_compartment_default: Database['public']['Enums']['compartment_t'] } | null,
): Compartment[] {
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

function safeVialContentMassMg(vial: VialRow | null): number | null {
  if (!vial) return null
  try {
    return toCanonicalMassMg(Number(vial.content_mass_value), vial.content_mass_unit)
  } catch {
    return null
  }
}

function safeVialTotalVolumeMl(vial: VialRow | null): number | null {
  if (!vial) return null
  if (vial.total_volume_value == null || vial.total_volume_unit == null) return null
  try {
    return toCanonicalVolumeMl(Number(vial.total_volume_value), vial.total_volume_unit)
  } catch {
    return null
  }
}

function toParsedFromStructured(opts: {
  inputKind: QuantityKind
  inputValue: number
  inputUnit: string
  normalizedUnit?: string
}): ParsedQuantity {
  const normalizedUnit = String(opts.normalizedUnit ?? opts.inputUnit).trim() || opts.inputUnit
  return {
    kind: opts.inputKind,
    value: opts.inputValue,
    unit: opts.inputUnit,
    normalizedUnit,
  }
}

function differsBeyondTolerance(a: number, b: number): boolean {
  const tol = 1e-6
  const scale = Math.max(1, Math.abs(a), Math.abs(b))
  return Math.abs(a - b) > tol * scale
}

function parseCreateInput(raw: SessionCreateInput):
  | { ok: true; parsed: ParsedQuantity; inputText: string }
  | { ok: false; message: string } {
  const inputText = String(raw.inputText ?? '').trim()
  const hasText = inputText.length > 0

  const hasStructured =
    raw.inputKind != null &&
    typeof raw.inputValue === 'number' &&
    Number.isFinite(raw.inputValue) &&
    raw.inputValue >= 0 &&
    typeof raw.inputUnit === 'string' &&
    raw.inputUnit.trim().length > 0

  if (!hasText && !hasStructured) {
    return { ok: false, message: 'Missing dose input (input_text or structured input fields).' }
  }

  if (hasText && hasStructured && !raw.preferStructured) {
    return {
      ok: false,
      message:
        'When both input_text and structured input fields are provided, set prefer_structured=true.',
    }
  }

  if (hasStructured && (!hasText || raw.preferStructured)) {
    const parsed = toParsedFromStructured({
      inputKind: raw.inputKind!,
      inputValue: raw.inputValue!,
      inputUnit: raw.inputUnit!.trim(),
      normalizedUnit: raw.normalizedUnit,
    })

    const text = hasText ? inputText : `${parsed.value} ${parsed.unit}`
    return { ok: true, parsed, inputText: text }
  }

  try {
    const parsed = parseQuantity(inputText)
    return { ok: true, parsed, inputText }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

function coerceIsoDateTime(raw: string): string | null {
  const value = String(raw || '').trim()
  if (!value) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function deriveEventTime(opts: {
  ts?: string
  timeHHMM?: string
  timezone?: string
  profile: ProfileRow
}): { ok: true; eventTs: string } | { ok: false; message: string } {
  const explicitTs = coerceIsoDateTime(String(opts.ts ?? ''))
  if (explicitTs) {
    return { ok: true, eventTs: explicitTs }
  }

  const timeHHMM = String(opts.timeHHMM ?? '').trim()
  if (!timeHHMM) {
    return { ok: true, eventTs: new Date().toISOString() }
  }

  try {
    const timeZone = safeTimeZone(String(opts.timezone ?? '').trim() || opts.profile.timezone)
    const eventTs = utcIsoFromTodayLocalTime({ timeZone, timeHHMM })
    return { ok: true, eventTs }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `Invalid time: ${msg}` }
  }
}

function parseCycleDecision(raw: SessionCreateInput['cycleDecision']): '' | 'new_cycle' | 'continue_cycle' {
  if (raw === 'new_cycle' || raw === 'continue_cycle') return raw
  return ''
}

function normalizeTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags ?? []) {
    const value = String(raw).trim()
    if (!value) continue
    if (seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

function toDistributionIds(ids: string[] | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids ?? []) {
    const value = String(id).trim()
    if (!value) continue
    if (seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

type CycleMutationState = {
  completedCycleId: string | null
  createdCycleIds: string[]
}

async function rollbackCycleMutations(
  supabase: DbClient,
  state: CycleMutationState,
): Promise<string[]> {
  if (!state.completedCycleId && state.createdCycleIds.length === 0) return []

  const warnings: string[] = []

  for (const cycleInstanceId of [...state.createdCycleIds].reverse()) {
    try {
      await deleteCycleInstanceHard(supabase, { cycleInstanceId })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push(`Rollback warning: failed deleting provisional cycle ${cycleInstanceId}: ${msg}`)
    }
  }

  if (state.completedCycleId) {
    try {
      await reopenCycleInstance(supabase, { cycleInstanceId: state.completedCycleId })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push(`Rollback warning: failed reopening cycle ${state.completedCycleId}: ${msg}`)
    }
  }

  return warnings
}

export async function createSession(
  supabase: DbClient,
  input: SessionCreateInput,
): Promise<SessionCreateResult> {
  const formulationId = String(input.formulationId ?? '').trim()
  if (!formulationId) {
    return { status: 'error', message: 'Missing formulation.', warnings: [] }
  }

  const parsedInput = parseCreateInput(input)
  if (!parsedInput.ok) {
    return { status: 'error', message: parsedInput.message, warnings: [] }
  }

  const cycleDecision = parseCycleDecision(input.cycleDecision)
  const warnings: string[] = []
  const cycleMutations: CycleMutationState = {
    completedCycleId: null,
    createdCycleIds: [],
  }
  const failWithRollback = async (message: string): Promise<SessionCreateResult> => {
    const rollbackWarnings = await rollbackCycleMutations(supabase, cycleMutations)
    return { status: 'error', message, warnings: [...warnings, ...rollbackWarnings] }
  }

  try {
    const userRes = await supabase.auth.getUser()
    const user = userRes.data.user
    if (!user) {
      return { status: 'error', message: 'Not authenticated.', warnings }
    }

    const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))
    const eventTime = deriveEventTime({
      ts: input.ts,
      timeHHMM: input.timeHHMM,
      timezone: input.timezone,
      profile,
    })

    if (!eventTime.ok) {
      return { status: 'error', message: eventTime.message, warnings }
    }

    const formulationEnriched = await getFormulationEnrichedById(supabase, {
      formulationId,
    })
    if (!formulationEnriched) {
      return { status: 'error', message: 'Formulation not found.', warnings }
    }

    const compartments = (() => {
      const defaultCompartments = compartmentsForSubstance(formulationEnriched.substance)
      if (!input.compartment || input.compartment === 'both') return defaultCompartments
      if (input.compartment === 'systemic') return ['systemic'] as Compartment[]
      return ['cns'] as Compartment[]
    })()

    let selectedVial: VialRow | null = null
    if (input.vialId) {
      selectedVial = await getVialById(supabase, { vialId: input.vialId })
      if (!selectedVial) {
        return { status: 'error', message: 'Specified vial was not found.', warnings }
      }
      if (selectedVial.formulation_id !== formulationId) {
        return { status: 'error', message: 'Specified vial does not belong to the selected formulation.', warnings }
      }
    } else {
      selectedVial = await getActiveVialForFormulation(supabase, {
        formulationId,
      })
    }

  // Calibration for device-units inputs.
  let calibrationDistSpec: CanonicalDistSpec | null = null
  let calibrationMean: number | null = null
  let calibrationSource: 'vial_override' | 'device_calibration' | 'input_override' | null = null

  const parsed = parsedInput.parsed
  if (parsed.kind === 'device_units') {
    if (typeof input.volumeMlPerDeviceUnit === 'number' && input.volumeMlPerDeviceUnit > 0) {
      calibrationMean = input.volumeMlPerDeviceUnit
      calibrationSource = 'input_override'
    } else {
      const routeId = formulationEnriched.formulation.route_id
      const deviceId = formulationEnriched.formulation.device_id
      const unitLabel = parsed.normalizedUnit

      const distId =
        selectedVial?.volume_ml_per_unit_override_dist_id ??
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
            'Device-units input requires a calibration (set a device calibration, per-vial override, or provide volume_ml_per_device_unit).',
          warnings,
        }
      }

      const distRows = await listDistributionsById(supabase, { distributionIds: [distId] })
      const distRow = distRows[0]
      if (!distRow) {
        return { status: 'error', message: 'Calibration distribution not found.', warnings }
      }

      const domain = distributionRowToDomain(distRow)
      if (domain.valueType !== 'volume_ml_per_unit') {
        return { status: 'error', message: 'Calibration distribution has the wrong value_type.', warnings }
      }

      calibrationDistSpec = distToSpec(distRow)
      calibrationMean = distributionMean(domain)
      calibrationSource =
        selectedVial?.volume_ml_per_unit_override_dist_id != null ? 'vial_override' : 'device_calibration'
    }
  }

  const selectedVialContentMassMg = safeVialContentMassMg(selectedVial)
  const selectedVialTotalVolumeMl = safeVialTotalVolumeMl(selectedVial)

  const vialContentMassMg =
    typeof input.vialContentMassMg === 'number' && input.vialContentMassMg > 0
      ? input.vialContentMassMg
      : selectedVialContentMassMg

  const vialTotalVolumeMl =
    typeof input.vialTotalVolumeMl === 'number' && input.vialTotalVolumeMl > 0
      ? input.vialTotalVolumeMl
      : selectedVialTotalVolumeMl

  let concentrationMgPerMl: number | null =
    typeof input.concentrationMgPerMl === 'number' && input.concentrationMgPerMl > 0
      ? input.concentrationMgPerMl
      : selectedVial?.concentration_mg_per_ml ?? null

  if (vialContentMassMg != null && vialTotalVolumeMl != null && vialTotalVolumeMl > 0) {
    const derived = vialContentMassMg / vialTotalVolumeMl
    if (concentrationMgPerMl == null) {
      concentrationMgPerMl = derived
    } else if (differsBeyondTolerance(concentrationMgPerMl, derived)) {
      if (!input.preferDirectConcentration) {
        return {
          status: 'error',
          message:
            'Direct and vial-derived concentration values differ. Set prefer_direct_concentration=true to continue with direct concentration.',
          warnings,
        }
      }
    }
  }

  let doseMassMg: number | null
  let doseVolumeMl: number | null

  try {
    const doseRes = computeDose({
      inputText: parsedInput.inputText,
      inputKind: parsed.kind,
      inputValue: parsed.value,
      inputUnit: parsed.unit,
      vial: {
        contentMassMg: vialContentMassMg,
        totalVolumeMl: vialTotalVolumeMl,
        concentrationMgPerMl,
      },
      volumeMlPerDeviceUnit: calibrationMean,
    })

    doseMassMg = doseRes.doseMassMg
    doseVolumeMl = doseRes.doseVolumeMl
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg, warnings }
  }

  if (parsed.kind === 'device_units' && doseVolumeMl == null) {
    return {
      status: 'error',
      message: 'Could not compute dose from device units (missing or invalid calibration).',
      warnings,
    }
  }

  if (typeof input.doseMgOverride === 'number' && Number.isFinite(input.doseMgOverride) && input.doseMgOverride >= 0) {
    doseMassMg = input.doseMgOverride
  }

  const costUsd = eventCostFromVial({
    doseMassMg,
    doseVolumeMl,
    vialContentMassMg,
    vialTotalVolumeMl,
    vialCostUsd: selectedVial?.cost_usd ?? null,
  })

  // Cycle assignment logic.
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
      const newEventTs = new Date(eventTime.eventTs)

      const action = suggestCycleAction({
        lastEventTs,
        newEventTs,
        gapDaysThreshold,
        autoStartFirstCycle,
      })

      const nextCycleNumber = (lastCycle?.cycle_number ?? 0) + 1

      if (action === 'suggest_new_cycle') {
        if (activeCycle) {
          if (!lastEventTs) {
            throw new Error('Internal error: suggest_new_cycle requires lastEventTs.')
          }

          const activeStartTs = new Date(activeCycle.start_ts)
          if (activeStartTs.getTime() > lastEventTs.getTime()) {
            cycleInstanceId = activeCycle.id
          } else {
            if (!cycleDecision) {
              const msPerDay = 24 * 60 * 60 * 1000
              const gapDays = (newEventTs.getTime() - lastEventTs.getTime()) / msPerDay
              const gapDaysLabel = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
                gapDays,
              )
              const gapThresholdLabel = new Intl.NumberFormat(undefined, {
                maximumFractionDigits: 1,
              }).format(gapDaysThreshold)
              const substanceLabel = formulationEnriched.substance?.display_name ?? 'this substance'

              const preview: SessionComputation = {
                eventId: randomUUID(),
                eventTs: eventTime.eventTs,
                formulationId,
                vialId: selectedVial?.id ?? null,
                cycleInstanceId: activeCycle.id,
                inputText: parsedInput.inputText,
                inputKind: parsed.kind,
                inputValue: parsed.value,
                inputUnit: parsed.unit,
                doseMassMg,
                doseVolumeMl,
                effectiveDose: { systemic: null, cns: null },
                mcN: null,
                mcSeed: null,
                modelSnapshot: {
                  version: 1,
                  formulation_id: formulationId,
                  substance_id: formulationEnriched.substance?.id ?? null,
                  route_id: formulationEnriched.route?.id ?? null,
                  device_id: formulationEnriched.device?.id ?? null,
                  calibration: null,
                  compartments: {},
                },
                costUsd,
                notes: String(input.notes ?? '').trim() || null,
                tags: normalizeTags(input.tags),
                warnings,
              }

              return {
                status: 'confirm_new_cycle',
                message: `New cycle for ${substanceLabel}? Gap since last event is ${gapDaysLabel} days (threshold ${gapThresholdLabel}).`,
                warnings,
                preview,
              }
            }

            if (cycleDecision === 'continue_cycle') {
              cycleInstanceId = activeCycle.id
            } else {
              const endCandidate = lastEventTs
              const safeEnd =
                endCandidate.getTime() < activeStartTs.getTime() ? activeStartTs : endCandidate

              if (!input.dryRun) {
                await completeCycleInstance(supabase, {
                  cycleInstanceId: activeCycle.id,
                  endTs: safeEnd.toISOString(),
                })
                cycleMutations.completedCycleId = activeCycle.id
              }

              if (!input.dryRun) {
                const newCycle = await createCycleInstance(supabase, {
                  substanceId,
                  cycleNumber: nextCycleNumber,
                  startTs: eventTime.eventTs,
                  status: 'active',
                  goal: null,
                  notes: null,
                })
                cycleInstanceId = newCycle.id
                cycleMutations.createdCycleIds.push(newCycle.id)
              } else {
                cycleInstanceId = randomUUID()
              }
            }
          }
        } else {
          if (!input.dryRun) {
            const newCycle = await createCycleInstance(supabase, {
              substanceId,
              cycleNumber: nextCycleNumber,
              startTs: eventTime.eventTs,
              status: 'active',
              goal: null,
              notes: null,
            })
            cycleInstanceId = newCycle.id
            cycleMutations.createdCycleIds.push(newCycle.id)
          } else {
            cycleInstanceId = randomUUID()
          }
        }
      } else if (activeCycle) {
        cycleInstanceId = activeCycle.id
      } else if (action === 'start_first_cycle') {
        if (!input.dryRun) {
          const newCycle = await createCycleInstance(supabase, {
            substanceId,
            cycleNumber: nextCycleNumber,
            startTs: eventTime.eventTs,
            status: 'active',
            goal: null,
            notes: null,
          })
          cycleInstanceId = newCycle.id
          cycleMutations.createdCycleIds.push(newCycle.id)
        } else {
          cycleInstanceId = randomUUID()
        }
      } else if (lastCycle?.status === 'completed' || lastCycle?.status === 'abandoned') {
        if (!input.dryRun) {
          const newCycle = await createCycleInstance(supabase, {
            substanceId,
            cycleNumber: nextCycleNumber,
            startTs: eventTime.eventTs,
            status: 'active',
            goal: null,
            notes: null,
          })
          cycleInstanceId = newCycle.id
          cycleMutations.createdCycleIds.push(newCycle.id)
        } else {
          cycleInstanceId = randomUUID()
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return failWithRollback(`Cycle assignment failed: ${msg}`)
    }
  }

  // Resolve distributions needed for MC.
  const multipliersByCompartment = new Map<Compartment, string[]>()
  const baseFractionDistIdByCompartment = new Map<Compartment, string | null>()
  const missingByCompartment = new Map<Compartment, string[]>()

  const explicitGlobalBase = String(input.baseFractionDistId ?? '').trim() || null
  const explicitGlobalMultipliers = toDistributionIds(input.multiplierDistIds)
  const explicitSystemicBase = String(input.systemicBaseFractionDistId ?? '').trim() || null
  const explicitCnsBase = String(input.cnsBaseFractionDistId ?? '').trim() || null
  const explicitSystemicMultipliers = toDistributionIds(input.systemicMultiplierDistIds)
  const explicitCnsMultipliers = toDistributionIds(input.cnsMultiplierDistIds)

  const modifierCompartments: Database['public']['Enums']['compartment_t'][] = Array.from(
    new Set<Database['public']['Enums']['compartment_t']>([...compartments, 'both']),
  )

  const [components, formulationModsAll] = await Promise.all([
    listFormulationComponents({ supabase, formulationId }),
    listFormulationModifierSpecs({ supabase, formulationId, compartments: modifierCompartments }),
  ])

  const componentIds = components.map((c) => c.id)
  const componentSpecsAll = await listComponentModifierSpecs({
    supabase,
    formulationComponentIds: componentIds,
    compartments: modifierCompartments,
  })

  const componentSpecsByComponentId = new Map<string, typeof componentSpecsAll>()
  for (const spec of componentSpecsAll) {
    const arr = componentSpecsByComponentId.get(spec.formulation_component_id) ?? []
    arr.push(spec)
    componentSpecsByComponentId.set(spec.formulation_component_id, arr)
  }

  const baseSpecByCompartment = new Map<Compartment, Awaited<ReturnType<typeof getBioavailabilitySpec>>>()
  if (formulationEnriched.substance && formulationEnriched.route) {
    const baseSpecs = await Promise.all(
      compartments.map((compartment) =>
        getBioavailabilitySpec({
          supabase,
          substanceId: formulationEnriched.substance!.id,
          routeId: formulationEnriched.route!.id,
          compartment,
        }),
      ),
    )
    for (let i = 0; i < compartments.length; i++) {
      baseSpecByCompartment.set(compartments[i]!, baseSpecs[i] ?? null)
    }
  } else {
    for (const compartment of compartments) {
      baseSpecByCompartment.set(compartment, null)
    }
  }

  for (const compartment of compartments) {
    const missing: string[] = []

    const baseSpec = baseSpecByCompartment.get(compartment) ?? null
    if (!baseSpec) {
      baseFractionDistIdByCompartment.set(compartment, null)
      missing.push('missing_base_bioavailability_spec')
    } else {
      baseFractionDistIdByCompartment.set(compartment, baseSpec.base_fraction_dist_id)
    }

    const formulationMultiplierIds = formulationModsAll
      .filter((m) => m.compartment === compartment || m.compartment === 'both')
      .map((m) => m.multiplier_dist_id)

    const componentMultiplierIds: string[] = []
    for (const c of components) {
      const specsForComponent = (componentSpecsByComponentId.get(c.id) ?? []).filter(
        (s) => s.compartment === compartment || s.compartment === 'both',
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

  applyExplicitCompartmentOverrides({
    compartments,
    baseFractionDistIdByCompartment,
    multipliersByCompartment,
    missingByCompartment,
    explicitGlobalBase,
    explicitGlobalMultipliers,
    explicitSystemicBase,
    explicitCnsBase,
    explicitSystemicMultipliers,
    explicitCnsMultipliers,
  })

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
      calibrationMean != null && calibrationSource
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
    const missing = [...(missingByCompartment.get(compartment) ?? [])]
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
      missing: Array.from(new Set(missing)).sort(),
    }
  }

  const eventId = randomUUID()

  const canonicalJson = JSON.stringify(snapshot)
  const deterministicSeedInput = JSON.stringify({
    formulationId,
    eventTs: eventTime.eventTs,
    inputText: parsedInput.inputText,
    inputKind: parsed.kind,
    inputValue: parsed.value,
    inputUnit: parsed.unit,
    doseMassMg,
    mcN: input.mcN ?? profile.default_simulation_n,
  })

  const baseSeed = (() => {
    if (typeof input.mcSeed === 'number' && Number.isInteger(input.mcSeed) && input.mcSeed >= 0) {
      return BigInt(input.mcSeed)
    }

    if (input.mcSeed === 'auto' || input.deterministicSeedMode) {
      return hashToSeed53(`${user.id}|${deterministicSeedInput}|${canonicalJson}`)
    }

    return hashToSeed53(`${user.id}|${eventId}|${canonicalJson}`)
  })()

  const mcSeedNumber = Number(baseSeed)

  const n = typeof input.mcN === 'number' && Number.isInteger(input.mcN) && input.mcN > 0
    ? input.mcN
    : profile.default_simulation_n
  let mcN: number | null = null

  let systemic: { p05: number; p50: number; p95: number } | null = null
  let cns: { p05: number; p50: number; p95: number } | null = null

  if (doseMassMg != null) {
    for (const compartment of compartments) {
      const baseId = baseFractionDistIdByCompartment.get(compartment) ?? null
      const baseRow = baseId ? distRowById.get(baseId) ?? null : null
      if (!baseRow) {
        const msg = `Model coverage missing for compartment: ${compartment}`
        if (input.strictModelCoverage) {
          return failWithRollback(msg)
        }
        warnings.push(msg)
        continue
      }

      const baseDist = distributionRowToDomain(baseRow)
      if (baseDist.valueType !== 'fraction') {
        const msg = `Base distribution for ${compartment} must be a fraction distribution.`
        if (input.strictModelCoverage) {
          return failWithRollback(msg)
        }
        warnings.push(msg)
        continue
      }

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
        seed: deriveSeed(baseSeed, compartment),
      })

      mcN = n
      if (compartment === 'systemic') systemic = pct
      if (compartment === 'cns') cns = pct
    }
  }

  const session: SessionComputation = {
    eventId,
    eventTs: eventTime.eventTs,
    formulationId,
    vialId: selectedVial?.id ?? null,
    cycleInstanceId,
    inputText: parsedInput.inputText,
    inputKind: parsed.kind,
    inputValue: parsed.value,
    inputUnit: parsed.unit,
    doseMassMg,
    doseVolumeMl,
    effectiveDose: {
      systemic,
      cns,
    },
    mcN,
    mcSeed: mcN ? mcSeedNumber : null,
    modelSnapshot: snapshot,
    costUsd,
    notes: String(input.notes ?? '').trim() || null,
    tags: normalizeTags(input.tags),
    warnings: [...warnings],
  }

  if (input.dryRun) {
    return {
      status: 'success',
      message: 'Dry run complete.',
      warnings,
      saved: false,
      session,
    }
  }

  const insertRes = await supabase.from('administration_events').insert({
    id: eventId,
    ts: eventTime.eventTs,
    formulation_id: formulationId,
    vial_id: selectedVial?.id ?? null,
    cycle_instance_id: cycleInstanceId,
    input_text: parsedInput.inputText,
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
    notes: session.notes,
    tags: session.tags,
  })

  if (insertRes.error) {
    return failWithRollback(`Failed to save event: ${insertRes.error.message}`)
  }

    return {
      status: 'success',
      message: 'Saved.',
      warnings,
      saved: true,
      session,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return failWithRollback(`Session creation failed: ${msg}`)
  }
}
