import type { DbClient } from './types'
import { requireData } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type ModelCoverageRow = Database['public']['Views']['v_model_coverage']['Row']

export async function listModelCoverage(supabase: DbClient): Promise<ModelCoverageRow[]> {
  const res = await supabase
    .from('v_model_coverage')
    .select('*')
    .order('substance_name', { ascending: true })
    .order('formulation_name', { ascending: true })

  return requireData(res.data, res.error, 'v_model_coverage.select')
}

