import Link from 'next/link'

import { listTodayEventsEnriched } from '@/lib/repos/eventsRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listModelCoverage } from '@/lib/repos/modelCoverageRepo'
import { createClient } from '@/lib/supabase/server'

import { deleteEventAction, restoreEventAction, seedDemoDataAction } from './actions'
import { TodayLogGrid } from './today-log-grid'

function toFiniteNumber(x: number | string | null | undefined): number | null {
  if (x == null) return null
  const n = typeof x === 'number' ? x : Number(x)
  return Number.isFinite(n) ? n : null
}

function firstSearchParam(x: string | string[] | undefined): string | null {
  if (x == null) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

function formatNumber(x: number | string | null | undefined): string {
  const n = toFiniteNumber(x)
  if (n == null) return '-'
  return n.toFixed(3).replace(/\.?0+$/, '')
}

type TargetCompartment = 'systemic' | 'cns' | 'both'

export default async function TodayPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const showDeleted = firstSearchParam(sp.show_deleted) === '1'
  const focus = firstSearchParam(sp.focus)
  const formulationId = firstSearchParam(sp.formulation_id)

  const baseParams = new URLSearchParams()
  if (focus) baseParams.set('focus', focus)
  if (formulationId) baseParams.set('formulation_id', formulationId)

  const showDeletedParams = new URLSearchParams(baseParams)
  showDeletedParams.set('show_deleted', '1')

  const showDeletedHref = `/today?${showDeletedParams.toString()}`
  const baseQuery = baseParams.toString()
  const hideDeletedHref = baseQuery ? `/today?${baseQuery}` : '/today'

  const supabase = await createClient()
  const formulations = await listFormulationsEnriched(supabase)
  const substanceTargetById = new Map<string, TargetCompartment>()
  for (const f of formulations) {
    if (f.substance) {
      substanceTargetById.set(f.substance.id, f.substance.target_compartment_default)
    }
  }
  const formulationOptions = formulations.map((f) => ({
    id: f.formulation.id,
    label: `${f.formulation.name} (${f.substance?.display_name ?? 'Unknown'} / ${
      f.route?.name ?? 'Unknown'
    })`,
  }))

  const events = await listTodayEventsEnriched(supabase, {
    limit: 200,
    deletedOnly: showDeleted,
  })
  const coverage = await listModelCoverage(supabase)
  const coverageGaps = coverage.filter(
    (c) => {
      const target: TargetCompartment = c.substance_id
        ? (substanceTargetById.get(c.substance_id) ?? 'systemic')
        : 'systemic'
      const systemicRelevant = target !== 'cns'
      const cnsRelevant = target !== 'systemic'

      const missingBaseSystemic = systemicRelevant && c.missing_base_systemic
      const missingBaseCns = cnsRelevant && c.missing_base_cns
      const missingDeviceCal = c.supports_device_calibration && c.missing_any_device_calibration

      return missingBaseSystemic || missingBaseCns || missingDeviceCal
    },
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="mt-1 text-sm text-zinc-700">Prototype logging surface.</p>
      </div>

      {formulationOptions.length === 0 ? (
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-zinc-700">
            No formulations exist yet. Use <Link className="underline hover:text-zinc-900" href="/setup">Setup</Link> to add
            substances, routes, and formulations. You can also seed demo data to exercise the event logging and Monte Carlo
            pipeline (dev-only scaffolding).
          </p>

          <form action={seedDemoDataAction} className="mt-3">
            <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" type="submit">
              Seed demo data
            </button>
          </form>
        </div>
      ) : (
        <TodayLogGrid
          key={formulationId ?? 'default'}
          formulations={formulationOptions}
          defaultFormulationId={formulationId}
        />
      )}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Model coverage</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Non-blocking warnings for missing base bioavailability specs and missing device calibrations.
        </p>

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
                  <th className="border-b px-2 py-2 font-medium">Modifiers</th>
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
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {c.has_formulation_modifiers || c.has_component_modifiers || c.has_component_fallback_modifiers ? (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">present</span>
                        ) : (
                          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">none</span>
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

      <section className="rounded-lg border bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            {showDeleted ? 'Deleted events (today)' : 'Today log'}
          </h2>
          <Link className="text-sm text-zinc-700 underline hover:text-zinc-900" href={showDeleted ? hideDeletedHref : showDeletedHref}>
            {showDeleted ? 'Hide deleted' : 'Show deleted'}
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">
            {showDeleted ? 'No deleted events today.' : 'No events logged today.'}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[700px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Time</th>
                  <th className="border-b px-2 py-2 font-medium">Formulation</th>
                  <th className="border-b px-2 py-2 font-medium">Input</th>
                  <th className="border-b px-2 py-2 font-medium">Dose mg</th>
                  <th className="border-b px-2 py-2 font-medium">Dose mL</th>
                  <th className="border-b px-2 py-2 font-medium">Eff systemic p50</th>
                  <th className="border-b px-2 py-2 font-medium">Cost</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.event_id ?? `${e.ts}-${e.input_text}`}>
                    <td className="border-b px-2 py-2 text-zinc-700">{e.ts}</td>
                    <td className="border-b px-2 py-2 text-zinc-900">
                      {e.formulation_name ?? '-'}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">{e.input_text ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {formatNumber(e.dose_mass_mg)}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {formatNumber(e.dose_volume_ml)}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {formatNumber(e.eff_systemic_p50_mg)}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {e.cost_usd == null ? '-' : `$${formatNumber(e.cost_usd)}`}
                    </td>
                    <td className="border-b px-2 py-2">
                      {e.event_id ? (
                        <form action={showDeleted ? restoreEventAction : deleteEventAction}>
                          <input type="hidden" name="event_id" value={e.event_id} />
                          {showDeleted ? (
                            <button className="text-sm text-emerald-700 underline" type="submit">
                              Restore
                            </button>
                          ) : (
                            <button className="text-sm text-red-700 underline" type="submit">
                              Delete
                            </button>
                          )}
                        </form>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
