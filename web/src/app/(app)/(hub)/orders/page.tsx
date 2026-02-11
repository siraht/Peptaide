import { CreateOrderForm } from './create-order-form'
import { CreateOrderItemForm } from './create-order-item-form'
import { CreateVendorForm } from './create-vendor-form'
import { GenerateVialsForm } from './generate-vials-form'
import { ImportRetaPeptideOrdersForm } from './import-reta-peptide-orders-form'
import { deleteOrderAction, deleteOrderItemAction, deleteVendorAction } from './actions'

import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listOrderItemVialCounts } from '@/lib/repos/orderItemVialCountsRepo'
import { listOrders } from '@/lib/repos/ordersRepo'
import { listOrderItems } from '@/lib/repos/orderItemsRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { listVendors, listVendorsById } from '@/lib/repos/vendorsRepo'
import { createClient } from '@/lib/supabase/server'

function toFiniteNumber(x: number | string | null | undefined): number | null {
  if (x == null) return null
  const n = typeof x === 'number' ? x : Number(x)
  return Number.isFinite(n) ? n : null
}

function fmtMoney(x: number | string | null | undefined): string {
  const n = toFiniteNumber(x)
  if (n == null) return '-'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n)
}

export default async function OrdersPage() {
  const supabase = await createClient()

  const [vendors, orders, orderItems, substances, formulations] = await Promise.all([
    listVendors(supabase),
    listOrders(supabase),
    listOrderItems(supabase),
    listSubstances(supabase),
    listFormulationsEnriched(supabase),
  ])

  const orderIds = new Set(orders.map((o) => o.id))
  const visibleItems = orderItems.filter((oi) => orderIds.has(oi.order_id))

  const vendorIds = [...new Set(orders.map((o) => o.vendor_id))]
  const [counts, vendorsForOrders] = await Promise.all([
    listOrderItemVialCounts(supabase, { orderItemIds: visibleItems.map((oi) => oi.id) }),
    listVendorsById(supabase, { vendorIds, includeDeleted: true }),
  ])

  const countsByOrderItemId = new Map<string, (typeof counts)[number]>()
  for (const c of counts) {
    if (c.order_item_id) {
      countsByOrderItemId.set(c.order_item_id, c)
    }
  }

  const vendorById = new Map(vendorsForOrders.map((v) => [v.id, v] as const))

  const substanceById = new Map(substances.map((s) => [s.id, s] as const))
  const formulationById = new Map(formulations.map((f) => [f.formulation.id, f] as const))
  const orderById = new Map(orders.map((o) => [o.id, o] as const))

  const vendorOptions = vendors.map((v) => ({ id: v.id, label: v.name }))
  const orderOptions = orders.map((o) => {
    const vendorName = vendorById.get(o.vendor_id)?.name ?? '(vendor)'
    const day = o.ordered_at ? o.ordered_at.slice(0, 10) : '(date)'
    return { id: o.id, label: `${vendorName} / ${day}` }
  })
  const substanceOptions = substances.map((s) => ({ id: s.id, label: s.display_name }))
  const formulationOptions = formulations.map((f) => ({
    id: f.formulation.id,
    label: `${f.formulation.name} (${f.substance?.display_name ?? 'Unknown'} / ${f.route?.name ?? 'Unknown'})`,
  }))

  const orderItemOptions = visibleItems
    .filter((oi) => oi.formulation_id != null)
    .map((oi) => {
      const order = orderById.get(oi.order_id)
      const vendorName = order ? vendorById.get(order.vendor_id)?.name ?? '(vendor)' : '(order)'
      const orderDay = order?.ordered_at ? order.ordered_at.slice(0, 10) : '(date)'
      const substanceName = substanceById.get(oi.substance_id)?.display_name ?? '(substance)'
      const formulationName = oi.formulation_id ? formulationById.get(oi.formulation_id)?.formulation.name ?? '(formulation)' : '(formulation)'
      return {
        id: oi.id,
        label: `${vendorName} / ${orderDay} - ${substanceName} - ${formulationName} (${oi.qty} ${oi.unit_label})`,
      }
    })

  return (
    <div className="h-full overflow-auto p-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Orders</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Orders and order items, with basic vial generation. Shipping allocation and cost previews come later.
        </p>
      </div>

      <ImportRetaPeptideOrdersForm />

      <CreateVendorForm />

      {vendorOptions.length === 0 ? (
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 text-sm text-slate-600 dark:text-slate-400 shadow-sm">
          Create a vendor before creating orders.
        </div>
      ) : (
        <CreateOrderForm vendors={vendorOptions} />
      )}

      {orderOptions.length === 0 || substanceOptions.length === 0 ? (
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 text-sm text-slate-600 dark:text-slate-400 shadow-sm">
          Create at least one order and substance before adding order items.
        </div>
      ) : (
        <CreateOrderItemForm orders={orderOptions} substances={substanceOptions} formulations={formulationOptions} />
      )}

      {orderItemOptions.length === 0 ? (
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 text-sm text-slate-600 dark:text-slate-400 shadow-sm">
          To generate vials, create an order item that is linked to a formulation.
        </div>
      ) : (
        <GenerateVialsForm orderItems={orderItemOptions} />
      )}

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Vendors</h2>
        {vendors.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No vendors yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[700px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Name</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Notes</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">{v.name}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{v.notes ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2">
                      <form action={deleteVendorAction}>
                        <input type="hidden" name="vendor_id" value={v.id} />
                        <button className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No orders yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Vendor</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Ordered at</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Shipping</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Total</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Tracking</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Notes</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">
                      {vendorById.get(o.vendor_id)?.name ?? '(vendor)'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{o.ordered_at ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{fmtMoney(o.shipping_cost_usd)}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{fmtMoney(o.total_cost_usd)}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{o.tracking_code ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{o.notes ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2">
                      <form action={deleteOrderAction}>
                        <input type="hidden" name="order_id" value={o.id} />
                        <button className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Order items</h2>
        {visibleItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No order items yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1500px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Order</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Substance</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Formulation</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Qty</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Price total</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Expected vials</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Vials (P/A/C/D/T)</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Vial cost sum</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Spent</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Remaining</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Notes</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((oi) => {
                  const order = orderById.get(oi.order_id)
                  const vendorName = order ? vendorById.get(order.vendor_id)?.name ?? '(vendor)' : '(order)'
                  const orderDay = order?.ordered_at ? order.ordered_at.slice(0, 10) : '(date)'

                  const substance = substanceById.get(oi.substance_id)
                  const formulation = oi.formulation_id ? formulationById.get(oi.formulation_id) : null
                  const c = countsByOrderItemId.get(oi.id) ?? null

                  const planned = (c?.vial_count_planned ?? 0) || 0
                  const active = (c?.vial_count_active ?? 0) || 0
                  const closed = (c?.vial_count_closed ?? 0) || 0
                  const discarded = (c?.vial_count_discarded ?? 0) || 0
                  const total = (c?.vial_count_total ?? 0) || 0

                  const vialCostSum = toFiniteNumber(c?.vial_cost_usd_sum ?? null)
                  const vialCostKnown = (c?.vial_cost_usd_known_count ?? 0) || 0

                  const spentSum = toFiniteNumber(c?.event_cost_usd_sum ?? null)
                  const spentKnown = (c?.event_cost_usd_known_count ?? 0) || 0
                  const spentTotal = (c?.event_count_total ?? 0) || 0

                  const remaining = vialCostSum != null && spentSum != null ? vialCostSum - spentSum : null

                  return (
                    <tr key={oi.id}>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">{`${vendorName} / ${orderDay}`}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{substance?.display_name ?? '-'}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{formulation?.formulation.name ?? '-'}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                        {oi.qty} {oi.unit_label}
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{fmtMoney(oi.price_total_usd)}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{oi.expected_vials ?? '-'}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                        <span className="font-mono text-xs" title="planned/active/closed/discarded/total">
                          {planned}/{active}/{closed}/{discarded}/{total}
                        </span>
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                        <div>{fmtMoney(vialCostSum)}</div>
                        {total > 0 ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{`cost known ${vialCostKnown}/${total}`}</div>
                        ) : null}
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                        <div>{fmtMoney(spentSum)}</div>
                        {spentTotal > 0 ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{`cost known ${spentKnown}/${spentTotal}`}</div>
                        ) : null}
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{fmtMoney(remaining)}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{oi.notes ?? '-'}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2">
                        <form action={deleteOrderItemAction}>
                          <input type="hidden" name="order_item_id" value={oi.id} />
                          <button className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit">
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
