import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type CycleRuleRow = Database['public']['Tables']['cycle_rules']['Row']
export type CycleInstanceRow = Database['public']['Tables']['cycle_instances']['Row']

export async function getCycleRuleForSubstance(
  supabase: DbClient,
  opts: { substanceId: string },
): Promise<CycleRuleRow | null> {
  const res = await supabase
    .from('cycle_rules')
    .select('*')
    .eq('substance_id', opts.substanceId)
    .is('deleted_at', null)
    .maybeSingle()
  requireOk(res.error, 'cycle_rules.select_by_substance')
  return res.data
}

export async function getActiveCycleForSubstance(
  supabase: DbClient,
  opts: { substanceId: string },
): Promise<CycleInstanceRow | null> {
  const res = await supabase
    .from('cycle_instances')
    .select('*')
    .eq('substance_id', opts.substanceId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()
  requireOk(res.error, 'cycle_instances.select_active')
  return res.data
}

export async function getLastCycleForSubstance(
  supabase: DbClient,
  opts: { substanceId: string },
): Promise<CycleInstanceRow | null> {
  const res = await supabase
    .from('cycle_instances')
    .select('*')
    .eq('substance_id', opts.substanceId)
    .is('deleted_at', null)
    .order('cycle_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  requireOk(res.error, 'cycle_instances.select_last')
  return res.data
}

export async function createCycleInstance(
  supabase: DbClient,
  opts: {
    substanceId: string
    cycleNumber: number
    startTs: string
    status: Database['public']['Enums']['cycle_status_t']
    goal: string | null
    notes: string | null
  },
): Promise<CycleInstanceRow> {
  const { substanceId, cycleNumber, startTs, status, goal, notes } = opts

  const res = await supabase
    .from('cycle_instances')
    .insert({
      substance_id: substanceId,
      cycle_number: cycleNumber,
      start_ts: startTs,
      status,
      goal,
      notes,
    })
    .select('*')
    .single()

  return requireData(res.data, res.error, 'cycle_instances.insert')
}

export async function completeCycleInstance(
  supabase: DbClient,
  opts: { cycleInstanceId: string; endTs: string },
): Promise<void> {
  const res = await supabase
    .from('cycle_instances')
    .update({ status: 'completed', end_ts: opts.endTs })
    .eq('id', opts.cycleInstanceId)
    .is('deleted_at', null)

  requireOk(res.error, 'cycle_instances.complete')
}

