import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type OrderItemRow = Database['public']['Tables']['order_items']['Row']

export async function getOrderItemById(
  supabase: DbClient,
  opts: { orderItemId: string; includeDeleted?: boolean },
): Promise<OrderItemRow | null> {
  const { orderItemId, includeDeleted } = opts

  const q = supabase.from('order_items').select('*').eq('id', orderItemId)
  const res = includeDeleted ? await q.maybeSingle() : await q.is('deleted_at', null).maybeSingle()
  requireOk(res.error, 'order_items.select_by_id')
  return res.data
}

export async function listOrderItems(supabase: DbClient): Promise<OrderItemRow[]> {
  const res = await supabase
    .from('order_items')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return requireData(res.data, res.error, 'order_items.select')
}

export async function listOrderItemsForOrder(
  supabase: DbClient,
  opts: { orderId: string },
): Promise<OrderItemRow[]> {
  const res = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', opts.orderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return requireData(res.data, res.error, 'order_items.select_for_order')
}

export async function createOrderItem(
  supabase: DbClient,
  opts: {
    orderId: string
    substanceId: string
    formulationId: string | null
    qty: number
    unitLabel: string
    priceTotalUsd: number | null
    expectedVials: number | null
    notes: string | null
  },
): Promise<OrderItemRow> {
  const res = await supabase
    .from('order_items')
    .insert({
      order_id: opts.orderId,
      substance_id: opts.substanceId,
      formulation_id: opts.formulationId,
      qty: opts.qty,
      unit_label: opts.unitLabel,
      price_total_usd: opts.priceTotalUsd,
      expected_vials: opts.expectedVials,
      notes: opts.notes,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'order_items.insert')
}

export async function softDeleteOrderItem(
  supabase: DbClient,
  opts: { orderItemId: string },
): Promise<void> {
  const res = await supabase
    .from('order_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.orderItemId)
    .is('deleted_at', null)

  requireOk(res.error, 'order_items.soft_delete')
}

export async function softDeleteOrderItemsForOrder(
  supabase: DbClient,
  opts: { orderId: string },
): Promise<void> {
  const res = await supabase
    .from('order_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('order_id', opts.orderId)
    .is('deleted_at', null)

  requireOk(res.error, 'order_items.soft_delete_for_order')
}
