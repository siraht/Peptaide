'use server'

import { revalidatePath } from 'next/cache'

import { toCanonicalMassMg, toCanonicalVolumeMl } from '@/lib/domain/units/canonicalize'
import { createOrder, softDeleteOrder } from '@/lib/repos/ordersRepo'
import {
  createOrderItem,
  getOrderItemById,
  softDeleteOrderItem,
  softDeleteOrderItemsForOrder,
} from '@/lib/repos/orderItemsRepo'
import { createVendor, softDeleteVendor } from '@/lib/repos/vendorsRepo'
import { createVial } from '@/lib/repos/vialsRepo'
import { createClient } from '@/lib/supabase/server'

export type CreateVendorState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export type CreateOrderState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export type CreateOrderItemState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export type GenerateVialsState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function parseOptionalNumber(raw: string, label: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const x = Number(t)
  if (!Number.isFinite(x)) {
    throw new Error(`${label} must be a number.`)
  }
  return x
}

function parseOptionalInt(raw: string, label: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const x = Number(t)
  if (!Number.isInteger(x)) {
    throw new Error(`${label} must be an integer.`)
  }
  return x
}

function mustInt(raw: string, label: string): number {
  const t = raw.trim()
  if (!t) {
    throw new Error(`${label} is required.`)
  }
  const x = Number(t)
  if (!Number.isInteger(x)) {
    throw new Error(`${label} must be an integer.`)
  }
  return x
}

function mustNumber(raw: string, label: string): number {
  const t = raw.trim()
  if (!t) {
    throw new Error(`${label} is required.`)
  }
  const x = Number(t)
  if (!Number.isFinite(x)) {
    throw new Error(`${label} must be a number.`)
  }
  return x
}

function parseOptionalTimestampIso(raw: string, label: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const d = new Date(t)
  if (!Number.isFinite(d.getTime())) {
    throw new Error(`${label} must be a valid timestamp (try ISO 8601 like "2026-02-07T05:00:00Z").`)
  }
  return d.toISOString()
}

