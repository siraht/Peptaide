'use server'

import { revalidatePath } from 'next/cache'

import { createPointDistribution } from '@/lib/repos/distributionsRepo'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type CreateDistributionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function isValueType(x: string): x is Database['public']['Enums']['distribution_value_type_t'] {
  return x === 'fraction' || x === 'multiplier' || x === 'volume_ml_per_unit' || x === 'other'
}

export async function createPointDistributionAction(
  _prev: CreateDistributionState,
  formData: FormData,
): Promise<CreateDistributionState> {
  const name = String(formData.get('name') ?? '').trim()
  const valueType = String(formData.get('value_type') ?? '').trim()
  const valueRaw = String(formData.get('value') ?? '').trim()
  const units = String(formData.get('units') ?? '').trim()
  const qualityScoreRaw = String(formData.get('quality_score') ?? '').trim()
  const evidenceSummary = String(formData.get('evidence_summary') ?? '').trim()

  if (!name) return { status: 'error', message: 'name is required.' }
  if (!isValueType(valueType)) return { status: 'error', message: 'Invalid value_type.' }

  const value = Number(valueRaw)
  if (!Number.isFinite(value)) return { status: 'error', message: 'value must be a number.' }

  const qualityScore = qualityScoreRaw ? Number(qualityScoreRaw) : 0
  if (!Number.isInteger(qualityScore) || qualityScore < 0 || qualityScore > 5) {
    return { status: 'error', message: 'quality_score must be an integer 0-5.' }
  }

  // Basic safety checks aligned with DB constraints; DB remains the final authority.
  if (valueType === 'fraction' && !(value >= 0 && value <= 1)) {
    return { status: 'error', message: 'fraction value must be in [0,1].' }
  }
  if (valueType === 'multiplier' && !(value >= 0)) {
    return { status: 'error', message: 'multiplier value must be >= 0.' }
  }
  if (valueType === 'volume_ml_per_unit' && !(value > 0)) {
    return { status: 'error', message: 'volume_ml_per_unit value must be > 0.' }
  }

  const supabase = await createClient()

  try {
    await createPointDistribution(supabase, {
      name,
      valueType,
      value,
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

