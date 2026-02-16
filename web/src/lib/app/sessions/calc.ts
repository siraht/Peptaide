import { createHash } from 'node:crypto'

import { computeDose } from '@/lib/domain/dose/computeDose'
import { composeBioavailability, simulateEffectiveDose } from '@/lib/domain/uncertainty/monteCarlo'
import { distributionMean } from '@/lib/domain/uncertainty/sample'
import type { Distribution } from '@/lib/domain/uncertainty/types'
import { parseQuantity, type ParsedQuantity } from '@/lib/domain/units/types'
import { listComponentModifierSpecs } from '@/lib/repos/componentModifierSpecsRepo'
import { listDistributionsById, distributionRowToDomain } from '@/lib/repos/distributionsRepo'
import { listFormulationComponents } from '@/lib/repos/formulationComponentsRepo'
import { getFormulationEnrichedById } from '@/lib/repos/formulationsRepo'
import { listFormulationModifierSpecs } from '@/lib/repos/formulationModifierSpecsRepo'
import { getBioavailabilitySpec } from '@/lib/repos/bioavailabilitySpecsRepo'
import type { DbClient } from '@/lib/repos/types'

import type { CalcDoseRequest, CalcEffectiveRequest } from '@/lib/api/contracts/cli'

type Compartment = 'systemic' | 'cns'

export type CalcDoseResult = {
  parsed: ParsedQuantity
  input_text: string
  dose_mg: number | null
  dose_volume_ml: number | null
  concentration_mg_per_ml: number | null
  warnings: string[]
}

export type EffectiveCompartmentResult = {
  compartment: Compartment
  p05_mg: number | null
  p50_mg: number | null
  p95_mg: number | null
  base_fraction_mean: number | null
  multiplier_mean: number | null
}

export type CalcEffectiveResult = {
  dose_mg: number | null
  mc_n: number
  mc_seed: number
  compartment_results: EffectiveCompartmentResult[]
  warnings: string[]
}

function hashToSeed53(input: string): number {
  const digest = createHash('sha256').update(input).digest()
  let x = 0n
  for (let i = 0; i < 8; i++) {
    x = (x << 8n) + BigInt(digest[i] ?? 0)
  }
  const masked = x & ((1n << 53n) - 1n)
  return Number(masked)
}

function deriveSeed(base: number, label: string): bigint {
  return BigInt(hashToSeed53(`${base}|${label}`))
}

function selectCompartments(value: CalcEffectiveRequest['compartment']): Compartment[] {
  if (value === 'both') return ['systemic', 'cns']
  if (value === 'cns') return ['cns']
  return ['systemic']
}

function parseInput(request: {
  input_text?: string
  input_kind?: CalcDoseRequest['input_kind']
  input_value?: number
  input_unit?: string
  normalized_unit?: string
  prefer_structured?: boolean
}): ParsedQuantity {
  const inputText = String(request.input_text ?? '').trim()
  const hasText = inputText.length > 0

  const hasStructured =
    request.input_kind != null &&
    typeof request.input_value === 'number' &&
    Number.isFinite(request.input_value) &&
    request.input_value >= 0 &&
    typeof request.input_unit === 'string' &&
    request.input_unit.trim().length > 0

  if (!hasText && !hasStructured) {
    throw new Error('Provide input_text or structured input_kind/input_value/input_unit.')
  }

  if (hasText && hasStructured && !request.prefer_structured) {
    throw new Error('Set prefer_structured=true when both text and structured inputs are provided.')
  }

  if (hasStructured && (!hasText || request.prefer_structured)) {
    return {
      kind: request.input_kind!,
      value: request.input_value!,
      unit: request.input_unit!,
      normalizedUnit: String(request.normalized_unit ?? request.input_unit).trim() || request.input_unit!,
    }
  }

  return parseQuantity(inputText)
}

