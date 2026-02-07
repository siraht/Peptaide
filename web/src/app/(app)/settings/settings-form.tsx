'use client'

import { useActionState } from 'react'

import type { ProfileRow } from '@/lib/repos/profilesRepo'

import type { UpdateProfileState } from './actions'
import { updateProfileAction } from './actions'

export function SettingsForm(props: { profile: ProfileRow }) {
  const { profile } = props

  const [state, formAction] = useActionState<UpdateProfileState, FormData>(updateProfileAction, {
    status: 'idle',
  })

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Profile defaults</h2>
      <p className="mt-1 text-sm text-zinc-700">
        These defaults are used for local-day analytics grouping and for new entries. They do not change historical
        event timestamps.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Timezone (IANA name)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="timezone" defaultValue={profile.timezone} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Default mass unit</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="default_mass_unit" defaultValue={profile.default_mass_unit}>
            <option value="mg">mg</option>
            <option value="mcg">mcg</option>
            <option value="g">g</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Default volume unit</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="default_volume_unit" defaultValue={profile.default_volume_unit}>
            <option value="mL">mL</option>
            <option value="cc">cc</option>
            <option value="uL">uL</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Default Monte Carlo N</span>
          <input
            className="h-10 rounded-md border px-3 text-sm"
            name="default_simulation_n"
            defaultValue={profile.default_simulation_n}
            inputMode="numeric"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Cycle gap default (days)</span>
          <input
            className="h-10 rounded-md border px-3 text-sm"
            name="cycle_gap_default_days"
            defaultValue={profile.cycle_gap_default_days}
            inputMode="numeric"
          />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Save
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-700">{state.message}</p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700">{state.message}</p>
      ) : null}
    </div>
  )
}

