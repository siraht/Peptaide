import type { DbClient } from './types'
import { requireData } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type FormulationModifierSpecRow =
  Database['public']['Tables']['formulation_modifier_specs']['Row']

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

