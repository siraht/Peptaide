import Link from 'next/link'

import { SettingsForm } from '@/app/(app)/settings/settings-form'
import { BulkAddFormulationsForm } from '@/app/(app)/formulations/bulk-add-formulations-form'
import { BulkAddRoutesForm } from '@/app/(app)/routes/bulk-add-routes-form'
import { BulkAddSubstancesForm } from '@/app/(app)/substances/bulk-add-substances-form'
import { CreateVialForm } from '@/app/(app)/inventory/create-vial-form'
import { GenerateVialsForm } from '@/app/(app)/orders/generate-vials-form'
import { SetupBaseBioavailabilitySpecForm } from '@/app/(app)/setup/base-ba-spec-form'
import { SetupDeviceCalibrationForm } from '@/app/(app)/setup/device-calibration-form'
import { SetupFormulationModifierSpecForm } from '@/app/(app)/setup/formulation-modifier-form'
import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { listDevices } from '@/lib/repos/devicesRepo'
import { listDistributions } from '@/lib/repos/distributionsRepo'
import { listEvidenceSources } from '@/lib/repos/evidenceSourcesRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listInventoryStatus } from '@/lib/repos/inventoryStatusRepo'
import { listModelCoverage } from '@/lib/repos/modelCoverageRepo'
import { listOrders } from '@/lib/repos/ordersRepo'
import { listOrderItems } from '@/lib/repos/orderItemsRepo'
import { listRoutes } from '@/lib/repos/routesRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { listVendors } from '@/lib/repos/vendorsRepo'
import { createClient } from '@/lib/supabase/server'

type TargetCompartment = 'systemic' | 'cns' | 'both'

