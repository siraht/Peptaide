import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type DeviceCalibrationRow =
  Database['public']['Tables']['device_calibrations']['Row']

export async function listDeviceCalibrationsForDevice(opts: {
  supabase: DbClient
  deviceId: string
}): Promise<DeviceCalibrationRow[]> {
  const { supabase, deviceId } = opts

  const res = await supabase
    .from('device_calibrations')
    .select('*')
    .eq('device_id', deviceId)
    .is('deleted_at', null)
    .order('route_id', { ascending: true })
    .order('unit_label', { ascending: true })

  return requireData(res.data, res.error, 'device_calibrations.select_for_device')
}

export async function getDeviceCalibration(opts: {
  supabase: DbClient
  deviceId: string
  routeId: string
  unitLabel: string
}): Promise<DeviceCalibrationRow | null> {
  const { supabase, deviceId, routeId, unitLabel } = opts

  const res = await supabase
    .from('device_calibrations')
    .select('*')
    .eq('device_id', deviceId)
    .eq('route_id', routeId)
    .eq('unit_label', unitLabel)
    .is('deleted_at', null)
    .maybeSingle()

  requireOk(res.error, 'device_calibrations.select')
  return res.data
}

export async function createDeviceCalibration(
  supabase: DbClient,
  opts: {
    deviceId: string
    routeId: string
    unitLabel: string
    volumeMlPerUnitDistId: string | null
    notes: string | null
  },
): Promise<DeviceCalibrationRow> {
  const { deviceId, routeId, unitLabel, volumeMlPerUnitDistId, notes } = opts

  const res = await supabase
    .from('device_calibrations')
    .insert({
      device_id: deviceId,
      route_id: routeId,
      unit_label: unitLabel,
      volume_ml_per_unit_dist_id: volumeMlPerUnitDistId,
      notes,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'device_calibrations.insert')
}

export async function softDeleteDeviceCalibration(
  supabase: DbClient,
  opts: { calibrationId: string },
): Promise<void> {
  const res = await supabase
    .from('device_calibrations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.calibrationId)
    .is('deleted_at', null)

  requireOk(res.error, 'device_calibrations.soft_delete')
}
