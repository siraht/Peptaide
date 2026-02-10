'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { ReconcileImportedVialsState } from './actions'
import { reconcileImportedVialsAction } from './actions'

export function ReconcileImportedVialsForm() {
  const [state, formAction] = useActionState<ReconcileImportedVialsState, FormData>(
    reconcileImportedVialsAction,
    { status: 'idle' },
  )

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm" data-e2e="reconcile-imported-vials">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Spreadsheet migration</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Links imported events to order-backed vials using <span className="font-mono">vial_#</span> tags, sets the
        latest vial per formulation active, and backfills event costs.
      </p>

      <form className="mt-3" action={formAction}>
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
          data-e2e="reconcile-imported-vials-submit"
          type="submit"
        >
          Reconcile imported vials
        </button>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" data-e2e="reconcile-imported-vials-error">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-emerald-700 dark:text-emerald-300" data-e2e="reconcile-imported-vials-success">
            {state.message}
          </p>
          {state.warnings.length > 0 ? (
            <details className="text-slate-600 dark:text-slate-400">
              <summary className="cursor-pointer select-none">Warnings ({state.warnings.length})</summary>
              <ul className="mt-2 list-disc pl-5">
                {state.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
