'use client'

import { useActionState } from 'react'

import type { RouteRow } from '@/lib/repos/routesRepo'

import type { CreateSubstanceRecommendationState } from './actions'
import { createSubstanceRecommendationAction } from './actions'

export function SubstanceRecommendationsForm(props: { substanceId: string; routes: RouteRow[] }) {
  const { substanceId, routes } = props

  const [state, formAction] = useActionState<CreateSubstanceRecommendationState, FormData>(
    createSubstanceRecommendationAction,
    { status: 'idle' },
  )

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Recommendations (user-entered)</h2>
      <p className="mt-1 text-sm text-zinc-700">
        These are reference ranges you enter for your own tracking. They are not medical advice.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <input type="hidden" name="substance_id" value={substanceId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Category</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="category" defaultValue="cycle_length_days" required>
            <option value="cycle_length_days">cycle length (days)</option>
            <option value="break_length_days">break length (days)</option>
            <option value="dosing">dosing</option>
            <option value="frequency">frequency</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Route (optional)</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="route_id" defaultValue="">
            <option value="">(none)</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Min (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="min_value" inputMode="decimal" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Max (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="max_value" inputMode="decimal" />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Unit</span>
          <input
            className="h-10 rounded-md border px-3 text-sm"
            name="unit"
            placeholder='e.g. "days", "mg", "mcg", "times/week"'
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Notes (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Save recommendation
          </button>
        </div>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-700">{state.message}</p> : null}
      {state.status === 'success' ? <p className="mt-3 text-sm text-emerald-700">{state.message}</p> : null}
    </div>
  )
}

