'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

import type { CreateEventState } from './actions'
import { createEventAction } from './actions'

export type TodayFormulationOption = {
  id: string
  label: string
}

export function TodayLogForm(props: { formulations: TodayFormulationOption[] }) {
  const { formulations } = props

  const [state, formAction] = useActionState<CreateEventState, FormData>(createEventAction, {
    status: 'idle',
  })

  const inputRef = useRef<HTMLInputElement | null>(null)
  const searchParams = useSearchParams()
  const focus = searchParams.get('focus')
  const formulationId = searchParams.get('formulation_id')

  useEffect(() => {
    if (state.status !== 'success') return
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.focus()
    }
  }, [state.status])

  useEffect(() => {
    if (focus !== 'log') return
    inputRef.current?.focus()
  }, [focus])

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Quick log</h2>

      <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" action={formAction}>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-zinc-700">Formulation</span>
          <select
            className="h-10 rounded-md border px-3 text-sm"
            name="formulation_id"
            required
            defaultValue={formulationId ?? undefined}
          >
            {formulations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-zinc-700">Dose</span>
          <input
            ref={inputRef}
            className="h-10 rounded-md border px-3 text-sm"
            name="input_text"
            placeholder='e.g. "0.3mL", "250mcg", "2 sprays"'
            required
            autoComplete="off"
            inputMode="decimal"
          />
        </label>

        <button
          className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white"
          type="submit"
        >
          Save
        </button>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-700">{state.message}</p>
      ) : null}

      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700">{state.message}</p>
      ) : null}
    </div>
  )
}
