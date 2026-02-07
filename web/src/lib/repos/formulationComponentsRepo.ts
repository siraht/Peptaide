import type { DbClient } from './types'
import { requireData } from './errors'

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

