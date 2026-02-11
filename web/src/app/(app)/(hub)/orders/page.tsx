import { CreateOrderForm } from './create-order-form'
import { CreateOrderItemForm } from './create-order-item-form'
import { CreateVendorForm } from './create-vendor-form'
import { GenerateVialsForm } from './generate-vials-form'
import { ImportRetaPeptideOrdersForm } from './import-reta-peptide-orders-form'
import { deleteOrderAction, deleteOrderItemAction, deleteVendorAction } from './actions'

import { CompactEntryModule } from '@/components/ui/compact-entry-module'
import { EmptyState } from '@/components/ui/empty-state'
import { MetricsStrip } from '@/components/ui/metrics-strip'
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

function fmtCount(n: number): string {
  return new Intl.NumberFormat().format(n)
}

function fmtDate(x: string | null | undefined): string {
  if (!x) return '-'
  const t = Date.parse(x)
  if (!Number.isFinite(t)) return x
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(t))
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
  const linkedOrderItems = visibleItems.filter((oi) => oi.formulation_id != null)

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

  const orderItemOptions = linkedOrderItems.map((oi) => {
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

  let latestOrderAt: string | null = null
  let latestOrderTs = Number.NEGATIVE_INFINITY
  let knownOrderTotals = 0
  let knownOrderTotalsSum = 0
  let plannedVials = 0
  let activeVials = 0
  let closedVials = 0
  let discardedVials = 0

  for (const order of orders) {
    const t = Date.parse(order.ordered_at ?? '')
    if (Number.isFinite(t) && t > latestOrderTs) {
      latestOrderTs = t
      latestOrderAt = order.ordered_at
    }

    const totalUsd = toFiniteNumber(order.total_cost_usd)
    if (totalUsd != null) {
      knownOrderTotals += 1
      knownOrderTotalsSum += totalUsd
    }
  }

  for (const c of counts) {
    plannedVials += (c.vial_count_planned ?? 0) || 0
    activeVials += (c.vial_count_active ?? 0) || 0
    closedVials += (c.vial_count_closed ?? 0) || 0
    discardedVials += (c.vial_count_discarded ?? 0) || 0
  }

  return (
    <div className="h-full overflow-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6 custom-scrollbar" data-e2e="orders-root">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Orders</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Orders and order items, with basic vial generation. Shipping allocation and cost previews come later.
        </p>
      </div>

      <MetricsStrip
        items={[
          {
            label: 'Vendors',
            value: fmtCount(vendors.length),
            detail: vendors.length === 0 ? 'Add one to start entering orders.' : 'Reusable supplier profiles.',
            tone: vendors.length === 0 ? 'warn' : 'neutral',
          },
          {
            label: 'Orders',
            value: fmtCount(orders.length),
            detail: latestOrderAt ? `Latest ${fmtDate(latestOrderAt)}` : 'No orders recorded yet.',
            tone: orders.length === 0 ? 'warn' : 'neutral',
          },
          {
            label: 'Order Items',
            value: fmtCount(visibleItems.length),
            detail: `${fmtCount(linkedOrderItems.length)} linked to formulations`,
            tone: linkedOrderItems.length > 0 ? 'good' : 'warn',
          },
          {
            label: 'Known Order Value',
            value: knownOrderTotals > 0 ? fmtMoney(knownOrderTotalsSum) : '-',
            detail:
              knownOrderTotals > 0
                ? `${fmtCount(knownOrderTotals)} order${knownOrderTotals === 1 ? '' : 's'} with total_cost_usd`
                : 'Add total_cost_usd on orders for spend rollups.',
            tone: knownOrderTotals > 0 ? 'good' : 'warn',
          },
        ]}
      />

      <CompactEntryModule
        id="orders-quick-import"
        title="Quick import"
        description="Seed the demo RETA-PEPTIDE orders and planned vials in one action."
        summaryItems={[
          { label: 'Current orders', value: fmtCount(orders.length), tone: orders.length > 0 ? 'good' : 'neutral' },
          {
            label: 'Planned vials',
            value: fmtCount(plannedVials),
            tone: plannedVials > 0 ? 'good' : 'neutral',
          },
          {
            label: 'Active / closed / discarded',
            value: `${fmtCount(activeVials)} / ${fmtCount(closedVials)} / ${fmtCount(discardedVials)}`,
          },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.orders.quick-import"
      >
        <ImportRetaPeptideOrdersForm />
      </CompactEntryModule>

      <CompactEntryModule
        id="orders-add-vendor"
        title="Add vendor"
        description="Save supplier records used by orders and cost tracking."
        summaryItems={[
          { label: 'Saved vendors', value: fmtCount(vendors.length), tone: vendors.length > 0 ? 'good' : 'warn' },
          {
            label: 'Orders with vendor links',
            value: fmtCount(orders.length),
            tone: orders.length > 0 ? 'good' : 'neutral',
          },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.orders.add-vendor"
      >
        <CreateVendorForm />
      </CompactEntryModule>

      <CompactEntryModule
        id="orders-add-order"
        title="Add order"
        description="Create order headers with optional shipping and total cost information."
        summaryItems={[
          { label: 'Available vendors', value: fmtCount(vendorOptions.length), tone: vendorOptions.length > 0 ? 'good' : 'warn' },
          { label: 'Saved orders', value: fmtCount(orders.length), tone: orders.length > 0 ? 'good' : 'neutral' },
          { label: 'Latest order date', value: latestOrderAt ? fmtDate(latestOrderAt) : '-' },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.orders.add-order"
        emptyCta={
          vendorOptions.length === 0
            ? { href: '/orders?focus=new-vendor', label: 'Create a vendor first' }
            : undefined
        }
      >
        {vendorOptions.length === 0 ? (
          <EmptyState
            icon="storefront"
            title="Orders need vendors"
            description="Create a vendor before creating orders."
            actionHref="/orders?focus=new-vendor"
            actionLabel="Create vendor"
          />
        ) : (
          <CreateOrderForm vendors={vendorOptions} />
        )}
      </CompactEntryModule>

      <CompactEntryModule
        id="orders-add-order-item"
        title="Add order item"
        description="Capture purchased line items and optionally map them to formulations."
        summaryItems={[
          { label: 'Orders', value: fmtCount(orderOptions.length), tone: orderOptions.length > 0 ? 'good' : 'warn' },
          { label: 'Substances', value: fmtCount(substanceOptions.length), tone: substanceOptions.length > 0 ? 'good' : 'warn' },
          { label: 'Items linked to formulations', value: fmtCount(linkedOrderItems.length), tone: linkedOrderItems.length > 0 ? 'good' : 'neutral' },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.orders.add-order-item"
        emptyCta={
          orderOptions.length === 0 || substanceOptions.length === 0
            ? { href: '/orders', label: 'Complete order and substance setup first' }
            : undefined
        }
      >
        {orderOptions.length === 0 || substanceOptions.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title="Order items need setup"
            description="Create at least one order and one substance before adding order items."
            actionHref="/orders"
            actionLabel="Create order"
            secondaryHref="/settings?tab=substances"
            secondaryLabel="Open substances"
          />
        ) : (
          <CreateOrderItemForm orders={orderOptions} substances={substanceOptions} formulations={formulationOptions} />
        )}
      </CompactEntryModule>

      <CompactEntryModule
        id="orders-generate-vials"
        title="Generate vials"
        description="Generate planned vials from formulation-linked order items."
        summaryItems={[
          { label: 'Eligible order items', value: fmtCount(orderItemOptions.length), tone: orderItemOptions.length > 0 ? 'good' : 'warn' },
          { label: 'Planned vials', value: fmtCount(plannedVials), tone: plannedVials > 0 ? 'good' : 'neutral' },
          { label: 'Active vials', value: fmtCount(activeVials), tone: activeVials > 0 ? 'good' : 'neutral' },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.orders.generate-vials"
        emptyCta={
          orderItemOptions.length === 0
            ? { href: '/orders', label: 'Create a formulation-linked order item' }
            : undefined
        }
      >
        {orderItemOptions.length === 0 ? (
          <EmptyState
            icon="medication_liquid"
            title="No vial generation targets yet"
            description="Create an order item linked to a formulation to generate planned vials."
            actionHref="/orders"
            actionLabel="Add order item"
          />
        ) : (
          <GenerateVialsForm orderItems={orderItemOptions} />
        )}
      </CompactEntryModule>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Vendors</h2>
        {vendors.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="store"
            title="No vendors yet"
            description="Start by saving your first vendor to anchor order costs."
            actionHref="/orders?focus=new-vendor"
            actionLabel="Create vendor"
          />
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
          <EmptyState
            className="mt-3"
            icon="shopping_cart"
            title="No orders yet"
            description="Create your first order to track planned stock and landed costs."
            actionHref="/orders?focus=new-order"
            actionLabel="Create order"
          />
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
          <EmptyState
            className="mt-3"
            icon="format_list_bulleted"
            title="No order items yet"
            description="Add item lines to map received quantities to formulations."
            actionHref="/orders?focus=new-order-item"
            actionLabel="Add order item"
          />
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
