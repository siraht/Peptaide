import { listDailyTotalsAdmin, listDailyTotalsEffectiveCns, listDailyTotalsEffectiveSystemic } from '@/lib/repos/dailyTotalsRepo'
import { listSpendRollups } from '@/lib/repos/spendRepo'
import { createClient } from '@/lib/supabase/server'

function formatNumber(x: number | null | undefined, digits = 3): string {
  if (x == null) return '-'
  if (!Number.isFinite(x)) return '-'
  return x.toFixed(digits).replace(/\.?0+$/, '')
}

function formatMoney(x: number | null | undefined): string {
  if (x == null) return '-'
  if (!Number.isFinite(x)) return '-'
  return `$${x.toFixed(2).replace(/\.?0+$/, '')}`
}

function dayLocalDaysAgo(n: number): string {
  const ms = Date.now() - n * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const since60 = dayLocalDaysAgo(60)
  const since180 = dayLocalDaysAgo(180)

  const [admin, effSystemic, effCns, spendDay, spendWeek, spendMonth] = await Promise.all([
    listDailyTotalsAdmin(supabase, { sinceDayLocal: since60 }),
    listDailyTotalsEffectiveSystemic(supabase, { sinceDayLocal: since60 }),
    listDailyTotalsEffectiveCns(supabase, { sinceDayLocal: since60 }),
    listSpendRollups(supabase, { periodKind: 'day', sincePeriodStartDate: since60 }),
    listSpendRollups(supabase, { periodKind: 'week', sincePeriodStartDate: since180 }),
    listSpendRollups(supabase, { periodKind: 'month', sincePeriodStartDate: since180 }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-700">Read-only surfaces backed by `security_invoker` SQL views.</p>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Daily administered dose (mg)</h2>
        <p className="mt-1 text-sm text-zinc-700">Last 60 local days, grouped by substance.</p>

        {admin.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No data yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Day (local)</th>
                  <th className="border-b px-2 py-2 font-medium">Substance</th>
                  <th className="border-b px-2 py-2 font-medium">Admin mg</th>
                  <th className="border-b px-2 py-2 font-medium">Events</th>
                </tr>
              </thead>
              <tbody>
                {admin.map((r, i) => (
                  <tr key={`${r.day_local ?? 'day'}-${r.substance_id ?? 'substance'}-${i}`}>
                    <td className="border-b px-2 py-2 text-zinc-700">{r.day_local ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-900">{r.substance_name ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{formatNumber(r.administered_mg)}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{r.event_count ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Daily effective dose (systemic, mg)</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Last 60 local days. Note: these p05/p50/p95 values are summed per day, so they are an approximate band, not
          true daily quantiles.
        </p>

        {effSystemic.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No data yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Day (local)</th>
                  <th className="border-b px-2 py-2 font-medium">Substance</th>
                  <th className="border-b px-2 py-2 font-medium">p05</th>
                  <th className="border-b px-2 py-2 font-medium">p50</th>
                  <th className="border-b px-2 py-2 font-medium">p95</th>
                  <th className="border-b px-2 py-2 font-medium">Events</th>
                </tr>
              </thead>
              <tbody>
                {effSystemic.map((r, i) => (
                  <tr key={`${r.day_local ?? 'day'}-${r.substance_id ?? 'substance'}-${i}`}>
                    <td className="border-b px-2 py-2 text-zinc-700">{r.day_local ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-900">{r.substance_name ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{formatNumber(r.eff_systemic_p05_mg)}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{formatNumber(r.eff_systemic_p50_mg)}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{formatNumber(r.eff_systemic_p95_mg)}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{r.event_count ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Daily effective dose (CNS, mg)</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Last 60 local days. Same note as systemic: summed percentiles are an approximate band.
        </p>

        {effCns.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No data yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Day (local)</th>
                  <th className="border-b px-2 py-2 font-medium">Substance</th>
                  <th className="border-b px-2 py-2 font-medium">p05</th>
                  <th className="border-b px-2 py-2 font-medium">p50</th>
                  <th className="border-b px-2 py-2 font-medium">p95</th>
                  <th className="border-b px-2 py-2 font-medium">Events</th>
                </tr>
              </thead>
              <tbody>
                {effCns.map((r, i) => (
                  <tr key={`${r.day_local ?? 'day'}-${r.substance_id ?? 'substance'}-${i}`}>
                    <td className="border-b px-2 py-2 text-zinc-700">{r.day_local ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-900">{r.substance_name ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{formatNumber(r.eff_cns_p05_mg)}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{formatNumber(r.eff_cns_p50_mg)}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{formatNumber(r.eff_cns_p95_mg)}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{r.event_count ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Spend</h2>
        <p className="mt-1 text-sm text-zinc-700">Rollups from event-attributed costs (`administration_events.cost_usd`).</p>

        {spendDay.length === 0 && spendWeek.length === 0 && spendMonth.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No data yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold text-zinc-700">Daily</h3>
              <table className="mt-2 min-w-[320px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs text-zinc-600">
                    <th className="border-b px-2 py-2 font-medium">Day</th>
                    <th className="border-b px-2 py-2 font-medium">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {spendDay.slice(0, 30).map((r, i) => (
                    <tr key={`${r.period_start_date ?? 'day'}-${i}`}>
                      <td className="border-b px-2 py-2 text-zinc-700">{r.period_start_date ?? '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{formatMoney(r.spend_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold text-zinc-700">Weekly</h3>
              <table className="mt-2 min-w-[320px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs text-zinc-600">
                    <th className="border-b px-2 py-2 font-medium">Week start</th>
                    <th className="border-b px-2 py-2 font-medium">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {spendWeek.slice(0, 16).map((r, i) => (
                    <tr key={`${r.period_start_date ?? 'week'}-${i}`}>
                      <td className="border-b px-2 py-2 text-zinc-700">{r.period_start_date ?? '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{formatMoney(r.spend_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold text-zinc-700">Monthly</h3>
              <table className="mt-2 min-w-[320px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs text-zinc-600">
                    <th className="border-b px-2 py-2 font-medium">Month start</th>
                    <th className="border-b px-2 py-2 font-medium">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {spendMonth.slice(0, 12).map((r, i) => (
                    <tr key={`${r.period_start_date ?? 'month'}-${i}`}>
                      <td className="border-b px-2 py-2 text-zinc-700">{r.period_start_date ?? '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{formatMoney(r.spend_usd)}</td>
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

