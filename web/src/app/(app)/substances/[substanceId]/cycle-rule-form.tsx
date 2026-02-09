'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { SetCycleRuleState } from './actions'
import { deleteCycleRuleAction, setCycleRuleAction } from './actions'

export type CycleRuleFormRule = {
  id: string
  gap_days_to_suggest_new_cycle: number
  auto_start_first_cycle: boolean
  notes: string | null
} | null

export function CycleRuleForm(props: {
  substanceId: string
  cycleRule: CycleRuleFormRule
  profileGapDefaultDays: number
}) {
  const { substanceId, cycleRule, profileGapDefaultDays } = props

  const effectiveGapDays = cycleRule?.gap_days_to_suggest_new_cycle ?? profileGapDefaultDays
  const effectiveAutoStartFirstCycle = cycleRule?.auto_start_first_cycle ?? true

  const [state, formAction] = useActionState<SetCycleRuleState, FormData>(setCycleRuleAction, {
    status: 'idle',
  })

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cycle rule</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Controls when logging suggests starting a new cycle for this substance.
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Currently: gap threshold <span className="font-medium">{effectiveGapDays}</span> days; auto-start first cycle{' '}
        <span className="font-medium">{effectiveAutoStartFirstCycle ? 'on' : 'off'}</span>.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <input type="hidden" name="substance_id" value={substanceId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Gap days threshold</span>
          <input
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
            name="gap_days_to_suggest_new_cycle"
            inputMode="numeric"
            defaultValue={String(effectiveGapDays)}
            required
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="auto_start_first_cycle"
            defaultChecked={effectiveAutoStartFirstCycle}
          />
          <span className="text-slate-700 dark:text-slate-300">Auto-start first cycle</span>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-700 dark:text-slate-300">Notes (optional)</span>
          <input
            className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
            name="notes"
            defaultValue={cycleRule?.notes ?? ''}
          />
        </label>

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors" type="submit">
            Save cycle rule
          </button>
        </div>
      </form>

      {cycleRule ? (
        <form className="mt-3" action={deleteCycleRuleAction}>
          <input type="hidden" name="substance_id" value={substanceId} />
          <input type="hidden" name="cycle_rule_id" value={cycleRule.id} />
          <button className="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-sm text-red-700 dark:text-red-300" type="submit">
            Remove override
          </button>
        </form>
      ) : null}

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{state.message}</p> : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p>
      ) : null}
    </section>
  )
}
