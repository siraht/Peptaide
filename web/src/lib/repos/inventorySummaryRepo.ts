import type { DbClient } from './types'
import { requireData } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type InventorySummaryRow = Database['public']['Views']['v_inventory_summary']['Row']

export async function listInventorySummary(supabase: DbClient): Promise<InventorySummaryRow[]> {
  const res = await supabase
    .from('v_inventory_summary')
    .select('*')
    .order('substance_name', { ascending: true })
    .order('formulation_name', { ascending: true })

  return requireData(res.data, res.error, 'v_inventory_summary.select')
}

