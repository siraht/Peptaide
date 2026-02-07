'use client'

import { useActionState, useEffect, useRef } from 'react'

import type { CreateDeviceState } from './actions'
import { createDeviceAction } from './actions'

export function CreateDeviceForm() {
  const [state, formAction] = useActionState<CreateDeviceState, FormData>(createDeviceAction, {
    status: 'idle',
  })

  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (state.status !== 'success') return
    nameRef.current?.focus()
  }, [state.status])

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Add device</h2>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Name</span>
          <input ref={nameRef} className="h-10 rounded-md border px-3 text-sm" name="name" required />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Kind</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="device_kind">
            <option value="syringe">syringe</option>
            <option value="spray">spray</option>
            <option value="dropper">dropper</option>
            <option value="pen">pen</option>
            <option value="other">other</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Default unit</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="default_unit" placeholder="spray" required />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Notes</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Create
          </button>
        </div>
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

