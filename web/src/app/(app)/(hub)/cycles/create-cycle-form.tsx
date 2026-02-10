'use client'

import { useActionState } from 'react'

import type { CreateCycleNowState } from './actions'
import { createCycleNowAction } from './actions'

export type CycleSubstanceOption = { id: string; label: string }

export function CreateCycleNowForm(props: { substances: CycleSubstanceOption[] }) {
  const { substances } = props

  const [state, formAction] = useActionState<CreateCycleNowState, FormData>(createCycleNowAction, {
    status: 'idle',
  })

  if (substances.length === 0) return null

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Start a new cycle (manual)</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Rare: use this only if you need a cycle with no immediately logged event. The cycle starts now and is only
        allowed when no other active cycle exists for the selected substance.
      </p>

      <form className="mt-3 flex flex-wrap items-end gap-3" action={formAction}>
        <label className="flex min-w-[16rem] flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Substance</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm transition-all outline-none text-slate-900 dark:text-slate-100" name="substance_id" required>
            {substances.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20" type="submit">
          Start cycle now
        </button>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.message}</p> : null}
    </div>
  )
}
