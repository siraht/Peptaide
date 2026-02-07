import { CreateFormulationForm } from './create-formulation-form'

import { listDevices } from '@/lib/repos/devicesRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listRoutes } from '@/lib/repos/routesRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function FormulationsPage() {
  const supabase = await createClient()

  const [substances, routes, devices, formulations] = await Promise.all([
    listSubstances(supabase),
    listRoutes(supabase),
    listDevices(supabase),
    listFormulationsEnriched(supabase),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Formulations</h1>
        <p className="mt-1 text-sm text-zinc-700">
          Formulations are the loggable combinations of (substance + route + optional device).
        </p>
      </div>

      {substances.length === 0 || routes.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-700">
          Create at least one substance and one route before creating formulations.
        </div>
      ) : (
        <CreateFormulationForm
          substances={substances.map((s) => ({ id: s.id, label: s.display_name }))}
          routes={routes.map((r) => ({ id: r.id, label: r.name }))}
          devices={devices.map((d) => ({ id: d.id, label: d.name }))}
        />
      )}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">List</h2>
        {formulations.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No formulations yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Name</th>
                  <th className="border-b px-2 py-2 font-medium">Substance</th>
                  <th className="border-b px-2 py-2 font-medium">Route</th>
                  <th className="border-b px-2 py-2 font-medium">Device</th>
                  <th className="border-b px-2 py-2 font-medium">Default</th>
                </tr>
              </thead>
              <tbody>
                {formulations.map((f) => (
                  <tr key={f.formulation.id}>
                    <td className="border-b px-2 py-2 text-zinc-900">{f.formulation.name}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {f.substance?.display_name ?? '-'}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">{f.route?.name ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{f.device?.name ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {f.formulation.is_default_for_route ? 'yes' : 'no'}
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

