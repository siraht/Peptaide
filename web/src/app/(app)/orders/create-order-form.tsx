'use client'

import { useActionState } from 'react'

import type { CreateOrderState } from './actions'
import { createOrderAction } from './actions'

export type OrdersVendorOption = { id: string; label: string }

export function CreateOrderForm(props: { vendors: OrdersVendorOption[] }) {
  const { vendors } = props

  const [state, formAction] = useActionState<CreateOrderState, FormData>(createOrderAction, {
    status: 'idle',
  })

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Add order</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Minimal order entry. Use ISO timestamps if you need a specific order time; otherwise leave it blank.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Vendor</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="vendor_id" required>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Ordered at (optional, ISO 8601)</span>
          <input
            className="h-10 rounded-md border px-3 text-sm"
            name="ordered_at"
            placeholder="2026-02-07T05:00:00Z"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Shipping cost USD (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="shipping_cost_usd" inputMode="decimal" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Total cost USD (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="total_cost_usd" inputMode="decimal" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Tracking code (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="tracking_code" />
        </label>

        <div className="hidden sm:block" />

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Notes (optional)</span>
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

