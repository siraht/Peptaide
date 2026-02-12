import Link from 'next/link'

import { BulkAddSubstancesForm } from './bulk-add-substances-form'
import { CreateSubstanceForm } from './create-substance-form'
import { deleteSubstanceAction } from './actions'

import { CompactEntryModule } from '@/components/ui/compact-entry-module'
import { EmptyState } from '@/components/ui/empty-state'
import { MetricsStrip } from '@/components/ui/metrics-strip'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

function fmtCount(n: number): string {
  return new Intl.NumberFormat().format(n)
}

export default async function SubstancesPage() {
  const supabase = await createClient()
  const substances = await listSubstances(supabase)

  const withFamily = substances.filter((s) => Boolean(s.family && s.family.trim())).length
  const withNotes = substances.filter((s) => Boolean(s.notes && s.notes.trim())).length
  const targetCount = new Set(substances.map((s) => s.target_compartment_default)).size

  return (
    <div className="h-full overflow-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Substances</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Reference table for substances you track.</p>
      </div>

      <MetricsStrip
        items={[
          {
            label: 'Tracked substances',
            value: fmtCount(substances.length),
            detail: `${fmtCount(withFamily)} with family metadata`,
            tone: substances.length > 0 ? 'good' : 'warn',
          },
          {
            label: 'Target compartments',
            value: fmtCount(targetCount),
            detail: targetCount > 0 ? 'Diversity of primary target defaults.' : 'No target defaults defined yet.',
            tone: targetCount > 0 ? 'good' : 'warn',
          },
          {
            label: 'Documentation coverage',
            value: `${fmtCount(withNotes)} noted`,
            detail: 'Rows with notes improve downstream interpretation and recall.',
            tone: withNotes > 0 ? 'good' : 'neutral',
          },
        ]}
      />

      <CompactEntryModule
        id="substances-add-single"
        title="Add substance"
        description="Create one tracked compound with canonical naming and metadata."
        summaryItems={[
          { label: 'Current total', value: fmtCount(substances.length), tone: substances.length > 0 ? 'good' : 'neutral' },
          { label: 'With family', value: fmtCount(withFamily), tone: withFamily > 0 ? 'good' : 'neutral' },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.substances.add-single"
      >
        <CreateSubstanceForm />
      </CompactEntryModule>

      <CompactEntryModule
        id="substances-bulk-add"
        title="Bulk add substances"
        description="Paste multiple canonical/display rows to seed a full catalog in one pass."
        summaryItems={[
          { label: 'Current total', value: fmtCount(substances.length), tone: substances.length > 0 ? 'good' : 'neutral' },
          { label: 'Target compartments', value: fmtCount(targetCount), tone: targetCount > 0 ? 'good' : 'neutral' },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.substances.bulk-add"
      >
        <BulkAddSubstancesForm />
      </CompactEntryModule>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">List</h2>
        {substances.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="biotech"
            title="No substances yet"
            description="Create your first tracked compound to unlock formulations, inventory, and logging."
            actionHref="/substances?focus=new"
            actionLabel="Create substance"
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[700px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Display</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Canonical</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Family</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Target</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {substances.map((s) => (
                  <tr key={s.id}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">
                      <Link className="underline hover:text-primary" href={`/substances/${s.id}`}>
                        {s.display_name}
                      </Link>
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{s.canonical_name}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{s.family ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                      {s.target_compartment_default}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2">
                      <form action={deleteSubstanceAction}>
                        <input type="hidden" name="substance_id" value={s.id} />
                        <button className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit">
                          Delete
                        </button>
                      </form>
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
