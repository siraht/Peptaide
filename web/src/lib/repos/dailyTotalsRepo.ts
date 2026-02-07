import type { DbClient } from './types'
import { requireData } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type DailyTotalsAdminRow = Database['public']['Views']['v_daily_totals_admin']['Row']
export type DailyTotalsEffectiveSystemicRow =
  Database['public']['Views']['v_daily_totals_effective_systemic']['Row']
export type DailyTotalsEffectiveCnsRow =
  Database['public']['Views']['v_daily_totals_effective_cns']['Row']

export async function listDailyTotalsAdmin(
  supabase: DbClient,
  opts?: { sinceDayLocal?: string },
): Promise<DailyTotalsAdminRow[]> {
  const since = opts?.sinceDayLocal ?? null

  let q = supabase.from('v_daily_totals_admin').select('*')
  if (since) {
    q = q.gte('day_local', since)
  }
  const res = await q.order('day_local', { ascending: false }).order('substance_name', { ascending: true })
  return requireData(res.data, res.error, 'v_daily_totals_admin.select')
}

export async function listDailyTotalsEffectiveSystemic(
  supabase: DbClient,
  opts?: { sinceDayLocal?: string },
): Promise<DailyTotalsEffectiveSystemicRow[]> {
  const since = opts?.sinceDayLocal ?? null

  let q = supabase.from('v_daily_totals_effective_systemic').select('*')
  if (since) {
    q = q.gte('day_local', since)
  }
  const res = await q.order('day_local', { ascending: false }).order('substance_name', { ascending: true })
  return requireData(res.data, res.error, 'v_daily_totals_effective_systemic.select')
}

export async function listDailyTotalsEffectiveCns(
  supabase: DbClient,
  opts?: { sinceDayLocal?: string },
): Promise<DailyTotalsEffectiveCnsRow[]> {
  const since = opts?.sinceDayLocal ?? null

  let q = supabase.from('v_daily_totals_effective_cns').select('*')
  if (since) {
    q = q.gte('day_local', since)
  }
  const res = await q.order('day_local', { ascending: false }).order('substance_name', { ascending: true })
  return requireData(res.data, res.error, 'v_daily_totals_effective_cns.select')
}

