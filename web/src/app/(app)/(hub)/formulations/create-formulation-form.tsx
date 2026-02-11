'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

  const router = useRouter()
  const nameRef = useRef<HTMLInputElement | null>(null)
  const focus = useSearchParams().get('focus')

  useEffect(() => {
    if (focus !== 'new') return
    nameRef.current?.focus()
  }, [focus])

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
    nameRef.current?.focus()
  }, [router, state.status])

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add formulation</h2>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Substance</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100" name="substance_id" required>
            {substances.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Route</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100" name="route_id" required>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Name</span>
          <input
            ref={nameRef}
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500"
            name="name"
            placeholder="e.g. IN + enhancer A"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Device (optional)</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100" name="device_id">
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
          <span className="text-slate-600 dark:text-slate-400">Default for this substance+route</span>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Notes</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
            Create
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.message}</p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p>
      ) : null}
    </div>
  )
}
