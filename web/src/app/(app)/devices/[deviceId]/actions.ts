'use server'

import { revalidatePath } from 'next/cache'

import {
  createDeviceCalibration,
  softDeleteDeviceCalibration,
} from '@/lib/repos/deviceCalibrationsRepo'
import { normalizeDeviceUnitLabel } from '@/lib/domain/units/types'
import { createClient } from '@/lib/supabase/server'

export type CreateDeviceCalibrationState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export async function createDeviceCalibrationAction(
  _prev: CreateDeviceCalibrationState,
  formData: FormData,
): Promise<CreateDeviceCalibrationState> {
  const deviceId = String(formData.get('device_id') ?? '').trim()
  const routeId = String(formData.get('route_id') ?? '').trim()
  const unitLabelRaw = String(formData.get('unit_label') ?? '').trim()
  const volumeDistId = String(formData.get('volume_ml_per_unit_dist_id') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!deviceId) return { status: 'error', message: 'Missing device_id.' }
  if (!routeId) return { status: 'error', message: 'route_id is required.' }
  if (!unitLabelRaw) return { status: 'error', message: 'unit_label is required.' }
  if (!volumeDistId) {
    return {
      status: 'error',
      message: 'volume_ml_per_unit_dist_id is required (create a volume_ml_per_unit distribution first).',
    }
  }

  const unitLabel = normalizeDeviceUnitLabel(unitLabelRaw)
  if (!unitLabel) return { status: 'error', message: 'unit_label is required.' }

  const supabase = await createClient()

  try {
    await createDeviceCalibration(supabase, {
      deviceId,
      routeId,
      unitLabel,
      volumeMlPerUnitDistId: volumeDistId,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath(`/devices/${deviceId}`)
  return { status: 'success', message: 'Created.' }
}

export async function deleteDeviceCalibrationAction(formData: FormData): Promise<void> {
  const deviceId = String(formData.get('device_id') ?? '').trim()
  const calibrationId = String(formData.get('calibration_id') ?? '').trim()
  if (!deviceId || !calibrationId) return

  const supabase = await createClient()
  await softDeleteDeviceCalibration(supabase, { calibrationId })
  revalidatePath(`/devices/${deviceId}`)
}
