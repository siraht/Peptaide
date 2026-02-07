'use server'

import { revalidatePath } from 'next/cache'

import { createRoute, softDeleteRoute } from '@/lib/repos/routesRepo'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type CreateRouteState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export async function createRouteAction(
  _prev: CreateRouteState,
  formData: FormData,
): Promise<CreateRouteState> {
  const name = String(formData.get('name') ?? '').trim()
  const defaultInputKind = String(formData.get('default_input_kind') ?? '').trim()
  const defaultInputUnit = String(formData.get('default_input_unit') ?? '').trim()
  const supportsDeviceCalibration = String(formData.get('supports_device_calibration') ?? '') === 'on'
  const notes = String(formData.get('notes') ?? '').trim()

  if (!name) return { status: 'error', message: 'name is required.' }
  if (!defaultInputKind) return { status: 'error', message: 'default_input_kind is required.' }
  if (!defaultInputUnit) return { status: 'error', message: 'default_input_unit is required.' }

  function isRouteInputKind(x: string): x is Database['public']['Enums']['route_input_kind_t'] {
    return x === 'mass' || x === 'volume' || x === 'device_units' || x === 'iu'
  }

  if (!isRouteInputKind(defaultInputKind)) {
    return { status: 'error', message: 'Invalid default input kind.' }
  }

  const supabase = await createClient()

  try {
    await createRoute(supabase, {
      name,
      defaultInputKind,
      defaultInputUnit,
      supportsDeviceCalibration,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/routes')
  return { status: 'success', message: 'Created.' }
}

export async function deleteRouteAction(formData: FormData): Promise<void> {
  const routeId = String(formData.get('route_id') ?? '').trim()
  if (!routeId) return

  const supabase = await createClient()
  await softDeleteRoute(supabase, { routeId })
  revalidatePath('/routes')
}
