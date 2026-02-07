'use client'

import { useActionState } from 'react'

import type { DistributionRow } from '@/lib/repos/distributionsRepo'
import type { RouteRow } from '@/lib/repos/routesRepo'
import type { SubstanceRow } from '@/lib/repos/substancesRepo'

import type { SetupSetBioavailabilitySpecState } from './actions'
import { setupSetBioavailabilitySpecAction } from './actions'

export function SetupBaseBioavailabilitySpecForm(props: {
  substances: SubstanceRow[]
  routes: RouteRow[]
  fractionDistributions: DistributionRow[]
}) {
  const { substances, routes, fractionDistributions } = props

  const [state, formAction] = useActionState<SetupSetBioavailabilitySpecState, FormData>(
    setupSetBioavailabilitySpecAction,
    { status: 'idle' },
  )

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Quick add base bioavailability spec</h3>
      <p className="mt-1 text-sm text-zinc-700">
        This sets the base bioavailability fraction distribution for a substance + route + compartment. Create fraction
        distributions on the{' '}
        <a className="underline hover:text-zinc-900" href="/distributions">
          Distributions
        </a>{' '}
        page.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Substance</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="substance_id" required>
            {substances.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </label>

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
          <select className="h-10 rounded-md border px-3 text-sm" name="compartment" defaultValue="systemic" required>
            <option value="systemic">systemic</option>
            <option value="cns">cns</option>
          </select>
        </label>

        <div className="hidden sm:block" />

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Base fraction distribution</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="base_fraction_dist_id" required>
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

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Save spec
          </button>
        </div>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-700">{state.message}</p> : null}
      {state.status === 'success' ? <p className="mt-3 text-sm text-emerald-700">{state.message}</p> : null}
    </div>
  )
}

