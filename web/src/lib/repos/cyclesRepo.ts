import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type CycleRuleRow = Database['public']['Tables']['cycle_rules']['Row']
export type CycleInstanceRow = Database['public']['Tables']['cycle_instances']['Row']

export async function getCycleInstanceById(
  supabase: DbClient,
  opts: { cycleInstanceId: string },
): Promise<CycleInstanceRow | null> {
  const res = await supabase
    .from('cycle_instances')
    .select('*')
    .eq('id', opts.cycleInstanceId)
    .is('deleted_at', null)
    .maybeSingle()

  requireOk(res.error, 'cycle_instances.select_by_id')
  return res.data
}

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

export async function setCycleRuleForSubstance(
  supabase: DbClient,
  opts: {
    substanceId: string
    gapDaysToSuggestNewCycle: number
    autoStartFirstCycle: boolean
    notes: string | null
  },
): Promise<CycleRuleRow> {
  const insertRes = await supabase
    .from('cycle_rules')
    .insert({
      substance_id: opts.substanceId,
      gap_days_to_suggest_new_cycle: opts.gapDaysToSuggestNewCycle,
      auto_start_first_cycle: opts.autoStartFirstCycle,
      notes: opts.notes,
    })
    .select('*')
    .single()

  // If the unique constraint already exists, update in-place (and clear deleted_at if it was soft-deleted).
  if (insertRes.error?.code === '23505') {
    const updateRes = await supabase
      .from('cycle_rules')
      .update({
        gap_days_to_suggest_new_cycle: opts.gapDaysToSuggestNewCycle,
        auto_start_first_cycle: opts.autoStartFirstCycle,
        notes: opts.notes,
        deleted_at: null,
      })
      .eq('substance_id', opts.substanceId)
      .select('*')
      .single()

    return requireData(updateRes.data, updateRes.error, 'cycle_rules.update')
  }

  return requireData(insertRes.data, insertRes.error, 'cycle_rules.insert')
}

export async function softDeleteCycleRule(
  supabase: DbClient,
  opts: { cycleRuleId: string },
): Promise<void> {
  const res = await supabase
    .from('cycle_rules')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', opts.cycleRuleId)
    .is('deleted_at', null)

  requireOk(res.error, 'cycle_rules.soft_delete')
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

export async function abandonCycleInstance(
  supabase: DbClient,
  opts: { cycleInstanceId: string; endTs: string },
): Promise<void> {
  const res = await supabase
    .from('cycle_instances')
    .update({ status: 'abandoned', end_ts: opts.endTs })
    .eq('id', opts.cycleInstanceId)
    .is('deleted_at', null)

  requireOk(res.error, 'cycle_instances.abandon')
}
