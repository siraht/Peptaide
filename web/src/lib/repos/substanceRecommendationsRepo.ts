import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type SubstanceRecommendationRow =
  Database['public']['Tables']['substance_recommendations']['Row']

export async function listDosingRecommendationsForSubstances(
  supabase: DbClient,
  opts: { substanceIds: string[] },
): Promise<SubstanceRecommendationRow[]> {
  const ids = opts.substanceIds.filter(Boolean)
  if (ids.length === 0) return []

  const res = await supabase
    .from('substance_recommendations')
    .select('*')
    .eq('category', 'dosing')
    .in('substance_id', ids)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return requireData(res.data, res.error, 'substance_recommendations.select_dosing_for_substances')
}

export async function listSubstanceRecommendationsForSubstance(
  supabase: DbClient,
  opts: { substanceId: string },
): Promise<SubstanceRecommendationRow[]> {
  const res = await supabase
    .from('substance_recommendations')
    .select('*')
    .eq('substance_id', opts.substanceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  return requireData(res.data, res.error, 'substance_recommendations.select_for_substance')
}

export async function createSubstanceRecommendation(
  supabase: DbClient,
  opts: {
    substanceId: string
    category: Database['public']['Enums']['recommendation_category_t']
    routeId: string | null
    minValue: number | null
    maxValue: number | null
    unit: string
    notes: string | null
    evidenceSourceId: string | null
  },
): Promise<SubstanceRecommendationRow> {
  const res = await supabase
    .from('substance_recommendations')
    .insert({
      substance_id: opts.substanceId,
      category: opts.category,
      route_id: opts.routeId,
      min_value: opts.minValue,
      max_value: opts.maxValue,
      unit: opts.unit,
      notes: opts.notes,
      evidence_source_id: opts.evidenceSourceId,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'substance_recommendations.insert')
}

export async function softDeleteSubstanceRecommendation(
  supabase: DbClient,
  opts: { recommendationId: string },
): Promise<void> {
  const res = await supabase
    .from('substance_recommendations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.recommendationId)
    .is('deleted_at', null)

  requireOk(res.error, 'substance_recommendations.soft_delete')
}
