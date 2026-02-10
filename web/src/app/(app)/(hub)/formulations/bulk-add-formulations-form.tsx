'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import type { BulkAddFormulationsState, FormulationSelectOption } from './actions'
import { bulkAddFormulationsAction } from './actions'

export function BulkAddFormulationsForm(props: {
  substances: FormulationSelectOption[]
  routes: FormulationSelectOption[]
  devices: FormulationSelectOption[]
}) {
  const { substances, routes, devices } = props
  const [state, formAction] = useActionState<BulkAddFormulationsState, FormData>(bulkAddFormulationsAction, {
    status: 'idle',
  })

  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (state.status !== 'success') return
    if (state.createdCount > 0) {
      if (textareaRef.current) textareaRef.current.value = ''
      router.refresh()
    }
  }, [router, state])

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bulk add</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Paste one formulation name per line. Select a substance and route that apply to the whole batch.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Substance</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="substance_id" required>
            {substances.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Route</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="route_id" required>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Device (optional)</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="device_id">
            <option value="">(none)</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Formulation names</span>
          <textarea
            ref={textareaRef}
            className="min-h-[140px] w-full rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary p-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500"
            name="lines"
            placeholder={'default\nwith enhancer A\nwith enhancer B'}
          />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
            Add formulations
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.message}</p>
      ) : null}
      {state.status === 'success' ? (
        <div className="mt-3 space-y-2">
          <p
            className={`text-sm ${
              state.createdCount === 0
                ? 'text-red-600 dark:text-red-400'
                : state.errors.length > 0
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {state.message}
          </p>
          {state.errors.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-red-600 dark:text-red-400">
              {state.errors.slice(0, 10).map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          ) : null}
          {state.errors.length > 10 ? (
            <p className="text-sm text-red-600 dark:text-red-400">{state.errors.length - 10} more errors not shown.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
