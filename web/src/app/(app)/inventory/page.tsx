import { CreateVialForm } from './create-vial-form'

import { listInventoryStatus } from '@/lib/repos/inventoryStatusRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { createClient } from '@/lib/supabase/server'

export default async function InventoryPage() {
  const supabase = await createClient()

  const [formulations, inventory] = await Promise.all([
    listFormulationsEnriched(supabase),
    listInventoryStatus(supabase),
  ])

  const formulationOptions = formulations.map((f) => {
    const substance = f.substance?.display_name ?? 'Unknown substance'
    const route = f.route?.name ?? 'Unknown route'
    return { id: f.formulation.id, label: `${substance} / ${route} / ${f.formulation.name}` }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Inventory</h1>
        <p className="mt-1 text-sm text-zinc-700">Vials and basic runway estimates.</p>
      </div>

      {formulationOptions.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-700">
          Create at least one formulation before creating vials.
        </div>
      ) : (
        <CreateVialForm formulations={formulationOptions} />
      )}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Vials</h2>
        {inventory.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No vials yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Substance</th>
                  <th className="border-b px-2 py-2 font-medium">Formulation</th>
                  <th className="border-b px-2 py-2 font-medium">Route</th>
                  <th className="border-b px-2 py-2 font-medium">Status</th>
                  <th className="border-b px-2 py-2 font-medium">Content</th>
                  <th className="border-b px-2 py-2 font-medium">Volume</th>
                  <th className="border-b px-2 py-2 font-medium">Conc (mg/mL)</th>
                  <th className="border-b px-2 py-2 font-medium">Remaining mg</th>
                  <th className="border-b px-2 py-2 font-medium">Runway days</th>
                  <th className="border-b px-2 py-2 font-medium">Cost USD</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((v) => (
                  <tr key={v.vial_id}>
                    <td className="border-b px-2 py-2 text-zinc-900">{v.substance_name}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{v.formulation_name}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{v.route_name}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{v.status}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {v.content_mass_value} {v.content_mass_unit}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {v.total_volume_value != null ? `${v.total_volume_value} ${v.total_volume_unit}` : '-'}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {v.concentration_mg_per_ml_effective ?? '-'}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">{v.remaining_mass_mg ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{v.runway_days_estimate_mg ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{v.cost_usd ?? '-'}</td>
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

