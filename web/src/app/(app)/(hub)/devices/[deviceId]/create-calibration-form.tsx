'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { DistributionRow } from '@/lib/repos/distributionsRepo'
import type { RouteRow } from '@/lib/repos/routesRepo'

import type { CreateDeviceCalibrationState } from './actions'
import { createDeviceCalibrationAction } from './actions'

export function CreateDeviceCalibrationForm(props: {
  deviceId: string
  routes: RouteRow[]
  volumeDistributions: DistributionRow[]
}) {
  const { deviceId, routes, volumeDistributions } = props

  const [state, formAction] = useActionState<CreateDeviceCalibrationState, FormData>(
    createDeviceCalibrationAction,
    { status: 'idle' },
  )

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm" data-e2e="device-calibration-card">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add calibration</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Calibrations convert device units (like <code className="rounded bg-slate-100 dark:bg-slate-800 px-1">spray</code> or{' '}
        <code className="rounded bg-slate-100 dark:bg-slate-800 px-1">click</code>) into a volume in mL. The unit label should match
        the parsed device unit token (lowercase, singular; for example <code className="rounded bg-slate-100 dark:bg-slate-800 px-1">spray</code>).
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction} data-e2e="device-calibration-form">
        <input type="hidden" name="device_id" value={deviceId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Route</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="route_id" required>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Unit label</span>
          <input
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500"
            name="unit_label"
            placeholder="spray"
            required
            data-e2e="device-calibration-unit-label"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Volume distribution (mL per unit)</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="volume_ml_per_unit_dist_id" required>
            {volumeDistributions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.dist_type})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Notes (optional)</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
            Create calibration
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" data-e2e="device-calibration-error">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300" data-e2e="device-calibration-success">
          {state.message}
        </p>
      ) : null}
    </div>
  )
}
