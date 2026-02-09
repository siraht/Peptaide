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
    <div className="rounded-lg border bg-white p-4" data-e2e="evidence-create-card">
      <h2 className="text-sm font-semibold text-zinc-900">Add evidence source</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Optional citations/notes that can be attached to bioavailability specs and recommendations.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction} data-e2e="evidence-create-form">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Source type</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="source_type" defaultValue="paper">
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
          <span className="text-zinc-700">Citation</span>
          <input
            className="h-10 rounded-md border px-3 text-sm"
            name="citation"
            placeholder="DOI/PMID/ISBN/URL/free text"
            required
            data-e2e="evidence-citation"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Notes (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="notes" data-e2e="evidence-notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Save
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-700" data-e2e="evidence-error">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700" data-e2e="evidence-success">
          {state.message}
        </p>
      ) : null}
    </div>
  )
}
