import type { DbClient } from './types'
import { requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type VialRow = Database['public']['Tables']['vials']['Row']

export async function getVialById(
  supabase: DbClient,
  opts: { vialId: string },
): Promise<VialRow | null> {
  const res = await supabase.from('vials').select('*').eq('id', opts.vialId).maybeSingle()
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

