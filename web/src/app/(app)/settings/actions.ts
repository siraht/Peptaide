'use server'

import { revalidatePath } from 'next/cache'

import { ensureMyProfile, updateMyProfile } from '@/lib/repos/profilesRepo'
import { createClient } from '@/lib/supabase/server'

export type UpdateProfileState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function isValidIanaTimezone(tz: string): boolean {
  try {
    // Throws RangeError on invalid IANA names.
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return true
  } catch {
    return false
  }
}

function mustInt(raw: string, label: string): number {
  const t = raw.trim()
  if (!t) {
    throw new Error(`${label} is required.`)
  }
  const x = Number(t)
  if (!Number.isInteger(x)) {
    throw new Error(`${label} must be an integer.`)
  }
  return x
}

function isMassUnit(x: string): boolean {
  return x === 'mg' || x === 'mcg' || x === 'g'
}

function isVolumeUnit(x: string): boolean {
  return x === 'mL' || x === 'cc' || x === 'uL'
}

export async function updateProfileAction(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const timezone = String(formData.get('timezone') ?? '').trim()
  const defaultMassUnit = String(formData.get('default_mass_unit') ?? '').trim()
  const defaultVolumeUnit = String(formData.get('default_volume_unit') ?? '').trim()
  const defaultSimulationNRaw = String(formData.get('default_simulation_n') ?? '').trim()
  const cycleGapDefaultDaysRaw = String(formData.get('cycle_gap_default_days') ?? '').trim()

  if (!timezone) return { status: 'error', message: 'timezone is required.' }
  if (!isValidIanaTimezone(timezone)) {
    return {
      status: 'error',
      message: 'timezone must be a valid IANA timezone name (e.g. "America/Los_Angeles").',
    }
  }
  if (!isMassUnit(defaultMassUnit)) {
    return { status: 'error', message: 'default_mass_unit must be one of: mg, mcg, g.' }
  }
  if (!isVolumeUnit(defaultVolumeUnit)) {
    return { status: 'error', message: 'default_volume_unit must be one of: mL, cc, uL.' }
  }

  let defaultSimulationN: number
  let cycleGapDefaultDays: number

  try {
    defaultSimulationN = mustInt(defaultSimulationNRaw, 'default_simulation_n')
    cycleGapDefaultDays = mustInt(cycleGapDefaultDaysRaw, 'cycle_gap_default_days')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  if (defaultSimulationN <= 0) {
    return { status: 'error', message: 'default_simulation_n must be > 0.' }
  }
  if (cycleGapDefaultDays < 0) {
    return { status: 'error', message: 'cycle_gap_default_days must be >= 0.' }
  }

  const supabase = await createClient()

  try {
    await ensureMyProfile(supabase)
    await updateMyProfile(supabase, {
      timezone,
      defaultMassUnit,
      defaultVolumeUnit,
      defaultSimulationN,
      cycleGapDefaultDays,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/settings')
  revalidatePath('/today')
  revalidatePath('/analytics')
  return { status: 'success', message: 'Updated.' }
}
