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

  const upsertRes = await supabase
    .from('profiles')
    .upsert({ user_id: user.id }, { onConflict: 'user_id' })
  requireOk(upsertRes.error, 'profiles.upsert')

  const profileRes = await supabase.from('profiles').select('*').maybeSingle()
  return requireData(profileRes.data, profileRes.error, 'profiles.select_after_upsert')
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
