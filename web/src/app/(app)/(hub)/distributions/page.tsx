import { CreateDistributionForm } from './create-distribution-form'

import { listDistributions } from '@/lib/repos/distributionsRepo'
import { createClient } from '@/lib/supabase/server'

export default async function DistributionsPage() {
  const supabase = await createClient()
  const dists = await listDistributions(supabase)

  return (
    <div className="h-full overflow-auto p-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Distributions</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Uncertainty primitives used by bioavailability, modifiers, and device calibration.
        </p>
      </div>

      <CreateDistributionForm />

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">List</h2>
        {dists.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No distributions yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Name</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Value type</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Dist type</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">p1</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">p2</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">p3</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">min</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">max</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Units</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Quality</th>
                </tr>
              </thead>
              <tbody>
                {dists.map((d) => (
                  <tr key={d.id}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">{d.name}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.value_type}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.dist_type}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.p1 ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.p2 ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.p3 ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.min_value ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.max_value ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.units ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.quality_score}</td>
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
