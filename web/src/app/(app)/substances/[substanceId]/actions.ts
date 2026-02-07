'use server'

import { revalidatePath } from 'next/cache'

import { setBioavailabilitySpec } from '@/lib/repos/bioavailabilitySpecsRepo'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type SetBioavailabilitySpecState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function isCompartment(
  x: string,
): x is Extract<Database['public']['Enums']['compartment_t'], 'systemic' | 'cns'> {
  return x === 'systemic' || x === 'cns'
}

export async function setBioavailabilitySpecAction(
  _prev: SetBioavailabilitySpecState,
  formData: FormData,
): Promise<SetBioavailabilitySpecState> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const routeId = String(formData.get('route_id') ?? '').trim()
  const compartmentRaw = String(formData.get('compartment') ?? '').trim()
  const baseFractionDistId = String(formData.get('base_fraction_dist_id') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!substanceId) return { status: 'error', message: 'Missing substance_id.' }
  if (!routeId) return { status: 'error', message: 'route_id is required.' }
  if (!isCompartment(compartmentRaw)) return { status: 'error', message: 'Invalid compartment.' }
  if (!baseFractionDistId) return { status: 'error', message: 'base_fraction_dist_id is required.' }

  const supabase = await createClient()

  try {
    await setBioavailabilitySpec(supabase, {
      substanceId,
      routeId,
      compartment: compartmentRaw,
      baseFractionDistId,
      notes: notes || null,
      evidenceSourceId: null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath(`/substances/${substanceId}`)
  return { status: 'success', message: 'Saved.' }
}

