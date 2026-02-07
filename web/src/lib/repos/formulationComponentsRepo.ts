import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type FormulationComponentRow =
  Database['public']['Tables']['formulation_components']['Row']

export async function listFormulationComponents(opts: {
  supabase: DbClient
  formulationId: string
}): Promise<FormulationComponentRow[]> {
  const { supabase, formulationId } = opts

  const res = await supabase
    .from('formulation_components')
    .select('*')
    .eq('formulation_id', formulationId)
    .is('deleted_at', null)
    .order('component_name', { ascending: true })

  return requireData(res.data, res.error, 'formulation_components.select')
}

export async function createFormulationComponent(
  supabase: DbClient,
  opts: {
    formulationId: string
    componentName: string
    role: string | null
    modifierDistId: string | null
    notes: string | null
  },
): Promise<FormulationComponentRow> {
  const { formulationId, componentName, role, modifierDistId, notes } = opts

  const res = await supabase
    .from('formulation_components')
    .insert({
      formulation_id: formulationId,
      component_name: componentName,
      role,
      modifier_dist_id: modifierDistId,
      notes,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'formulation_components.insert')
}

export async function softDeleteFormulationComponent(
  supabase: DbClient,
  opts: { componentId: string },
): Promise<void> {
  const res = await supabase
    .from('formulation_components')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.componentId)
    .is('deleted_at', null)

  requireOk(res.error, 'formulation_components.soft_delete')
}
