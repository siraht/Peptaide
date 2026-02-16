import Link from 'next/link'

import { SubstanceAnalyticsPanel } from '@/components/analytics/substance-analytics-panel'
import { TodayAnalyticsStrip } from '@/components/analytics/today-analytics-strip'
import { VialMassAndVolumeFields, VialNotesField, VialStatusField } from '@/components/inventory/vial-core-fields'
import { EmptyState } from '@/components/ui/empty-state'
import { listActiveCycleSummary } from '@/lib/repos/cycleSummaryRepo'
import {
  listDailyTotalsAdmin,
  listDailyTotalsEffectiveCns,
  listDailyTotalsEffectiveSystemic,
} from '@/lib/repos/dailyTotalsRepo'
import { listDoseInventoryWarnings } from '@/lib/repos/doseInventoryWarningsRepo'
import { listTodayEventsEnriched } from '@/lib/repos/eventsRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listInventorySummary } from '@/lib/repos/inventorySummaryRepo'
import { listInventoryStatus } from '@/lib/repos/inventoryStatusRepo'
import { listModelCoverage } from '@/lib/repos/modelCoverageRepo'
import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { listSpendRollups } from '@/lib/repos/spendRepo'
import { listDosingRecommendationsForSubstances } from '@/lib/repos/substanceRecommendationsRepo'
import { createClient } from '@/lib/supabase/server'
import { dayLocalDaysAgo, safeTimeZone } from '@/lib/time'

import { createVialFromTodayAction, discardVialFromControlCenterAction, seedDemoDataAction } from './actions'
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
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n)
}

