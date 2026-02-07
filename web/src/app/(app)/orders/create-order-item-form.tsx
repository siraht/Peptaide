'use client'

import { useActionState } from 'react'

import type { CreateOrderItemState } from './actions'
import { createOrderItemAction } from './actions'

export type OrdersOrderOption = { id: string; label: string }
export type OrdersSubstanceOption = { id: string; label: string }
export type OrdersFormulationOption = { id: string; label: string }

export function CreateOrderItemForm(props: {
  orders: OrdersOrderOption[]
  substances: OrdersSubstanceOption[]
  formulations: OrdersFormulationOption[]
}) {
  const { orders, substances, formulations } = props

  const [state, formAction] = useActionState<CreateOrderItemState, FormData>(createOrderItemAction, {
    status: 'idle',
  })

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Add order item</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Order items represent purchased units (vials, kits, packs, etc). Link a formulation to enable vial generation.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Order</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="order_id" required>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Substance</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="substance_id" required>
            {substances.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Formulation (optional)</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="formulation_id" defaultValue="">
            <option value="">(none)</option>
            {formulations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Qty</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="qty" required inputMode="numeric" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Unit label</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="unit_label" required placeholder="vial" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Price total USD (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="price_total_usd" inputMode="decimal" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Expected vials (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="expected_vials" inputMode="numeric" />
        </label>

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
