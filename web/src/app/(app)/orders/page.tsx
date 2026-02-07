import { CreateOrderForm } from './create-order-form'
import { CreateOrderItemForm } from './create-order-item-form'
import { CreateVendorForm } from './create-vendor-form'
import { GenerateVialsForm } from './generate-vials-form'
import { deleteOrderAction, deleteOrderItemAction, deleteVendorAction } from './actions'

import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listOrders } from '@/lib/repos/ordersRepo'
import { listOrderItems } from '@/lib/repos/orderItemsRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { listVendors, listVendorsById } from '@/lib/repos/vendorsRepo'
import { createClient } from '@/lib/supabase/server'

function fmtMoney(x: number | null): string {
  if (x == null) return '-'
  if (!Number.isFinite(x)) return '-'
  return `$${x.toFixed(2).replace(/\.?0+$/, '')}`
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
  const vendorsForOrders = await listVendorsById(supabase, { vendorIds, includeDeleted: true })
  const vendorById = new Map(vendorsForOrders.map((v) => [v.id, v] as const))

  const substanceById = new Map(substances.map((s) => [s.id, s] as const))
  const formulationById = new Map(formulations.map((f) => [f.formulation.id, f] as const))
  const orderById = new Map(orders.map((o) => [o.id, o] as const))

  const vendorOptions = vendors.map((v) => ({ id: v.id, label: v.name }))
  const orderOptions = orders.map((o) => {
    const vendorName = vendorById.get(o.vendor_id)?.name ?? '(vendor)'
    const day = o.ordered_at.slice(0, 10)
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
      const orderDay = order ? order.ordered_at.slice(0, 10) : '(date)'
      const substanceName = substanceById.get(oi.substance_id)?.display_name ?? '(substance)'
      const formulationName = oi.formulation_id ? formulationById.get(oi.formulation_id)?.formulation.name ?? '(formulation)' : '(formulation)'
      return {
        id: oi.id,
        label: `${vendorName} / ${orderDay} - ${substanceName} - ${formulationName} (${oi.qty} ${oi.unit_label})`,
      }
    })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-zinc-700">Orders, order items, and (later) vial generation + cost allocation.</p>
      </div>

      <CreateVendorForm />

      {vendorOptions.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-700">
          Create a vendor before creating orders.
        </div>
      ) : (
        <CreateOrderForm vendors={vendorOptions} />
      )}

      {orderOptions.length === 0 || substanceOptions.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-700">
          Create at least one order and substance before adding order items.
        </div>
      ) : (
        <CreateOrderItemForm orders={orderOptions} substances={substanceOptions} formulations={formulationOptions} />
      )}

      {orderItemOptions.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-700">
          To generate vials, create an order item that is linked to a formulation.
        </div>
      ) : (
        <GenerateVialsForm orderItems={orderItemOptions} />
      )}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Vendors</h2>
        {vendors.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No vendors yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[700px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Name</th>
                  <th className="border-b px-2 py-2 font-medium">Notes</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td className="border-b px-2 py-2 text-zinc-900">{v.name}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{v.notes ?? '-'}</td>
                    <td className="border-b px-2 py-2">
                      <form action={deleteVendorAction}>
                        <input type="hidden" name="vendor_id" value={v.id} />
                        <button className="text-sm text-red-700" type="submit">
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

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No orders yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Vendor</th>
                  <th className="border-b px-2 py-2 font-medium">Ordered at</th>
                  <th className="border-b px-2 py-2 font-medium">Shipping</th>
                  <th className="border-b px-2 py-2 font-medium">Total</th>
                  <th className="border-b px-2 py-2 font-medium">Tracking</th>
                  <th className="border-b px-2 py-2 font-medium">Notes</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="border-b px-2 py-2 text-zinc-900">
                      {vendorById.get(o.vendor_id)?.name ?? '(vendor)'}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">{o.ordered_at}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{fmtMoney(o.shipping_cost_usd)}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{fmtMoney(o.total_cost_usd)}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{o.tracking_code ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{o.notes ?? '-'}</td>
                    <td className="border-b px-2 py-2">
                      <form action={deleteOrderAction}>
                        <input type="hidden" name="order_id" value={o.id} />
                        <button className="text-sm text-red-700" type="submit">
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

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Order items</h2>
        {visibleItems.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No order items yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1200px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Order</th>
                  <th className="border-b px-2 py-2 font-medium">Substance</th>
                  <th className="border-b px-2 py-2 font-medium">Formulation</th>
                  <th className="border-b px-2 py-2 font-medium">Qty</th>
                  <th className="border-b px-2 py-2 font-medium">Price total</th>
                  <th className="border-b px-2 py-2 font-medium">Expected vials</th>
                  <th className="border-b px-2 py-2 font-medium">Notes</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((oi) => {
                  const order = orderById.get(oi.order_id)
                  const vendorName = order ? vendorById.get(order.vendor_id)?.name ?? '(vendor)' : '(order)'
                  const orderDay = order ? order.ordered_at.slice(0, 10) : '(date)'

                  const substance = substanceById.get(oi.substance_id)
                  const formulation = oi.formulation_id ? formulationById.get(oi.formulation_id) : null

                  return (
                    <tr key={oi.id}>
                      <td className="border-b px-2 py-2 text-zinc-900">{`${vendorName} / ${orderDay}`}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{substance?.display_name ?? '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{formulation?.formulation.name ?? '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {oi.qty} {oi.unit_label}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">{fmtMoney(oi.price_total_usd)}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{oi.expected_vials ?? '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{oi.notes ?? '-'}</td>
                      <td className="border-b px-2 py-2">
                        <form action={deleteOrderItemAction}>
                          <input type="hidden" name="order_item_id" value={oi.id} />
                          <button className="text-sm text-red-700" type="submit">
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
