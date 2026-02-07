import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CreateDeviceCalibrationForm } from './create-calibration-form'
import { deleteDeviceCalibrationAction } from './actions'

import { listDeviceCalibrationsForDevice } from '@/lib/repos/deviceCalibrationsRepo'
import { getDeviceById } from '@/lib/repos/devicesRepo'
import { listDistributions } from '@/lib/repos/distributionsRepo'
import { listRoutes } from '@/lib/repos/routesRepo'
import { createClient } from '@/lib/supabase/server'

function summarizeDist(dist: {
  dist_type: string
  p1: number | null
  p2: number | null
  p3: number | null
  min_value: number | null
  max_value: number | null
}): string {
  switch (dist.dist_type) {
    case 'point':
      return `value=${dist.p1 ?? '-'}`
    case 'uniform':
      return `[${dist.min_value ?? '-'}, ${dist.max_value ?? '-'}]`
    case 'triangular':
      return `min=${dist.p1 ?? '-'} mode=${dist.p2 ?? '-'} max=${dist.p3 ?? '-'}`
    case 'beta_pert':
      return `min=${dist.p1 ?? '-'} mode=${dist.p2 ?? '-'} max=${dist.p3 ?? '-'}`
    case 'lognormal':
      return `median=${dist.p1 ?? '-'} log_sigma=${dist.p2 ?? '-'}`
    default:
      return '-'
  }
}

export default async function DeviceDetailPage({
  params,
}: {
  params: { deviceId: string }
}) {
  const { deviceId } = params

  const supabase = await createClient()

  const [device, routes, dists, calibrations] = await Promise.all([
    getDeviceById(supabase, { deviceId }),
    listRoutes(supabase),
    listDistributions(supabase),
    listDeviceCalibrationsForDevice({ supabase, deviceId }),
  ])

  if (!device) notFound()

  const volumeDists = dists.filter((d) => d.value_type === 'volume_ml_per_unit')
  const routeById = new Map(routes.map((r) => [r.id, r]))
  const distById = new Map(dists.map((d) => [d.id, d]))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{device.name}</h1>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{device.device_kind}</span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{device.default_unit}</span>
        </div>
        <p className="mt-1 text-sm text-zinc-700">
          <Link className="underline hover:text-zinc-900" href="/devices">
            Back to list
          </Link>
        </p>
      </div>

      <CreateDeviceCalibrationForm deviceId={deviceId} routes={routes} volumeDistributions={volumeDists} />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Calibrations</h2>
        {calibrations.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No calibrations yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1000px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Route</th>
                  <th className="border-b px-2 py-2 font-medium">Unit label</th>
                  <th className="border-b px-2 py-2 font-medium">Distribution</th>
                  <th className="border-b px-2 py-2 font-medium">Params</th>
                  <th className="border-b px-2 py-2 font-medium">Notes</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {calibrations.map((c) => {
                  const route = routeById.get(c.route_id)
                  const dist = c.volume_ml_per_unit_dist_id
                    ? distById.get(c.volume_ml_per_unit_dist_id) ?? null
                    : null
                  return (
                    <tr key={c.id}>
                      <td className="border-b px-2 py-2 text-zinc-900">{route?.name ?? c.route_id}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{c.unit_label}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {dist ? (
                          <>
                            {dist.name}{' '}
                            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
                              {dist.dist_type}
                            </span>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">{dist ? summarizeDist(dist) : '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{c.notes ?? '-'}</td>
                      <td className="border-b px-2 py-2">
                        <form action={deleteDeviceCalibrationAction}>
                          <input type="hidden" name="device_id" value={deviceId} />
                          <input type="hidden" name="calibration_id" value={c.id} />
                          <button className="text-sm text-red-700" type="submit">
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

