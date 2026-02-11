'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/toast/use-toast'
import type { DistributionRow } from '@/lib/repos/distributionsRepo'

import type { SetupSetFormulationModifierSpecState } from './actions'
import { setupSetFormulationModifierSpecAction } from './actions'

export type SetupFormulationOption = { id: string; label: string }

export function SetupFormulationModifierSpecForm(props: {
  formulations: SetupFormulationOption[]
  multiplierDistributions: DistributionRow[]
}) {
  const { formulations, multiplierDistributions } = props

  const [state, formAction] = useActionState<SetupSetFormulationModifierSpecState, FormData>(
    setupSetFormulationModifierSpecAction,
    { status: 'idle' },
  )

  const router = useRouter()
  const { pushToast } = useToast()

  useEffect(() => {
    if (state.status !== 'success') return
    pushToast({ kind: 'success', title: 'Saved', message: state.message })
    router.refresh()
  }, [pushToast, router, state])

  return (
    <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Optional: formulation modifier</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Modifier specs are multipliers (greater than or equal to 0) applied on top of base bioavailability. Use this to
        model formulation-level enhancers that apply to systemic, CNS, or both.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Formulation</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="formulation_id"
            required
          >
            {formulations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Compartment</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="compartment"
            defaultValue="both"
            required
          >
            <option value="both">both</option>
            <option value="systemic">systemic</option>
            <option value="cns">cns</option>
          </select>
        </label>

        <div className="hidden sm:block" />

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Multiplier distribution</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="multiplier_dist_id"
            required
          >
            {multiplierDistributions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.dist_type})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Notes (optional)</span>
          <input
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors"
            name="notes"
          />
        </label>

        <div className="sm:col-span-2">
          <button
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            type="submit"
          >
            Save modifier
          </button>
        </div>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-700">{state.message}</p> : null}
    </div>
  )
}