function inferConcentration(request: CalcDoseRequest): { concentration: number | null; warnings: string[] } {
  const warnings: string[] = []
  const direct =
    typeof request.concentration_mg_per_ml === 'number' && request.concentration_mg_per_ml > 0
      ? request.concentration_mg_per_ml
      : null

  const derived =
    typeof request.vial_content_mass_mg === 'number' &&
    request.vial_content_mass_mg > 0 &&
    typeof request.vial_total_volume_ml === 'number' &&
    request.vial_total_volume_ml > 0
      ? request.vial_content_mass_mg / request.vial_total_volume_ml
      : null

  if (direct != null && derived != null) {
    const diff = Math.abs(direct - derived)
    const scale = Math.max(1, Math.abs(direct), Math.abs(derived))
    if (diff > 1e-6 * scale && !request.prefer_direct_concentration) {
      throw new Error(
        'Direct and vial-derived concentration differ. Set prefer_direct_concentration=true to continue with direct value.',
      )
    }
  }

  if (direct != null) return { concentration: direct, warnings }
  if (derived != null) {
    warnings.push('Using vial-derived concentration (vial_content_mass_mg / vial_total_volume_ml).')
    return { concentration: derived, warnings }
  }

  warnings.push('No concentration provided; mass/volume conversion may be null for some input kinds.')
  return { concentration: null, warnings }
}

export function calcParse(text: string): ParsedQuantity {
  return parseQuantity(text)
}

export function calcDose(request: CalcDoseRequest): CalcDoseResult {
  const parsed = parseInput(request)
  const inputText = String(request.input_text ?? '').trim() || `${parsed.value} ${parsed.unit}`
  const conc = inferConcentration(request)

  const result = computeDose({
    inputText,
    inputKind: parsed.kind,
    inputValue: parsed.value,
    inputUnit: parsed.unit,
    vial: {
      contentMassMg:
        typeof request.vial_content_mass_mg === 'number' && request.vial_content_mass_mg > 0
          ? request.vial_content_mass_mg
          : null,
      totalVolumeMl:
        typeof request.vial_total_volume_ml === 'number' && request.vial_total_volume_ml > 0
          ? request.vial_total_volume_ml
          : null,
      concentrationMgPerMl: conc.concentration,
    },
    volumeMlPerDeviceUnit:
      typeof request.volume_ml_per_device_unit === 'number' && request.volume_ml_per_device_unit > 0
        ? request.volume_ml_per_device_unit
        : null,
  })

  if (parsed.kind === 'device_units' && result.doseVolumeMl == null) {
    throw new Error('device_units input requires volume_ml_per_device_unit calibration.')
  }

  return {
    parsed,
    input_text: inputText,
    dose_mg: result.doseMassMg,
    dose_volume_ml: result.doseVolumeMl,
    concentration_mg_per_ml: conc.concentration,
    warnings: conc.warnings,
  }
}

