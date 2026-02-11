'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/toast/use-toast'
import type { DistributionRow } from '@/lib/repos/distributionsRepo'
import type { EvidenceSourceRow } from '@/lib/repos/evidenceSourcesRepo'
import type { RouteRow } from '@/lib/repos/routesRepo'
import type { SubstanceRow } from '@/lib/repos/substancesRepo'

import type { SetupSetBioavailabilitySpecState } from './actions'
import { setupSetBioavailabilitySpecAction } from './actions'

export function SetupBaseBioavailabilitySpecForm(props: {
  substances: SubstanceRow[]
  routes: RouteRow[]
  fractionDistributions: DistributionRow[]
  evidenceSources: EvidenceSourceRow[]
}) {
  const { substances, routes, fractionDistributions, evidenceSources } = props

  const [state, formAction] = useActionState<SetupSetBioavailabilitySpecState, FormData>(
    setupSetBioavailabilitySpecAction,
    { status: 'idle' },
  )

  const router = useRouter()
  const { pushToast } = useToast()

  useEffect(() => {
    if (state.status !== 'success') return
    pushToast({ kind: 'success', title: 'Saved', message: state.message })
    router.refresh()
  }, [pushToast, router, state])

  return (
    <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick add base bioavailability</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        This sets the base bioavailability fraction distribution for a substance + route + compartment. Create fraction
        distributions on the{' '}
        <a className="underline hover:text-primary" href="/distributions">
          Distributions
        </a>{' '}
        page.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Substance</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="substance_id"
            required
          >
            {substances.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Route</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="route_id"
            required
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Compartment</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="compartment"
            defaultValue="systemic"
            required
          >
            <option value="systemic">systemic</option>
            <option value="cns">cns</option>
          </select>
        </label>

        <div className="hidden sm:block" />

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Base fraction distribution</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="base_fraction_dist_id"
            required
          >
            {fractionDistributions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.dist_type})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Notes (optional)</span>
          <input
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="notes"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Evidence source (optional)</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
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
          <button
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            type="submit"
          >
            Save spec
          </button>
        </div>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-700">{state.message}</p> : null}
    </div>
  )
}
