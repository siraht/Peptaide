'use server'

import { revalidatePath } from 'next/cache'

import { createSubstance, softDeleteSubstance } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type CreateSubstanceState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export type BulkAddSubstancesState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'success'
      message: string
      createdCount: number
      errors: string[]
    }

function splitFields(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim())
  if (line.includes(',')) return line.split(',').map((s) => s.trim())
  if (line.includes('|')) return line.split('|').map((s) => s.trim())
  return [line.trim()]
}

function isCompartment(x: string): x is Database['public']['Enums']['compartment_t'] {
  return x === 'systemic' || x === 'cns' || x === 'both'
}

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

export async function bulkAddSubstancesAction(
  _prev: BulkAddSubstancesState,
  formData: FormData,
): Promise<BulkAddSubstancesState> {
  const raw = String(formData.get('lines') ?? '')
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  if (lines.length === 0) {
    return { status: 'error', message: 'Paste one or more lines first.' }
  }
  if (lines.length > 200) {
    return { status: 'error', message: 'Too many lines (max 200 per bulk add).' }
  }

  const supabase = await createClient()

  let createdCount = 0
  const errors: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const fields = splitFields(line)

    const canonicalName = String(fields[0] ?? '').trim()
    const displayName = String(fields[1] ?? canonicalName).trim()
    const family = String(fields[2] ?? '').trim()
    const targetRaw = String(fields[3] ?? 'systemic').trim()

    if (!canonicalName) {
      errors.push(`Line ${i + 1}: canonical name is required.`)
      continue
    }
    if (!displayName) {
      errors.push(`Line ${i + 1}: display name is required.`)
      continue
    }
    if (!isCompartment(targetRaw)) {
      errors.push(`Line ${i + 1}: invalid target compartment ${JSON.stringify(targetRaw)}.`)
      continue
    }

    try {
      await createSubstance(supabase, {
        canonicalName,
        displayName,
        family: family || null,
        targetCompartmentDefault: targetRaw,
        notes: null,
      })
      createdCount++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Line ${i + 1} (${canonicalName}): ${msg}`)
    }
  }

  if (createdCount > 0) {
    revalidatePath('/substances')
  }

  return {
    status: 'success',
    message: `Created ${createdCount} substance${createdCount === 1 ? '' : 's'}.`,
    createdCount,
    errors,
  }
}

export async function deleteSubstanceAction(formData: FormData): Promise<void> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  if (!substanceId) return

  const supabase = await createClient()
  await softDeleteSubstance(supabase, { substanceId })
  revalidatePath('/substances')
}
