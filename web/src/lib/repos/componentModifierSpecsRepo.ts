import type { DbClient } from './types'
import { requireData } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type ComponentModifierSpecRow =
  Database['public']['Tables']['component_modifier_specs']['Row']

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

