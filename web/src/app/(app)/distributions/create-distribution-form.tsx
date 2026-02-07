'use client'

import { useActionState } from 'react'

import type { CreateDistributionState } from './actions'
import { createPointDistributionAction } from './actions'

export function CreateDistributionForm() {
  const [state, formAction] = useActionState<CreateDistributionState, FormData>(
    createPointDistributionAction,
    { status: 'idle' },
  )

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Add distribution (point)</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Minimal UI: creates a <code className="rounded bg-zinc-100 px-1">point</code> distribution
        only. The full MVP will add beta-PERT/lognormal/triangular forms.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Name</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="name" required />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Value type</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="value_type">
            <option value="fraction">fraction</option>
            <option value="multiplier">multiplier</option>
            <option value="volume_ml_per_unit">volume_ml_per_unit</option>
            <option value="other">other</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Value</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="value" required inputMode="decimal" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Units (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="units" placeholder="fraction" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Quality (0-5)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="quality_score" placeholder="0" inputMode="numeric" />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Evidence summary (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="evidence_summary" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Create
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-700">{state.message}</p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700">{state.message}</p>
      ) : null}
    </div>
  )
}

