'use server'

import { revalidatePath } from 'next/cache'

import { createFormulation } from '@/lib/repos/formulationsRepo'
import { createClient } from '@/lib/supabase/server'

export type CreateFormulationState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export async function createFormulationAction(
  _prev: CreateFormulationState,
  formData: FormData,
): Promise<CreateFormulationState> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const routeId = String(formData.get('route_id') ?? '').trim()
  const deviceIdRaw = String(formData.get('device_id') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const isDefaultForRoute = String(formData.get('is_default_for_route') ?? '') === 'on'
  const notes = String(formData.get('notes') ?? '').trim()

  if (!substanceId) return { status: 'error', message: 'substance is required.' }
  if (!routeId) return { status: 'error', message: 'route is required.' }
  if (!name) return { status: 'error', message: 'name is required.' }

  const supabase = await createClient()

  try {
    await createFormulation(supabase, {
      substanceId,
      routeId,
      deviceId: deviceIdRaw ? deviceIdRaw : null,
      name,
      isDefaultForRoute,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/formulations')
  return { status: 'success', message: 'Created.' }
}

