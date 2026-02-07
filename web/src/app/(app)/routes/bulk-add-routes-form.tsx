'use client'

import { useActionState, useEffect, useRef } from 'react'

import type { BulkAddRoutesState } from './actions'
import { bulkAddRoutesAction } from './actions'

export function BulkAddRoutesForm() {
  const [state, formAction] = useActionState<BulkAddRoutesState, FormData>(bulkAddRoutesAction, {
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
        Paste one route name per line. The defaults below apply to all new routes.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Route names</span>
          <textarea
            ref={textareaRef}
            className="min-h-[140px] w-full rounded-md border p-3 text-sm"
            name="lines"
            placeholder={'subcutaneous\nintramuscular\nintranasal'}
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

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input className="h-4 w-4" type="checkbox" name="supports_device_calibration" />
          <span className="text-zinc-700">Supports device calibration</span>
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Add routes
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-700">{state.message}</p>
      ) : null}
      {state.status === 'success' ? (
        <div className="mt-3 space-y-2">
          <p
            className={`text-sm ${
              state.createdCount === 0
                ? 'text-red-700'
                : state.errors.length > 0
                  ? 'text-amber-700'
                  : 'text-emerald-700'
            }`}
          >
            {state.message}
          </p>
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
