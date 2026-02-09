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
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Quick import</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Imports the two RETA-PEPTIDE orders (I and II) and generates planned vials for each case (10 vials each). Safe
        to run multiple times.
      </p>

      <form className="mt-3" action={formAction}>
        <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
          Import RETA-PEPTIDE orders
        </button>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-700">{state.message}</p> : null}
      {state.status === 'success' ? <p className="mt-3 text-sm text-emerald-700">{state.message}</p> : null}
    </div>
  )
}

