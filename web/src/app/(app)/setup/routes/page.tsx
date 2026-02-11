import Link from 'next/link'

import { BulkAddRoutesForm } from '@/app/(app)/(hub)/routes/bulk-add-routes-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { CompactEntryModule } from '@/components/ui/compact-entry-module'
import { MetricsStrip } from '@/components/ui/metrics-strip'
import { listRoutes } from '@/lib/repos/routesRepo'
import { createClient } from '@/lib/supabase/server'

function fmtCount(n: number): string {
  return new Intl.NumberFormat().format(n)
}

export default async function SetupRoutesPage() {
  const supabase = await createClient()
  const routes = await listRoutes(supabase)

  const nextDisabledReason = routes.length === 0 ? 'Add at least one route so formulations can be created.' : null
  const calibrationEnabled = routes.filter((r) => r.supports_device_calibration).length

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
        <MetricsStrip
          items={[
            {
              label: 'Current routes',
              value: fmtCount(routes.length),
              detail: routes.length > 0 ? 'Proceed to formulations when ready.' : 'Add at least one route first.',
              tone: routes.length > 0 ? 'good' : 'warn',
            },
            {
              label: 'Calibration-enabled',
              value: fmtCount(calibrationEnabled),
              detail: `${fmtCount(routes.length - calibrationEnabled)} without calibration`,
            },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Current: <span className="font-semibold text-slate-900 dark:text-slate-100">{routes.length}</span>
          </div>
          <Link className="text-sm text-slate-600 dark:text-slate-400 underline hover:text-primary" href="/routes">
            Manage routes
          </Link>
        </div>

        <CompactEntryModule
          id="setup-routes-bulk-add"
          title="Bulk add routes"
          description="Seed common administration routes and adjust details later in the Routes hub."
          summaryItems={[
            { label: 'Current routes', value: fmtCount(routes.length), tone: routes.length > 0 ? 'good' : 'neutral' },
            { label: 'Calibration-enabled', value: fmtCount(calibrationEnabled), tone: calibrationEnabled > 0 ? 'good' : 'neutral' },
          ]}
          defaultCollapsed
          storageKey="peptaide.module.setup.routes.bulk-add"
        >
          <BulkAddRoutesForm />
        </CompactEntryModule>

        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
          If a route supports a device calibration (like a spray or syringe), you can enable it on the route and add
          calibrations later.
        </div>
      </div>
    </SetupStepShell>
  )
}
