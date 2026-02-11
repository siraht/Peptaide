import Link from 'next/link'

import { BulkAddFormulationsForm } from '@/app/(app)/(hub)/formulations/bulk-add-formulations-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { listDevices } from '@/lib/repos/devicesRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listRoutes } from '@/lib/repos/routesRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function SetupFormulationsPage() {
  const supabase = await createClient()

  const [substances, routes, devices, formulations] = await Promise.all([
    listSubstances(supabase),
    listRoutes(supabase),
    listDevices(supabase),
    listFormulationsEnriched(supabase),
  ])

  const prereqMissing = substances.length === 0 || routes.length === 0
  const nextDisabledReason = prereqMissing
    ? 'Add at least one substance and one route first.'
    : formulations.length === 0
      ? 'Add at least one formulation so you can create vials and log events.'
      : null

  return (
    <SetupStepShell
      title="Formulations"
      description="Formulations are the loggable combinations of substance + route (+ optional device)."
      backHref="/setup/routes"
      backLabel="Routes"
      nextHref="/setup/inventory"
      nextLabel="Inventory"
      nextDisabledReason={nextDisabledReason}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Current: <span className="font-semibold text-slate-900 dark:text-slate-100">{formulations.length}</span>
          </div>
          <Link className="text-sm text-slate-600 dark:text-slate-400 underline hover:text-primary" href="/formulations">
            Manage formulations
          </Link>
        </div>

        {prereqMissing ? (
          <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
            You need at least one substance and one route before you can create formulations.
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <Link className="underline hover:text-primary" href="/setup/substances">
                Go to Substances
              </Link>
              <Link className="underline hover:text-primary" href="/setup/routes">
                Go to Routes
              </Link>
            </div>
          </div>
        ) : (
          <BulkAddFormulationsForm
            substances={substances.map((s) => ({ id: s.id, label: s.display_name }))}
            routes={routes.map((r) => ({ id: r.id, label: r.name }))}
            devices={devices.map((d) => ({ id: d.id, label: d.name }))}
          />
        )}

        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
          Tip: create separate formulations when concentration or device changes. This keeps inventory and cost allocation
          clean.
        </div>
      </div>
    </SetupStepShell>
  )
}