async function resolveModelFromContext(opts: {
  supabase: DbClient
  formulationId?: string
  substanceId?: string
  routeId?: string
  compartments: Compartment[]
}): Promise<{
  baseByCompartment: Map<Compartment, string | null>
  multipliersByCompartment: Map<Compartment, string[]>
}> {
  const { supabase, formulationId, substanceId, routeId, compartments } = opts

  const baseByCompartment = new Map<Compartment, string | null>()
  const multipliersByCompartment = new Map<Compartment, string[]>()

  if (formulationId) {
    const formulationEnriched = await getFormulationEnrichedById(supabase, { formulationId })
    if (!formulationEnriched?.substance || !formulationEnriched.route) {
      for (const compartment of compartments) {
        baseByCompartment.set(compartment, null)
        multipliersByCompartment.set(compartment, [])
      }
      return { baseByCompartment, multipliersByCompartment }
    }

    const modifierCompartments = Array.from(new Set([...compartments, 'both'])) as Array<
      Compartment | 'both'
    >

    const [components, formulationModsAll] = await Promise.all([
      listFormulationComponents({ supabase, formulationId }),
      listFormulationModifierSpecs({
        supabase,
        formulationId,
        compartments: modifierCompartments,
      }),
    ])

    const componentIds = components.map((c) => c.id)
    const componentSpecsAll = await listComponentModifierSpecs({
      supabase,
      formulationComponentIds: componentIds,
      compartments: modifierCompartments,
    })

    const componentSpecsByComponentId = new Map<string, typeof componentSpecsAll>()
    for (const spec of componentSpecsAll) {
      const list = componentSpecsByComponentId.get(spec.formulation_component_id) ?? []
      list.push(spec)
      componentSpecsByComponentId.set(spec.formulation_component_id, list)
    }

    for (const compartment of compartments) {
      const baseSpec = await getBioavailabilitySpec({
        supabase,
        substanceId: formulationEnriched.substance.id,
        routeId: formulationEnriched.route.id,
        compartment,
      })

      baseByCompartment.set(compartment, baseSpec?.base_fraction_dist_id ?? null)

      const formulationMultiplierIds = formulationModsAll
        .filter((m) => m.compartment === compartment || m.compartment === 'both')
        .map((m) => m.multiplier_dist_id)

      const componentMultiplierIds: string[] = []
      for (const component of components) {
        const specs = (componentSpecsByComponentId.get(component.id) ?? []).filter(
          (s) => s.compartment === compartment || s.compartment === 'both',
        )
        if (specs.length > 0) {
          componentMultiplierIds.push(...specs.map((s) => s.multiplier_dist_id))
        } else if (component.modifier_dist_id) {
          componentMultiplierIds.push(component.modifier_dist_id)
        }
      }

      multipliersByCompartment.set(compartment, [...formulationMultiplierIds, ...componentMultiplierIds])
    }

    return { baseByCompartment, multipliersByCompartment }
  }

  if (!substanceId || !routeId) {
    throw new Error(
      'Provide formulation_id or substance_id+route_id when explicit distributions are not supplied.',
    )
  }

  for (const compartment of compartments) {
    const baseSpec = await getBioavailabilitySpec({
      supabase,
      substanceId,
      routeId,
      compartment,
    })

    baseByCompartment.set(compartment, baseSpec?.base_fraction_dist_id ?? null)
    multipliersByCompartment.set(compartment, [])
  }

  return { baseByCompartment, multipliersByCompartment }
}

