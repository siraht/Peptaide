'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { CreateDistributionState } from './actions'
import { createDistributionAction } from './actions'

export function CreateDistributionForm() {
  const [distType, setDistType] = useState<'point' | 'uniform' | 'triangular' | 'beta_pert' | 'lognormal'>('point')

  const [state, formAction] = useActionState<CreateDistributionState, FormData>(
    createDistributionAction,
    { status: 'idle' },
  )

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

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
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add distribution</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Distributions are uncertainty primitives used by bioavailability specs, modifier specs, and device calibration.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Name</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="name" required />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Value type</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="value_type">
            <option value="fraction">fraction</option>
            <option value="multiplier">multiplier</option>
            <option value="volume_ml_per_unit">volume_ml_per_unit</option>
            <option value="other">other</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Dist type</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100"
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

        <div className="text-sm text-slate-600 dark:text-slate-400 sm:col-span-2">
          <span className="font-medium">Params:</span> {paramHelp}
        </div>

        {distType === 'point' ? (
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-slate-600 dark:text-slate-400">Value</span>
            <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="p1" required inputMode="decimal" />
          </label>
        ) : null}

        {distType === 'uniform' ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600 dark:text-slate-400">Min</span>
              <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="min_value" required inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600 dark:text-slate-400">Max</span>
              <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="max_value" required inputMode="decimal" />
            </label>
          </>
        ) : null}

        {distType === 'triangular' || distType === 'beta_pert' ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600 dark:text-slate-400">Min</span>
              <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="p1" required inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600 dark:text-slate-400">Mode</span>
              <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="p2" required inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600 dark:text-slate-400">Max</span>
              <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="p3" required inputMode="decimal" />
            </label>
          </>
        ) : null}

        {distType === 'lognormal' ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600 dark:text-slate-400">Median</span>
              <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="p1" required inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600 dark:text-slate-400">log_sigma</span>
              <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="p2" required inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600 dark:text-slate-400">Clamp min (optional)</span>
              <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="min_value" inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600 dark:text-slate-400">Clamp max (optional)</span>
              <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="max_value" inputMode="decimal" />
            </label>
          </>
        ) : null}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Units (optional)</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="units" placeholder="fraction" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Quality (0-5)</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="quality_score" placeholder="0" inputMode="numeric" />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Evidence summary (optional)</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="evidence_summary" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
            Create
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.message}</p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p>
      ) : null}
    </div>
  )
}
