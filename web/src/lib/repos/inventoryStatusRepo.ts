import type { DbClient } from './types'
import { requireData } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type InventoryStatusRow = Database['public']['Views']['v_inventory_status']['Row']

export async function listInventoryStatus(supabase: DbClient): Promise<InventoryStatusRow[]> {
  const res = await supabase
    .from('v_inventory_status')
    .select('*')
    .order('status', { ascending: true })
    .order('substance_name', { ascending: true })
    .order('formulation_name', { ascending: true })

  return requireData(res.data, res.error, 'v_inventory_status.select')
}