export async function calcEffective(
  supabase: DbClient,
  request: CalcEffectiveRequest,
): Promise<CalcEffectiveResult> {
  const doseResult =
    typeof request.dose_mg === 'number' && request.dose_mg >= 0
      ? {
          dose_mg: request.dose_mg,
          warnings: [] as string[],
        }
      : (() => {
          const d = calcDose(request)
          return {
            dose_mg: d.dose_mg,
            warnings: d.warnings,
          }
        })()

  const warnings: string[] = [...doseResult.warnings]

  if (doseResult.dose_mg == null) {
    warnings.push('Dose mass is null; effective dose estimates cannot be computed.')
  }

  const compartments = selectCompartments(request.compartment)

  const baseByCompartment = new Map<Compartment, string | null>()
  const multipliersByCompartment = new Map<Compartment, string[]>()

  const hasScopedExplicit =
    typeof request.systemic_base_fraction_dist_id === 'string' ||
    typeof request.cns_base_fraction_dist_id === 'string' ||
    (request.systemic_multiplier_dist_id?.length ?? 0) > 0 ||
    (request.cns_multiplier_dist_id?.length ?? 0) > 0

  const hasGlobalExplicit =
    typeof request.base_fraction_dist_id === 'string' || (request.multiplier_dist_id?.length ?? 0) > 0

  if (hasScopedExplicit) {
    if (compartments.includes('systemic')) {
      baseByCompartment.set('systemic', request.systemic_base_fraction_dist_id ?? null)
      multipliersByCompartment.set('systemic', request.systemic_multiplier_dist_id ?? [])
    }
    if (compartments.includes('cns')) {
      baseByCompartment.set('cns', request.cns_base_fraction_dist_id ?? null)
      multipliersByCompartment.set('cns', request.cns_multiplier_dist_id ?? [])
    }
  } else if (hasGlobalExplicit) {
    for (const compartment of compartments) {
      baseByCompartment.set(compartment, request.base_fraction_dist_id ?? null)
      multipliersByCompartment.set(compartment, request.multiplier_dist_id ?? [])
    }
  } else {
    const resolved = await resolveModelFromContext({
      supabase,
      formulationId: request.formulation_id,
      substanceId: request.substance_id,
      routeId: request.route_id,
      compartments,
    })

    for (const compartment of compartments) {
      baseByCompartment.set(compartment, resolved.baseByCompartment.get(compartment) ?? null)
      multipliersByCompartment.set(compartment, resolved.multipliersByCompartment.get(compartment) ?? [])
    }
  }

  const distIds = new Set<string>()
  for (const compartment of compartments) {
    const base = baseByCompartment.get(compartment)
    if (base) distIds.add(base)
    for (const id of multipliersByCompartment.get(compartment) ?? []) distIds.add(id)
  }

  const distRows = await listDistributionsById(supabase, { distributionIds: [...distIds] })
  const distById = new Map(distRows.map((row) => [row.id, row] as const))

  const mcN =
    typeof request.mc_n === 'number' && Number.isInteger(request.mc_n) && request.mc_n > 0
      ? request.mc_n
      : 2048

  const mcSeed =
    typeof request.mc_seed === 'number'
      ? request.mc_seed
      : request.mc_seed === 'auto'
        ? hashToSeed53(JSON.stringify(request))
        : hashToSeed53(JSON.stringify({ request, mcN }))

  const compartmentResults: EffectiveCompartmentResult[] = []

  for (const compartment of compartments) {
    const baseId = baseByCompartment.get(compartment) ?? null
    const baseRow = baseId ? distById.get(baseId) ?? null : null
    if (!baseRow) {
      const msg = `Missing base fraction distribution for ${compartment}.`
      if (request.strict_model_coverage) {
        throw new Error(msg)
      }
      warnings.push(msg)
      compartmentResults.push({
        compartment,
        p05_mg: null,
        p50_mg: null,
        p95_mg: null,
        base_fraction_mean: null,
        multiplier_mean: null,
      })
      continue
    }

    const baseDist = distributionRowToDomain(baseRow)
    if (baseDist.valueType !== 'fraction') {
      throw new Error(`Base distribution for ${compartment} must have value_type=fraction.`)
    }

    const multiplierDists: Distribution[] = []
    for (const id of multipliersByCompartment.get(compartment) ?? []) {
      const row = distById.get(id)
      if (!row) continue
      const dist = distributionRowToDomain(row)
      if (dist.valueType !== 'multiplier') continue
      multiplierDists.push(dist)
    }
    multiplierDists.sort((a, b) => a.id.localeCompare(b.id))

    if (doseResult.dose_mg == null) {
      compartmentResults.push({
        compartment,
        p05_mg: null,
        p50_mg: null,
        p95_mg: null,
        base_fraction_mean: distributionMean(baseDist),
        multiplier_mean: multiplierDists.reduce((acc, curr) => acc * distributionMean(curr), 1),
      })
      continue
    }

    const pct = simulateEffectiveDose({
      doseMg: doseResult.dose_mg,
      baseFractionDist: baseDist,
      multiplierDists,
      n: mcN,
      seed: deriveSeed(mcSeed, compartment),
    })

    compartmentResults.push({
      compartment,
      p05_mg: pct.p05,
      p50_mg: pct.p50,
      p95_mg: pct.p95,
      base_fraction_mean: distributionMean(baseDist),
      multiplier_mean: multiplierDists.reduce((acc, curr) => acc * distributionMean(curr), 1),
    })
  }

  return {
    dose_mg: doseResult.dose_mg,
    mc_n: mcN,
    mc_seed: mcSeed,
    compartment_results: compartmentResults,
    warnings,
  }
}

export function estimateEffectiveDoseMean(opts: {
  doseMg: number
  baseFraction: number
  multipliers: number[]
}): number {
  return opts.doseMg * composeBioavailability(opts.baseFraction, opts.multipliers)
}
