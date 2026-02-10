import Link from 'next/link'

import { deleteEvidenceSourceAction } from './actions'
import { CreateEvidenceSourceForm } from './create-evidence-source-form'

import { listEvidenceSources } from '@/lib/repos/evidenceSourcesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function EvidenceSourcesPage() {
  const supabase = await createClient()
  const sources = await listEvidenceSources(supabase)

  return (
    <div className="h-full overflow-auto p-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Evidence sources</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Optional citations that can be attached to specs and recommendations. These are user-entered notes, not medical
          advice.{' '}
          <Link className="underline hover:text-primary" href="/substances">
            Go to substances
          </Link>
          .
        </p>
      </div>

      <CreateEvidenceSourceForm />

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Saved evidence sources</h2>
        {sources.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No evidence sources yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Type</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Citation</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Notes</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} data-e2e="evidence-row" data-evidence-id={s.id}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">{s.source_type}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{s.citation}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{s.notes ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2">
                      <form action={deleteEvidenceSourceAction}>
                        <input type="hidden" name="evidence_source_id" value={s.id} />
                        <button className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit" data-e2e="evidence-delete">
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
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Note: deleting an evidence source here is a soft delete. If you already attached it to a spec/recommendation,
          those rows will still reference the old id, but the source will no longer appear in dropdowns.
        </p>
      </section>
    </div>
  )
}
