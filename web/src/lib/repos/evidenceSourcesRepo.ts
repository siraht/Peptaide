import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type EvidenceSourceRow = Database['public']['Tables']['evidence_sources']['Row']

export async function listEvidenceSources(supabase: DbClient): Promise<EvidenceSourceRow[]> {
  const res = await supabase
    .from('evidence_sources')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return requireData(res.data, res.error, 'evidence_sources.select')
}

export async function createEvidenceSource(
  supabase: DbClient,
  opts: {
    sourceType: Database['public']['Enums']['evidence_source_type_t']
    citation: string
    notes: string | null
  },
): Promise<EvidenceSourceRow> {
  const { sourceType, citation, notes } = opts

  const insertRes = await supabase
    .from('evidence_sources')
    .insert({
      source_type: sourceType,
      citation,
      notes,
    })
    .select('*')
    .single()

  // If the unique constraint already exists, update notes and clear deleted_at.
  if (insertRes.error?.code === '23505') {
    const updateRes = await supabase
      .from('evidence_sources')
      .update({ notes, deleted_at: null })
      .eq('source_type', sourceType)
      .eq('citation', citation)
      .select('*')
      .single()

    return requireData(updateRes.data, updateRes.error, 'evidence_sources.update')
  }

  return requireData(insertRes.data, insertRes.error, 'evidence_sources.insert')
}

export async function softDeleteEvidenceSource(
  supabase: DbClient,
  opts: { evidenceSourceId: string },
): Promise<void> {
  const res = await supabase
    .from('evidence_sources')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.evidenceSourceId)
    .is('deleted_at', null)

  requireOk(res.error, 'evidence_sources.soft_delete')
}

