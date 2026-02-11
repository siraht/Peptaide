'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import type { BulkAddRoutesState } from './actions'
import { bulkAddRoutesAction } from './actions'

export function BulkAddRoutesForm() {
  const [state, formAction] = useActionState<BulkAddRoutesState, FormData>(bulkAddRoutesAction, {
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
        Paste one route name per line. The defaults below apply to all new routes.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Route names</span>
          <textarea
            ref={textareaRef}
            className="min-h-[140px] w-full rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary p-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500"
            name="lines"
            placeholder={'subcutaneous\nintramuscular\nintranasal'}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Default input kind</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100" name="default_input_kind">
            <option value="mass">mass</option>
            <option value="volume">volume</option>
            <option value="device_units">device_units</option>
            <option value="iu">iu</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Default input unit</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="default_input_unit" placeholder="mg" required />
        </label>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input className="h-4 w-4" type="checkbox" name="supports_device_calibration" />
          <span className="text-slate-600 dark:text-slate-400">Supports device calibration</span>
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
            Add routes
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
