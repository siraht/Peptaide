import Link from 'next/link'

import { listActiveCycleSummary } from '@/lib/repos/cycleSummaryRepo'
import { listDailyTotalsAdmin } from '@/lib/repos/dailyTotalsRepo'
import { listTodayEventsEnriched } from '@/lib/repos/eventsRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listInventorySummary } from '@/lib/repos/inventorySummaryRepo'
import { listInventoryStatus } from '@/lib/repos/inventoryStatusRepo'
import { listModelCoverage } from '@/lib/repos/modelCoverageRepo'
import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { listSpendRollups } from '@/lib/repos/spendRepo'
import { listDosingRecommendationsForSubstances } from '@/lib/repos/substanceRecommendationsRepo'
import { createClient } from '@/lib/supabase/server'

import { seedDemoDataAction } from './actions'
import { TodayLogTable } from './today-log-table'

function toFiniteNumber(x: number | string | null | undefined): number | null {
  if (x == null) return null
  const n = typeof x === 'number' ? x : Number(x)
  return Number.isFinite(n) ? n : null
}

function sumFinite(xs: Array<number | string | null | undefined>): number | null {
  let sum = 0
  let any = false
  for (const x of xs) {
    const n = toFiniteNumber(x)
    if (n == null) continue
    sum += n
    any = true
  }
  return any ? sum : null
}

function formatNumber(x: number | string | null | undefined, digits = 3): string {
  const n = toFiniteNumber(x)
  if (n == null) return '-'
  return n.toFixed(digits).replace(/\.?0+$/, '')
}

function formatMoney(x: number | string | null | undefined): string {
  const n = toFiniteNumber(x)
  if (n == null) return '-'
  return `$${n.toFixed(2).replace(/\.?0+$/, '')}`
}

function safeTimeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return tz
  } catch {
    return 'UTC'
  }
}

function firstSearchParam(x: string | string[] | undefined): string | null {
  if (x == null) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

function mustGetLocalYmd(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = fmt.formatToParts(date)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`Failed to format local day parts for timezone ${JSON.stringify(timeZone)}.`)
  }

  return { year, month, day }
}

function ymdToIso(ymd: { year: number; month: number; day: number }): string {
  const mm = String(ymd.month).padStart(2, '0')
  const dd = String(ymd.day).padStart(2, '0')
  return `${ymd.year}-${mm}-${dd}`
}

