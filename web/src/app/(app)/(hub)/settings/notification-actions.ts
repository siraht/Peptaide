'use server'

import { revalidatePath } from 'next/cache'

import { ensureMyProfile, updateMyNotificationPrefs } from '@/lib/repos/profilesRepo'
import { createClient } from '@/lib/supabase/server'

export type UpdateNotificationPrefsState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function mustInt(raw: string, label: string): number {
  const t = raw.trim()
  if (!t) throw new Error(`${label} is required.`)
  const x = Number(t)
  if (!Number.isInteger(x)) throw new Error(`${label} must be an integer.`)
  return x
}

function mustNumber(raw: string, label: string): number {
  const t = raw.trim()
  if (!t) throw new Error(`${label} is required.`)
  const x = Number(t)
  if (!Number.isFinite(x)) throw new Error(`${label} must be a number.`)
  return x
}

export async function updateNotificationPrefsAction(
  _prev: UpdateNotificationPrefsState,
  formData: FormData,
): Promise<UpdateNotificationPrefsState> {
  const notifyLowStockEnabled = String(formData.get('notify_low_stock_enabled') ?? '') === 'on'
  const notifySpendEnabled = String(formData.get('notify_spend_enabled') ?? '') === 'on'

  const lowStockDaysRaw = String(formData.get('notify_low_stock_runway_days_threshold') ?? '')
  const spendUsdRaw = String(formData.get('notify_spend_usd_per_day_threshold') ?? '')
  const spendWindowRaw = String(formData.get('notify_spend_window_days') ?? '')

  let lowStockDays: number
  let spendUsdPerDay: number
  let spendWindowDays: number

  try {
    lowStockDays = mustInt(lowStockDaysRaw, 'Low stock runway threshold (days)')
    spendUsdPerDay = mustNumber(spendUsdRaw, 'Spend threshold (USD/day)')
    spendWindowDays = mustInt(spendWindowRaw, 'Spend window (days)')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  if (lowStockDays < 0) return { status: 'error', message: 'Low stock runway threshold must be >= 0.' }
  if (spendUsdPerDay < 0) return { status: 'error', message: 'Spend threshold must be >= 0.' }
  if (spendWindowDays < 1) return { status: 'error', message: 'Spend window must be >= 1 day.' }
  if (spendWindowDays > 365) return { status: 'error', message: 'Spend window must be <= 365 days.' }

  const supabase = await createClient()

  try {
    await ensureMyProfile(supabase)
    await updateMyNotificationPrefs(supabase, {
      notifyLowStockEnabled,
      notifyLowStockRunwayDaysThreshold: lowStockDays,
      notifySpendEnabled,
      notifySpendUsdPerDayThreshold: spendUsdPerDay,
      notifySpendWindowDays: spendWindowDays,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/settings')
  revalidatePath('/today')
  revalidatePath('/analytics')

  return { status: 'success', message: 'Notification settings saved.' }
}

