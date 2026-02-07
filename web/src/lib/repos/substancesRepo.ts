import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type SubstanceRow = Database['public']['Tables']['substances']['Row']

export async function getSubstanceById(
  supabase: DbClient,
  opts: { substanceId: string },
): Promise<SubstanceRow | null> {
  const res = await supabase
    .from('substances')
    .select('*')
    .eq('id', opts.substanceId)
    .is('deleted_at', null)
    .maybeSingle()
  requireOk(res.error, 'substances.select_by_id')
  return res.data
}

export async function listSubstances(supabase: DbClient): Promise<SubstanceRow[]> {
  const res = await supabase
    .from('substances')
    .select('*')
    .is('deleted_at', null)
    .order('display_name', { ascending: true })
  return requireData(res.data, res.error, 'substances.select')
}

export async function createSubstance(
  supabase: DbClient,
  opts: {
    canonicalName: string
    displayName: string
    family: string | null
    targetCompartmentDefault: Database['public']['Enums']['compartment_t']
    notes: string | null
  },
): Promise<SubstanceRow> {
  const { canonicalName, displayName, family, targetCompartmentDefault, notes } = opts

  const res = await supabase
    .from('substances')
    .insert({
      canonical_name: canonicalName,
      display_name: displayName,
      family,
      target_compartment_default: targetCompartmentDefault,
      notes,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'substances.insert')
}

export async function softDeleteSubstance(
  supabase: DbClient,
  opts: { substanceId: string },
): Promise<void> {
  const res = await supabase
    .from('substances')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.substanceId)
    .is('deleted_at', null)

  requireOk(res.error, 'substances.soft_delete')
}
