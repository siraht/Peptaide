'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { CreateEvidenceSourceState } from './actions'
import { createEvidenceSourceAction } from './actions'

export function CreateEvidenceSourceForm() {
  const [state, formAction] = useActionState<CreateEvidenceSourceState, FormData>(
    createEvidenceSourceAction,
    { status: 'idle' },
  )

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm" data-e2e="evidence-create-card">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add evidence source</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Optional citations/notes that can be attached to bioavailability specs and recommendations.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction} data-e2e="evidence-create-form">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Source type</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="source_type" defaultValue="paper">
            <option value="paper">paper</option>
            <option value="label">label</option>
            <option value="clinical_guideline">clinical guideline</option>
            <option value="vendor">vendor</option>
            <option value="anecdote">anecdote</option>
            <option value="personal_note">personal note</option>
          </select>
        </label>

        <div className="hidden sm:block" />

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Citation</span>
          <input
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500"
            name="citation"
            placeholder="DOI/PMID/ISBN/URL/free text"
            required
            data-e2e="evidence-citation"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Notes (optional)</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="notes" data-e2e="evidence-notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
            Save
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" data-e2e="evidence-error">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300" data-e2e="evidence-success">
          {state.message}
        </p>
      ) : null}
    </div>
  )
}
