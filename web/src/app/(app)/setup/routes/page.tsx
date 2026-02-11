import Link from 'next/link'

import { BulkAddRoutesForm } from '@/app/(app)/(hub)/routes/bulk-add-routes-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { listRoutes } from '@/lib/repos/routesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function SetupRoutesPage() {
  const supabase = await createClient()
  const routes = await listRoutes(supabase)

  const nextDisabledReason = routes.length === 0 ? 'Add at least one route so formulations can be created.' : null

  return (
    <SetupStepShell
      title="Routes"
      description="Routes describe how a dose is administered and what units make sense by default."
      backHref="/setup/substances"
      backLabel="Substances"
      nextHref="/setup/formulations"
      nextLabel="Formulations"
      nextDisabledReason={nextDisabledReason}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Current: <span className="font-semibold text-slate-900 dark:text-slate-100">{routes.length}</span>
          </div>
          <Link className="text-sm text-slate-600 dark:text-slate-400 underline hover:text-primary" href="/routes">
            Manage routes
          </Link>
        </div>

        <BulkAddRoutesForm />

        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
          If a route supports a device calibration (like a spray or syringe), you can enable it on the route and add
          calibrations later.
        </div>
      </div>
    </SetupStepShell>
  )
}

