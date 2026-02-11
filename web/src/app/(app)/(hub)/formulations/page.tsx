import Link from 'next/link'

import { BulkAddFormulationsForm } from './bulk-add-formulations-form'
import { CreateFormulationForm } from './create-formulation-form'

import { EmptyState } from '@/components/ui/empty-state'
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
    <div className="h-full overflow-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Formulations</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Formulations are the loggable combinations of (substance + route + optional device).
        </p>
      </div>

      {substances.length === 0 || routes.length === 0 ? (
        <EmptyState
          icon="medication"
          title="Formulations need prerequisites"
          description="Create at least one substance and one route before creating formulations."
          actionHref="/settings?tab=substances"
          actionLabel="Open substances"
          secondaryHref="/routes"
          secondaryLabel="Open routes"
        />
      ) : (
        <>
          <CreateFormulationForm
            substances={substances.map((s) => ({ id: s.id, label: s.display_name }))}
            routes={routes.map((r) => ({ id: r.id, label: r.name }))}
            devices={devices.map((d) => ({ id: d.id, label: d.name }))}
          />
          <BulkAddFormulationsForm
            substances={substances.map((s) => ({ id: s.id, label: s.display_name }))}
            routes={routes.map((r) => ({ id: r.id, label: r.name }))}
            devices={devices.map((d) => ({ id: d.id, label: d.name }))}
          />
        </>
      )}

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">List</h2>
        {formulations.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="medication"
            title="No formulations yet"
            description="Create your first formulation to start logging events against an active vial."
            actionHref="/formulations?focus=new"
            actionLabel="Create formulation"
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Name</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Substance</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Route</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Device</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Default</th>
                </tr>
              </thead>
              <tbody>
                {formulations.map((f) => (
                  <tr key={f.formulation.id}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">
                      <Link className="underline hover:text-primary" href={`/formulations/${f.formulation.id}`}>
                        {f.formulation.name}
                      </Link>
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                      {f.substance?.display_name ?? '-'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{f.route?.name ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{f.device?.name ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
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
