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
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Start a new cycle (manual)</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Rare: use this only if you need a cycle with no immediately logged event. The cycle starts now and is only
        allowed when no other active cycle exists for the selected substance.
      </p>

      <form className="mt-3 flex flex-wrap items-end gap-3" action={formAction}>
        <label className="flex min-w-[16rem] flex-col gap-1 text-sm">
          <span className="text-zinc-700">Substance</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="substance_id" required>
            {substances.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
          Start cycle now
        </button>
      </form>

      {state.status === 'error' ? <p className="mt-3 text-sm text-red-700">{state.message}</p> : null}
    </div>
  )
}

