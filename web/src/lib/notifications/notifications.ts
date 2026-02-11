import type { DbClient } from '@/lib/repos/types'
import { listInventorySummary, type InventorySummaryRow } from '@/lib/repos/inventorySummaryRepo'
import { ensureMyProfile, getMyProfile, type ProfileRow } from '@/lib/repos/profilesRepo'
import { listSpendRollups, type SpendRow } from '@/lib/repos/spendRepo'
import { dayLocalDaysAgo, safeTimeZone } from '@/lib/time'

export type NotificationSeverity = 'info' | 'warning' | 'urgent'

export type NotificationItem = {
  id: string
  severity: NotificationSeverity
  title: string
  description: string
  href: string | null
}

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

function formatNumber(x: number | string | null | undefined, digits = 2): string {
  const n = toFiniteNumber(x)
  if (n == null) return '-'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n)
}

function formatMoney(x: number | string | null | undefined): string {
  const n = toFiniteNumber(x)
  if (n == null) return '-'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n)
}

function severityRank(s: NotificationSeverity): number {
  if (s === 'urgent') return 0
  if (s === 'warning') return 1
  return 2
}

export type LowStockGroup = {
  substanceId: string
  substanceName: string
  remainingTotalMg: number | null
  contentTotalMg: number | null
  avgDailyAdminMg14d: number | null
  runwayDays: number | null
}

export function groupInventorySummaryBySubstance(rows: InventorySummaryRow[]): LowStockGroup[] {
  const groups = new Map<string, { substanceName: string; rows: InventorySummaryRow[] }>()
  for (const r of rows) {
    if (!r.substance_id) continue
    const id = r.substance_id
    const entry = groups.get(id) ?? { substanceName: r.substance_name ?? 'Unknown', rows: [] }
    entry.rows.push(r)
    groups.set(id, entry)
  }

  const out: LowStockGroup[] = []
  for (const [substanceId, g] of groups.entries()) {
    const remainingTotalMg = sumFinite(g.rows.map((r) => r.total_remaining_mass_mg))
    const contentTotalMg = sumFinite(g.rows.map((r) => r.total_content_mass_mg))
    const avgDailyAdminMg14d = sumFinite(g.rows.map((r) => r.avg_daily_administered_mg_14d))
    const runwayDays =
      remainingTotalMg != null && avgDailyAdminMg14d != null && avgDailyAdminMg14d > 0
        ? remainingTotalMg / avgDailyAdminMg14d
        : null

    out.push({
      substanceId,
      substanceName: g.substanceName,
      remainingTotalMg,
      contentTotalMg,
      avgDailyAdminMg14d,
      runwayDays,
    })
  }

  return out.sort((a, b) => a.substanceName.localeCompare(b.substanceName))
}

export function evaluateLowStockNotifications(
  groups: LowStockGroup[],
  opts: { enabled: boolean; runwayDaysThreshold: number },
): NotificationItem[] {
  if (!opts.enabled) return []
  const threshold = Math.max(0, Math.floor(opts.runwayDaysThreshold))
  if (threshold === 0) return []

  const out: NotificationItem[] = []
  for (const g of groups) {
    const runway = g.runwayDays
    if (runway == null) continue

    if (runway > threshold) continue

    const severity: NotificationSeverity = runway <= 3 ? 'urgent' : 'warning'
    out.push({
      id: `low-stock-${g.substanceId}`,
      severity,
      title: `${g.substanceName} stock low`,
      description: `Runway ~${Math.round(runway)}d (threshold ${threshold}d). Total remaining ${formatNumber(
        g.remainingTotalMg,
        2,
      )}mg.`,
      href: '/orders',
    })
  }
  return out
}

export type SpendAlert = {
  avgUsdPerDay: number | null
  sumUsd: number | null
}

export function computeSpendAvgUsdPerDay(
  spendDay: SpendRow[],
  opts: { windowDays: number },
): SpendAlert {
  const windowDays = Math.max(1, Math.floor(opts.windowDays))
  const sumUsd = sumFinite(spendDay.map((r) => r.spend_usd))
  const avgUsdPerDay = sumUsd == null ? null : sumUsd / windowDays
  return { avgUsdPerDay, sumUsd }
}

export function evaluateSpendNotifications(
  spend: SpendAlert,
  opts: { enabled: boolean; usdPerDayThreshold: number; windowDays: number },
): NotificationItem[] {
  if (!opts.enabled) return []
  const threshold = Math.max(0, Number(opts.usdPerDayThreshold))
  const windowDays = Math.max(1, Math.floor(opts.windowDays))

  const avg = spend.avgUsdPerDay
  if (avg == null) return []
  if (avg <= threshold) return []

  const severity: NotificationSeverity = avg >= threshold * 2 ? 'urgent' : 'warning'
  return [
    {
      id: `spend-high-${windowDays}`,
      severity,
      title: 'Spend burn rate high',
      description: `Avg ${formatMoney(avg)}/day over last ${windowDays} days (threshold ${formatMoney(
        threshold,
      )}/day).`,
      href: '/analytics',
    },
  ]
}

function prefsFromProfile(profile: ProfileRow) {
  return {
    lowStockEnabled: Boolean(profile.notify_low_stock_enabled),
    lowStockRunwayDaysThreshold: Number(profile.notify_low_stock_runway_days_threshold ?? 7),
    spendEnabled: Boolean(profile.notify_spend_enabled),
    spendUsdPerDayThreshold: Number(profile.notify_spend_usd_per_day_threshold ?? 50),
    spendWindowDays: Number(profile.notify_spend_window_days ?? 7),
    timeZone: safeTimeZone(profile.timezone ?? 'UTC'),
  }
}

export async function listMyActiveNotifications(supabase: DbClient): Promise<NotificationItem[]> {
  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))
  const prefs = prefsFromProfile(profile)

  // Do not fetch anything if notifications are fully disabled.
  const anyEnabled = prefs.lowStockEnabled || prefs.spendEnabled
  if (!anyEnabled) return []

  const [inventorySummary, spendDay] = await Promise.all([
    prefs.lowStockEnabled ? listInventorySummary(supabase) : Promise.resolve([]),
    prefs.spendEnabled
      ? listSpendRollups(supabase, {
          periodKind: 'day',
          // The spend view is already local-day grouped; we only need a local-day boundary.
          sincePeriodStartDate: dayLocalDaysAgo(Math.max(0, Math.floor(prefs.spendWindowDays) - 1), prefs.timeZone),
        })
      : Promise.resolve([]),
  ])

  const groups = groupInventorySummaryBySubstance(inventorySummary)
  const lowStock = evaluateLowStockNotifications(groups, {
    enabled: prefs.lowStockEnabled,
    runwayDaysThreshold: prefs.lowStockRunwayDaysThreshold,
  })

  const spend = computeSpendAvgUsdPerDay(spendDay, { windowDays: prefs.spendWindowDays })
  const spendAlerts = evaluateSpendNotifications(spend, {
    enabled: prefs.spendEnabled,
    usdPerDayThreshold: prefs.spendUsdPerDayThreshold,
    windowDays: prefs.spendWindowDays,
  })

  return [...lowStock, ...spendAlerts].sort((a, b) => {
    const sr = severityRank(a.severity) - severityRank(b.severity)
    if (sr !== 0) return sr
    return a.title.localeCompare(b.title)
  })
}

