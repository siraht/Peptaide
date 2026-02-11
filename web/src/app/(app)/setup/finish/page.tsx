import Link from 'next/link'

import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listInventorySummary } from '@/lib/repos/inventorySummaryRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function SetupFinishPage() {
  const supabase = await createClient()

  const [substances, formulations, inventorySummary] = await Promise.all([
    listSubstances(supabase),
    listFormulationsEnriched(supabase),
    listInventorySummary(supabase),
  ])

  const prereqMissing = substances.length === 0 || formulations.length === 0

  return (
    <SetupStepShell
      title="Finish"
      description="You’re ready to log. From here, you can refine inventory and modeling as you go."
      backHref="/setup/model"
      backLabel="Model coverage"
      nextHref={prereqMissing ? null : '/today?focus=log'}
      nextLabel="Start logging"
      nextDisabledReason={prereqMissing ? 'Add at least one substance + formulation first.' : null}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-2xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-5">
          <div className="flex items-start gap-3">
            <span className="material-icons text-emerald-600 dark:text-emerald-400" aria-hidden="true">
              verified
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick checklist</div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-400">
                <div>
                  Substances: <span className="font-semibold text-slate-900 dark:text-slate-100">{substances.length}</span>
                </div>
                <div>
                  Formulations:{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formulations.length}</span>
                </div>
                <div>
                  Inventory items:{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{inventorySummary.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Where to go next</div>
          <div className="mt-2 grid grid-cols-1 gap-2 text-sm">
            <Link className="underline hover:text-primary text-slate-700 dark:text-slate-200" href="/today">
              Today: log events fast
            </Link>
            <Link className="underline hover:text-primary text-slate-700 dark:text-slate-200" href="/inventory">
              Inventory: add vials and view runway
            </Link>
            <Link className="underline hover:text-primary text-slate-700 dark:text-slate-200" href="/analytics">
              Analytics: spend and dose rollups
            </Link>
            <Link className="underline hover:text-primary text-slate-700 dark:text-slate-200" href="/settings?tab=app#notifications">
              Notifications: tune alert thresholds
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
          You can revisit this wizard anytime. Peptaide is designed so you can start logging early and fill in
          inventory/modeling details later without breaking your history.
        </div>
      </div>
    </SetupStepShell>
  )
}