export async function createVendorAction(
  _prev: CreateVendorState,
  formData: FormData,
): Promise<CreateVendorState> {
  const name = String(formData.get('name') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!name) return { status: 'error', message: 'name is required.' }

  const supabase = await createClient()

  try {
    await createVendor(supabase, { name, notes: notes || null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/orders')
  return { status: 'success', message: 'Created.' }
}

export async function deleteVendorAction(formData: FormData): Promise<void> {
  const vendorId = String(formData.get('vendor_id') ?? '').trim()
  if (!vendorId) return

  const supabase = await createClient()
  await softDeleteVendor(supabase, { vendorId })
  revalidatePath('/orders')
}

export async function createOrderAction(
  _prev: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const vendorId = String(formData.get('vendor_id') ?? '').trim()
  const orderedAtRaw = String(formData.get('ordered_at') ?? '').trim()
  const shippingCostUsdRaw = String(formData.get('shipping_cost_usd') ?? '').trim()
  const totalCostUsdRaw = String(formData.get('total_cost_usd') ?? '').trim()
  const trackingCode = String(formData.get('tracking_code') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!vendorId) return { status: 'error', message: 'vendor_id is required.' }

  let orderedAt: string | null = null
  let shippingCostUsd: number | null = null
  let totalCostUsd: number | null = null

  try {
    orderedAt = parseOptionalTimestampIso(orderedAtRaw, 'ordered_at')
    shippingCostUsd = parseOptionalNumber(shippingCostUsdRaw, 'shipping_cost_usd')
    totalCostUsd = parseOptionalNumber(totalCostUsdRaw, 'total_cost_usd')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  if (shippingCostUsd != null && shippingCostUsd < 0) {
    return { status: 'error', message: 'shipping_cost_usd must be >= 0.' }
  }
  if (totalCostUsd != null && totalCostUsd < 0) {
    return { status: 'error', message: 'total_cost_usd must be >= 0.' }
  }

  const supabase = await createClient()

  try {
    await createOrder(supabase, {
      vendorId,
      orderedAt,
      shippingCostUsd,
      totalCostUsd,
      trackingCode: trackingCode || null,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/orders')
  return { status: 'success', message: 'Created.' }
}

export async function deleteOrderAction(formData: FormData): Promise<void> {
  const orderId = String(formData.get('order_id') ?? '').trim()
  if (!orderId) return

  const supabase = await createClient()

  // Keep list views sane: "soft delete order" also soft-deletes its order_items.
  await softDeleteOrder(supabase, { orderId })
  await softDeleteOrderItemsForOrder(supabase, { orderId })

  revalidatePath('/orders')
  revalidatePath('/inventory')
}

export async function createOrderItemAction(
  _prev: CreateOrderItemState,
  formData: FormData,
): Promise<CreateOrderItemState> {
  const orderId = String(formData.get('order_id') ?? '').trim()
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const formulationIdRaw = String(formData.get('formulation_id') ?? '').trim()
  const qtyRaw = String(formData.get('qty') ?? '').trim()
  const unitLabel = String(formData.get('unit_label') ?? '').trim()
  const priceTotalUsdRaw = String(formData.get('price_total_usd') ?? '').trim()
  const expectedVialsRaw = String(formData.get('expected_vials') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!orderId) return { status: 'error', message: 'order_id is required.' }
  if (!substanceId) return { status: 'error', message: 'substance_id is required.' }
  if (!unitLabel) return { status: 'error', message: 'unit_label is required.' }

  let qty: number
  let priceTotalUsd: number | null = null
  let expectedVials: number | null = null

  try {
    qty = mustInt(qtyRaw, 'qty')
    priceTotalUsd = parseOptionalNumber(priceTotalUsdRaw, 'price_total_usd')
    expectedVials = parseOptionalInt(expectedVialsRaw, 'expected_vials')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  if (qty <= 0) return { status: 'error', message: 'qty must be > 0.' }
  if (priceTotalUsd != null && priceTotalUsd < 0) {
    return { status: 'error', message: 'price_total_usd must be >= 0.' }
  }
  if (expectedVials != null && expectedVials < 0) {
    return { status: 'error', message: 'expected_vials must be >= 0.' }
  }

  const supabase = await createClient()

  try {
    await createOrderItem(supabase, {
      orderId,
      substanceId,
      formulationId: formulationIdRaw || null,
      qty,
      unitLabel,
      priceTotalUsd,
      expectedVials,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/orders')
  revalidatePath('/inventory')
  return { status: 'success', message: 'Created.' }
}

export async function deleteOrderItemAction(formData: FormData): Promise<void> {
  const orderItemId = String(formData.get('order_item_id') ?? '').trim()
  if (!orderItemId) return

  const supabase = await createClient()
  await softDeleteOrderItem(supabase, { orderItemId })
  revalidatePath('/orders')
  revalidatePath('/inventory')
}

export async function generateVialsFromOrderItemAction(
  _prev: GenerateVialsState,
  formData: FormData,
): Promise<GenerateVialsState> {
  const orderItemId = String(formData.get('order_item_id') ?? '').trim()
  const countRaw = String(formData.get('vial_count') ?? '').trim()
  const contentMassValueRaw = String(formData.get('content_mass_value') ?? '').trim()
  const contentMassUnit = String(formData.get('content_mass_unit') ?? '').trim()
  const totalVolumeValueRaw = String(formData.get('total_volume_value') ?? '').trim()
  const totalVolumeUnit = String(formData.get('total_volume_unit') ?? '').trim()
  const costUsdRaw = String(formData.get('cost_usd') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!orderItemId) return { status: 'error', message: 'order_item_id is required.' }
  if (!contentMassUnit) return { status: 'error', message: 'content_mass_unit is required.' }

  let vialCount: number | null = null
  let contentMassValue: number
  let totalVolumeValue: number | null = null
  let costUsdOverride: number | null = null

  try {
    vialCount = parseOptionalInt(countRaw, 'vial_count')
    contentMassValue = mustNumber(contentMassValueRaw, 'content_mass_value')
    totalVolumeValue = parseOptionalNumber(totalVolumeValueRaw, 'total_volume_value')
    costUsdOverride = parseOptionalNumber(costUsdRaw, 'cost_usd')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  if (!(contentMassValue > 0)) {
    return { status: 'error', message: 'content_mass_value must be > 0.' }
  }
  if (totalVolumeValue != null && !(totalVolumeValue > 0)) {
    return { status: 'error', message: 'total_volume_value must be > 0 when provided.' }
  }
  if (totalVolumeValue != null && !totalVolumeUnit) {
    return { status: 'error', message: 'total_volume_unit is required when total_volume_value is provided.' }
  }
  if (costUsdOverride != null && costUsdOverride < 0) {
    return { status: 'error', message: 'cost_usd must be >= 0 when provided.' }
  }

  const supabase = await createClient()
  const orderItem = await getOrderItemById(supabase, { orderItemId })
  if (!orderItem) {
    return { status: 'error', message: 'Order item not found.' }
  }
  if (!orderItem.formulation_id) {
    return {
      status: 'error',
      message:
        'Order item must be linked to a formulation before generating vials (set formulation_id on the order item).',
    }
  }

  const defaultCountCandidate =
    orderItem.expected_vials != null && orderItem.expected_vials > 0
      ? orderItem.expected_vials
      : orderItem.qty
  const count = vialCount ?? defaultCountCandidate
  if (!(Number.isInteger(count) && count > 0)) {
    return { status: 'error', message: 'vial_count must be a positive integer (or leave it blank).' }
  }

  let concentration: number | null = null
  if (totalVolumeValue != null && totalVolumeUnit) {
    try {
      const massMg = toCanonicalMassMg(contentMassValue, contentMassUnit)
      const volMl = toCanonicalVolumeMl(totalVolumeValue, totalVolumeUnit)
      if (volMl > 0) concentration = massMg / volMl
    } catch {
      concentration = null
    }
  }

  let costPerVial: number | null = null
  if (costUsdOverride != null) {
    costPerVial = costUsdOverride
  } else if (
    orderItem.price_total_usd != null &&
    orderItem.expected_vials != null &&
    orderItem.expected_vials > 0
  ) {
    costPerVial = Number(orderItem.price_total_usd) / orderItem.expected_vials
  }

  try {
    for (let i = 0; i < count; i++) {
      await createVial(supabase, {
        substanceId: orderItem.substance_id,
        formulationId: orderItem.formulation_id,
        orderItemId: orderItem.id,
        status: 'planned',
        contentMassValue,
        contentMassUnit,
        totalVolumeValue,
        totalVolumeUnit: totalVolumeValue != null ? totalVolumeUnit : null,
        concentrationMgPerMl: concentration,
        costUsd: costPerVial,
        notes: notes || null,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  revalidatePath('/orders')
  revalidatePath('/inventory')
  revalidatePath('/today')
  return { status: 'success', message: `Generated ${count} planned vial(s).` }
}
