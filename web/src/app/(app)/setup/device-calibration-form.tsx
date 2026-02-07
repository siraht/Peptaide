'use client'

import { useActionState } from 'react'

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

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Quick add device calibration</h3>
      <p className="mt-1 text-sm text-zinc-700">
        Calibrations convert device units (like <code className="rounded bg-zinc-100 px-1">spray</code> or{' '}
        <code className="rounded bg-zinc-100 px-1">click</code>) into a volume in mL. The unit label should match the
        parsed device unit token (lowercase, singular; for example{' '}
        <code className="rounded bg-zinc-100 px-1">spray</code>).
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Device</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="device_id" required>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.default_unit})
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
          <span className="text-zinc-700">Unit label</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="unit_label" placeholder="spray" required />
        </label>

        <div className="hidden sm:block" />

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Volume distribution (mL per unit)</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="volume_ml_per_unit_dist_id" required>
            {volumeDistributions.map((d) => (
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
            Create calibration
          </button>
        </div>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-700">{state.message}</p> : null}
      {state.status === 'success' ? <p className="mt-3 text-sm text-emerald-700">{state.message}</p> : null}
    </div>
  )
}

