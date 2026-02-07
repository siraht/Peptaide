'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { DistributionRow } from '@/lib/repos/distributionsRepo'
import type { EvidenceSourceRow } from '@/lib/repos/evidenceSourcesRepo'
import type { RouteRow } from '@/lib/repos/routesRepo'

import type { SetBioavailabilitySpecState } from './actions'
import { setBioavailabilitySpecAction } from './actions'

export function BaseBioavailabilitySpecForm(props: {
  substanceId: string
  routes: RouteRow[]
  fractionDistributions: DistributionRow[]
  evidenceSources: EvidenceSourceRow[]
}) {
  const { substanceId, routes, fractionDistributions, evidenceSources } = props

  const [state, formAction] = useActionState<SetBioavailabilitySpecState, FormData>(
    setBioavailabilitySpecAction,
    { status: 'idle' },
  )

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Base bioavailability spec</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Sets the base bioavailability fraction distribution for a substance + route + compartment. You can
        create fraction distributions on the{' '}
        <a className="underline hover:text-zinc-900" href="/distributions">
          Distributions
        </a>{' '}
        page.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <input type="hidden" name="substance_id" value={substanceId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Route</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="route_id" required>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Compartment</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="compartment" required>
            <option value="systemic">systemic</option>
            <option value="cns">cns</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Base fraction distribution</span>
          <select
            className="h-10 rounded-md border px-3 text-sm"
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
          <span className="text-zinc-700">Notes (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="notes" />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Evidence source (optional)</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="evidence_source_id" defaultValue="">
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
            className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white"
            type="submit"
          >
            Save spec
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
