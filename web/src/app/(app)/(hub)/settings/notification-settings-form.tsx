'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/toast/use-toast'
import type { ProfileRow } from '@/lib/repos/profilesRepo'

import type { UpdateNotificationPrefsState } from './notification-actions'
import { updateNotificationPrefsAction } from './notification-actions'

export function NotificationSettingsForm(props: { profile: ProfileRow }) {
  const { profile } = props
  const router = useRouter()
  const { pushToast } = useToast()

  const [state, formAction] = useActionState<UpdateNotificationPrefsState, FormData>(updateNotificationPrefsAction, {
    status: 'idle',
  })

  useEffect(() => {
    if (state.status !== 'success') return
    pushToast({ kind: 'success', title: 'Saved', message: state.message })
    router.refresh()
  }, [pushToast, router, state])

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm" id="notifications">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Peptaide surfaces in-app alerts when your data suggests something needs attention. These alerts are computed on demand
        from inventory and spend rollups.
      </p>

      <form className="mt-4 space-y-4" action={formAction} data-e2e="settings-notifications-form">
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="material-icons text-slate-400" aria-hidden="true">
                  science
                </span>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Low stock runway</div>
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Trigger when estimated runway is below your threshold, based on your recent usage.
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 shrink-0">
              <input
                type="checkbox"
                name="notify_low_stock_enabled"
                defaultChecked={Boolean(profile.notify_low_stock_enabled)}
                className="h-4 w-4 accent-primary"
                data-e2e="notify-low-stock-enabled"
              />
              Enabled
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-700 dark:text-slate-300">Runway threshold (days)</span>
              <input
                className="h-10 rounded-md bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 px-3 text-sm text-slate-900 dark:text-slate-100"
                name="notify_low_stock_runway_days_threshold"
                defaultValue={profile.notify_low_stock_runway_days_threshold ?? 7}
                inputMode="numeric"
                data-e2e="notify-low-stock-threshold"
              />
            </label>
            <div className="text-xs text-slate-500 dark:text-slate-400 sm:self-end">
              Tip: set this to 7 for “restock within a week”, or 3 for “only warn when urgent”.
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="material-icons text-slate-400" aria-hidden="true">
                  attach_money
                </span>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Spend burn rate</div>
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Trigger when your average cost per day exceeds a threshold over a rolling window.
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 shrink-0">
              <input
                type="checkbox"
                name="notify_spend_enabled"
                defaultChecked={Boolean(profile.notify_spend_enabled)}
                className="h-4 w-4 accent-primary"
                data-e2e="notify-spend-enabled"
              />
              Enabled
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-700 dark:text-slate-300">Threshold (USD/day)</span>
              <input
                className="h-10 rounded-md bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 px-3 text-sm text-slate-900 dark:text-slate-100"
                name="notify_spend_usd_per_day_threshold"
                defaultValue={profile.notify_spend_usd_per_day_threshold ?? 50}
                inputMode="decimal"
                data-e2e="notify-spend-threshold"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-700 dark:text-slate-300">Window (days)</span>
              <input
                className="h-10 rounded-md bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 px-3 text-sm text-slate-900 dark:text-slate-100"
                name="notify_spend_window_days"
                defaultValue={profile.notify_spend_window_days ?? 7}
                inputMode="numeric"
                data-e2e="notify-spend-window"
              />
            </label>

            <div className="text-xs text-slate-500 dark:text-slate-400 sm:self-end">
              Example: $10/day over 7 days gives a monthly estimate of about $300.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            The bell icon shows a badge when alerts are active.
          </div>
          <button
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            type="submit"
            data-e2e="settings-notifications-save"
          >
            Save
          </button>
        </div>

        {state.status === 'error' ? <p className="text-sm text-red-700">{state.message}</p> : null}
      </form>
    </div>
  )
}

