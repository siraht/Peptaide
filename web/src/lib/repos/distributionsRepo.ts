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

