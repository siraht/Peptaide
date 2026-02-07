import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type FormulationRow = Database['public']['Tables']['formulations']['Row']
export type SubstanceRow = Database['public']['Tables']['substances']['Row']
export type RouteRow = Database['public']['Tables']['routes']['Row']
export type DeviceRow = Database['public']['Tables']['devices']['Row']

export type FormulationEnriched = {
  formulation: FormulationRow
  substance: SubstanceRow | null
  route: RouteRow | null
  device: DeviceRow | null
}

function uniq(ids: string[]): string[] {
  return [...new Set(ids)]
}

function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>()
  for (const r of rows) m.set(r.id, r)
  return m
}

export async function listFormulationsEnriched(
  supabase: DbClient,
): Promise<FormulationEnriched[]> {
  const formulationsRes = await supabase
    .from('formulations')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  const formulations = requireData(
    formulationsRes.data,
    formulationsRes.error,
    'formulations.select',
  )

  const substanceIds = uniq(formulations.map((f) => f.substance_id))
  const routeIds = uniq(formulations.map((f) => f.route_id))
  const deviceIds = uniq(
    formulations
      .map((f) => f.device_id)
      .filter((id): id is string => id != null),
  )

  const substancesRes =
    substanceIds.length === 0
      ? { data: [] as SubstanceRow[], error: null }
      : await supabase
          .from('substances')
          .select('*')
          .in('id', substanceIds)
          .is('deleted_at', null)
  const routesRes =
    routeIds.length === 0
      ? { data: [] as RouteRow[], error: null }
      : await supabase.from('routes').select('*').in('id', routeIds).is('deleted_at', null)
  const devicesRes =
    deviceIds.length === 0
      ? { data: [] as DeviceRow[], error: null }
      : await supabase
          .from('devices')
          .select('*')
          .in('id', deviceIds)
          .is('deleted_at', null)

  requireOk(substancesRes.error, 'substances.select_by_id')
  requireOk(routesRes.error, 'routes.select_by_id')
  requireOk(devicesRes.error, 'devices.select_by_id')

  const substancesById = indexById(substancesRes.data ?? [])
  const routesById = indexById(routesRes.data ?? [])
  const devicesById = indexById(devicesRes.data ?? [])

  return formulations.map((f) => ({
    formulation: f,
    substance: substancesById.get(f.substance_id) ?? null,
    route: routesById.get(f.route_id) ?? null,
    device: f.device_id ? devicesById.get(f.device_id) ?? null : null,
  }))
}

