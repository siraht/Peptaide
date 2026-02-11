import Link from 'next/link'

import { BulkAddFormulationsForm } from '@/app/(app)/(hub)/formulations/bulk-add-formulations-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { CompactEntryModule } from '@/components/ui/compact-entry-module'
import { MetricsStrip } from '@/components/ui/metrics-strip'
import { listDevices } from '@/lib/repos/devicesRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listRoutes } from '@/lib/repos/routesRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

function fmtCount(n: number): string {
  return new Intl.NumberFormat().format(n)
}

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
        <MetricsStrip
          items={[
            {
              label: 'Formulations',
              value: fmtCount(formulations.length),
              detail: formulations.length > 0 ? 'Inventory setup can proceed.' : 'Add at least one formulation.',
              tone: formulations.length > 0 ? 'good' : 'warn',
            },
            {
              label: 'Substances / routes',
              value: `${fmtCount(substances.length)} / ${fmtCount(routes.length)}`,
              detail: 'Both are required to create formulations.',
              tone: prereqMissing ? 'warn' : 'good',
            },
            {
              label: 'Devices',
              value: fmtCount(devices.length),
              detail: 'Optional for formulation creation.',
            },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Current: <span className="font-semibold text-slate-900 dark:text-slate-100">{formulations.length}</span>
          </div>
          <Link className="text-sm text-slate-600 dark:text-slate-400 underline hover:text-primary" href="/formulations">
            Manage formulations
          </Link>
        </div>

        <CompactEntryModule
          id="setup-formulations-bulk-add"
          title="Bulk add formulations"
          description="Quickly create starter formulations once substances and routes exist."
          summaryItems={[
            { label: 'Substances', value: fmtCount(substances.length), tone: substances.length > 0 ? 'good' : 'warn' },
            { label: 'Routes', value: fmtCount(routes.length), tone: routes.length > 0 ? 'good' : 'warn' },
            { label: 'Current formulations', value: fmtCount(formulations.length), tone: formulations.length > 0 ? 'good' : 'neutral' },
          ]}
          defaultCollapsed
          storageKey="peptaide.module.setup.formulations.bulk-add"
          emptyCta={
            prereqMissing
              ? { href: '/setup/substances', label: 'Complete substances and routes first' }
              : undefined
          }
        >
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
        </CompactEntryModule>

        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
          Tip: create separate formulations when concentration or device changes. This keeps inventory and cost allocation
          clean.
        </div>
      </div>
    </SetupStepShell>
  )
}
