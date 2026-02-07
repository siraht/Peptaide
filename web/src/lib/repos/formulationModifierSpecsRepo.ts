import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type FormulationModifierSpecRow =
  Database['public']['Tables']['formulation_modifier_specs']['Row']

export async function getFormulationModifierSpec(opts: {
  supabase: DbClient
  formulationId: string
  compartment: Database['public']['Enums']['compartment_t']
}): Promise<FormulationModifierSpecRow | null> {
  const { supabase, formulationId, compartment } = opts

  const res = await supabase
    .from('formulation_modifier_specs')
    .select('*')
    .eq('formulation_id', formulationId)
    .eq('compartment', compartment)
    .is('deleted_at', null)
    .maybeSingle()

  requireOk(res.error, 'formulation_modifier_specs.select')
  return res.data
}

export async function setFormulationModifierSpec(
  supabase: DbClient,
  opts: {
    formulationId: string
    compartment: Database['public']['Enums']['compartment_t']
    multiplierDistId: string
    notes: string | null
  },
): Promise<FormulationModifierSpecRow> {
  const { formulationId, compartment, multiplierDistId, notes } = opts

  const insertRes = await supabase
    .from('formulation_modifier_specs')
    .insert({
      formulation_id: formulationId,
      compartment,
      multiplier_dist_id: multiplierDistId,
      notes,
    })
    .select('*')
    .single()

  // If the unique constraint already exists, update in-place (and clear deleted_at if it was soft-deleted).
  if (insertRes.error?.code === '23505') {
    const updateRes = await supabase
      .from('formulation_modifier_specs')
      .update({ multiplier_dist_id: multiplierDistId, notes, deleted_at: null })
      .eq('formulation_id', formulationId)
      .eq('compartment', compartment)
      .select('*')
      .single()

    return requireData(updateRes.data, updateRes.error, 'formulation_modifier_specs.update')
  }

  return requireData(insertRes.data, insertRes.error, 'formulation_modifier_specs.insert')
}

export async function listFormulationModifierSpecs(opts: {
  supabase: DbClient
  formulationId: string
  compartments: Database['public']['Enums']['compartment_t'][]
}): Promise<FormulationModifierSpecRow[]> {
  const { supabase, formulationId, compartments } = opts
  if (compartments.length === 0) return []

  const res = await supabase
    .from('formulation_modifier_specs')
    .select('*')
    .eq('formulation_id', formulationId)
    .in('compartment', compartments)
    .is('deleted_at', null)

  return requireData(res.data, res.error, 'formulation_modifier_specs.select')
}
