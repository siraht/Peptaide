'use client'

import { useActionState, useEffect, useRef } from 'react'

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

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (state.status !== 'success') return
    if (state.createdCount > 0) {
      if (textareaRef.current) textareaRef.current.value = ''
    }
  }, [state])

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Bulk add</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Paste one formulation name per line. Select a substance and route that apply to the whole batch.
      </p>

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

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
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

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Formulation names</span>
          <textarea
            ref={textareaRef}
            className="min-h-[140px] w-full rounded-md border p-3 text-sm"
            name="lines"
            placeholder={'default\nwith enhancer A\nwith enhancer B'}
          />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Add formulations
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-700">{state.message}</p>
      ) : null}
      {state.status === 'success' ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-emerald-700">{state.message}</p>
          {state.errors.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-red-700">
              {state.errors.slice(0, 10).map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          ) : null}
          {state.errors.length > 10 ? (
            <p className="text-sm text-red-700">{state.errors.length - 10} more errors not shown.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

