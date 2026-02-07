import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type OrderRow = Database['public']['Tables']['orders']['Row']

export async function getOrderById(
  supabase: DbClient,
  opts: { orderId: string; includeDeleted?: boolean },
): Promise<OrderRow | null> {
  const { orderId, includeDeleted } = opts

  const q = supabase.from('orders').select('*').eq('id', orderId)
  const res = includeDeleted ? await q.maybeSingle() : await q.is('deleted_at', null).maybeSingle()
  requireOk(res.error, 'orders.select_by_id')
  return res.data
}

export async function listOrders(supabase: DbClient): Promise<OrderRow[]> {
  const res = await supabase
    .from('orders')
    .select('*')
    .is('deleted_at', null)
    .order('ordered_at', { ascending: false })
  return requireData(res.data, res.error, 'orders.select')
}

export async function createOrder(
  supabase: DbClient,
  opts: {
    vendorId: string
    orderedAt: string | null
    shippingCostUsd: number | null
    totalCostUsd: number | null
    trackingCode: string | null
    notes: string | null
  },
): Promise<OrderRow> {
  const insert: Database['public']['Tables']['orders']['Insert'] = {
    vendor_id: opts.vendorId,
    shipping_cost_usd: opts.shippingCostUsd,
    total_cost_usd: opts.totalCostUsd,
    tracking_code: opts.trackingCode,
    notes: opts.notes,
  }

  if (opts.orderedAt) {
    insert.ordered_at = opts.orderedAt
  }

  const res = await supabase.from('orders').insert(insert).select('*').single()
  return requireData(res.data, res.error, 'orders.insert')
}

export async function softDeleteOrder(
  supabase: DbClient,
  opts: { orderId: string },
): Promise<void> {
  const res = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.orderId)
    .is('deleted_at', null)

  requireOk(res.error, 'orders.soft_delete')
}

