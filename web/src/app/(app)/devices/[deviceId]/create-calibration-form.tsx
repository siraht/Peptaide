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
    <div className="rounded-lg border bg-white p-4" data-e2e="device-calibration-card">
      <h2 className="text-sm font-semibold text-zinc-900">Add calibration</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Calibrations convert device units (like <code className="rounded bg-zinc-100 px-1">spray</code> or{' '}
        <code className="rounded bg-zinc-100 px-1">click</code>) into a volume in mL. The unit label should match
        the parsed device unit token (lowercase, singular; for example <code className="rounded bg-zinc-100 px-1">spray</code>).
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction} data-e2e="device-calibration-form">
        <input type="hidden" name="device_id" value={deviceId} />

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
          <input
            className="h-10 rounded-md border px-3 text-sm"
            name="unit_label"
            placeholder="spray"
            required
            data-e2e="device-calibration-unit-label"
          />
        </label>

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

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-700" data-e2e="device-calibration-error">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700" data-e2e="device-calibration-success">
          {state.message}
        </p>
      ) : null}
    </div>
  )
}
