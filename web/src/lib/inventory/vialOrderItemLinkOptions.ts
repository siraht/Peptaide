import { allocateVialCost } from '@/lib/domain/cost/cost'
import type { FormulationEnriched, SubstanceRow } from '@/lib/repos/formulationsRepo'
import type { OrderItemRow } from '@/lib/repos/orderItemsRepo'
import type { OrderRow } from '@/lib/repos/ordersRepo'
import type { VendorRow } from '@/lib/repos/vendorsRepo'

function orderDay(orderedAt: string | null): string {
  return orderedAt ? orderedAt.slice(0, 10) : '(date)'
}

function orderShortId(orderId: string): string {
  return orderId.slice(0, 8)
}

export type VialOrderItemLinkOption = {
  id: string
  formulationId: string
  orderId: string
  vendorId: string
  vendorName: string
  orderedAt: string | null
  orderRefLabel: string
  substanceName: string
  formulationName: string
  qty: number
  unitLabel: string
  expectedVials: number | null
  priceTotalUsd: number | null
  impliedCostUsd: number | null
  selectorLabel: string
}

export function buildVialOrderItemLinkOptions(opts: {
  orders: OrderRow[]
  orderItems: OrderItemRow[]
  vendors: VendorRow[]
  substances: SubstanceRow[]
  formulations: FormulationEnriched[]
}): VialOrderItemLinkOption[] {
  const { orders, orderItems, vendors, substances, formulations } = opts

  const orderById = new Map(orders.map((o) => [o.id, o] as const))
  const vendorById = new Map(vendors.map((v) => [v.id, v] as const))
  const substanceById = new Map(substances.map((s) => [s.id, s] as const))
  const formulationById = new Map(formulations.map((f) => [f.formulation.id, f] as const))

  const rows: VialOrderItemLinkOption[] = []

  for (const oi of orderItems) {
    if (!oi.formulation_id) continue

    const order = orderById.get(oi.order_id)
    if (!order) continue

    const vendorName = vendorById.get(order.vendor_id)?.name ?? '(vendor)'
    const substanceName = substanceById.get(oi.substance_id)?.display_name ?? '(substance)'
    const formulationName = formulationById.get(oi.formulation_id)?.formulation.name ?? '(formulation)'

    const impliedCostUsd = allocateVialCost({
      priceTotalUsd: oi.price_total_usd,
      expectedVials: oi.expected_vials,
    })

    const day = orderDay(order.ordered_at)
    const ref = `${day} / #${orderShortId(order.id)}`
    const selectorLabel = `${vendorName} / ${day} - ${substanceName} - ${formulationName} (${oi.qty} ${oi.unit_label})`

    rows.push({
      id: oi.id,
      formulationId: oi.formulation_id,
      orderId: order.id,
      vendorId: order.vendor_id,
      vendorName,
      orderedAt: order.ordered_at,
      orderRefLabel: ref,
      substanceName,
      formulationName,
      qty: oi.qty,
      unitLabel: oi.unit_label,
      expectedVials: oi.expected_vials,
      priceTotalUsd: oi.price_total_usd,
      impliedCostUsd,
      selectorLabel,
    })
  }

  rows.sort((a, b) => {
    const aTs = a.orderedAt ? Date.parse(a.orderedAt) : 0
    const bTs = b.orderedAt ? Date.parse(b.orderedAt) : 0
    if (aTs !== bTs) return bTs - aTs
    return a.selectorLabel.localeCompare(b.selectorLabel)
  })

  return rows
}
