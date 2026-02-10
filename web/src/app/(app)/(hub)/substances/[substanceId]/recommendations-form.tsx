'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { EvidenceSourceRow } from '@/lib/repos/evidenceSourcesRepo'
import type { RouteRow } from '@/lib/repos/routesRepo'

import type { CreateSubstanceRecommendationState } from './actions'
import { createSubstanceRecommendationAction } from './actions'

export function SubstanceRecommendationsForm(props: { substanceId: string; routes: RouteRow[]; evidenceSources: EvidenceSourceRow[] }) {
  const { substanceId, routes, evidenceSources } = props

  const [state, formAction] = useActionState<CreateSubstanceRecommendationState, FormData>(
    createSubstanceRecommendationAction,
    { status: 'idle' },
  )

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <div
      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4"
      data-e2e="settings-recommendations"
    >
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recommendations (user-entered)</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        These are reference ranges you enter for your own tracking. They are not medical advice.
      </p>

      <form
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
        action={formAction}
        data-e2e="settings-recommendations-form"
      >
        <input type="hidden" name="substance_id" value={substanceId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Category</span>
          <select
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
            name="category"
            defaultValue="cycle_length_days"
            required
          >
            <option value="cycle_length_days">cycle length (days)</option>
            <option value="break_length_days">break length (days)</option>
            <option value="dosing">dosing</option>
            <option value="frequency">frequency</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Route (optional)</span>
          <select
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
            name="route_id"
            defaultValue=""
          >
            <option value="">(none)</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Min (optional)</span>
          <input
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
            name="min_value"
            inputMode="decimal"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Max (optional)</span>
          <input
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
            name="max_value"
            inputMode="decimal"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Unit</span>
          <input
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
            name="unit"
            placeholder='e.g. "days", "mg", "mcg", "times/week"'
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Notes (optional)</span>
          <input className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100" name="notes" />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Evidence source (optional)</span>
          <select
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
            name="evidence_source_id"
            defaultValue=""
          >
            <option value="">(none)</option>
            {evidenceSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.source_type}: {s.citation}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors" type="submit">
            Save recommendation
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300" data-e2e="settings-recommendations-error">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <p
          className="mt-3 text-sm text-emerald-700 dark:text-emerald-300"
          data-e2e="settings-recommendations-success"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  )
}
