'use server'

import { revalidatePath } from 'next/cache'

import { createRoute, softDeleteRoute } from '@/lib/repos/routesRepo'
import { toUserFacingDbErrorMessage } from '@/lib/errors/userFacingDbError'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type CreateRouteState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export type BulkAddRoutesState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'success'
      message: string
      createdCount: number
      errors: string[]
    }

function isRouteInputKind(x: string): x is Database['public']['Enums']['route_input_kind_t'] {
  return x === 'mass' || x === 'volume' || x === 'device_units' || x === 'iu'
}

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
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath('/routes')
  return { status: 'success', message: 'Created.' }
}

export async function bulkAddRoutesAction(
  _prev: BulkAddRoutesState,
  formData: FormData,
): Promise<BulkAddRoutesState> {
  const raw = String(formData.get('lines') ?? '')
  const defaultInputKind = String(formData.get('default_input_kind') ?? '').trim()
  const defaultInputUnit = String(formData.get('default_input_unit') ?? '').trim()
  const supportsDeviceCalibration = String(formData.get('supports_device_calibration') ?? '') === 'on'

  if (!defaultInputKind) return { status: 'error', message: 'default_input_kind is required.' }
  if (!defaultInputUnit) return { status: 'error', message: 'default_input_unit is required.' }
  if (!isRouteInputKind(defaultInputKind)) {
    return { status: 'error', message: 'Invalid default input kind.' }
  }

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
    const name = lines[i]!
    try {
      await createRoute(supabase, {
        name,
        defaultInputKind,
        defaultInputUnit,
        supportsDeviceCalibration,
        notes: null,
      })
      createdCount++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Line ${i + 1} (${name}): ${toUserFacingDbErrorMessage(msg) ?? msg}`)
    }
  }

  if (createdCount > 0) {
    revalidatePath('/routes')
  }

  const createdPart =
    createdCount === 0 ? 'No routes created' : `Created ${createdCount} route${createdCount === 1 ? '' : 's'}`
  const errorSuffix =
    errors.length > 0 ? ` (${errors.length} error${errors.length === 1 ? '' : 's'})` : ''

  return {
    status: 'success',
    message: `${createdPart}${errorSuffix}.`,
    createdCount,
    errors,
  }
}

export async function deleteRouteAction(formData: FormData): Promise<void> {
  const routeId = String(formData.get('route_id') ?? '').trim()
  if (!routeId) return

  const supabase = await createClient()
  await softDeleteRoute(supabase, { routeId })
  revalidatePath('/routes')
}
