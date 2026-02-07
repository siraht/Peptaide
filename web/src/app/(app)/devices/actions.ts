'use server'

import { revalidatePath } from 'next/cache'

import { createDevice, softDeleteDevice } from '@/lib/repos/devicesRepo'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type CreateDeviceState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function isDeviceKind(x: string): x is Database['public']['Enums']['device_kind_t'] {
  return x === 'syringe' || x === 'spray' || x === 'dropper' || x === 'pen' || x === 'other'
}

export async function createDeviceAction(
  _prev: CreateDeviceState,
  formData: FormData,
): Promise<CreateDeviceState> {
  const name = String(formData.get('name') ?? '').trim()
  const deviceKindRaw = String(formData.get('device_kind') ?? '').trim()
  const defaultUnit = String(formData.get('default_unit') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!name) return { status: 'error', message: 'name is required.' }
  if (!defaultUnit) return { status: 'error', message: 'default_unit is required.' }
  if (!isDeviceKind(deviceKindRaw)) return { status: 'error', message: 'Invalid device_kind.' }

  const supabase = await createClient()

  try {
    await createDevice(supabase, {
      name,
      deviceKind: deviceKindRaw,
      defaultUnit,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/devices')
  return { status: 'success', message: 'Created.' }
}

export async function deleteDeviceAction(formData: FormData): Promise<void> {
  const deviceId = String(formData.get('device_id') ?? '').trim()
  if (!deviceId) return

  const supabase = await createClient()
  await softDeleteDevice(supabase, { deviceId })
  revalidatePath('/devices')
}