export default async function SetupPage() {
  const supabase = await createClient()

  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))

  const [
    substances,
    routes,
    devices,
    vendors,
    orders,
    orderItems,
    dists,
    evidenceSources,
    formulations,
    inventory,
    coverage,
  ] = await Promise.all([
    listSubstances(supabase),
    listRoutes(supabase),
    listDevices(supabase),
    listVendors(supabase),
    listOrders(supabase),
    listOrderItems(supabase),
    listDistributions(supabase),
    listEvidenceSources(supabase),
    listFormulationsEnriched(supabase),
    listInventoryStatus(supabase),
    listModelCoverage(supabase),
  ])

  const fractionDists = dists.filter((d) => d.value_type === 'fraction')
  const volumeDists = dists.filter((d) => d.value_type === 'volume_ml_per_unit')
  const multiplierDists = dists.filter((d) => d.value_type === 'multiplier')
  const calibrationRoutes = routes.filter((r) => r.supports_device_calibration)

  const vendorById = new Map(vendors.map((v) => [v.id, v] as const))
  const substanceById = new Map(substances.map((s) => [s.id, s] as const))
  const formulationById = new Map(formulations.map((f) => [f.formulation.id, f] as const))
  const orderById = new Map(orders.map((o) => [o.id, o] as const))

  const formulationOptions = formulations.map((f) => {
    const substance = f.substance?.display_name ?? 'Unknown substance'
    const route = f.route?.name ?? 'Unknown route'
    return { id: f.formulation.id, label: `${substance} / ${route} / ${f.formulation.name}` }
  })

  const orderIds = new Set(orders.map((o) => o.id))
  const eligibleOrderItems = orderItems.filter(
    (oi) => orderIds.has(oi.order_id) && oi.formulation_id != null,
  )
  const orderItemOptions = eligibleOrderItems.map((oi) => {
    const order = orderById.get(oi.order_id)
    const vendorName = order ? vendorById.get(order.vendor_id)?.name ?? '(vendor)' : '(order)'
    const orderDay = order?.ordered_at ? order.ordered_at.slice(0, 10) : '(date)'
    const substanceName = substanceById.get(oi.substance_id)?.display_name ?? '(substance)'
    const formulationName =
      oi.formulation_id ? formulationById.get(oi.formulation_id)?.formulation.name ?? '(formulation)' : '(formulation)'

    return {
      id: oi.id,
      label: `${vendorName} / ${orderDay} - ${substanceName} - ${formulationName} (${oi.qty} ${oi.unit_label})`,
    }
  })

  const vialsByStatus = inventory.reduce(
    (acc, row) => {
      const status = row.status ?? null
      if (status === 'planned') acc.planned++
      else if (status === 'active') acc.active++
      else if (status === 'closed') acc.closed++
      else if (status === 'discarded') acc.discarded++
      else acc.unknown++
      return acc
    },
    { planned: 0, active: 0, closed: 0, discarded: 0, unknown: 0 },
  )

  const substanceTargetById = new Map<string, TargetCompartment>()
  for (const f of formulations) {
    if (f.substance) {
      substanceTargetById.set(f.substance.id, f.substance.target_compartment_default)
    }
  }

  const coverageGaps = coverage.filter((c) => {
    const target: TargetCompartment = c.substance_id
      ? (substanceTargetById.get(c.substance_id) ?? 'systemic')
      : 'systemic'
    const systemicRelevant = target !== 'cns'
    const cnsRelevant = target !== 'systemic'

    const missingBaseSystemic = systemicRelevant && c.missing_base_systemic
    const missingBaseCns = cnsRelevant && c.missing_base_cns
    const missingDeviceCal = c.supports_device_calibration && c.missing_any_device_calibration

    return missingBaseSystemic || missingBaseCns || missingDeviceCal
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Setup</h1>
        <p className="mt-1 text-sm text-zinc-700">
          MVP onboarding flow. Goal: add your core reference data so you can log events and see model coverage gaps.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">1. Profile defaults</h2>
          <p className="mt-1 text-sm text-zinc-700">
            Configure timezone and units. These affect day grouping and default entry behavior.
          </p>
        </div>
        <SettingsForm profile={profile} />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">2. Substances</h2>
            <p className="mt-1 text-sm text-zinc-700">Add substances you plan to track.</p>
          </div>
          <Link className="text-sm text-zinc-700 underline hover:text-zinc-900" href="/substances">
            Manage
          </Link>
        </div>
        <BulkAddSubstancesForm />
        <p className="text-sm text-zinc-700">Current: {substances.length}.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">3. Routes</h2>
            <p className="mt-1 text-sm text-zinc-700">Add routes and choose defaults (kind/unit).</p>
          </div>
          <Link className="text-sm text-zinc-700 underline hover:text-zinc-900" href="/routes">
            Manage
          </Link>
        </div>
        <BulkAddRoutesForm />
        <p className="text-sm text-zinc-700">Current: {routes.length}.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">4. Formulations</h2>
            <p className="mt-1 text-sm text-zinc-700">
              Create loggable combinations of (substance + route + optional device).
            </p>
          </div>
          <Link className="text-sm text-zinc-700 underline hover:text-zinc-900" href="/formulations">
            Manage
          </Link>
        </div>

        {substances.length === 0 || routes.length === 0 ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-700">
            Add at least one substance and one route first.
          </div>
        ) : (
          <BulkAddFormulationsForm
            substances={substances.map((s) => ({ id: s.id, label: s.display_name }))}
            routes={routes.map((r) => ({ id: r.id, label: r.name }))}
            devices={devices.map((d) => ({ id: d.id, label: d.name }))}
          />
        )}
        <p className="text-sm text-zinc-700">Current: {formulations.length}.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">5. Vials (inventory)</h2>
            <p className="mt-1 text-sm text-zinc-700">
              Create vials so event logging can compute concentration-based conversions and cost allocation. For batch
              creation, you can generate planned vials from orders.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="text-zinc-700 underline hover:text-zinc-900" href="/inventory">
              Manage inventory
            </Link>
            <Link className="text-zinc-700 underline hover:text-zinc-900" href="/orders">
              Manage orders
            </Link>
          </div>
        </div>

        {formulationOptions.length === 0 ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-700">
            Add at least one formulation first.
          </div>
        ) : (
          <CreateVialForm formulations={formulationOptions} />
        )}

        {orderItemOptions.length === 0 ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-700">
            To generate planned vials from orders, create an order item linked to a formulation (see{' '}
            <Link className="underline hover:text-zinc-900" href="/orders">
              Orders
            </Link>
            ).
          </div>
        ) : (
          <GenerateVialsForm orderItems={orderItemOptions} />
        )}

        <p className="text-sm text-zinc-700">
          Current: {inventory.length} total (active {vialsByStatus.active}, planned {vialsByStatus.planned}, closed{' '}
          {vialsByStatus.closed}, discarded {vialsByStatus.discarded}
          {vialsByStatus.unknown > 0 ? `, unknown ${vialsByStatus.unknown}` : ''}).
        </p>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">6. Model coverage (bioavailability + calibrations)</h2>
        <p className="mt-1 text-sm text-zinc-700">
          This is the to-do list for effective dose percentiles. You can add base bioavailability specs and device
          calibrations below (distributions required), or manage them on the substance/device detail pages.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-700">
          <Link className="underline hover:text-zinc-900" href="/distributions">
            Distributions
          </Link>
          <Link className="underline hover:text-zinc-900" href="/today">
            Today (logging surface)
          </Link>
        </div>

        {substances.length === 0 || routes.length === 0 ? (
          <div className="mt-3 rounded-lg border bg-white p-4 text-sm text-zinc-700">
            Add at least one substance and one route first.
          </div>
        ) : fractionDists.length === 0 ? (
          <div className="mt-3 rounded-lg border bg-white p-4 text-sm text-zinc-700">
            Create at least one fraction distribution first (see{' '}
            <Link className="underline hover:text-zinc-900" href="/distributions">
              Distributions
            </Link>
            ).
          </div>
        ) : (
          <div className="mt-3">
            <SetupBaseBioavailabilitySpecForm
              substances={substances}
              routes={routes}
              fractionDistributions={fractionDists}
              evidenceSources={evidenceSources}
            />
          </div>
        )}

        {devices.length === 0 ? (
          <div className="mt-3 rounded-lg border bg-white p-4 text-sm text-zinc-700">
            Add at least one device first (see{' '}
            <Link className="underline hover:text-zinc-900" href="/devices">
              Devices
            </Link>
            ).
          </div>
        ) : calibrationRoutes.length === 0 ? (
          <div className="mt-3 rounded-lg border bg-white p-4 text-sm text-zinc-700">
            No routes support device calibration yet. Enable it on a route (see{' '}
            <Link className="underline hover:text-zinc-900" href="/routes">
              Routes
            </Link>
            ).
          </div>
        ) : volumeDists.length === 0 ? (
          <div className="mt-3 rounded-lg border bg-white p-4 text-sm text-zinc-700">
            Create at least one <span className="font-mono">volume_ml_per_unit</span> distribution first (see{' '}
            <Link className="underline hover:text-zinc-900" href="/distributions">
              Distributions
            </Link>
            ).
          </div>
        ) : (
          <div className="mt-3">
            <SetupDeviceCalibrationForm
              devices={devices}
              routes={calibrationRoutes}
              volumeDistributions={volumeDists}
            />
          </div>
        )}

        {formulationOptions.length === 0 ? (
          <div className="mt-3 rounded-lg border bg-white p-4 text-sm text-zinc-700">
            Add at least one formulation first.
          </div>
        ) : multiplierDists.length === 0 ? (
          <div className="mt-3 rounded-lg border bg-white p-4 text-sm text-zinc-700">
            Create at least one multiplier distribution first (see{' '}
            <Link className="underline hover:text-zinc-900" href="/distributions">
              Distributions
            </Link>
            ).
          </div>
        ) : (
          <div className="mt-3">
            <SetupFormulationModifierSpecForm
              formulations={formulationOptions}
              multiplierDistributions={multiplierDists}
            />
          </div>
        )}

        {coverageGaps.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-700">No coverage gaps detected.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Formulation</th>
                  <th className="border-b px-2 py-2 font-medium">Substance</th>
                  <th className="border-b px-2 py-2 font-medium">Route</th>
                  <th className="border-b px-2 py-2 font-medium">Device</th>
                  <th className="border-b px-2 py-2 font-medium">Base systemic</th>
                  <th className="border-b px-2 py-2 font-medium">Base CNS</th>
                  <th className="border-b px-2 py-2 font-medium">Device cal</th>
                </tr>
              </thead>
              <tbody>
                {coverageGaps.map((c) => {
                  const target: TargetCompartment = c.substance_id
                    ? (substanceTargetById.get(c.substance_id) ?? 'systemic')
                    : 'systemic'
                  const systemicRelevant = target !== 'cns'
                  const cnsRelevant = target !== 'systemic'

                  const formulationId = c.formulation_id
                  const substanceId = c.substance_id
                  const routeId = c.route_id
                  const deviceId = c.device_id
                  const rowKey = formulationId ?? `${substanceId ?? 'substance'}-${routeId ?? 'route'}`

                  return (
                    <tr key={rowKey}>
                      <td className="border-b px-2 py-2 text-zinc-900">
                        {formulationId ? (
                          <Link className="underline hover:text-zinc-900" href={`/formulations/${formulationId}`}>
                            {c.formulation_name ?? '-'}
                          </Link>
                        ) : (
                          <span>{c.formulation_name ?? '-'}</span>
                        )}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {substanceId ? (
                          <Link className="underline hover:text-zinc-900" href={`/substances/${substanceId}`}>
                            {c.substance_name ?? '-'}
                          </Link>
                        ) : (
                          <span>{c.substance_name ?? '-'}</span>
                        )}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">{c.route_name ?? '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {deviceId ? (
                          <Link className="underline hover:text-zinc-900" href={`/devices/${deviceId}`}>
                            {c.device_name ?? '(device)'}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {systemicRelevant ? (
                          c.missing_base_systemic ? (
                            <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">missing</span>
                          ) : (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">ok</span>
                          )
                        ) : (
                          <span className="text-zinc-500">n/a</span>
                        )}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {cnsRelevant ? (
                          c.missing_base_cns ? (
                            <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">missing</span>
                          ) : (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">ok</span>
                          )
                        ) : (
                          <span className="text-zinc-500">n/a</span>
                        )}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {c.supports_device_calibration && deviceId ? (
                          c.missing_any_device_calibration ? (
                            <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">missing</span>
                          ) : (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">ok</span>
                          )
                        ) : (
                          <span className="text-zinc-500">n/a</span>
                        )}
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
