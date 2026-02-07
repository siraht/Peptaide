'use server'

import { revalidatePath } from 'next/cache'

import { createDistribution } from '@/lib/repos/distributionsRepo'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type CreateDistributionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function isValueType(x: string): x is Database['public']['Enums']['distribution_value_type_t'] {
  return x === 'fraction' || x === 'multiplier' || x === 'volume_ml_per_unit' || x === 'other'
}

function isDistType(x: string): x is Database['public']['Enums']['distribution_dist_type_t'] {
  return x === 'point' || x === 'uniform' || x === 'triangular' || x === 'beta_pert' || x === 'lognormal'
}

function mustNumber(raw: string, label: string): number {
  const x = Number(raw)
  if (!Number.isFinite(x)) {
    throw new Error(`${label} must be a number.`)
  }
  return x
}

function maybeNumber(raw: string, label: string): number | null {
  const t = raw.trim()
  if (!t) return null
  return mustNumber(t, label)
}

export async function createDistributionAction(
  _prev: CreateDistributionState,
  formData: FormData,
): Promise<CreateDistributionState> {
  const name = String(formData.get('name') ?? '').trim()
  const valueType = String(formData.get('value_type') ?? '').trim()
  const distType = String(formData.get('dist_type') ?? '').trim()
  const p1Raw = String(formData.get('p1') ?? '').trim()
  const p2Raw = String(formData.get('p2') ?? '').trim()
  const p3Raw = String(formData.get('p3') ?? '').trim()
  const minRaw = String(formData.get('min_value') ?? '').trim()
  const maxRaw = String(formData.get('max_value') ?? '').trim()
  const units = String(formData.get('units') ?? '').trim()
  const qualityScoreRaw = String(formData.get('quality_score') ?? '').trim()
  const evidenceSummary = String(formData.get('evidence_summary') ?? '').trim()

  if (!name) return { status: 'error', message: 'name is required.' }
  if (!isValueType(valueType)) return { status: 'error', message: 'Invalid value_type.' }
  if (!isDistType(distType)) return { status: 'error', message: 'Invalid dist_type.' }

  const qualityScore = qualityScoreRaw ? Number(qualityScoreRaw) : 0
  if (!Number.isInteger(qualityScore) || qualityScore < 0 || qualityScore > 5) {
    return { status: 'error', message: 'quality_score must be an integer 0-5.' }
  }

  let p1: number | null = null
  let p2: number | null = null
  let p3: number | null = null
  let minValue: number | null = null
  let maxValue: number | null = null

  try {
    switch (distType) {
      case 'point': {
        p1 = mustNumber(p1Raw, 'value')
        break
      }
      case 'uniform': {
        minValue = mustNumber(minRaw, 'min_value')
        maxValue = mustNumber(maxRaw, 'max_value')
        if (minValue > maxValue) throw new Error('min_value must be <= max_value.')
        break
      }
      case 'triangular':
      case 'beta_pert': {
        p1 = mustNumber(p1Raw, 'min')
        p2 = mustNumber(p2Raw, 'mode')
        p3 = mustNumber(p3Raw, 'max')
        if (!(p1 < p3)) throw new Error('min must be < max.')
        if (!(p1 <= p2 && p2 <= p3)) throw new Error('mode must be between min and max.')
        break
      }
      case 'lognormal': {
        p1 = mustNumber(p1Raw, 'median')
        p2 = mustNumber(p2Raw, 'log_sigma')
        if (!(p1 > 0)) throw new Error('median must be > 0.')
        if (!(p2 >= 0)) throw new Error('log_sigma must be >= 0.')
        minValue = maybeNumber(minRaw, 'min_value (clamp)')
        maxValue = maybeNumber(maxRaw, 'max_value (clamp)')
        if (minValue != null && !(minValue > 0)) throw new Error('min_value (clamp) must be > 0.')
        if (maxValue != null && !(maxValue > 0)) throw new Error('max_value (clamp) must be > 0.')
        if (minValue != null && maxValue != null && minValue > maxValue) {
          throw new Error('min_value (clamp) must be <= max_value (clamp).')
        }
        break
      }
    }

    // Basic safety checks aligned with DB constraints; DB remains the final authority.
    if (valueType === 'fraction') {
      if (distType === 'lognormal') throw new Error('fraction distributions cannot be lognormal.')
      if (distType === 'point' && !(p1 != null && p1 >= 0 && p1 <= 1)) {
        throw new Error('fraction value must be in [0,1].')
      }
      if (distType === 'uniform' && !((minValue ?? 0) >= 0 && (maxValue ?? 1) <= 1)) {
        throw new Error('fraction uniform bounds must be within [0,1].')
      }
      if ((distType === 'triangular' || distType === 'beta_pert') && !((p1 ?? 0) >= 0 && (p3 ?? 1) <= 1)) {
        throw new Error('fraction min/max must be within [0,1].')
      }
    }

    if (valueType === 'multiplier') {
      if (distType === 'point' && !(p1 != null && p1 >= 0)) throw new Error('multiplier value must be >= 0.')
      if (distType === 'uniform' && !(minValue != null && minValue >= 0)) {
        throw new Error('multiplier min_value must be >= 0.')
      }
      if ((distType === 'triangular' || distType === 'beta_pert') && !(p1 != null && p1 >= 0)) {
        throw new Error('multiplier min must be >= 0.')
      }
      if (distType === 'lognormal' && !(p1 != null && p1 > 0)) throw new Error('multiplier median must be > 0.')
    }

    if (valueType === 'volume_ml_per_unit') {
      if (distType === 'point' && !(p1 != null && p1 > 0)) throw new Error('volume_ml_per_unit must be > 0.')
      if (distType === 'uniform' && !(minValue != null && minValue > 0)) {
        throw new Error('volume_ml_per_unit min_value must be > 0.')
      }
      if ((distType === 'triangular' || distType === 'beta_pert') && !(p1 != null && p1 > 0)) {
        throw new Error('volume_ml_per_unit min must be > 0.')
      }
      if (distType === 'lognormal' && !(p1 != null && p1 > 0)) throw new Error('volume_ml_per_unit median must be > 0.')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  const supabase = await createClient()

  try {
    await createDistribution(supabase, {
      name,
      valueType,
      distType,
      p1,
      p2,
      p3,
      minValue,
      maxValue,
      units: units || null,
      qualityScore,
      evidenceSummary: evidenceSummary || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/distributions')
  return { status: 'success', message: 'Created.' }
}
