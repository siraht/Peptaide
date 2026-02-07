'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">Optional: formulation modifier</h3>
      <p className="mt-1 text-sm text-zinc-700">
        Modifier specs are multipliers (greater than or equal to 0) applied on top of base bioavailability. Use this to
        model formulation-level enhancers that apply to systemic, CNS, or both.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Formulation</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="formulation_id" required>
            {formulations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Compartment</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="compartment" defaultValue="both" required>
            <option value="both">both</option>
            <option value="systemic">systemic</option>
            <option value="cns">cns</option>
          </select>
        </label>

        <div className="hidden sm:block" />

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Multiplier distribution</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="multiplier_dist_id" required>
            {multiplierDistributions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.dist_type})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Notes (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Save modifier
          </button>
        </div>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-700">{state.message}</p> : null}
      {state.status === 'success' ? <p className="mt-3 text-sm text-emerald-700">{state.message}</p> : null}
    </div>
  )
}
