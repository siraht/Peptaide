import Link from 'next/link'

import { SetupWizardSidebar, type SetupStep } from './wizard-sidebar'

import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listInventorySummary } from '@/lib/repos/inventorySummaryRepo'
import { listModelCoverage } from '@/lib/repos/modelCoverageRepo'
import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { listRoutes } from '@/lib/repos/routesRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

function countCompleted(steps: SetupStep[]): number {
  return steps.filter((s) => s.status === 'done').length
}

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))

  const [substances, routes, formulations, inventorySummary, coverage] = await Promise.all([
    listSubstances(supabase),
    listRoutes(supabase),
    listFormulationsEnriched(supabase),
    listInventorySummary(supabase),
    listModelCoverage(supabase),
  ])

  const substancesCount = substances.length
  const routesCount = routes.length
  const formulationsCount = formulations.length
  const inventoryCount = inventorySummary.length

  const coverageGaps = coverage.filter((c) => c.missing_base_systemic || c.missing_base_cns || c.missing_any_device_calibration)

  const steps: SetupStep[] = [
    {
      key: 'profile',
      title: 'Profile',
      description: 'Timezone and defaults.',
      href: '/setup/profile',
      status: profile ? 'done' : 'todo',
    },
    {
      key: 'substances',
      title: 'Substances',
      description: 'What you track.',
      href: '/setup/substances',
      status: substancesCount > 0 ? 'done' : 'todo',
      badge: substancesCount > 0 ? String(substancesCount) : undefined,
    },
    {
      key: 'routes',
      title: 'Routes',
      description: 'How you administer.',
      href: '/setup/routes',
      status: routesCount > 0 ? 'done' : 'todo',
      badge: routesCount > 0 ? String(routesCount) : undefined,
    },
    {
      key: 'formulations',
      title: 'Formulations',
      description: 'Loggable combos.',
      href: '/setup/formulations',
      status: substancesCount === 0 || routesCount === 0 ? 'blocked' : formulationsCount > 0 ? 'done' : 'todo',
      badge: formulationsCount > 0 ? String(formulationsCount) : undefined,
    },
    {
      key: 'inventory',
      title: 'Inventory',
      description: 'Orders and vials.',
      href: '/setup/inventory',
      status: formulationsCount === 0 ? 'blocked' : inventoryCount > 0 ? 'done' : 'todo',
      badge: inventoryCount > 0 ? String(inventoryCount) : undefined,
    },
    {
      key: 'model',
      title: 'Model coverage',
      description: 'Uncertainty + conversions.',
      href: '/setup/model',
      status: formulationsCount === 0 ? 'blocked' : coverageGaps.length === 0 && formulationsCount > 0 ? 'done' : 'todo',
      badge: formulationsCount === 0 ? undefined : coverageGaps.length === 0 ? 'OK' : `${coverageGaps.length} gaps`,
    },
    {
      key: 'finish',
      title: 'Finish',
      description: 'Ready to log.',
      href: '/setup/finish',
      status: formulationsCount === 0 ? 'blocked' : 'todo',
    },
  ]

  const completed = countCompleted(steps)
  const total = steps.length

  return (
    <div className="min-h-full bg-background-light dark:bg-background-dark">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-3 py-1 text-xs text-slate-600 dark:text-slate-300 shadow-sm">
              <span className="material-icons text-base text-primary" aria-hidden="true">
                route
              </span>
              Guided onboarding
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Setup</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Get your reference data, inventory, and modeling coverage into shape so logging and analytics work end-to-end.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Link
              href="/today"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-primary/40 hover:text-primary dark:hover:text-slate-100 transition-colors"
              data-e2e="setup-go-today"
            >
              <span className="material-icons text-base" aria-hidden="true">
                today
              </span>
              Go to Today
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="lg:sticky lg:top-6 h-fit">
            <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Progress
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {completed} of {total} complete
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {Math.round((completed / total) * 100)}%
                </div>
              </div>

              <div className="mt-3 h-2 w-full rounded-full bg-slate-200/70 dark:bg-slate-700/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.round((completed / total) * 100)}%` }}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-4">
                <SetupWizardSidebar steps={steps} />
              </div>

              <div className="mt-4 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-3">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Shortcut</div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Press <span className="font-mono">Ctrl/Cmd+K</span> to navigate and log quickly.
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}

