'use server'

import { revalidatePath } from 'next/cache'

import { createSubstance, softDeleteSubstance } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type CreateSubstanceState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export async function createSubstanceAction(
  _prev: CreateSubstanceState,
  formData: FormData,
): Promise<CreateSubstanceState> {
  const canonicalName = String(formData.get('canonical_name') ?? '').trim()
  const displayName = String(formData.get('display_name') ?? '').trim()
  const family = String(formData.get('family') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const targetCompartmentDefault = String(formData.get('target_compartment_default') ?? '').trim()

  if (!canonicalName) return { status: 'error', message: 'canonical_name is required.' }
  if (!displayName) return { status: 'error', message: 'display_name is required.' }

  function isCompartment(x: string): x is Database['public']['Enums']['compartment_t'] {
    return x === 'systemic' || x === 'cns' || x === 'both'
  }

  if (!isCompartment(targetCompartmentDefault)) {
    return { status: 'error', message: 'Invalid target compartment.' }
  }

  const supabase = await createClient()

  try {
    await createSubstance(supabase, {
      canonicalName,
      displayName,
      family: family || null,
      targetCompartmentDefault,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/substances')
  return { status: 'success', message: 'Created.' }
}

export async function deleteSubstanceAction(formData: FormData): Promise<void> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  if (!substanceId) return

  const supabase = await createClient()
  await softDeleteSubstance(supabase, { substanceId })
  revalidatePath('/substances')
}
