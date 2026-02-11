import { listDailyTotalsAdmin, listDailyTotalsEffectiveCns, listDailyTotalsEffectiveSystemic } from '@/lib/repos/dailyTotalsRepo'
import { getMyProfile } from '@/lib/repos/profilesRepo'
import { listSpendRollups } from '@/lib/repos/spendRepo'
import { createClient } from '@/lib/supabase/server'

function toFiniteNumber(x: number | string | null | undefined): number | null {
  if (x == null) return null
  const n = typeof x === 'number' ? x : Number(x)
  return Number.isFinite(n) ? n : null
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

function safeTimeZone(tz: string): string {
  try {
    // Throws RangeError for invalid IANA names.
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return tz
  } catch {
    return 'UTC'
  }
}

function ymdToIso(ymd: { year: number; month: number; day: number }): string {
  const mm = String(ymd.month).padStart(2, '0')
  const dd = String(ymd.day).padStart(2, '0')
  return `${ymd.year}-${mm}-${dd}`
}

function dayLocalDaysAgo(daysAgo: number, timeZone: string): string {
  // "Local day" means calendar-day arithmetic in the user's timezone, not subtracting 24h
  // from the current UTC timestamp (which can be off by one around midnight and DST).
  const todayLocal = mustGetLocalYmd(new Date(), timeZone)
  const d = new Date(Date.UTC(todayLocal.year, todayLocal.month - 1, todayLocal.day))
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return ymdToIso({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() })
}

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const profile = await getMyProfile(supabase)
  const timeZone = safeTimeZone(profile?.timezone ?? 'UTC')

  const since180 = dayLocalDaysAgo(180, timeZone)

  const [admin, effSystemic, effCns, spendDay, spendWeek, spendMonth] = await Promise.all([
    listDailyTotalsAdmin(supabase, { sinceDayLocal: since180 }),
    listDailyTotalsEffectiveSystemic(supabase, { sinceDayLocal: since180 }),
    listDailyTotalsEffectiveCns(supabase, { sinceDayLocal: since180 }),
    listSpendRollups(supabase, { periodKind: 'day', sincePeriodStartDate: since180 }),
    listSpendRollups(supabase, { periodKind: 'week', sincePeriodStartDate: since180 }),
    listSpendRollups(supabase, { periodKind: 'month', sincePeriodStartDate: since180 }),
  ])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Analytics</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Trends for administered and effective dose, plus spend over time.
        </p>
      </div>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Daily administered dose (mg)</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Last 180 local days, grouped by substance.</p>

        {admin.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">No data yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm tabular-nums">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                    Day (local)
                  </th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                    Substance
                  </th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                    Admin mg
                  </th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                    Events
                  </th>
                </tr>
              </thead>
              <tbody>
                {admin.map((r, i) => (
                  <tr key={`${r.day_local ?? 'day'}-${r.substance_id ?? 'substance'}-${i}`}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {r.day_local ?? '-'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-gray-900 dark:text-gray-100">
                      {r.substance_name ?? '-'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {formatNumber(r.administered_mg)}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {r.event_count ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Daily effective dose (systemic, mg)</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Last 180 local days. Note: these p05/p50/p95 values are summed per day, so they are an approximate band, not
          true daily quantiles.
        </p>

        {effSystemic.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">No data yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm tabular-nums">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                    Day (local)
                  </th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                    Substance
                  </th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">p05</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">p50</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">p95</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                    Events
                  </th>
                </tr>
              </thead>
              <tbody>
                {effSystemic.map((r, i) => (
                  <tr key={`${r.day_local ?? 'day'}-${r.substance_id ?? 'substance'}-${i}`}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {r.day_local ?? '-'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-gray-900 dark:text-gray-100">
                      {r.substance_name ?? '-'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {formatNumber(r.eff_systemic_p05_mg)}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {formatNumber(r.eff_systemic_p50_mg)}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {formatNumber(r.eff_systemic_p95_mg)}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {r.event_count ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Daily effective dose (CNS, mg)</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Last 180 local days. Same note as systemic: summed percentiles are an approximate band.
        </p>

        {effCns.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">No data yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm tabular-nums">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                    Day (local)
                  </th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                    Substance
                  </th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">p05</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">p50</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">p95</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                    Events
                  </th>
                </tr>
              </thead>
              <tbody>
                {effCns.map((r, i) => (
                  <tr key={`${r.day_local ?? 'day'}-${r.substance_id ?? 'substance'}-${i}`}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {r.day_local ?? '-'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-gray-900 dark:text-gray-100">
                      {r.substance_name ?? '-'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {formatNumber(r.eff_cns_p05_mg)}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {formatNumber(r.eff_cns_p50_mg)}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {formatNumber(r.eff_cns_p95_mg)}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {r.event_count ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Spend</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Rollups from event-attributed costs.</p>

        {spendDay.length === 0 && spendWeek.length === 0 && spendMonth.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">No data yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Daily
              </h3>
              <table className="mt-2 min-w-[320px] border-separate border-spacing-0 text-left text-sm tabular-nums">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                      Day
                    </th>
                    <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                      Spend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {spendDay.slice(0, 30).map((r, i) => (
                    <tr key={`${r.period_start_date ?? 'day'}-${i}`}>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                        {r.period_start_date ?? '-'}
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                        {formatMoney(r.spend_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Weekly
              </h3>
              <table className="mt-2 min-w-[320px] border-separate border-spacing-0 text-left text-sm tabular-nums">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                      Week start
                    </th>
                    <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                      Spend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {spendWeek.slice(0, 16).map((r, i) => (
                    <tr key={`${r.period_start_date ?? 'week'}-${i}`}>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                        {r.period_start_date ?? '-'}
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                        {formatMoney(r.spend_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Monthly
              </h3>
              <table className="mt-2 min-w-[320px] border-separate border-spacing-0 text-left text-sm tabular-nums">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                      Month start
                    </th>
                    <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-semibold">
                      Spend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {spendMonth.slice(0, 12).map((r, i) => (
                    <tr key={`${r.period_start_date ?? 'month'}-${i}`}>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                        {r.period_start_date ?? '-'}
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-gray-600 dark:text-gray-400">
                        {formatMoney(r.spend_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
