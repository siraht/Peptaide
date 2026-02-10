'use server'

import { revalidatePath } from 'next/cache'

import { createEvidenceSource, softDeleteEvidenceSource } from '@/lib/repos/evidenceSourcesRepo'
import { toUserFacingDbErrorMessage } from '@/lib/errors/userFacingDbError'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type CreateEvidenceSourceState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function isEvidenceSourceType(
  x: string,
): x is Database['public']['Enums']['evidence_source_type_t'] {
  return (
    x === 'paper' ||
    x === 'label' ||
    x === 'clinical_guideline' ||
    x === 'vendor' ||
    x === 'anecdote' ||
    x === 'personal_note'
  )
}

export async function createEvidenceSourceAction(
  _prev: CreateEvidenceSourceState,
  formData: FormData,
): Promise<CreateEvidenceSourceState> {
  const sourceTypeRaw = String(formData.get('source_type') ?? '').trim()
  const citation = String(formData.get('citation') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!isEvidenceSourceType(sourceTypeRaw)) {
    return { status: 'error', message: 'Invalid source_type.' }
  }
  if (!citation) return { status: 'error', message: 'citation is required.' }

  const supabase = await createClient()

  try {
    await createEvidenceSource(supabase, {
      sourceType: sourceTypeRaw,
      citation,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath('/evidence-sources')
  revalidatePath('/setup')
  // Evidence sources appear in dropdowns on substance detail pages.
  revalidatePath('/substances', 'layout')
  return { status: 'success', message: 'Saved.' }
}

export async function deleteEvidenceSourceAction(formData: FormData): Promise<void> {
  const evidenceSourceId = String(formData.get('evidence_source_id') ?? '').trim()
  if (!evidenceSourceId) return

  const supabase = await createClient()
  await softDeleteEvidenceSource(supabase, { evidenceSourceId })

  revalidatePath('/evidence-sources')
  revalidatePath('/setup')
  // Evidence sources appear in dropdowns on substance detail pages.
  revalidatePath('/substances', 'layout')
}
