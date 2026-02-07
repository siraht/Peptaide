import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type RouteRow = Database['public']['Tables']['routes']['Row']

export async function listRoutes(supabase: DbClient): Promise<RouteRow[]> {
  const res = await supabase
    .from('routes')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  return requireData(res.data, res.error, 'routes.select')
}

export async function createRoute(
  supabase: DbClient,
  opts: {
    name: string
    defaultInputKind: Database['public']['Enums']['route_input_kind_t']
    defaultInputUnit: string
    supportsDeviceCalibration: boolean
    notes: string | null
  },
): Promise<RouteRow> {
  const { name, defaultInputKind, defaultInputUnit, supportsDeviceCalibration, notes } = opts

  const res = await supabase
    .from('routes')
    .insert({
      name,
      default_input_kind: defaultInputKind,
      default_input_unit: defaultInputUnit,
      supports_device_calibration: supportsDeviceCalibration,
      notes,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'routes.insert')
}

export async function softDeleteRoute(
  supabase: DbClient,
  opts: { routeId: string },
): Promise<void> {
  const res = await supabase
    .from('routes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.routeId)
    .is('deleted_at', null)

  requireOk(res.error, 'routes.soft_delete')
}

