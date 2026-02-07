import { signOut } from '@/app/actions/auth'
import { listRecentEventsEnriched } from '@/lib/repos/eventsRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { createClient } from '@/lib/supabase/server'

import { seedDemoDataAction } from './actions'
import { TodayLogForm } from './today-log-form'

function formatNumber(x: number | null | undefined): string {
  if (x == null) return '-'
  if (!Number.isFinite(x)) return '-'
  return x.toFixed(3).replace(/\.?0+$/, '')
}

export default async function TodayPage() {
  const supabase = await createClient()
  const formulations = await listFormulationsEnriched(supabase)
  const formulationOptions = formulations.map((f) => ({
    id: f.formulation.id,
    label: `${f.formulation.name} (${f.substance?.display_name ?? 'Unknown'} / ${
      f.route?.name ?? 'Unknown'
    })`,
  }))

  const events = await listRecentEventsEnriched(supabase, { limit: 20 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="mt-1 text-sm text-zinc-700">Prototype logging surface.</p>
      </div>

      {formulationOptions.length === 0 ? (
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-zinc-700">
            No formulations exist yet. For now, you can seed demo data to exercise the event logging
            and Monte Carlo pipeline. This is dev-only scaffolding; the real Setup Wizard will
            replace it.
          </p>

          <form action={seedDemoDataAction} className="mt-3">
            <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" type="submit">
              Seed demo data
            </button>
          </form>
        </div>
      ) : (
        <TodayLogForm formulations={formulationOptions} />
      )}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Recent events</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No events yet.</p>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form action={signOut}>
        <button className="rounded-md border px-3 py-2 text-sm" type="submit">
          Sign out
        </button>
      </form>
    </div>
  )
}
