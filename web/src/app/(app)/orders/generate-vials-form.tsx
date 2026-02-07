'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { GenerateVialsState } from './actions'
import { generateVialsFromOrderItemAction } from './actions'

export type OrdersOrderItemOption = { id: string; label: string }

export function GenerateVialsForm(props: { orderItems: OrdersOrderItemOption[] }) {
  const { orderItems } = props

  const [state, formAction] = useActionState<GenerateVialsState, FormData>(generateVialsFromOrderItemAction, {
    status: 'idle',
  })

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Generate vials</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Creates planned vials linked to an order item. If <code className="rounded bg-zinc-100 px-1">expected_vials</code>{' '}
        is set, cost defaults to <code className="rounded bg-zinc-100 px-1">price_total_usd / expected_vials</code>.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Order item</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="order_item_id" required>
            {orderItems.map((oi) => (
              <option key={oi.id} value={oi.id}>
                {oi.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Vial count (optional)</span>
          <input
            className="h-10 rounded-md border px-3 text-sm"
            name="vial_count"
            inputMode="numeric"
            placeholder="(defaults to expected_vials or qty)"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Content mass</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="content_mass_value" required inputMode="decimal" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Mass unit</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="content_mass_unit" defaultValue="mg">
            <option value="mg">mg</option>
            <option value="mcg">mcg</option>
            <option value="ug">ug</option>
            <option value="g">g</option>
            <option value="IU">IU</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Total volume (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="total_volume_value" inputMode="decimal" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Volume unit</span>
          <select className="h-10 rounded-md border px-3 text-sm" name="total_volume_unit" defaultValue="mL">
            <option value="mL">mL</option>
            <option value="cc">cc</option>
            <option value="uL">uL</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700">Cost per vial USD (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="cost_usd" inputMode="decimal" />
        </label>

        <div className="hidden sm:block" />

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700">Notes (optional)</span>
          <input className="h-10 rounded-md border px-3 text-sm" name="notes" />
        </label>

        <div className="sm:col-span-2">
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" type="submit">
            Generate
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