function firstSearchParam(x: string | string[] | undefined): string | null {
  if (x == null) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

function toLocalDateIso(ts: string | null | undefined, timeZone: string): string | null {
  if (!ts) return null
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

type HistoryWindow = '90' | '180' | 'all'

function normalizeHistoryWindow(x: string | null): HistoryWindow {
  if (x === '180') return '180'
  if (x === 'all') return 'all'
  return '90'
}

function hasExplicitHistoryWindow(x: string | null): x is HistoryWindow {
  return x === '90' || x === '180' || x === 'all'
}

function formatLocalDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
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
  const ccModal = firstSearchParam(sp.cc_modal)
  const ccSubstanceId = firstSearchParam(sp.cc_substance_id)
  const ccError = firstSearchParam(sp.cc_error)
  const ccNotice = firstSearchParam(sp.cc_notice)
  const ccHistoryRaw = firstSearchParam(sp.cc_history)
  const ccHistory = normalizeHistoryWindow(ccHistoryRaw)

  const baseParams = new URLSearchParams()
  if (focus) baseParams.set('focus', focus)
  if (formulationId) baseParams.set('formulation_id', formulationId)
  if (ccModal) baseParams.set('cc_modal', ccModal)
  if (ccSubstanceId) baseParams.set('cc_substance_id', ccSubstanceId)
  if (hasExplicitHistoryWindow(ccHistoryRaw)) baseParams.set('cc_history', ccHistory)

  const showDeletedParams = new URLSearchParams(baseParams)
  showDeletedParams.set('show_deleted', '1')

  const showDeletedHref = `/today?${showDeletedParams.toString()}`
  const baseQuery = baseParams.toString()
  const hideDeletedHref = baseQuery ? `/today?${baseQuery}` : '/today'

  const closeModalParams = new URLSearchParams(baseParams)
  if (showDeleted) closeModalParams.set('show_deleted', '1')
  closeModalParams.delete('cc_modal')
  closeModalParams.delete('cc_substance_id')
  closeModalParams.delete('cc_history')
  closeModalParams.delete('cc_error')
  closeModalParams.delete('cc_notice')
  const closeModalHref = closeModalParams.toString() ? `/today?${closeModalParams.toString()}` : '/today'

  const supabase = await createClient()

  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))
  const timeZone = safeTimeZone(profile.timezone ?? 'UTC')

  const since7 = dayLocalDaysAgo(7, timeZone)
  const since180 = dayLocalDaysAgo(180, timeZone)

  // Avoid server-side waterfalls: these queries are independent.
  const [
    formulations,
    events,
    coverage,
    inventory,
    inventorySummary,
    spendDay,
    spendWeek,
    spendMonth,
    dailyAdmin,
    dailyEffectiveSystemic,
    dailyEffectiveCns,
    activeCycles,
    doseWarnings,
  ] = await Promise.all([
    listFormulationsEnriched(supabase),
    listTodayEventsEnriched(supabase, {
      limit: 200,
      deletedOnly: showDeleted,
    }),
    listModelCoverage(supabase),
    listInventoryStatus(supabase),
    listInventorySummary(supabase),
    listSpendRollups(supabase, { periodKind: 'day', sincePeriodStartDate: since180 }),
    listSpendRollups(supabase, { periodKind: 'week', sincePeriodStartDate: since180 }),
    listSpendRollups(supabase, { periodKind: 'month', sincePeriodStartDate: since180 }),
    listDailyTotalsAdmin(supabase, { sinceDayLocal: since180 }),
    listDailyTotalsEffectiveSystemic(supabase, { sinceDayLocal: since180 }),
    listDailyTotalsEffectiveCns(supabase, { sinceDayLocal: since180 }),
    listActiveCycleSummary(supabase),
    listDoseInventoryWarnings(supabase, { limit: 1200 }),
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
    const xs = spendDay
      .filter((r) => {
        const day = r.period_start_date
        return typeof day === 'string' && day >= since7
      })
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

  const warningCountBySubstanceId = new Map<string, number>()
  for (const w of doseWarnings) {
    warningCountBySubstanceId.set(w.substanceId, (warningCountBySubstanceId.get(w.substanceId) ?? 0) + 1)
  }
  const warningCountTotal = doseWarnings.length
  const warningRows = doseWarnings.slice(0, 120)

  const formulationsBySubstanceId = new Map<
    string,
    Array<{ formulationId: string; formulationName: string; routeName: string }>
  >()
  for (const f of formulations) {
    const substanceId = f.formulation.substance_id
    const arr = formulationsBySubstanceId.get(substanceId) ?? []
    arr.push({
      formulationId: f.formulation.id,
      formulationName: f.formulation.name,
      routeName: f.route?.name ?? 'Route',
    })
    formulationsBySubstanceId.set(substanceId, arr)
  }

  for (const rows of formulationsBySubstanceId.values()) {
    rows.sort((a, b) => {
      const byRoute = a.routeName.localeCompare(b.routeName)
      if (byRoute !== 0) return byRoute
      return a.formulationName.localeCompare(b.formulationName)
    })
  }

  const selectedModalSubstance = (() => {
    if (!ccSubstanceId) return null
    const stockHit = stockedSubstances.find((s) => s.substanceId === ccSubstanceId)
    if (stockHit) return { id: stockHit.substanceId, name: stockHit.substanceName }

    const formulationHit = formulations.find((f) => f.formulation.substance_id === ccSubstanceId)
    if (formulationHit) {
      return {
        id: ccSubstanceId,
        name: formulationHit.substance?.display_name ?? 'Substance',
      }
    }

    const warningHit = doseWarnings.find((w) => w.substanceId === ccSubstanceId)
    if (warningHit) return { id: warningHit.substanceId, name: warningHit.substanceName }
    return null
  })()

  const selectedSubstanceId = selectedModalSubstance?.id ?? null
  const selectedSubstanceName = selectedModalSubstance?.name ?? 'Substance'

  const addVialFormulations =
    selectedSubstanceId == null ? [] : formulationsBySubstanceId.get(selectedSubstanceId) ?? []
  const defaultAddVialFormulationId = addVialFormulations[0]?.formulationId ?? ''

  const historyDateFrom = (() => {
    if (ccHistory === '180') return dayLocalDaysAgo(180, timeZone)
    if (ccHistory === 'all') return null
    return dayLocalDaysAgo(90, timeZone)
  })()

  const selectedVialHistory = (() => {
    if (!selectedSubstanceId) return []
    return inventory
      .filter((row) => row.substance_id === selectedSubstanceId)
      .filter((row) => {
        if (!historyDateFrom) return true
        const anchor =
          toLocalDateIso(row.opened_at, timeZone) ??
          toLocalDateIso(row.received_at, timeZone) ??
          toLocalDateIso(row.closed_at, timeZone)
        if (!anchor) return true
        return anchor >= historyDateFrom
      })
      .sort((a, b) => {
        const ta = a.opened_at ?? a.received_at ?? a.closed_at ?? ''
        const tb = b.opened_at ?? b.received_at ?? b.closed_at ?? ''
        return String(tb).localeCompare(String(ta))
      })
  })()

  const selectedWarnings = selectedSubstanceId
    ? doseWarnings.filter((w) => w.substanceId === selectedSubstanceId).slice(0, 60)
    : []

  const analyticsFilter = {
    substanceId: selectedSubstanceId,
    dateFrom: historyDateFrom,
    dateTo: null,
  }
  const spendRows = [...spendDay, ...spendWeek, ...spendMonth]

  function buildAnalyticsHistoryHref(window: HistoryWindow): string {
    const params = new URLSearchParams(baseParams)
    if (showDeleted) params.set('show_deleted', '1')
    params.set('cc_modal', 'analytics')
    if (selectedSubstanceId) params.set('cc_substance_id', selectedSubstanceId)
    params.set('cc_history', window)
    return `/today?${params.toString()}`
  }

  return (
    <div className="h-full overflow-auto xl:overflow-hidden flex flex-col xl:flex-row" data-e2e="today-root">
      <section
        className="xl:w-3/5 w-full flex flex-col xl:border-r border-gray-200 dark:border-gray-800 bg-surface-light dark:bg-background-dark min-w-0"
        data-e2e="today-log-hub"
      >
        <div className="shrink-0 px-4 pb-2 pt-5 sm:px-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Today&apos;s Log</h2>
            <Link
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10 dark:text-blue-300"
              href="/analytics"
              data-e2e="today-view-history"
            >
              <span className="material-icons text-base">history</span>
              View History
            </Link>
          </div>

          <div className="mb-2 rounded-2xl border border-border-light/70 bg-gradient-to-b from-slate-50 to-white p-3 shadow-sm dark:border-border-dark dark:from-slate-900/30 dark:to-surface-dark">
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

        <div className="px-4 py-2 space-y-6 sm:px-6 xl:flex-1 xl:overflow-auto">
          {formulationOptions.length === 0 ? (
            <div className="space-y-3">
              <EmptyState
                icon="medication"
                title="No formulations exist yet"
                description={
                  <>
                    Use <Link className="underline" href="/setup">Setup</Link> to add substances, routes, and formulations.
                  </>
                }
                actionHref="/setup"
                actionLabel="Open setup wizard"
              />
              <form action={seedDemoDataAction} className="pl-1">
                <button className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90" type="submit">
                  Seed demo data
                </button>
              </form>
            </div>
          ) : (
            <TodayLogTable
              timeZone={timeZone}
              formulations={formulationOptions}
              doseRecommendationsByFormulationId={doseRecommendationsByFormulationId}
              events={events}
              vialLabelByVialId={vialLabelByVialId}
              showDeleted={showDeleted}
              showDeletedHref={showDeletedHref}
              hideDeletedHref={hideDeletedHref}
            />
          )}

          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-surface-dark p-4 shadow-sm">
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

        <TodayAnalyticsStrip
          dailyAdminTotalsByDay={dailyAdminTotalsByDay}
          maxDailyAdminMg={maxDailyAdminMg}
          dailySpendAvg7={dailySpendAvg7}
        />
      </section>

      <section
        className="xl:w-2/5 w-full flex flex-col bg-gray-50 dark:bg-[#0c1017] xl:border-l border-gray-200 dark:border-gray-800 min-w-0"
        data-e2e="today-control-center"
      >
        <div className="shrink-0 space-y-3 px-4 pb-3 pt-5 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Control Center</h2>
              <p className="text-sm text-gray-500">Total stock</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/orders"
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
                title="Add New Order"
                aria-label="Add new order"
                data-e2e="today-control-orders"
              >
                <span className="material-icons text-sm">add_shopping_cart</span>
              </Link>
              <Link
                href="/inventory"
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary-dark transition-colors"
                title="Inventory"
                aria-label="Open inventory"
                data-e2e="today-control-inventory"
              >
                <span className="material-icons text-sm">science</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2" data-e2e="today-control-quick-create">
            <Link
              href="/substances?focus=new"
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-primary hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              data-e2e="today-quick-create-substance"
            >
              + Substance
            </Link>
            <Link
              href="/routes?focus=new"
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-primary hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              data-e2e="today-quick-create-route"
            >
              + Route
            </Link>
            <Link
              href="/formulations?focus=new"
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-primary hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              data-e2e="today-quick-create-formulation"
            >
              + Formulation
            </Link>
            <Link
              href="/inventory?focus=new-vial"
              className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 dark:text-blue-300"
              data-e2e="today-quick-create-vial"
            >
              + Vial
            </Link>
            <details className="relative" data-e2e="today-quick-create-overflow">
              <summary
                className="list-none rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-primary hover:text-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 cursor-pointer"
                data-e2e="today-quick-create-overflow-toggle"
              >
                More
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <Link
                  href="/inventory?focus=reconcile-imported"
                  className="block rounded-md px-2 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-gray-800"
                  data-e2e="today-quick-create-reconcile"
                >
                  Reconcile Imported Vials
                </Link>
                <Link
                  href="/orders?focus=new-order-item"
                  className="block rounded-md px-2 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-gray-800"
                  data-e2e="today-quick-create-order-item"
                >
                  New Order Item
                </Link>
              </div>
            </details>
          </div>

          {warningCountTotal > 0 ? (
            <div
              className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
              data-e2e="today-warning-summary"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  Dose/vial integrity warnings: {warningCountTotal}
                </span>
                <a
                  href="#today-warning-list"
                  className="underline underline-offset-2 hover:text-primary"
                  data-e2e="today-warning-summary-jump"
                >
                  View list
                </a>
              </div>
              <p className="mt-1 text-xs leading-5">
                Non-blocking checks: missing-candidate vials • timeline mismatches • cumulative overdraw.
              </p>
            </div>
          ) : null}
        </div>

        <div className="px-4 pb-5 space-y-4 sm:px-6 sm:pb-6 xl:flex-1 xl:overflow-y-auto">
          {stockedSubstances.length === 0 ? (
            <EmptyState
              icon="inventory_2"
              title="No stock yet"
              description={
                <>
                  Generate planned vials in <Link className="underline" href="/orders">Orders</Link> or add vials in{' '}
                  <Link className="underline" href="/inventory">Inventory</Link>.
                </>
              }
              actionHref="/orders"
              actionLabel="Open orders"
              secondaryHref="/inventory"
              secondaryLabel="Open inventory"
            />
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
              const warningCount = warningCountBySubstanceId.get(s.substanceId) ?? 0

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
              const discardableVials = inventory
                .filter(
                  (v) =>
                    v.substance_id === s.substanceId &&
                    Boolean(v.vial_id) &&
                    v.status != null &&
                    v.status !== 'discarded',
                )
                .map((v) => ({
                  vialId: String(v.vial_id),
                  status: String(v.status),
                  lot: v.lot ? String(v.lot) : null,
                  formulationName: v.formulation_name ? String(v.formulation_name) : 'Formulation',
                }))
                .sort((a, b) => {
                  const rank = (status: string) => {
                    if (status === 'active') return 0
                    if (status === 'planned') return 1
                    if (status === 'closed') return 2
                    return 3
                  }
                  const byStatus = rank(a.status) - rank(b.status)
                  if (byStatus !== 0) return byStatus
                  return a.formulationName.localeCompare(b.formulationName)
                })

              const modalBaseParams = new URLSearchParams(baseParams)
              if (showDeleted) modalBaseParams.set('show_deleted', '1')
              modalBaseParams.set('cc_substance_id', s.substanceId)
              modalBaseParams.set('cc_history', ccHistory)

              const addVialParams = new URLSearchParams(modalBaseParams)
              addVialParams.set('cc_modal', 'add-vial')
              const addVialHref = `/today?${addVialParams.toString()}`

              const analyticsParams = new URLSearchParams(modalBaseParams)
              analyticsParams.set('cc_modal', 'analytics')
              const analyticsHref = `/today?${analyticsParams.toString()}`

              return (
                <div
                  key={s.substanceId}
                  className={`rounded-2xl border bg-white/95 p-4 shadow-sm transition-colors dark:bg-surface-dark ${
                    lowStock ? 'border-orange-200 dark:border-orange-900/30' : 'border-gray-200 dark:border-gray-700/50 hover:border-primary/50'
                  }`}
                  data-e2e="today-inventory-card"
                  data-substance-id={s.substanceId}
                  data-vial-id={activeVialId ?? ''}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        lowStock ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' : 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                      }`}>
                        <span className="material-icons">{lowStock ? 'warning' : 'medication_liquid'}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">
                            {s.substanceName}
                          </h3>
                          {warningCount > 0 ? (
                            <span
                              className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                              data-e2e="today-card-warning-count"
                            >
                              {warningCount} warning{warningCount === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </div>
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
                    <Link
                      className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-white rounded transition-colors bg-gray-50 dark:bg-gray-800"
                      href={addVialHref}
                      data-e2e="today-card-add-vial"
                      data-substance-id={s.substanceId}
                    >
                      Add vial
                    </Link>
                    <Link
                      className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-white rounded transition-colors bg-gray-50 dark:bg-gray-800"
                      href={analyticsHref}
                      data-e2e="today-card-analytics"
                      data-substance-id={s.substanceId}
                    >
                      Analytics
                    </Link>
                    <div className="flex-1"></div>
                    {discardableVials.length > 0 ? (
                      <details
                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1.5"
                        data-e2e="today-inventory-discard-menu"
                        data-substance-id={s.substanceId}
                      >
                        <summary
                          className="list-none cursor-pointer text-xs font-medium text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-300"
                          data-e2e="today-inventory-discard-menu-toggle"
                        >
                          Toss vial
                        </summary>
                        <form
                          action={discardVialFromControlCenterAction}
                          className="mt-2 min-w-[16rem] space-y-2"
                          data-e2e="today-inventory-discard-form"
                        >
                          <input type="hidden" name="cc_return_q" value={closeModalParams.toString()} />
                          <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400">
                            Vial
                            <select
                              name="vial_id"
                              required
                              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none transition-colors focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                              data-e2e="today-inventory-discard-vial-select"
                            >
                              {discardableVials.map((v) => (
                                <option key={v.vialId} value={v.vialId}>
                                  {v.formulationName}
                                  {v.lot ? ` • ${v.lot}` : ''}
                                  {` • ${v.status}`}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400">
                            Reason (optional)
                            <input
                              name="discard_reason"
                              maxLength={240}
                              placeholder="gone bad, contaminated, tossed..."
                              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none transition-colors focus:border-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                              data-e2e="today-inventory-discard-reason-input"
                            />
                          </label>
                          <button
                            type="submit"
                            className="w-full rounded-md bg-red-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                            data-e2e="today-inventory-discard-submit"
                          >
                            Mark discarded
                          </button>
                        </form>
                      </details>
                    ) : null}
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

          {warningCountTotal > 0 ? (
            <section
              id="today-warning-list"
              className="rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-sm dark:border-gray-700/50 dark:bg-surface-dark"
              data-e2e="today-warning-list"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dose/Vial integrity warnings</h3>
                <span className="text-xs text-gray-500">Showing {warningRows.length} of {warningCountTotal}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
                Warnings are non-blocking. Review suspicious historical/event-vial states.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[860px] border-separate border-spacing-0 text-left text-xs">
                  <thead>
                    <tr className="uppercase tracking-wide text-gray-500">
                      <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">Severity</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">Substance</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">When</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">Code</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warningRows.map((w) => {
                      const severityClass =
                        w.severity === 'error'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                          : w.severity === 'warning'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                            : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
                      const candidateCount = toFiniteNumber(
                        w.detailsJson?.candidate_count as number | string | null | undefined,
                      )
                      const candidates =
                        candidateCount != null
                          ? String(Math.max(0, Math.floor(candidateCount)))
                          : Array.isArray(w.detailsJson?.candidate_vial_ids)
                            ? String((w.detailsJson?.candidate_vial_ids as unknown[]).length)
                            : null
                      const overdrawMg = toFiniteNumber(w.detailsJson?.overdraw_mg as number | string | null | undefined)
                      const overdrawMl = toFiniteNumber(w.detailsJson?.overdraw_ml as number | string | null | undefined)
                      const detailSummary =
                        overdrawMg != null
                          ? `Overdraw ${formatNumber(overdrawMg, 3)} mg`
                          : overdrawMl != null
                            ? `Overdraw ${formatNumber(overdrawMl, 3)} mL`
                            : candidates != null
                              ? `${candidates} candidate vial(s)`
                              : '-'

                      return (
                        <tr key={`${w.eventId}:${w.warningCode}`} data-e2e="today-warning-row">
                          <td className="border-b border-gray-200 px-2 py-2 dark:border-gray-800">
                            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${severityClass}`}>
                              {w.severity}
                            </span>
                          </td>
                          <td className="border-b border-gray-200 px-2 py-2 text-gray-900 dark:border-gray-800 dark:text-gray-100">
                            <Link
                              href={`/today?cc_modal=analytics&cc_substance_id=${encodeURIComponent(w.substanceId)}&cc_history=${encodeURIComponent(ccHistory)}`}
                              className="underline-offset-2 hover:underline"
                            >
                              {w.substanceName}
                            </Link>
                          </td>
                          <td className="border-b border-gray-200 px-2 py-2 text-gray-600 dark:border-gray-800 dark:text-gray-400">
                            {formatLocalDateTime(w.eventTs, timeZone)}
                          </td>
                          <td className="border-b border-gray-200 px-2 py-2 font-mono text-[11px] text-gray-700 dark:border-gray-800 dark:text-gray-300">
                            {w.warningCode}
                          </td>
                          <td className="border-b border-gray-200 px-2 py-2 text-gray-600 dark:border-gray-800 dark:text-gray-400">
                            {detailSummary}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
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

      {(ccModal === 'add-vial' || ccModal === 'analytics') && selectedSubstanceId ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 py-8 sm:px-6">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-5xl rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-surface-dark sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {ccModal === 'add-vial' ? `Add vial • ${selectedSubstanceName}` : `Analytics • ${selectedSubstanceName}`}
                </h3>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {ccModal === 'add-vial'
                    ? 'Create a vial without leaving /today. The same server action as /inventory is reused.'
                    : 'Substance-scoped analytics and vial history from the selected date window.'}
                </p>
              </div>
              <Link
                href={closeModalHref}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:border-primary hover:text-primary dark:border-gray-700 dark:text-gray-300"
                data-e2e="today-modal-close"
                aria-label="Close modal"
              >
                <span className="material-icons text-base">close</span>
              </Link>
            </div>

            {ccModal === 'add-vial' ? (
              <div data-e2e="today-modal-add-vial">
                {ccError ? (
                  <div
                    className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200"
                    data-e2e="today-modal-add-vial-error"
                  >
                    {ccError}
                  </div>
                ) : null}
                {ccNotice ? (
                  <div
                    className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-200"
                    data-e2e="today-modal-add-vial-notice"
                  >
                    {ccNotice}
                  </div>
                ) : null}

                {addVialFormulations.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300">
                    <p>No formulations exist for this substance yet.</p>
                    <Link
                      href={`/formulations?focus=new&substance_id=${encodeURIComponent(selectedSubstanceId)}&return_to=${encodeURIComponent('/today')}`}
                      className="mt-2 inline-flex rounded-md border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      Create formulation
                    </Link>
                  </div>
                ) : (
                  <form
                    action={createVialFromTodayAction}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    data-e2e="today-modal-add-vial-form"
                  >
                    <input type="hidden" name="cc_substance_id" value={selectedSubstanceId} />
                    <input type="hidden" name="cc_history" value={ccHistory} />
                    <input type="hidden" name="cc_return_q" value={closeModalParams.toString()} />
                    <input type="hidden" name="order_item_id" value="" />
                    <input type="hidden" name="cost_manual_override" value="0" />

                    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                      <span className="text-slate-600 dark:text-slate-400">Formulation</span>
                      <select
                        name="formulation_id"
                        required
                        defaultValue={defaultAddVialFormulationId}
                        className="h-10 rounded-md border border-transparent bg-slate-100 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-800 dark:text-slate-100"
                        data-e2e="today-modal-add-vial-formulation"
                      >
                        {addVialFormulations.map((f) => (
                          <option key={f.formulationId} value={f.formulationId}>
                            {f.formulationName} ({f.routeName})
                          </option>
                        ))}
                      </select>
                    </label>

                    <VialStatusField defaultValue="planned" />
                    <div className="hidden sm:block" />
                    <VialMassAndVolumeFields />
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Cost USD (optional)</span>
                      <input
                        name="cost_usd"
                        inputMode="decimal"
                        className="h-10 rounded-md border border-transparent bg-slate-100 px-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-800 dark:text-slate-100"
                      />
                    </label>
                    <VialNotesField />

                    <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-1">
                      <Link
                        href={closeModalHref}
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary dark:border-gray-700 dark:text-gray-300"
                      >
                        Cancel
                      </Link>
                      <button
                        type="submit"
                        className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                        data-e2e="today-modal-add-vial-submit"
                      >
                        Create vial
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="space-y-4" data-e2e="today-modal-analytics">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">History window:</span>
                    <Link
                      href={buildAnalyticsHistoryHref('90')}
                      className={`rounded px-2 py-1 font-semibold ${
                        ccHistory === '90'
                          ? 'bg-primary/20 text-primary dark:text-blue-300'
                          : 'text-gray-600 hover:text-primary dark:text-gray-400'
                      }`}
                      data-e2e="today-modal-analytics-history-90"
                    >
                      90d
                    </Link>
                    <Link
                      href={buildAnalyticsHistoryHref('180')}
                      className={`rounded px-2 py-1 font-semibold ${
                        ccHistory === '180'
                          ? 'bg-primary/20 text-primary dark:text-blue-300'
                          : 'text-gray-600 hover:text-primary dark:text-gray-400'
                      }`}
                      data-e2e="today-modal-analytics-history-180"
                    >
                      180d
                    </Link>
                    <Link
                      href={buildAnalyticsHistoryHref('all')}
                      className={`rounded px-2 py-1 font-semibold ${
                        ccHistory === 'all'
                          ? 'bg-primary/20 text-primary dark:text-blue-300'
                          : 'text-gray-600 hover:text-primary dark:text-gray-400'
                      }`}
                      data-e2e="today-modal-analytics-history-all"
                    >
                      All
                    </Link>
                  </div>
                  <Link
                    href="/analytics"
                    className="text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-primary dark:text-gray-300"
                  >
                    Open full analytics
                  </Link>
                </div>

                {selectedWarnings.length > 0 ? (
                  <section
                    className="rounded-xl border border-amber-300/60 bg-amber-50/80 p-3 dark:border-amber-900/30 dark:bg-amber-900/20"
                    data-e2e="today-modal-warning-list"
                  >
                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Integrity warnings ({selectedWarnings.length})
                    </h4>
                    <div className="mt-2 max-h-40 overflow-auto text-xs text-amber-900 dark:text-amber-100">
                      {selectedWarnings.map((w) => (
                        <div
                          key={`${w.eventId}:${w.warningCode}`}
                          className="border-b border-amber-200/60 py-1 last:border-b-0 dark:border-amber-900/40"
                        >
                          <span className="font-mono">{w.warningCode}</span>{' '}
                          <span className="text-amber-800/80 dark:text-amber-200/80">
                            {formatLocalDateTime(w.eventTs, timeZone)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <SubstanceAnalyticsPanel
                  filter={analyticsFilter}
                  adminRows={dailyAdmin}
                  effectiveSystemicRows={dailyEffectiveSystemic}
                  effectiveCnsRows={dailyEffectiveCns}
                  spendRows={spendRows}
                  rowLimit={120}
                  showSpend={false}
                />

                <section
                  className="rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm dark:border-gray-700 dark:bg-surface-dark"
                  data-e2e="today-modal-vial-history"
                >
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vial history</h4>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {ccHistory === 'all'
                      ? 'All available vial records for this substance.'
                      : `Filtered to the last ${ccHistory} days by opened/received/closed timestamps.`}
                  </p>
                  {selectedVialHistory.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">No vial rows in this window.</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-[760px] border-separate border-spacing-0 text-left text-xs">
                        <thead>
                          <tr className="uppercase tracking-wide text-gray-500">
                            <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">Formulation</th>
                            <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">Status</th>
                            <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">Lot</th>
                            <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">Opened</th>
                            <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">Remaining</th>
                            <th className="border-b border-gray-200 px-2 py-2 font-semibold dark:border-gray-800">Runway</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVialHistory.map((row) => (
                            <tr key={row.vial_id ?? `${row.formulation_id}-${row.opened_at ?? row.received_at ?? row.closed_at ?? 'row'}`} data-e2e="today-modal-vial-history-row">
                              <td className="border-b border-gray-200 px-2 py-2 text-gray-900 dark:border-gray-800 dark:text-gray-100">
                                {row.formulation_name ?? '-'}
                              </td>
                              <td className="border-b border-gray-200 px-2 py-2 text-gray-600 dark:border-gray-800 dark:text-gray-400">
                                {row.status ?? '-'}
                              </td>
                              <td className="border-b border-gray-200 px-2 py-2 font-mono text-gray-600 dark:border-gray-800 dark:text-gray-400">
                                {row.lot ?? '-'}
                              </td>
                              <td className="border-b border-gray-200 px-2 py-2 text-gray-600 dark:border-gray-800 dark:text-gray-400">
                                {formatLocalDateTime(row.opened_at ?? row.received_at ?? row.closed_at, timeZone)}
                              </td>
                              <td className="border-b border-gray-200 px-2 py-2 font-mono text-gray-600 dark:border-gray-800 dark:text-gray-400">
                                {row.remaining_mass_mg == null ? '-' : `${formatNumber(row.remaining_mass_mg, 2)} mg`}
                              </td>
                              <td className="border-b border-gray-200 px-2 py-2 font-mono text-gray-600 dark:border-gray-800 dark:text-gray-400">
                                {row.runway_days_estimate_mg == null ? '-' : `${formatNumber(row.runway_days_estimate_mg, 1)} d`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
