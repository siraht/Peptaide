import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type ComponentModifierSpecRow =
  Database['public']['Tables']['component_modifier_specs']['Row']

export async function setComponentModifierSpec(
  supabase: DbClient,
  opts: {
    formulationComponentId: string
    compartment: Database['public']['Enums']['compartment_t']
    multiplierDistId: string
    notes: string | null
  },
): Promise<ComponentModifierSpecRow> {
  const { formulationComponentId, compartment, multiplierDistId, notes } = opts

  const insertRes = await supabase
    .from('component_modifier_specs')
    .insert({
      formulation_component_id: formulationComponentId,
      compartment,
      multiplier_dist_id: multiplierDistId,
      notes,
    })
    .select('*')
    .single()

  // If the unique constraint already exists, update in-place (and clear deleted_at if it was soft-deleted).
  if (insertRes.error?.code === '23505') {
    const updateRes = await supabase
      .from('component_modifier_specs')
      .update({ multiplier_dist_id: multiplierDistId, notes, deleted_at: null })
      .eq('formulation_component_id', formulationComponentId)
      .eq('compartment', compartment)
      .select('*')
      .single()

    return requireData(updateRes.data, updateRes.error, 'component_modifier_specs.update')
  }

  return requireData(insertRes.data, insertRes.error, 'component_modifier_specs.insert')
}

export async function softDeleteComponentModifierSpec(
  supabase: DbClient,
  opts: { componentModifierSpecId: string },
): Promise<void> {
  const res = await supabase
    .from('component_modifier_specs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.componentModifierSpecId)
    .is('deleted_at', null)

  requireOk(res.error, 'component_modifier_specs.soft_delete')
}

export async function listComponentModifierSpecs(opts: {
  supabase: DbClient
  formulationComponentIds: string[]
  compartments: Database['public']['Enums']['compartment_t'][]
}): Promise<ComponentModifierSpecRow[]> {
  const { supabase, formulationComponentIds, compartments } = opts
  if (formulationComponentIds.length === 0 || compartments.length === 0) return []

  const res = await supabase
    .from('component_modifier_specs')
    .select('*')
    .in('formulation_component_id', formulationComponentIds)
    .in('compartment', compartments)
    .is('deleted_at', null)

  return requireData(res.data, res.error, 'component_modifier_specs.select')
}
