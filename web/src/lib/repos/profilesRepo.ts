import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type ProfileRow = Database['public']['Tables']['profiles']['Row']

export async function getMyProfile(supabase: DbClient): Promise<ProfileRow | null> {
  const res = await supabase.from('profiles').select('*').maybeSingle()
  requireOk(res.error, 'profiles.select')
  return res.data
}

export async function ensureMyProfile(supabase: DbClient): Promise<ProfileRow> {
  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) {
    throw new Error('Not authenticated (cannot ensure profile).')
  }

  // Prefer a single round-trip that returns the row. A follow-up `select()` has shown rare
  // flakes under load where it returns no rows even after a successful upsert.
  const res = await supabase
    .from('profiles')
    .upsert({ user_id: user.id }, { onConflict: 'user_id' })
    .select('*')
    .maybeSingle()

  return requireData(res.data, res.error, 'profiles.upsert_select')
}

export async function updateMyProfile(
  supabase: DbClient,
  opts: {
    timezone: string
    defaultMassUnit: string
    defaultVolumeUnit: string
    defaultSimulationN: number
    cycleGapDefaultDays: number
  },
): Promise<ProfileRow> {
  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) {
    throw new Error('Not authenticated (cannot update profile).')
  }

  const res = await supabase
    .from('profiles')
    .update({
      timezone: opts.timezone,
      default_mass_unit: opts.defaultMassUnit,
      default_volume_unit: opts.defaultVolumeUnit,
      default_simulation_n: opts.defaultSimulationN,
      cycle_gap_default_days: opts.cycleGapDefaultDays,
    })
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle()

  return requireData(res.data, res.error, 'profiles.update')
}

export async function updateMyNotificationPrefs(
  supabase: DbClient,
  opts: {
    notifyLowStockEnabled: boolean
    notifyLowStockRunwayDaysThreshold: number
    notifySpendEnabled: boolean
    notifySpendUsdPerDayThreshold: number
    notifySpendWindowDays: number
  },
): Promise<ProfileRow> {
  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) {
    throw new Error('Not authenticated (cannot update notification prefs).')
  }

  const res = await supabase
    .from('profiles')
    .update({
      notify_low_stock_enabled: opts.notifyLowStockEnabled,
      notify_low_stock_runway_days_threshold: opts.notifyLowStockRunwayDaysThreshold,
      notify_spend_enabled: opts.notifySpendEnabled,
      notify_spend_usd_per_day_threshold: opts.notifySpendUsdPerDayThreshold,
      notify_spend_window_days: opts.notifySpendWindowDays,
    })
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle()

  return requireData(res.data, res.error, 'profiles.update_notify_prefs')
}