function dayLocalDaysAgo(daysAgo: number, timeZone: string): string {
  const todayLocal = mustGetLocalYmd(new Date(), timeZone)
  const d = new Date(Date.UTC(todayLocal.year, todayLocal.month - 1, todayLocal.day))
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return ymdToIso({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() })
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

  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))
  const timeZone = safeTimeZone(profile.timezone ?? 'UTC')

  const since7 = dayLocalDaysAgo(7, timeZone)

  // Avoid server-side waterfalls: these queries are independent.
  const [formulations, events, coverage, inventory, inventorySummary, spendDay, dailyAdmin, activeCycles] = await Promise.all([
    listFormulationsEnriched(supabase),
    listTodayEventsEnriched(supabase, {
      limit: 200,
      deletedOnly: showDeleted,
    }),
    listModelCoverage(supabase),
    listInventoryStatus(supabase),
    listInventorySummary(supabase),
    listSpendRollups(supabase, { periodKind: 'day', sincePeriodStartDate: since7 }),
    listDailyTotalsAdmin(supabase, { sinceDayLocal: since7 }),
    listActiveCycleSummary(supabase),
  ])

  const substanceTargetById = new Map<string, TargetCompartment>()
  for (const f of formulations) {
    if (f.substance) {
      substanceTargetById.set(f.substance.id, f.substance.target_compartment_default)
    }
  }

  // Inline hint for the log grid: show the most recent dosing recommendation for the formulation's
  // (substance, route) if present (route-specific preferred, otherwise global).
  const substanceIds = Array.from(
    new Set(formulations.map((f) => f.substance?.id).filter((id): id is string => Boolean(id))),
  )
  const dosingRecs = await listDosingRecommendationsForSubstances(supabase, { substanceIds })

  const dosingRecsBySubstanceId = new Map<string, typeof dosingRecs>()
  for (const r of dosingRecs) {
    const arr = dosingRecsBySubstanceId.get(r.substance_id) ?? []
    arr.push(r)
    dosingRecsBySubstanceId.set(r.substance_id, arr)
  }

  function pickRecHint(substanceId: string, routeId: string): { min: number | null; max: number | null; unit: string } | null {
    const recs = dosingRecsBySubstanceId.get(substanceId) ?? []
    const preferred = recs.find((r) => r.route_id === routeId) ?? recs.find((r) => r.route_id == null) ?? null
    if (!preferred) return null
    const min = preferred.min_value == null ? null : Number(preferred.min_value)
    const max = preferred.max_value == null ? null : Number(preferred.max_value)
    const unit = String(preferred.unit || '').trim()
    if (!unit) return null
    return { min: Number.isFinite(min as number) ? min : null, max: Number.isFinite(max as number) ? max : null, unit }
  }

  const doseRecommendationsByFormulationId: Record<string, { min: number | null; max: number | null; unit: string } | null> = {}
  for (const f of formulations) {
    const substanceId = f.substance?.id
    const routeId = f.route?.id ?? f.formulation.route_id
    if (!substanceId || !routeId) continue
    doseRecommendationsByFormulationId[f.formulation.id] = pickRecHint(substanceId, routeId)
  }

  const formulationOptions = formulations.map((f) => ({
    id: f.formulation.id,
    label: `${f.formulation.name} (${f.substance?.display_name ?? 'Unknown'} / ${
      f.route?.name ?? 'Unknown'
    })`,
  }))

  const quickLogFormulations = (() => {
    const seen = new Set<string>()
    const picks: Array<{ formulationId: string; label: string }> = []

    const newestFirst = [...events].reverse()
    for (const e of newestFirst) {
      const id = e.formulation_id
      if (!id || seen.has(id)) continue
      const f = formulationOptions.find((o) => o.id === id)
      if (!f) continue
      picks.push({ formulationId: id, label: f.label })
      seen.add(id)
      if (picks.length >= 3) break
    }

    if (picks.length < 3) {
      for (const f of formulationOptions) {
        if (seen.has(f.id)) continue
        picks.push({ formulationId: f.id, label: f.label })
        seen.add(f.id)
        if (picks.length >= 3) break
      }
    }

    return picks
  })()

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

  const vialLabelByVialId: Record<string, string> = {}
  for (const v of inventory) {
    if (!v.vial_id) continue
    if (!v.lot) continue
    vialLabelByVialId[v.vial_id] = v.lot
  }

  const formulationMetaById: Record<string, { formulationName: string; substanceName: string; routeName: string }> = {}
  for (const f of formulations) {
    formulationMetaById[f.formulation.id] = {
      formulationName: f.formulation.name,
      substanceName: f.substance?.display_name ?? 'Unknown',
      routeName: f.route?.name ?? 'Unknown',
    }
  }

  const stockedSubstances = (() => {
    const rows = inventorySummary.filter((v) => v.formulation_id && v.substance_id)

    const stockedRows = rows.filter((v) => {
      const remaining = toFiniteNumber(v.total_remaining_mass_mg)
      const content = toFiniteNumber(v.total_content_mass_mg)
      if (remaining == null || content == null) return true
      return remaining > 0 && content > 0
    })

    const grouped = new Map<string, { substanceId: string; substanceName: string; rows: typeof stockedRows }>()
    for (const r of stockedRows) {
      const substanceId = r.substance_id
      if (!substanceId) continue
      const next = grouped.get(substanceId) ?? {
        substanceId,
        substanceName: r.substance_name ?? 'Substance',
        rows: [],
      }
      next.rows.push(r)
      grouped.set(substanceId, next)
    }

    function runwayEstimateForRows(xs: typeof stockedRows): number | null {
      const remaining = sumFinite(xs.map((r) => r.total_remaining_mass_mg))
      const avgDaily = sumFinite(xs.map((r) => r.avg_daily_administered_mg_14d))
      if (remaining == null || avgDaily == null || avgDaily <= 0) return null
      return remaining / avgDaily
    }

    const out = Array.from(grouped.values())
    // Prefer showing "lowest runway first" to make restocking obvious.
    out.sort((a, b) => {
      const ra = runwayEstimateForRows(a.rows)
      const rb = runwayEstimateForRows(b.rows)
      if (ra == null && rb == null) return 0
      if (ra == null) return 1
      if (rb == null) return -1
      return ra - rb
    })

    return out
  })()

  const activeCycleBySubstanceId = new Map<string, (typeof activeCycles)[number]>()
  for (const c of activeCycles) {
    if (!c.substance_id) continue
    activeCycleBySubstanceId.set(c.substance_id, c)
  }

  const dailySpendAvg7 = (() => {
    // spendDay is already filtered to since7, ordered desc in repo.
    const xs = spendDay
      .map((r) => toFiniteNumber(r.spend_usd))
      .filter((n): n is number => typeof n === 'number')
    if (xs.length === 0) return null
    const sum = xs.reduce((a, b) => a + b, 0)
    return sum / xs.length
  })()

  const dailyAdminTotalsByDay = (() => {
    const m = new Map<string, number>()
    for (const r of dailyAdmin) {
      const day = r.day_local
      const mg = toFiniteNumber(r.administered_mg)
      if (!day || mg == null) continue
      m.set(day, (m.get(day) ?? 0) + mg)
    }

    // Render last 7 local days oldest->newest.
    const out: Array<{ day: string; mg: number }> = []
    for (let i = 6; i >= 0; i--) {
      const day = dayLocalDaysAgo(i, timeZone)
      out.push({ day, mg: m.get(day) ?? 0 })
    }
    return out
  })()

  const maxDailyAdminMg = Math.max(...dailyAdminTotalsByDay.map((d) => d.mg), 1)

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden" data-e2e="today-root">
      <section
        className="lg:w-3/5 w-full flex flex-col lg:border-r border-gray-200 dark:border-gray-800 bg-surface-light dark:bg-background-dark min-w-0"
        data-e2e="today-log-hub"
      >
        <div className="p-6 pb-2 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Today&apos;s Log</h2>
            <Link
              className="flex items-center gap-1 text-primary hover:text-primary-dark dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
              href="/analytics"
              data-e2e="today-view-history"
            >
              <span className="material-icons text-base">history</span>
              View History
            </Link>
          </div>

          <div className="mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Log</p>
            <div className="flex flex-wrap gap-2" data-e2e="today-quick-log">
              {quickLogFormulations.map((f) => (
                <Link
                  key={f.formulationId}
                  className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary dark:text-blue-300 rounded-lg border border-primary/20 transition-colors text-sm font-medium"
                  href={`/today?focus=log&formulation_id=${encodeURIComponent(f.formulationId)}`}
                  data-e2e="today-quick-log-item"
                  data-formulation-id={f.formulationId}
                >
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span className="truncate max-w-[20rem]">{f.label}</span>
                </Link>
              ))}

              <Link
                className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                href="/today?focus=log"
                data-e2e="today-quick-log-custom"
              >
                <span className="material-icons text-sm">add</span>
                Custom
              </Link>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-2 space-y-6">
          {formulationOptions.length === 0 ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-surface-dark p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                No formulations exist yet. Use{' '}
                <Link className="underline hover:text-white" href="/setup">
                  Setup
                </Link>{' '}
                to add substances, routes, and formulations. You can also seed demo data to exercise the event logging and Monte Carlo pipeline (dev-only scaffolding).
              </p>

              <form action={seedDemoDataAction} className="mt-3">
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90" type="submit">
                  Seed demo data
                </button>
              </form>
            </div>
          ) : (
            <TodayLogTable
              timeZone={timeZone}
              formulations={formulationOptions}
              formulationMetaById={formulationMetaById}
              doseRecommendationsByFormulationId={doseRecommendationsByFormulationId}
              events={events}
              vialLabelByVialId={vialLabelByVialId}
              showDeleted={showDeleted}
              showDeletedHref={showDeletedHref}
              hideDeletedHref={hideDeletedHref}
            />
          )}

          <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-surface-dark p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Model coverage</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Non-blocking warnings for missing base bioavailability specs and missing device calibrations.
            </p>

            {coverageGaps.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">No coverage gaps detected.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide">
                      <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Formulation</th>
                      <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Substance</th>
                      <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Route</th>
                      <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Device</th>
                      <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Base systemic</th>
                      <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Base CNS</th>
                      <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Device cal</th>
                      <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Modifiers</th>
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

                      const okBadge =
                        'rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300'
                      const missingBadge =
                        'rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-300'

                      return (
                        <tr key={rowKey}>
                          <td className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-gray-900 dark:text-gray-100">
                            {formulationId ? (
                              <Link className="underline hover:text-primary" href={`/formulations/${formulationId}`}>
                                {c.formulation_name ?? '-'}
                              </Link>
                            ) : (
                              <span>{c.formulation_name ?? '-'}</span>
                            )}
                          </td>
                          <td className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-gray-600 dark:text-gray-400">
                            {substanceId ? (
                              <Link className="underline hover:text-primary" href={`/substances/${substanceId}`}>
                                {c.substance_name ?? '-'}
                              </Link>
                            ) : (
                              <span>{c.substance_name ?? '-'}</span>
                            )}
                          </td>
                          <td className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-gray-600 dark:text-gray-400">{c.route_name ?? '-'}</td>
                          <td className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-gray-600 dark:text-gray-400">
                            {deviceId ? (
                              <Link className="underline hover:text-primary" href={`/devices/${deviceId}`}>
                                {c.device_name ?? '(device)'}
                              </Link>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-gray-600 dark:text-gray-400">
                            {systemicRelevant ? (
                              c.missing_base_systemic ? (
                                <span className={missingBadge}>missing</span>
                              ) : (
                                <span className={okBadge}>ok</span>
                              )
                            ) : (
                              <span className="text-gray-400">n/a</span>
                            )}
                          </td>
                          <td className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-gray-600 dark:text-gray-400">
                            {cnsRelevant ? (
                              c.missing_base_cns ? (
                                <span className={missingBadge}>missing</span>
                              ) : (
                                <span className={okBadge}>ok</span>
                              )
                            ) : (
                              <span className="text-gray-400">n/a</span>
                            )}
                          </td>
                          <td className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-gray-600 dark:text-gray-400">
                            {c.supports_device_calibration && deviceId ? (
                              c.missing_any_device_calibration ? (
                                <span className={missingBadge}>missing</span>
                              ) : (
                                <span className={okBadge}>ok</span>
                              )
                            ) : (
                              <span className="text-gray-400">n/a</span>
                            )}
                          </td>
                          <td className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 text-gray-600 dark:text-gray-400">
                            {c.has_formulation_modifiers || c.has_component_modifiers || c.has_component_fallback_modifiers ? (
                              <span className={okBadge}>present</span>
                            ) : (
                              <span className="rounded bg-gray-200/60 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">none</span>
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

        <div className="h-64 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#151a23] flex flex-col shrink-0">
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Analytics Dashboard</h3>
            <div className="flex gap-2">
              <Link className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500" href="/analytics" title="Open analytics">
                <span className="material-icons text-sm">open_in_new</span>
              </Link>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-4 p-4 scrollbar-hide">
            <div className="min-w-[300px] w-[320px] bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Daily Dose (admin)</span>
                <span className="text-[10px] text-gray-500">Last 7 days</span>
              </div>
              <div className="flex-1 flex items-end justify-between gap-2 px-1 pb-1">
                <div className="w-full h-full flex items-end gap-1">
                  {dailyAdminTotalsByDay.map((d) => {
                    const pct = Math.max(0, Math.min(1, d.mg / maxDailyAdminMg))
                    const height = `${Math.round(pct * 100)}%`
                    return (
                      <div key={d.day} className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-t-sm relative h-full">
                        <div className="absolute bottom-0 w-full bg-primary/80 rounded-t-sm" style={{ height }} />
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-gray-400 flex justify-between">
                <span>{dailyAdminTotalsByDay[0]?.day?.slice(5) ?? ''}</span>
                <span>{dailyAdminTotalsByDay.at(-1)?.day?.slice(5) ?? ''}</span>
              </div>
            </div>

            <div className="min-w-[200px] w-[240px] bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Spend Burn Rate</span>
                <span className="material-icons text-gray-400 text-sm">attach_money</span>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {dailySpendAvg7 == null ? '-' : formatMoney(dailySpendAvg7)}
                  <span className="text-sm font-normal text-gray-500">/day</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {dailySpendAvg7 == null ? 'No cost data yet.' : `Monthly est: ${formatMoney(dailySpendAvg7 * 30)}`}
                </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-400 to-blue-500 h-full rounded-full"
                  style={{ width: dailySpendAvg7 == null ? '0%' : '65%' }}
                />
              </div>
            </div>

            <div className="min-w-[300px] w-[320px] bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Monte Carlo Uncertainty</span>
                <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 rounded">Systemic vs CNS</span>
              </div>
              <div className="flex-1 relative w-full mt-1">
                <div className="absolute inset-0 flex items-end justify-between px-1">
                  <div className="w-full h-full relative">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <path d="M0,80 Q25,75 50,60 T100,40 L100,55 Q75,70 50,80 T0,90 Z" fill="rgba(168, 85, 247, 0.2)" stroke="none"></path>
                      <path d="M0,85 Q25,80 50,65 T100,45" fill="none" stroke="#a855f7" strokeDasharray="2,2" strokeWidth="1"></path>
                      <path d="M0,60 Q30,50 60,30 T100,20 L100,35 Q70,50 40,65 T0,75 Z" fill="rgba(59, 130, 246, 0.2)" stroke="none"></path>
                      <path d="M0,67 Q30,57 60,37 T100,27" fill="none" stroke="#3b82f6" strokeWidth="2"></path>
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-gray-400">
                <span>p05</span>
                <span>p50</span>
                <span>p95</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="lg:w-2/5 w-full flex flex-col bg-gray-50 dark:bg-[#0c1017] lg:border-l border-gray-200 dark:border-gray-800 min-w-0"
        data-e2e="today-control-center"
      >
        <div className="p-6 shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Control Center</h2>
            <p className="text-sm text-gray-500">Total stock</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/orders"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
              title="Add New Order"
              data-e2e="today-control-orders"
            >
              <span className="material-icons text-sm">add_shopping_cart</span>
            </Link>
            <Link
              href="/inventory"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary-dark transition-colors"
              title="Inventory"
              data-e2e="today-control-inventory"
            >
              <span className="material-icons text-sm">science</span>
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          {stockedSubstances.length === 0 ? (
            <div className="rounded-xl p-4 border border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark text-sm text-gray-600 dark:text-gray-400">
              No stock yet. Generate planned vials in <Link className="underline hover:text-white" href="/orders">Orders</Link> or add vials in{' '}
              <Link className="underline hover:text-white" href="/inventory">Inventory</Link>.
            </div>
          ) : (
            stockedSubstances.slice(0, 12).map((s) => {
              const rows = s.rows

              const remainingTotal = sumFinite(rows.map((r) => r.total_remaining_mass_mg))
              const contentTotal = sumFinite(rows.map((r) => r.total_content_mass_mg))
              const pctTotal =
                remainingTotal != null && contentTotal != null && contentTotal > 0
                  ? Math.max(0, Math.min(1, remainingTotal / contentTotal))
                  : null

              const avgDaily = sumFinite(rows.map((r) => r.avg_daily_administered_mg_14d))
              const runway =
                remainingTotal != null && avgDaily != null && avgDaily > 0 ? remainingTotal / avgDaily : null
              const lowStock = runway != null && runway < 3

              const costUsdKnown = sumFinite(rows.map((r) => r.total_cost_usd_known))
              const vialsTotal = sumFinite(rows.map((r) => r.vial_count_total))
              const vialsCostKnown = sumFinite(rows.map((r) => r.vial_count_cost_known))
              const costPerMg =
                costUsdKnown != null && contentTotal != null && contentTotal > 0
                  ? costUsdKnown / contentTotal
                  : null
              const costAllKnown = vialsTotal != null && vialsCostKnown != null && vialsTotal > 0 && vialsCostKnown === vialsTotal

              const cycle = activeCycleBySubstanceId.get(s.substanceId) ?? null
              // Keep render pure: derive the day index from the view's `cycle_length_days` (which uses `now()`
              // server-side for active cycles) instead of calling `Date.now()` in React render.
              const cycleLengthDays = toFiniteNumber(cycle?.cycle_length_days)
              const dayOfCycle = cycleLengthDays == null ? null : Math.max(1, Math.floor(cycleLengthDays) + 1)
              const cycleDaysMax = toFiniteNumber(cycle?.recommended_cycle_days_max)
              const cycleLabel =
                dayOfCycle == null
                  ? null
                  : cycleDaysMax == null
                    ? `Day ${dayOfCycle}`
                    : `Day ${dayOfCycle} of ${Math.round(cycleDaysMax)}`

              const activeVials = rows
                .filter((r) => Boolean(r.active_vial_id))
                .map((r) => {
                  const remainingActive = toFiniteNumber(r.active_remaining_mass_mg)
                  const contentActive = toFiniteNumber(r.active_content_mass_mg)
                  const pctActive =
                    remainingActive != null && contentActive != null && contentActive > 0
                      ? Math.max(0, Math.min(1, remainingActive / contentActive))
                      : null

                  return {
                    activeVialId: r.active_vial_id ?? null,
                    formulationId: r.formulation_id ?? '',
                    formulationName: r.formulation_name ?? null,
                    lot: r.active_lot ?? null,
                    remainingActive,
                    contentActive,
                    pctActive,
                  }
                })
                .filter((r) => Boolean(r.formulationId))
                .sort((a, b) => String(a.formulationName ?? '').localeCompare(String(b.formulationName ?? '')))

              const primaryFormulationId = activeVials[0]?.formulationId ?? rows[0]?.formulation_id ?? null
              const activeVialId = activeVials[0]?.activeVialId ?? null

              const lots = activeVials.map((v) => v.lot).filter((l): l is string => Boolean(l))
              const lotBadges = lots.slice(0, 3)
              const extraLots = Math.max(0, lots.length - lotBadges.length)

              return (
                <div
                  key={s.substanceId}
                  className={`bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border transition-colors ${
                    lowStock ? 'border-orange-200 dark:border-orange-900/30' : 'border-gray-200 dark:border-gray-700/50 hover:border-primary/50'
                  }`}
                  data-e2e="today-inventory-card"
                  data-substance-id={s.substanceId}
                  data-vial-id={activeVialId ?? ''}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        lowStock ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' : 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                      }`}>
                        <span className="material-icons">{lowStock ? 'warning' : 'medication_liquid'}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">
                          {s.substanceName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {cycleLabel ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              {cycleLabel}
                            </span>
                          ) : null}
                          {lotBadges.map((lot) => (
                            <span key={lot} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                              {lot}
                            </span>
                          ))}
                          {extraLots > 0 ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                              +{extraLots}
                            </span>
                          ) : null}
                          {costPerMg == null ? (
                            <span className="text-xs text-gray-400">-</span>
                          ) : (
                            <span className="text-xs text-gray-400">
                              {costAllKnown ? '' : '~'}${formatNumber(costPerMg, 2)}/mg
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-semibold uppercase tracking-wider ${
                        lowStock ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400'
                      }`}>
                        {lowStock ? 'Low Stock' : 'Runway'}
                      </div>
                      <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        {runway == null ? '-' : `~${Math.round(runway)}d`}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1.5 font-medium">
                      <span className={lowStock ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}>
                        Total stock:{' '}
                        {remainingTotal == null ? '-' : `${formatNumber(remainingTotal, 2)}mg`} /{' '}
                        {contentTotal == null ? '-' : `${formatNumber(contentTotal, 2)}mg`}
                      </span>
                      <span className="text-gray-400">{pctTotal == null ? '-' : `${Math.round(pctTotal * 100)}%`}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${lowStock ? 'bg-orange-500' : 'bg-green-500'}`}
                        style={{ width: pctTotal == null ? '0%' : `${Math.round(pctTotal * 100)}%` }}
                      />
                    </div>

                    {activeVials.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {activeVials.map((av) => (
                          <div
                            key={av.formulationId}
                            data-e2e="today-inventory-current-vial"
                            data-formulation-id={av.formulationId}
                          >
                            <div className="flex justify-between text-[10px] mb-1 font-medium text-gray-500 dark:text-gray-400 gap-2">
                              <span className="truncate">
                                Current vial{av.formulationName ? ` (${av.formulationName})` : ''}{av.lot ? ` • ${av.lot}` : ''}:{' '}
                                {av.remainingActive == null ? '-' : `${formatNumber(av.remainingActive, 2)}mg`} /{' '}
                                {av.contentActive == null ? '-' : `${formatNumber(av.contentActive, 2)}mg`}
                              </span>
                              <span className="shrink-0 flex items-center gap-2">
                                <span>{av.pctActive == null ? '-' : `${Math.round(av.pctActive * 100)}%`}</span>
                                <Link
                                  className="px-2 py-0.5 text-[10px] font-semibold text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-white rounded transition-colors bg-gray-50 dark:bg-gray-800"
                                  href={`/today?focus=log&formulation_id=${encodeURIComponent(av.formulationId)}`}
                                  data-e2e="today-inventory-log-dose"
                                >
                                  Log Dose
                                </Link>
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gray-400 dark:bg-gray-500"
                                style={{ width: av.pctActive == null ? '0%' : `${Math.round(av.pctActive * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 items-center">
                    <div className="flex-1"></div>
                    {activeVials.length === 0 && primaryFormulationId ? (
                      <Link
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-white rounded transition-colors bg-gray-50 dark:bg-gray-800"
                        href={`/today?focus=log&formulation_id=${encodeURIComponent(primaryFormulationId)}`}
                        data-e2e="today-inventory-log-dose"
                      >
                        Log Dose
                      </Link>
                    ) : null}
                    {lowStock ? (
                      <Link className="px-3 py-1.5 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded transition-colors shadow-sm" href="/orders">
                        Restock
                      </Link>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-surface-dark">
          <button
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors group"
            type="button"
            data-e2e="today-scan-vial"
          >
            <span className="material-icons group-hover:scale-110 transition-transform">qr_code_scanner</span>
            <span className="font-medium">Scan Vial to Activate</span>
          </button>
        </div>
      </section>
    </div>
  )
}
