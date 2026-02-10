'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { ProfileRow } from '@/lib/repos/profilesRepo'

import type { UpdateProfileState } from './actions'
import { updateProfileAction } from './actions'

export function SettingsForm(props: { profile: ProfileRow }) {
  const { profile } = props

  const [state, formAction] = useActionState<UpdateProfileState, FormData>(updateProfileAction, {
    status: 'idle',
  })

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile defaults</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        These defaults are used for local-day analytics grouping and for new entries. They do not change historical
        event timestamps.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Timezone (IANA name)</span>
          <input
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none"
            name="timezone"
            defaultValue={profile.timezone}
            placeholder="America/Los_Angeles"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Default mass unit</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none"
            name="default_mass_unit"
            defaultValue={profile.default_mass_unit}
          >
            <option value="mg">mg</option>
            <option value="mcg">mcg</option>
            <option value="g">g</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Default volume unit</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none"
            name="default_volume_unit"
            defaultValue={profile.default_volume_unit}
          >
            <option value="mL">mL</option>
            <option value="cc">cc</option>
            <option value="uL">uL</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Default Monte Carlo N</span>
          <input
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none"
            name="default_simulation_n"
            defaultValue={profile.default_simulation_n}
            inputMode="numeric"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Cycle gap default (days)</span>
          <input
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none"
            name="cycle_gap_default_days"
            defaultValue={profile.cycle_gap_default_days}
            inputMode="numeric"
          />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors" type="submit">
            Save
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-700">{state.message}</p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p>
      ) : null}
    </div>
  )
}
