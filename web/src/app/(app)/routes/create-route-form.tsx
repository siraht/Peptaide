'use client'

import { useActionState } from 'react'

import type { CreateRouteState } from './actions'
import { createRouteAction } from './actions'

export function CreateRouteForm() {
  const [state, formAction] = useActionState<CreateRouteState, FormData>(createRouteAction, {
    status: 'idle',
  })

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Add route</h2>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Name</span>
          <input
            className="h-10 rounded-md border px-3 text-sm"
            name="name"
            placeholder="e.g. subcutaneous"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Default input kind</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="default_input_kind">
            <option value="mass">mass</option>
            <option value="volume">volume</option>
            <option value="device_units">device_units</option>
            <option value="iu">iu</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Default input unit</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="default_input_unit" placeholder="mg" required />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input className="h-4 w-4" type="checkbox" name="supports_device_calibration" />
          <span className="text-zinc-700">Supports device calibration</span>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Notes</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Create
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

