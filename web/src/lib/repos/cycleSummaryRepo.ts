import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type CycleSummaryRow = Database['public']['Views']['v_cycle_summary']['Row']

export async function getCycleSummaryById(
  supabase: DbClient,
  opts: { cycleInstanceId: string },
): Promise<CycleSummaryRow | null> {
  const res = await supabase
    .from('v_cycle_summary')
    .select('*')
    .eq('cycle_instance_id', opts.cycleInstanceId)
    .maybeSingle()

  requireOk(res.error, 'v_cycle_summary.select_by_id')
  return res.data
}

export async function listCycleSummary(supabase: DbClient): Promise<CycleSummaryRow[]> {
  const res = await supabase
    .from('v_cycle_summary')
    .select('*')
    .order('substance_name', { ascending: true })
    .order('cycle_number', { ascending: true })

  return requireData(res.data, res.error, 'v_cycle_summary.select')
}
