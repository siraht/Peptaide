import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type VialRow = Database['public']['Tables']['vials']['Row']

export async function getVialById(
  supabase: DbClient,
  opts: { vialId: string },
): Promise<VialRow | null> {
  const res = await supabase
    .from('vials')
    .select('*')
    .eq('id', opts.vialId)
    .is('deleted_at', null)
    .maybeSingle()
  requireOk(res.error, 'vials.select_by_id')
  return res.data
}

export async function getActiveVialForFormulation(
  supabase: DbClient,
  opts: { formulationId: string },
): Promise<VialRow | null> {
  const res = await supabase
    .from('vials')
    .select('*')
    .eq('formulation_id', opts.formulationId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()
  requireOk(res.error, 'vials.select_active_for_formulation')
  return res.data
}

export async function closeActiveVialsForFormulation(
  supabase: DbClient,
  opts: { formulationId: string },
): Promise<void> {
  const now = new Date().toISOString()
  const res = await supabase
    .from('vials')
    .update({ status: 'closed', closed_at: now })
    .eq('formulation_id', opts.formulationId)
    .eq('status', 'active')
    .is('deleted_at', null)

  requireOk(res.error, 'vials.close_active_for_formulation')
}

export async function createVial(
  supabase: DbClient,
  opts: {
    substanceId: string
    formulationId: string
    orderItemId: string | null
    status: Database['public']['Enums']['vial_status_t']
    contentMassValue: number
    contentMassUnit: string
    totalVolumeValue: number | null
    totalVolumeUnit: string | null
    concentrationMgPerMl: number | null
    costUsd: number | null
    notes: string | null
  },
): Promise<VialRow> {
  const {
    substanceId,
    formulationId,
    orderItemId,
    status,
    contentMassValue,
    contentMassUnit,
    totalVolumeValue,
    totalVolumeUnit,
    concentrationMgPerMl,
    costUsd,
    notes,
  } = opts

  const res = await supabase
    .from('vials')
    .insert({
      substance_id: substanceId,
      formulation_id: formulationId,
      order_item_id: orderItemId,
      status,
      content_mass_value: contentMassValue,
      content_mass_unit: contentMassUnit,
      total_volume_value: totalVolumeValue,
      total_volume_unit: totalVolumeUnit,
      concentration_mg_per_ml: concentrationMgPerMl,
      cost_usd: costUsd,
      notes,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'vials.insert')
}

export async function activateVial(
  supabase: DbClient,
  opts: { vialId: string; openedAt: string },
): Promise<void> {
  const res = await supabase
    .from('vials')
    .update({
      status: 'active',
      opened_at: opts.openedAt,
      // If a vial is re-activated (manual correction), clear closed_at for consistency.
      closed_at: null,
    })
    .eq('id', opts.vialId)
    .is('deleted_at', null)

  requireOk(res.error, 'vials.activate')
}

export async function closeVial(
  supabase: DbClient,
  opts: { vialId: string; closedAt: string },
): Promise<void> {
  const res = await supabase
    .from('vials')
    .update({ status: 'closed', closed_at: opts.closedAt })
    .eq('id', opts.vialId)
    .is('deleted_at', null)

  requireOk(res.error, 'vials.close')
}

export async function discardVial(
  supabase: DbClient,
  opts: { vialId: string; closedAt: string },
): Promise<void> {
  const res = await supabase
    .from('vials')
    .update({ status: 'discarded', closed_at: opts.closedAt })
    .eq('id', opts.vialId)
    .is('deleted_at', null)

  requireOk(res.error, 'vials.discard')
}
