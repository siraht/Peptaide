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

function isJwtIatFutureMessage(msg: string): boolean {
  return msg.toLowerCase().includes('jwt issued at future')
}

async function sleep(ms: number): Promise<void> {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return
  await new Promise((r) => setTimeout(r, n))
}

export async function listFormulationsEnriched(
  supabase: DbClient,
): Promise<FormulationEnriched[]> {
  // Local Supabase can occasionally return "JWT issued at future" immediately after stack resets
  // (container clock skew). Retry briefly so authed pages don't 500 on first load.
  const maxAttempts = 20

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
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

      const substancesPromise =
        substanceIds.length === 0
          ? Promise.resolve({ data: [] as SubstanceRow[], error: null })
          : supabase.from('substances').select('*').in('id', substanceIds).is('deleted_at', null)
      const routesPromise =
        routeIds.length === 0
          ? Promise.resolve({ data: [] as RouteRow[], error: null })
          : supabase.from('routes').select('*').in('id', routeIds).is('deleted_at', null)
      const devicesPromise =
        deviceIds.length === 0
          ? Promise.resolve({ data: [] as DeviceRow[], error: null })
          : supabase.from('devices').select('*').in('id', deviceIds).is('deleted_at', null)

      const [substancesRes, routesRes, devicesRes] = await Promise.all([
        substancesPromise,
        routesPromise,
        devicesPromise,
      ])

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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!isJwtIatFutureMessage(msg)) throw e
      if (attempt === maxAttempts) {
        console.warn('formulations.select: JWT issued at future persisted after retries; returning empty list', e)
        return []
      }

      // Cap the backoff so we wait long enough for clock skew to resolve without making
      // any single request "hang" for too long. Total wait (20 attempts) is ~31s.
      await sleep(Math.min(200 * attempt, 2000))
    }
  }

  return []
}

export async function getFormulationEnrichedById(
  supabase: DbClient,
  opts: { formulationId: string },
): Promise<FormulationEnriched | null> {
  const formulationRes = await supabase
    .from('formulations')
    .select('*')
    .eq('id', opts.formulationId)
    .is('deleted_at', null)
    .maybeSingle()
  requireOk(formulationRes.error, 'formulations.select_by_id')

  const formulation = formulationRes.data
  if (!formulation) return null

  const [substanceRes, routeRes, deviceRes] = await Promise.all([
    supabase.from('substances').select('*').eq('id', formulation.substance_id).is('deleted_at', null).maybeSingle(),
    supabase.from('routes').select('*').eq('id', formulation.route_id).is('deleted_at', null).maybeSingle(),
    formulation.device_id
      ? supabase.from('devices').select('*').eq('id', formulation.device_id).is('deleted_at', null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  requireOk(substanceRes.error, 'substances.select_by_id')
  requireOk(routeRes.error, 'routes.select_by_id')
  requireOk(deviceRes.error, 'devices.select_by_id')

  return {
    formulation,
    substance: substanceRes.data ?? null,
    route: routeRes.data ?? null,
    device: deviceRes.data ?? null,
  }
}

export async function createFormulation(
  supabase: DbClient,
  opts: {
    substanceId: string
    routeId: string
    deviceId: string | null
    name: string
    isDefaultForRoute: boolean
    notes: string | null
  },
): Promise<FormulationRow> {
  const { substanceId, routeId, deviceId, name, isDefaultForRoute, notes } = opts

  const res = await supabase
    .from('formulations')
    .insert({
      substance_id: substanceId,
      route_id: routeId,
      device_id: deviceId,
      name,
      is_default_for_route: isDefaultForRoute,
      notes,
    })
    .select('*')
    .single()
  return requireData(res.data, res.error, 'formulations.insert')
}
