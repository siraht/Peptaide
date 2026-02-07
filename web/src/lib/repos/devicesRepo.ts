import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type DeviceRow = Database['public']['Tables']['devices']['Row']

export async function listDevices(supabase: DbClient): Promise<DeviceRow[]> {
  const res = await supabase
    .from('devices')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  return requireData(res.data, res.error, 'devices.select')
}

export async function getDeviceById(
  supabase: DbClient,
  opts: { deviceId: string },
): Promise<DeviceRow | null> {
  const res = await supabase
    .from('devices')
    .select('*')
    .eq('id', opts.deviceId)
    .is('deleted_at', null)
    .maybeSingle()
  requireOk(res.error, 'devices.select_by_id')
  return res.data
}

export async function createDevice(
  supabase: DbClient,
  opts: {
    name: string
    deviceKind: Database['public']['Enums']['device_kind_t']
    defaultUnit: string
    notes: string | null
  },
): Promise<DeviceRow> {
  const { name, deviceKind, defaultUnit, notes } = opts

  const res = await supabase
    .from('devices')
    .insert({
      name,
      device_kind: deviceKind,
      default_unit: defaultUnit,
      notes,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'devices.insert')
}

export async function softDeleteDevice(supabase: DbClient, opts: { deviceId: string }): Promise<void> {
  const res = await supabase
    .from('devices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.deviceId)
    .is('deleted_at', null)

  requireOk(res.error, 'devices.soft_delete')
}
