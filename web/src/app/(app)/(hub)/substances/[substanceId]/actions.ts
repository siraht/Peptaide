'use server'

import { revalidatePath } from 'next/cache'

import { setBioavailabilitySpec } from '@/lib/repos/bioavailabilitySpecsRepo'
import { setCycleRuleForSubstance, softDeleteCycleRule } from '@/lib/repos/cyclesRepo'
import { createSubstanceRecommendation, softDeleteSubstanceRecommendation } from '@/lib/repos/substanceRecommendationsRepo'
import { toUserFacingDbErrorMessage } from '@/lib/errors/userFacingDbError'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type SetBioavailabilitySpecState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export type CreateSubstanceRecommendationState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function isCompartment(
  x: string,
): x is Extract<Database['public']['Enums']['compartment_t'], 'systemic' | 'cns'> {
  return x === 'systemic' || x === 'cns'
}

function isRecommendationCategory(
  x: string,
): x is Database['public']['Enums']['recommendation_category_t'] {
  return x === 'cycle_length_days' || x === 'break_length_days' || x === 'dosing' || x === 'frequency'
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number: "${raw}"`)
  }
  return n
}

export async function setBioavailabilitySpecAction(
  _prev: SetBioavailabilitySpecState,
  formData: FormData,
): Promise<SetBioavailabilitySpecState> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const routeId = String(formData.get('route_id') ?? '').trim()
  const compartmentRaw = String(formData.get('compartment') ?? '').trim()
  const baseFractionDistId = String(formData.get('base_fraction_dist_id') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const evidenceSourceIdRaw = String(formData.get('evidence_source_id') ?? '').trim()

  if (!substanceId) return { status: 'error', message: 'Missing substance_id.' }
  if (!routeId) return { status: 'error', message: 'route_id is required.' }
  if (!isCompartment(compartmentRaw)) return { status: 'error', message: 'Invalid compartment.' }
  if (!baseFractionDistId) return { status: 'error', message: 'base_fraction_dist_id is required.' }

  const supabase = await createClient()

  try {
    await setBioavailabilitySpec(supabase, {
      substanceId,
      routeId,
      compartment: compartmentRaw,
      baseFractionDistId,
      notes: notes || null,
      evidenceSourceId: evidenceSourceIdRaw ? evidenceSourceIdRaw : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath(`/substances/${substanceId}`)
  return { status: 'success', message: 'Saved.' }
}

export async function createSubstanceRecommendationAction(
  _prev: CreateSubstanceRecommendationState,
  formData: FormData,
): Promise<CreateSubstanceRecommendationState> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const categoryRaw = String(formData.get('category') ?? '').trim()
  const routeIdRaw = String(formData.get('route_id') ?? '').trim()
  const minValueRaw = String(formData.get('min_value') ?? '').trim()
  const maxValueRaw = String(formData.get('max_value') ?? '').trim()
  const unit = String(formData.get('unit') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const evidenceSourceIdRaw = String(formData.get('evidence_source_id') ?? '').trim()

  if (!substanceId) return { status: 'error', message: 'Missing substance_id.' }
  if (!isRecommendationCategory(categoryRaw)) return { status: 'error', message: 'Invalid category.' }
  if (!unit) return { status: 'error', message: 'unit is required.' }

  let minValue: number | null = null
  let maxValue: number | null = null

  try {
    minValue = parseOptionalNumber(minValueRaw)
    maxValue = parseOptionalNumber(maxValueRaw)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  if (minValue == null && maxValue == null) {
    return { status: 'error', message: 'Provide min and/or max.' }
  }
  if (minValue != null && maxValue != null && minValue > maxValue) {
    return { status: 'error', message: 'min must be <= max when both are provided.' }
  }

  const supabase = await createClient()

  try {
    await createSubstanceRecommendation(supabase, {
      substanceId,
      category: categoryRaw,
      routeId: routeIdRaw ? routeIdRaw : null,
      minValue,
      maxValue,
      unit,
      notes: notes || null,
      evidenceSourceId: evidenceSourceIdRaw ? evidenceSourceIdRaw : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath(`/substances/${substanceId}`)
  revalidatePath('/cycles')
  return { status: 'success', message: 'Saved.' }
}

export async function deleteSubstanceRecommendationAction(formData: FormData): Promise<void> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const recommendationId = String(formData.get('recommendation_id') ?? '').trim()
  if (!substanceId || !recommendationId) return

  const supabase = await createClient()
  await softDeleteSubstanceRecommendation(supabase, { recommendationId })
  revalidatePath(`/substances/${substanceId}`)
  revalidatePath('/cycles')
}

export type SetCycleRuleState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function parseNonNegativeInt(raw: string, label: string): number {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error(`${label} is required.`)
  }
  const n = Number(trimmed)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
  return n
}

export async function setCycleRuleAction(
  _prev: SetCycleRuleState,
  formData: FormData,
): Promise<SetCycleRuleState> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const gapDaysRaw = String(formData.get('gap_days_to_suggest_new_cycle') ?? '').trim()
  const autoStartFirstCycle = formData.get('auto_start_first_cycle') != null
  const notes = String(formData.get('notes') ?? '').trim()

  if (!substanceId) return { status: 'error', message: 'Missing substance_id.' }

  let gapDaysToSuggestNewCycle: number
  try {
    gapDaysToSuggestNewCycle = parseNonNegativeInt(gapDaysRaw, 'gap_days_to_suggest_new_cycle')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  const supabase = await createClient()

  try {
    await setCycleRuleForSubstance(supabase, {
      substanceId,
      gapDaysToSuggestNewCycle,
      autoStartFirstCycle,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath(`/substances/${substanceId}`)
  revalidatePath('/today')
  revalidatePath('/cycles')
  return { status: 'success', message: 'Saved.' }
}

export async function deleteCycleRuleAction(formData: FormData): Promise<void> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const cycleRuleId = String(formData.get('cycle_rule_id') ?? '').trim()
  if (!substanceId || !cycleRuleId) return

  const supabase = await createClient()
  await softDeleteCycleRule(supabase, { cycleRuleId })

  revalidatePath(`/substances/${substanceId}`)
  revalidatePath('/today')
  revalidatePath('/cycles')
}
