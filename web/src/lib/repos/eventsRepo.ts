import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type EventEnrichedRow = Database['public']['Views']['v_event_enriched']['Row']
export type AdministrationEventRow = Database['public']['Tables']['administration_events']['Row']

export async function getAdministrationEventById(
  supabase: DbClient,
  opts: { eventId: string },
): Promise<AdministrationEventRow | null> {
  const res = await supabase
    .from('administration_events')
    .select('*')
    .eq('id', opts.eventId)
    .maybeSingle()

  requireOk(res.error, 'administration_events.select_by_id')
  return res.data
}

export async function listEventsEnrichedInRange(
  supabase: DbClient,
  opts: { startTs: string; endTs: string },
): Promise<EventEnrichedRow[]> {
  const { startTs, endTs } = opts

  const res = await supabase
    .from('v_event_enriched')
    .select('*')
    .is('deleted_at', null)
    .gte('ts', startTs)
    .lt('ts', endTs)
    .order('ts', { ascending: true })
  return requireData(res.data, res.error, 'v_event_enriched.select_range')
}

export async function listEventsEnrichedForCycle(
  supabase: DbClient,
  opts: { cycleInstanceId: string; includeDeleted?: boolean },
): Promise<EventEnrichedRow[]> {
  const { cycleInstanceId, includeDeleted = false } = opts
  if (!cycleInstanceId) return []

  let q = supabase.from('v_event_enriched').select('*').eq('cycle_instance_id', cycleInstanceId)
  if (!includeDeleted) {
    q = q.is('deleted_at', null)
  }

  const res = await q.order('ts', { ascending: true })
  requireOk(res.error, 'v_event_enriched.select_for_cycle')
  return res.data ?? []
}

export async function listRecentEventsEnriched(
  supabase: DbClient,
  opts: { limit: number; includeDeleted?: boolean; deletedOnly?: boolean },
): Promise<EventEnrichedRow[]> {
  const { limit, includeDeleted = false, deletedOnly = false } = opts
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer.')
  }

  let q = supabase.from('v_event_enriched').select('*')

  if (deletedOnly) {
    q = q.not('deleted_at', 'is', null)
  } else if (!includeDeleted) {
    q = q.is('deleted_at', null)
  }

  const res = await q.order('ts', { ascending: false }).limit(limit)
  requireOk(res.error, 'v_event_enriched.select_recent')
  return res.data ?? []
}

export async function listTodayEventsEnriched(
  supabase: DbClient,
  opts: { limit?: number; includeDeleted?: boolean; deletedOnly?: boolean } = {},
): Promise<EventEnrichedRow[]> {
  const { limit = 200, includeDeleted = false, deletedOnly = false } = opts
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer.')
  }

  let q = supabase.from('v_events_today').select('*')

  if (deletedOnly) {
    q = q.not('deleted_at', 'is', null)
  } else if (!includeDeleted) {
    q = q.is('deleted_at', null)
  }

  const res = await q.order('ts', { ascending: true }).limit(limit)
  requireOk(res.error, 'v_events_today.select')
  return res.data ?? []
}

export async function getLastEventEnrichedForSubstance(
  supabase: DbClient,
  opts: { substanceId: string },
): Promise<Pick<EventEnrichedRow, 'ts' | 'cycle_instance_id'> | null> {
  const res = await supabase
    .from('v_event_enriched')
    .select('ts, cycle_instance_id')
    .eq('substance_id', opts.substanceId)
    .is('deleted_at', null)
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle()
  requireOk(res.error, 'v_event_enriched.select_last_for_substance')
  return res.data
}
