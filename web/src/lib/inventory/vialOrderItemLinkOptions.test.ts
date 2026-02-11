import { describe, expect, test } from 'vitest'

import type { FormulationEnriched, SubstanceRow } from '@/lib/repos/formulationsRepo'
import type { OrderItemRow } from '@/lib/repos/orderItemsRepo'
import type { OrderRow } from '@/lib/repos/ordersRepo'
import type { VendorRow } from '@/lib/repos/vendorsRepo'

import { buildVialOrderItemLinkOptions } from './vialOrderItemLinkOptions'

function asFormulationRow(x: Partial<FormulationEnriched['formulation']>): FormulationEnriched['formulation'] {
  return x as FormulationEnriched['formulation']
}

function asOrderRow(x: Partial<OrderRow>): OrderRow {
  return x as OrderRow
}

function asOrderItemRow(x: Partial<OrderItemRow>): OrderItemRow {
  return x as OrderItemRow
}

function asVendorRow(x: Partial<VendorRow>): VendorRow {
  return x as VendorRow
}

function asSubstanceRow(x: Partial<SubstanceRow>): SubstanceRow {
  return x as SubstanceRow
}

function asFormulationEnriched(x: Partial<FormulationEnriched>): FormulationEnriched {
  return x as FormulationEnriched
}

describe('buildVialOrderItemLinkOptions', () => {
  test('builds selector labels and implied per-vial cost from order item pricing', () => {
    const options = buildVialOrderItemLinkOptions({
      orders: [asOrderRow({ id: 'order-1', vendor_id: 'vendor-1', ordered_at: '2026-01-03T00:00:00Z' })],
      orderItems: [
        asOrderItemRow({
          id: 'oi-1',
          order_id: 'order-1',
          formulation_id: 'form-1',
          substance_id: 'sub-1',
          qty: 2,
          unit_label: 'vial',
          expected_vials: 4,
          price_total_usd: 100,
        }),
      ],
      vendors: [asVendorRow({ id: 'vendor-1', name: 'Acme Labs' })],
      substances: [asSubstanceRow({ id: 'sub-1', display_name: 'Semax' })],
      formulations: [
        asFormulationEnriched({
          formulation: asFormulationRow({ id: 'form-1', name: 'Semax IN' }),
        }),
      ],
    })

    expect(options).toHaveLength(1)
    expect(options[0]?.impliedCostUsd).toBe(25)
    expect(options[0]?.selectorLabel).toContain('Acme Labs')
    expect(options[0]?.selectorLabel).toContain('Semax')
    expect(options[0]?.selectorLabel).toContain('Semax IN')
  })

  test('ignores unlinked order items and rows whose order is missing', () => {
    const options = buildVialOrderItemLinkOptions({
      orders: [asOrderRow({ id: 'order-1', vendor_id: 'vendor-1', ordered_at: '2026-01-03T00:00:00Z' })],
      orderItems: [
        asOrderItemRow({
          id: 'oi-missing-formulation',
          order_id: 'order-1',
          formulation_id: null,
          substance_id: 'sub-1',
          qty: 1,
          unit_label: 'vial',
          expected_vials: 1,
          price_total_usd: 10,
        }),
        asOrderItemRow({
          id: 'oi-orphan-order',
          order_id: 'missing-order',
          formulation_id: 'form-1',
          substance_id: 'sub-1',
          qty: 1,
          unit_label: 'vial',
          expected_vials: 1,
          price_total_usd: 10,
        }),
      ],
      vendors: [asVendorRow({ id: 'vendor-1', name: 'Acme Labs' })],
      substances: [asSubstanceRow({ id: 'sub-1', display_name: 'Semax' })],
      formulations: [
        asFormulationEnriched({
          formulation: asFormulationRow({ id: 'form-1', name: 'Semax IN' }),
        }),
      ],
    })

    expect(options).toHaveLength(0)
  })
})
