import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type VendorRow = Database['public']['Tables']['vendors']['Row']

export async function getVendorById(
  supabase: DbClient,
  opts: { vendorId: string; includeDeleted?: boolean },
): Promise<VendorRow | null> {
  const { vendorId, includeDeleted } = opts

  const q = supabase.from('vendors').select('*').eq('id', vendorId)
  const res = includeDeleted ? await q.maybeSingle() : await q.is('deleted_at', null).maybeSingle()
  requireOk(res.error, 'vendors.select_by_id')
  return res.data
}

export async function listVendors(supabase: DbClient): Promise<VendorRow[]> {
  const res = await supabase
    .from('vendors')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  return requireData(res.data, res.error, 'vendors.select')
}

export async function listVendorsById(
  supabase: DbClient,
  opts: { vendorIds: string[]; includeDeleted?: boolean },
): Promise<VendorRow[]> {
  const { vendorIds, includeDeleted } = opts
  if (vendorIds.length === 0) return []

  const q = supabase.from('vendors').select('*').in('id', vendorIds)
  const res = includeDeleted ? await q : await q.is('deleted_at', null)
  return requireData(res.data, res.error, 'vendors.select_by_ids')
}

export async function createVendor(
  supabase: DbClient,
  opts: { name: string; notes: string | null },
): Promise<VendorRow> {
  const res = await supabase
    .from('vendors')
    .insert({ name: opts.name, notes: opts.notes })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'vendors.insert')
}

export async function softDeleteVendor(
  supabase: DbClient,
  opts: { vendorId: string },
): Promise<void> {
  const res = await supabase
    .from('vendors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.vendorId)
    .is('deleted_at', null)

  requireOk(res.error, 'vendors.soft_delete')
}

