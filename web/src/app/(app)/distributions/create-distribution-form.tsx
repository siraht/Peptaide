'use client'

import { useActionState, useMemo, useState } from 'react'

import type { CreateDistributionState } from './actions'
import { createDistributionAction } from './actions'

export function CreateDistributionForm() {
  const [distType, setDistType] = useState<'point' | 'uniform' | 'triangular' | 'beta_pert' | 'lognormal'>('point')

  const [state, formAction] = useActionState<CreateDistributionState, FormData>(
    createDistributionAction,
    { status: 'idle' },
  )

  const paramHelp = useMemo(() => {
    switch (distType) {
      case 'point':
        return 'Deterministic value.'
      case 'uniform':
        return 'Sample uniformly between min and max.'
      case 'triangular':
        return 'Defined by min / mode / max.'
      case 'beta_pert':
        return 'Defined by min / mode / max (lambda=4 in sampling).'
      case 'lognormal':
        return 'Defined by median and log_sigma; optional positive clamps.'
    }
  }, [distType])

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Add distribution</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Distributions are uncertainty primitives used by bioavailability specs, modifier specs, and device calibration.
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
          <span className="text-zinc-700">Dist type</span>
          <select
            className="h-10 rounded-md border px-3 text-sm"
            name="dist_type"
            value={distType}
            onChange={(e) => setDistType(e.target.value as typeof distType)}
          >
            <option value="point">point</option>
            <option value="uniform">uniform</option>
            <option value="triangular">triangular</option>
            <option value="beta_pert">beta_pert</option>
            <option value="lognormal">lognormal</option>
          </select>
        </label>

        <div className="text-sm text-zinc-700 sm:col-span-2">
          <span className="font-medium">Params:</span> {paramHelp}
        </div>

        {distType === 'point' ? (
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-zinc-700">Value</span>
            <input className="h-10 rounded-md border px-3 text-sm" name="p1" required inputMode="decimal" />
          </label>
        ) : null}

        {distType === 'uniform' ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Min</span>
              <input className="h-10 rounded-md border px-3 text-sm" name="min_value" required inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Max</span>
              <input className="h-10 rounded-md border px-3 text-sm" name="max_value" required inputMode="decimal" />
            </label>
          </>
        ) : null}

        {distType === 'triangular' || distType === 'beta_pert' ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Min</span>
              <input className="h-10 rounded-md border px-3 text-sm" name="p1" required inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Mode</span>
              <input className="h-10 rounded-md border px-3 text-sm" name="p2" required inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Max</span>
              <input className="h-10 rounded-md border px-3 text-sm" name="p3" required inputMode="decimal" />
            </label>
          </>
        ) : null}

        {distType === 'lognormal' ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Median</span>
              <input className="h-10 rounded-md border px-3 text-sm" name="p1" required inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">log_sigma</span>
              <input className="h-10 rounded-md border px-3 text-sm" name="p2" required inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Clamp min (optional)</span>
              <input className="h-10 rounded-md border px-3 text-sm" name="min_value" inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700">Clamp max (optional)</span>
              <input className="h-10 rounded-md border px-3 text-sm" name="max_value" inputMode="decimal" />
            </label>
          </>
        ) : null}

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
