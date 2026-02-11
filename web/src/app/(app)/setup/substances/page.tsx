import Link from 'next/link'

import { BulkAddSubstancesForm } from '@/app/(app)/(hub)/substances/bulk-add-substances-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { CompactEntryModule } from '@/components/ui/compact-entry-module'
import { MetricsStrip } from '@/components/ui/metrics-strip'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

function fmtCount(n: number): string {
  return new Intl.NumberFormat().format(n)
}

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
        <MetricsStrip
          items={[
            {
              label: 'Current substances',
              value: fmtCount(substances.length),
              detail: substances.length > 0 ? 'You can proceed to route setup.' : 'Add at least one before continuing.',
              tone: substances.length > 0 ? 'good' : 'warn',
            },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Current: <span className="font-semibold text-slate-900 dark:text-slate-100">{substances.length}</span>
          </div>
          <Link className="text-sm text-slate-600 dark:text-slate-400 underline hover:text-primary" href="/substances">
            Manage substances
          </Link>
        </div>

        <CompactEntryModule
          id="setup-substances-bulk-add"
          title="Bulk add substances"
          description="Use presets to quickly create a starter list, then refine details later."
          summaryItems={[
            { label: 'Current records', value: fmtCount(substances.length), tone: substances.length > 0 ? 'good' : 'neutral' },
            { label: 'Next step', value: substances.length > 0 ? 'Routes' : 'Add at least one substance', tone: substances.length > 0 ? 'good' : 'warn' },
          ]}
          defaultCollapsed
          storageKey="peptaide.module.setup.substances.bulk-add"
        >
          <BulkAddSubstancesForm />
        </CompactEntryModule>

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
