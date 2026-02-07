import type { DbClient } from './types'
import { requireData } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type CycleSummaryRow = Database['public']['Views']['v_cycle_summary']['Row']

export async function listCycleSummary(supabase: DbClient): Promise<CycleSummaryRow[]> {
  const res = await supabase
    .from('v_cycle_summary')
    .select('*')
    .order('substance_name', { ascending: true })
    .order('cycle_number', { ascending: true })

  return requireData(res.data, res.error, 'v_cycle_summary.select')
}

