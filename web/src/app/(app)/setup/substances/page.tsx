import Link from 'next/link'

import { BulkAddSubstancesForm } from '@/app/(app)/(hub)/substances/bulk-add-substances-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function SetupSubstancesPage() {
  const supabase = await createClient()
  const substances = await listSubstances(supabase)

  const nextDisabledReason =
    substances.length === 0 ? 'Add at least one substance so you have something to log and stock.' : null

  return (
    <SetupStepShell
      title="Substances"
      description="Add what you want to track (e.g. BPC-157, TB-500, SS-31)."
      backHref="/setup/profile"
      backLabel="Profile"
      nextHref="/setup/routes"
      nextLabel="Routes"
      nextDisabledReason={nextDisabledReason}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Current: <span className="font-semibold text-slate-900 dark:text-slate-100">{substances.length}</span>
          </div>
          <Link className="text-sm text-slate-600 dark:text-slate-400 underline hover:text-primary" href="/substances">
            Manage substances
          </Link>
        </div>

        <BulkAddSubstancesForm />

        {substances.length > 0 ? (
          <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
            Tip: use consistent canonical names (like <span className="font-mono">bpc_157</span>) so imports and searches are
            reliable.
          </div>
        ) : null}
      </div>
    </SetupStepShell>
  )
}

