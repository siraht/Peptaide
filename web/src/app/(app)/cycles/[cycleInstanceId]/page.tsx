import Link from 'next/link'
import { notFound } from 'next/navigation'

import { splitCycleAtEventAction } from './actions'

import { getLastCycleForSubstance } from '@/lib/repos/cyclesRepo'
import { getCycleSummaryById } from '@/lib/repos/cycleSummaryRepo'
import { listEventsEnrichedForCycle } from '@/lib/repos/eventsRepo'
import { createClient } from '@/lib/supabase/server'

function fmt(x: unknown): string {
  if (x == null) return '-'
  if (typeof x === 'number') return Number.isFinite(x) ? x.toFixed(2).replace(/\.?0+$/, '') : '-'
  return String(x)
}

export default async function CycleDetailPage({
  params,
  searchParams,
}: {
  params: { cycleInstanceId: string }
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const { cycleInstanceId } = params
  const error = typeof searchParams?.error === 'string' ? searchParams.error : null

  const supabase = await createClient()

  const cycle = await getCycleSummaryById(supabase, { cycleInstanceId })
  if (!cycle) {
    notFound()
  }

  const [events, lastCycle] = await Promise.all([
    listEventsEnrichedForCycle(supabase, { cycleInstanceId }),
    getLastCycleForSubstance(supabase, { substanceId: cycle.substance_id ?? '' }),
  ])

  const canSplit =
    cycle.cycle_instance_id != null &&
    cycle.status === 'active' &&
    lastCycle?.id === cycle.cycle_instance_id

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">
            {cycle.substance_name ?? 'Cycle'} #{fmt(cycle.cycle_number)}
          </h1>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
            {cycle.status ?? '-'}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-700">
          <Link className="underline hover:text-zinc-900" href="/cycles">
            Back to cycles
          </Link>
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Summary</h2>
        <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-zinc-500">Start</div>
            <div className="text-zinc-900">{fmt(cycle.start_ts)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">End</div>
            <div className="text-zinc-900">{fmt(cycle.end_ts)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Events</div>
            <div className="text-zinc-900">{fmt(cycle.event_count)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Administered mg</div>
            <div className="text-zinc-900">{fmt(cycle.administered_mg_total)}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Events</h2>

        {canSplit ? (
          <p className="mt-1 text-sm text-zinc-700">
            Split this cycle at an event to fix a missed new-cycle selection. This completes the current cycle at the
            selected event time, creates a new active cycle starting at that event, and moves that event and all later
            events into the new cycle.
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-700">
            Split is only supported for the most recent active cycle in the MVP.
          </p>
        )}

        {events.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No events in this cycle.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[800px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Time</th>
                  <th className="border-b px-2 py-2 font-medium">Formulation</th>
                  <th className="border-b px-2 py-2 font-medium">Input</th>
                  <th className="border-b px-2 py-2 font-medium">Dose mg</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.event_id ?? `${e.ts}-${e.input_text}`}>
                    <td className="border-b px-2 py-2 text-zinc-700">{e.ts}</td>
                    <td className="border-b px-2 py-2 text-zinc-900">{e.formulation_name ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{e.input_text ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{fmt(e.dose_mass_mg)}</td>
                    <td className="border-b px-2 py-2">
                      {canSplit && e.event_id ? (
                        <form action={splitCycleAtEventAction}>
                          <input type="hidden" name="cycle_instance_id" value={cycleInstanceId} />
                          <input type="hidden" name="event_id" value={e.event_id} />
                          <button className="text-sm text-zinc-900 underline" type="submit">
                            Split cycle here
                          </button>
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

