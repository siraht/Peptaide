'use client'

import { useActionState } from 'react'

import type { DistributionRow } from '@/lib/repos/distributionsRepo'

import type { CreateFormulationComponentState } from './actions'
import { createFormulationComponentAction } from './actions'

export function CreateFormulationComponentForm(props: {
  formulationId: string
  multiplierDistributions: DistributionRow[]
}) {
  const { formulationId, multiplierDistributions } = props

  const [state, formAction] = useActionState<CreateFormulationComponentState, FormData>(
    createFormulationComponentAction,
    { status: 'idle' },
  )

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Add formulation component</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Components can optionally reference a multiplier distribution. This MVP uses the component&apos;s
        <code className="rounded bg-zinc-100 px-1">modifier_dist_id</code> as a fallback modifier that applies
        to both systemic and CNS when no per-compartment component modifier specs exist.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <input type="hidden" name="formulation_id" value={formulationId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Component name</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="component_name" required />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Role (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="role" placeholder="enhancer" />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Modifier distribution (optional)</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="modifier_dist_id">
            <option value="">(none)</option>
            {multiplierDistributions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.dist_type})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Notes (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Create component
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

