import type { DbClient } from './types'
import { requireData } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type SpendRow = Database['public']['Views']['v_spend_daily_weekly_monthly']['Row']

export async function listSpendRollups(
  supabase: DbClient,
  opts?: { periodKind?: 'day' | 'week' | 'month'; sincePeriodStartDate?: string },
): Promise<SpendRow[]> {
  const period = opts?.periodKind ?? null
  const since = opts?.sincePeriodStartDate ?? null

  let q = supabase.from('v_spend_daily_weekly_monthly').select('*')
  if (period) {
    q = q.eq('period_kind', period)
  }
  if (since) {
    q = q.gte('period_start_date', since)
  }
  const res = await q.order('period_start_date', { ascending: false })
  return requireData(res.data, res.error, 'v_spend_daily_weekly_monthly.select')
}

