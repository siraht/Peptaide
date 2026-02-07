import type { DbClient } from './types'
import { requireData } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type OrderItemVialCountsRow = Database['public']['Views']['v_order_item_vial_counts']['Row']

export async function listOrderItemVialCounts(
  supabase: DbClient,
  opts: { orderItemIds: string[] },
): Promise<OrderItemVialCountsRow[]> {
  if (opts.orderItemIds.length === 0) return []

  const res = await supabase
    .from('v_order_item_vial_counts')
    .select('*')
    .in('order_item_id', opts.orderItemIds)

  return requireData(res.data, res.error, 'v_order_item_vial_counts.select')
}

