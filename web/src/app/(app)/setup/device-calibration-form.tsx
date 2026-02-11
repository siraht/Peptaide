'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/toast/use-toast'
import type { DeviceRow } from '@/lib/repos/devicesRepo'
import type { DistributionRow } from '@/lib/repos/distributionsRepo'
import type { RouteRow } from '@/lib/repos/routesRepo'

import type { SetupCreateDeviceCalibrationState } from './actions'
import { setupCreateDeviceCalibrationAction } from './actions'

export function SetupDeviceCalibrationForm(props: {
  devices: DeviceRow[]
  routes: RouteRow[]
  volumeDistributions: DistributionRow[]
}) {
  const { devices, routes, volumeDistributions } = props

  const [state, formAction] = useActionState<SetupCreateDeviceCalibrationState, FormData>(
    setupCreateDeviceCalibrationAction,
    { status: 'idle' },
  )

  const router = useRouter()
  const { pushToast } = useToast()

  useEffect(() => {
    if (state.status !== 'success') return
    pushToast({ kind: 'success', title: 'Created', message: state.message })
    router.refresh()
  }, [pushToast, router, state])

  return (
    <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick add device calibration</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Calibrations convert device units (like <code className="rounded bg-slate-200/70 dark:bg-slate-700/60 px-1">spray</code> or{' '}
        <code className="rounded bg-slate-200/70 dark:bg-slate-700/60 px-1">click</code>) into a volume in mL. The unit label should match the
        parsed device unit token (lowercase, singular; for example{' '}
        <code className="rounded bg-slate-200/70 dark:bg-slate-700/60 px-1">spray</code>).
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Device</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="device_id"
            required
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.default_unit})
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
          <span className="text-slate-700 dark:text-slate-300">Unit label</span>
          <input
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="unit_label"
            placeholder="spray"
            required
          />
        </label>

        <div className="hidden sm:block" />

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Volume distribution (mL per unit)</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="volume_ml_per_unit_dist_id"
            required
          >
            {volumeDistributions.map((d) => (
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

        <div className="sm:col-span-2">
          <button
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            type="submit"
          >
            Create calibration
          </button>
        </div>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-700">{state.message}</p> : null}
    </div>
  )
}
