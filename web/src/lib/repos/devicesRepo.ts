import type { DbClient } from './types'
import { requireData } from './errors'

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

