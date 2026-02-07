import type { DbClient } from './types'
import { requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type DeviceCalibrationRow =
  Database['public']['Tables']['device_calibrations']['Row']

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

