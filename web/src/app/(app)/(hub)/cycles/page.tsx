import Link from 'next/link'

import { CreateCycleNowForm } from './create-cycle-form'

import { listCycleSummary } from '@/lib/repos/cycleSummaryRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

function fmt(x: unknown): string {
  if (x == null) return '-'
  if (typeof x === 'number') return Number.isFinite(x) ? x.toFixed(2).replace(/\.?0+$/, '') : '-'
  return String(x)
}

function fmtRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return '-'
  if (min != null && max != null) return `${fmt(min)} - ${fmt(max)}`
  if (min != null) return `>= ${fmt(min)}`
  return `<= ${fmt(max)}`
}

export default async function CyclesPage() {
  const supabase = await createClient()
  const [cycles, substances] = await Promise.all([listCycleSummary(supabase), listSubstances(supabase)])
  const substanceOptions = substances.map((s) => ({ id: s.id, label: s.display_name }))

  return (
    <div className="h-full overflow-auto p-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Cycles</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Minimal view over computed cycle summaries (details + split/merge tools come later).
        </p>
      </div>

      <CreateCycleNowForm substances={substanceOptions} />

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">List</h2>
        {cycles.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No cycles yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Substance</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Cycle #</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Status</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Start</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">End</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Len (days)</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Break to next (days)</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Events</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Admin mg</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Rec cycle days</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Rec break days</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((c) => {
                  const rowKey =
                    c.cycle_instance_id ?? `${c.substance_id ?? 'substance'}-${c.cycle_number ?? 'cycle'}`

                  return (
                    <tr key={rowKey}>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">{c.substance_name ?? '-'}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                        {c.cycle_instance_id ? (
                          <Link className="underline hover:text-primary" href={`/cycles/${c.cycle_instance_id}`}>
                            {fmt(c.cycle_number)}
                          </Link>
                        ) : (
                          <span>{fmt(c.cycle_number)}</span>
                        )}
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{c.status ?? '-'}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{fmt(c.start_ts)}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{fmt(c.end_ts)}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{fmt(c.cycle_length_days)}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{fmt(c.break_to_next_cycle_days)}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{fmt(c.event_count)}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{fmt(c.administered_mg_total)}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                        {fmtRange(c.recommended_cycle_days_min, c.recommended_cycle_days_max)}
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                        {fmtRange(c.recommended_break_days_min, c.recommended_break_days_max)}
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
