'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { ImportRetaPeptideOrdersState } from './actions'
import { importRetaPeptideOrdersAction } from './actions'

export function ImportRetaPeptideOrdersForm() {
  const [state, formAction] = useActionState<ImportRetaPeptideOrdersState, FormData>(
    importRetaPeptideOrdersAction,
    { status: 'idle' },
  )

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick import</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Imports the two RETA-PEPTIDE orders (I and II) and generates planned vials for each case (10 vials each). Safe
        to run multiple times.
      </p>

      <form className="mt-3" action={formAction}>
        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
          Import RETA-PEPTIDE orders
        </button>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.message}</p> : null}
      {state.status === 'success' ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p> : null}
    </div>
  )
}
