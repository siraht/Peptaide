import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'
import type { Distribution } from '@/lib/domain/uncertainty/types'

export type DistributionRow = Database['public']['Tables']['distributions']['Row']

export function distributionRowToDomain(row: DistributionRow): Distribution {
  return {
    id: row.id,
    valueType: row.value_type,
    distType: row.dist_type,
    p1: row.p1,
    p2: row.p2,
    p3: row.p3,
    minValue: row.min_value,
    maxValue: row.max_value,
  }
}

export async function getDistributionById(
  supabase: DbClient,
  opts: { distributionId: string },
): Promise<DistributionRow | null> {
  const res = await supabase
    .from('distributions')
    .select('*')
    .eq('id', opts.distributionId)
    .maybeSingle()
  requireOk(res.error, 'distributions.select_by_id')
  return res.data
}

export async function listDistributions(supabase: DbClient): Promise<DistributionRow[]> {
  const res = await supabase
    .from('distributions')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  return requireData(res.data, res.error, 'distributions.select')
}

export async function listDistributionsById(
  supabase: DbClient,
  opts: { distributionIds: string[] },
): Promise<DistributionRow[]> {
  const { distributionIds } = opts
  if (distributionIds.length === 0) return []

  const res = await supabase.from('distributions').select('*').in('id', distributionIds)
  return requireData(res.data, res.error, 'distributions.select_by_ids')
}

export async function getDistributionDomainById(
  supabase: DbClient,
  opts: { distributionId: string },
): Promise<Distribution | null> {
  const row = await getDistributionById(supabase, opts)
  return row ? distributionRowToDomain(row) : null
}

export async function createPointDistribution(
  supabase: DbClient,
  opts: {
    name: string
    valueType: Database['public']['Enums']['distribution_value_type_t']
    value: number
    units: string | null
    qualityScore: number
    evidenceSummary: string | null
  },
): Promise<DistributionRow> {
  const { name, valueType, value, units, qualityScore, evidenceSummary } = opts

  const res = await supabase
    .from('distributions')
    .insert({
      name,
      value_type: valueType,
      dist_type: 'point',
      p1: value,
      p2: null,
      p3: null,
      min_value: null,
      max_value: null,
      units,
      quality_score: qualityScore,
      evidence_summary: evidenceSummary,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'distributions.insert_point')
}

export async function createDistribution(
  supabase: DbClient,
  opts: {
    name: string
    valueType: Database['public']['Enums']['distribution_value_type_t']
    distType: Database['public']['Enums']['distribution_dist_type_t']
    p1: number | null
    p2: number | null
    p3: number | null
    minValue: number | null
    maxValue: number | null
    units: string | null
    qualityScore: number
    evidenceSummary: string | null
  },
): Promise<DistributionRow> {
  const { name, valueType, distType, p1, p2, p3, minValue, maxValue, units, qualityScore, evidenceSummary } =
    opts

  const res = await supabase
    .from('distributions')
    .insert({
      name,
      value_type: valueType,
      dist_type: distType,
      p1,
      p2,
      p3,
      min_value: minValue,
      max_value: maxValue,
      units,
      quality_score: qualityScore,
      evidence_summary: evidenceSummary,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'distributions.insert')
}
