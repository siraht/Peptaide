'use client'

import { useActionState, useEffect, useRef } from 'react'

import type { CreateSubstanceState } from './actions'
import { createSubstanceAction } from './actions'

export function CreateSubstanceForm() {
  const [state, formAction] = useActionState<CreateSubstanceState, FormData>(createSubstanceAction, {
    status: 'idle',
  })

  const canonicalRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (state.status !== 'success') return
    canonicalRef.current?.focus()
  }, [state.status])

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Add substance</h2>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Canonical name</span>
          <input
            ref={canonicalRef}
            className="h-10 rounded-md border px-3 text-sm"
            name="canonical_name"
            placeholder="e.g. semax"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Display name</span>
          <input
            className="h-10 rounded-md border px-3 text-sm"
            name="display_name"
            placeholder="e.g. Semax"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Family</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="family" placeholder="peptide" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Target compartment</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="target_compartment_default">
            <option value="systemic">systemic</option>
            <option value="cns">cns</option>
            <option value="both">both</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Notes</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="notes" />
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

