'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { DistributionRow } from '@/lib/repos/distributionsRepo'

import type { CreateFormulationComponentState } from './actions'
import { createFormulationComponentAction } from './actions'

export function CreateFormulationComponentForm(props: {
  formulationId: string
  multiplierDistributions: DistributionRow[]
}) {
  const { formulationId, multiplierDistributions } = props

  const [state, formAction] = useActionState<CreateFormulationComponentState, FormData>(
    createFormulationComponentAction,
    { status: 'idle' },
  )

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm" data-e2e="formulation-component-card">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add formulation component</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Components can optionally reference a multiplier distribution. This MVP uses the component&apos;s
        <code className="rounded bg-slate-100 dark:bg-slate-800 px-1">modifier_dist_id</code> as a fallback modifier that applies
        to both systemic and CNS when no per-compartment component modifier specs exist.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction} data-e2e="formulation-component-form">
        <input type="hidden" name="formulation_id" value={formulationId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Component name</span>
          <input
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500"
            name="component_name"
            required
            data-e2e="formulation-component-name"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Role (optional)</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="role" placeholder="enhancer" />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Modifier distribution (optional)</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100" name="modifier_dist_id">
            <option value="">(none)</option>
            {multiplierDistributions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.dist_type})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Notes (optional)</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
            Create component
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" data-e2e="formulation-component-error">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300" data-e2e="formulation-component-success">
          {state.message}
        </p>
      ) : null}
    </div>
  )
}
