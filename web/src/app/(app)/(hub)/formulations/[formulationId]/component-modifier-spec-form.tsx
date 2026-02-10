'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { DistributionRow } from '@/lib/repos/distributionsRepo'
import type { FormulationComponentRow } from '@/lib/repos/formulationComponentsRepo'

import type { SetComponentModifierSpecState } from './actions'
import { setComponentModifierSpecAction } from './actions'

export function ComponentModifierSpecForm(props: {
  formulationId: string
  components: FormulationComponentRow[]
  multiplierDistributions: DistributionRow[]
}) {
  const { formulationId, components, multiplierDistributions } = props

  const [state, formAction] = useActionState<SetComponentModifierSpecState, FormData>(
    setComponentModifierSpecAction,
    { status: 'idle' },
  )

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  if (components.length === 0) {
    return (
      <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm" data-e2e="component-modifier-spec-card">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Component modifier specs</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Add at least one component first.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm" data-e2e="component-modifier-spec-card">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Component modifier specs</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        These per-compartment modifier specs take precedence over the component&apos;s fallback
        <code className="rounded bg-slate-100 dark:bg-slate-800 px-1">modifier_dist_id</code>.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction} data-e2e="component-modifier-spec-form">
        <input type="hidden" name="formulation_id" value={formulationId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Component</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="formulation_component_id" required>
            {components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.component_name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Compartment</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="compartment" defaultValue="both">
            <option value="both">both</option>
            <option value="systemic">systemic</option>
            <option value="cns">cns</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Multiplier distribution</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="multiplier_dist_id" required>
            {multiplierDistributions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.dist_type})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Notes (optional)</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="notes" data-e2e="component-modifier-notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
            Save component modifier spec
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" data-e2e="component-modifier-spec-error">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300" data-e2e="component-modifier-spec-success">
          {state.message}
        </p>
      ) : null}
    </div>
  )
}
