'use client'

import { useActionState } from 'react'

import type { CreateFormulationState } from './actions'
import { createFormulationAction } from './actions'

export type FormulationSelectOption = { id: string; label: string }

export function CreateFormulationForm(props: {
  substances: FormulationSelectOption[]
  routes: FormulationSelectOption[]
  devices: FormulationSelectOption[]
}) {
  const { substances, routes, devices } = props
  const [state, formAction] = useActionState<CreateFormulationState, FormData>(createFormulationAction, {
    status: 'idle',
  })

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Add formulation</h2>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Substance</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="substance_id" required>
            {substances.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Route</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="route_id" required>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Name</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="name" placeholder="e.g. IN + enhancer A" required />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Device (optional)</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="device_id">
            <option value="">(none)</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input className="h-4 w-4" type="checkbox" name="is_default_for_route" />
          <span className="text-zinc-700">Default for this substance+route</span>
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

