'use server'

import { revalidatePath } from 'next/cache'

import { toCanonicalMassMg, toCanonicalVolumeMl } from '@/lib/domain/units/canonicalize'
import { toUserFacingDbErrorMessage } from '@/lib/errors/userFacingDbError'
import { createFormulation } from '@/lib/repos/formulationsRepo'
import { createOrder, softDeleteOrder } from '@/lib/repos/ordersRepo'
import {
  createOrderItem,
  getOrderItemById,
  softDeleteOrderItem,
  softDeleteOrderItemsForOrder,
} from '@/lib/repos/orderItemsRepo'
import { createRoute } from '@/lib/repos/routesRepo'
import { createSubstance } from '@/lib/repos/substancesRepo'
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

export type ImportRetaPeptideOrdersState =
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

function normalizeKey(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function slugifyCanonicalName(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
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
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
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
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
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
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
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
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
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
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
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
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath('/orders')
  revalidatePath('/inventory')
  revalidatePath('/today')
  return { status: 'success', message: `Generated ${count} planned vial(s).` }
}

type Money = number

type PlannedOrderItem = {
  substanceDisplayName: string
  routeName: string
  formulationName: string
  productCode: string
  contentMassMgPerVial: number
  expectedVials: number
  qty: number
  unitLabel: string
  priceTotalUsd: Money
  notes: string
}

function orderNotes(parts: {
  label: string
  subtotalUsd: Money
  platformFeeUsd: Money
  shippingUsd: Money
  taxUsd: Money
  totalUsd: Money
}): string {
  return [
    parts.label,
    `subtotal_usd=${parts.subtotalUsd.toFixed(2)}`,
    `platform_fee_usd=${parts.platformFeeUsd.toFixed(2)}`,
    `shipping_usd=${parts.shippingUsd.toFixed(2)}`,
    `tax_usd=${parts.taxUsd.toFixed(2)}`,
    `total_usd=${parts.totalUsd.toFixed(2)}`,
  ].join('; ')
}

async function ensureVendorId(supabase: Awaited<ReturnType<typeof createClient>>, vendorName: string): Promise<string> {
  // Prefer exact vendor name match; fall back to any existing vendor containing `reta-peptide`.
  const vendorsRes = await supabase.from('vendors').select('*').is('deleted_at', null)
  if (vendorsRes.error) throw vendorsRes.error
  const vendors = vendorsRes.data ?? []

  const exact = vendors.find((v) => normalizeKey(v.name) === normalizeKey(vendorName))
  if (exact) return exact.id

  const fallback = vendors.find((v) => normalizeKey(v.name).includes('reta-peptide'))
  if (fallback) return fallback.id

  const created = await createVendor(supabase, { name: vendorName, notes: null })
  return created.id
}

async function ensureRouteId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  routeName: string,
): Promise<string> {
  const routesRes = await supabase.from('routes').select('*').is('deleted_at', null)
  if (routesRes.error) throw routesRes.error
  const routes = routesRes.data ?? []

  const existing = routes.find((r) => normalizeKey(r.name) === normalizeKey(routeName))
  if (existing) return existing.id

  const created = await createRoute(supabase, {
    name: routeName,
    defaultInputKind: 'mass',
    defaultInputUnit: 'mg',
    supportsDeviceCalibration: false,
    notes: null,
  })
  return created.id
}

async function ensureSubstanceId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  displayName: string,
): Promise<string> {
  const subsRes = await supabase.from('substances').select('*').is('deleted_at', null)
  if (subsRes.error) throw subsRes.error
  const subs = subsRes.data ?? []

  const existing = subs.find((s) => normalizeKey(s.display_name) === normalizeKey(displayName))
  if (existing) return existing.id

  const taken = new Set(subs.map((s) => s.canonical_name))
  let canonical = slugifyCanonicalName(displayName)
  if (!canonical) canonical = 'substance'
  if (taken.has(canonical)) {
    let n = 2
    while (taken.has(`${canonical}_${n}`)) n++
    canonical = `${canonical}_${n}`
  }

  const created = await createSubstance(supabase, {
    canonicalName: canonical,
    displayName,
    family: null,
    targetCompartmentDefault: 'systemic',
    notes: null,
  })
  return created.id
}

async function ensureFormulationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: { substanceId: string; routeId: string; formulationName: string },
): Promise<string> {
  const formulationsRes = await supabase.from('formulations').select('*').is('deleted_at', null)
  if (formulationsRes.error) throw formulationsRes.error
  const formulations = formulationsRes.data ?? []

  const existing = formulations.find(
    (f) =>
      f.substance_id === opts.substanceId &&
      f.route_id === opts.routeId &&
      normalizeKey(f.name) === normalizeKey(opts.formulationName),
  )
  if (existing) return existing.id

  const hasDefaultForPair = formulations.some(
    (f) => f.substance_id === opts.substanceId && f.route_id === opts.routeId && f.is_default_for_route,
  )

  const created = await createFormulation(supabase, {
    substanceId: opts.substanceId,
    routeId: opts.routeId,
    deviceId: null,
    name: opts.formulationName,
    isDefaultForRoute: !hasDefaultForPair,
    notes: null,
  })
  return created.id
}

async function findOrCreateOrderId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    vendorId: string
    orderedAtIso: string
    shippingUsd: Money
    totalUsd: Money
    notes: string
  },
): Promise<string> {
  const day = opts.orderedAtIso.slice(0, 10)
  const dayStart = `${day}T00:00:00.000Z`
  const dayEndD = new Date(dayStart)
  dayEndD.setUTCDate(dayEndD.getUTCDate() + 1)
  const dayEnd = dayEndD.toISOString()

  const existingRes = await supabase
    .from('orders')
    .select('*')
    .eq('vendor_id', opts.vendorId)
    .gte('ordered_at', dayStart)
    .lt('ordered_at', dayEnd)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (existingRes.error) throw existingRes.error
  const existing = (existingRes.data ?? [])[0]
  if (existing) return existing.id

  const created = await createOrder(supabase, {
    vendorId: opts.vendorId,
    orderedAt: opts.orderedAtIso,
    shippingCostUsd: opts.shippingUsd,
    totalCostUsd: opts.totalUsd,
    trackingCode: null,
    notes: opts.notes,
  })
  return created.id
}

async function findOrCreateOrderItemId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    orderId: string
    substanceId: string
    formulationId: string
    qty: number
    unitLabel: string
    expectedVials: number
    priceTotalUsd: Money
    notes: string
  },
): Promise<{ id: string; created: boolean }> {
  const itemsRes = await supabase.from('order_items').select('*').eq('order_id', opts.orderId).is('deleted_at', null)
  if (itemsRes.error) throw itemsRes.error
  const items = itemsRes.data ?? []

  const existing = items.find((oi) => {
    if (oi.substance_id !== opts.substanceId) return false
    if (oi.formulation_id !== opts.formulationId) return false
    if (oi.qty !== opts.qty) return false
    if (normalizeKey(oi.unit_label) !== normalizeKey(opts.unitLabel)) return false
    if ((oi.expected_vials ?? null) !== opts.expectedVials) return false
    const price = oi.price_total_usd == null ? null : Number(oi.price_total_usd)
    return price != null && Number.isFinite(price) && Math.abs(price - opts.priceTotalUsd) < 0.00001
  })
  if (existing) return { id: existing.id, created: false }

  const created = await createOrderItem(supabase, {
    orderId: opts.orderId,
    substanceId: opts.substanceId,
    formulationId: opts.formulationId,
    qty: opts.qty,
    unitLabel: opts.unitLabel,
    priceTotalUsd: opts.priceTotalUsd,
    expectedVials: opts.expectedVials,
    notes: opts.notes,
  })
  return { id: created.id, created: true }
}

async function countExistingVialsForOrderItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderItemId: string,
): Promise<number> {
  const res = await supabase
    .from('vials')
    .select('id', { count: 'exact', head: true })
    .eq('order_item_id', orderItemId)
    .is('deleted_at', null)
  if (res.error) throw res.error
  return res.count ?? 0
}

async function generatePlannedVialsForOrderItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    orderItemId: string
    substanceId: string
    formulationId: string
    expectedVials: number
    contentMassMgPerVial: number
    priceTotalUsd: Money
    notes: string
  },
): Promise<number> {
  const existingCount = await countExistingVialsForOrderItem(supabase, opts.orderItemId)
  const toCreate = Math.max(0, opts.expectedVials - existingCount)
  if (toCreate === 0) return 0

  const costPerVial = opts.expectedVials > 0 ? opts.priceTotalUsd / opts.expectedVials : null

  for (let i = 0; i < toCreate; i++) {
    await createVial(supabase, {
      substanceId: opts.substanceId,
      formulationId: opts.formulationId,
      orderItemId: opts.orderItemId,
      status: 'planned',
      contentMassValue: opts.contentMassMgPerVial,
      contentMassUnit: 'mg',
      totalVolumeValue: null,
      totalVolumeUnit: null,
      concentrationMgPerMl: null,
      costUsd: costPerVial,
      notes: opts.notes,
    })
  }

  return toCreate
}

export async function importRetaPeptideOrdersAction(
  prev: ImportRetaPeptideOrdersState,
  formData: FormData,
): Promise<ImportRetaPeptideOrdersState> {
  void prev
  void formData

  const supabase = await createClient()

  const authRes = await supabase.auth.getUser()
  const user = authRes.data.user
  if (!user) return { status: 'error', message: 'Not signed in.' }

  try {
    const vendorId = await ensureVendorId(supabase, 'RETA-PEPTIDE')

    // Ensure base reference data exists.
    const subcutaneousRouteId = await ensureRouteId(supabase, 'subcutaneous')
    const intranasalRouteId = await ensureRouteId(supabase, 'intranasal')

    const semaxSubstanceId = await ensureSubstanceId(supabase, 'Semax')
    const bpcSubstanceId = await ensureSubstanceId(supabase, 'BPC-157')
    const tbSubstanceId = await ensureSubstanceId(supabase, 'TB-500')
    const ss31SubstanceId = await ensureSubstanceId(supabase, 'SS-31')
    const motsSubstanceId = await ensureSubstanceId(supabase, 'MOTS-c')
    const ghkSubstanceId = await ensureSubstanceId(supabase, 'GHK-CU')
    const epithSubstanceId = await ensureSubstanceId(supabase, 'Epithalon')

    const semaxFormulationId = await ensureFormulationId(supabase, {
      substanceId: semaxSubstanceId,
      routeId: subcutaneousRouteId,
      formulationName: 'Semax - subcutaneous',
    })
    const bpcFormulationId = await ensureFormulationId(supabase, {
      substanceId: bpcSubstanceId,
      routeId: subcutaneousRouteId,
      formulationName: 'BPC-157 - subcutaneous',
    })
    const tbFormulationId = await ensureFormulationId(supabase, {
      substanceId: tbSubstanceId,
      routeId: subcutaneousRouteId,
      formulationName: 'TB-500 - subcutaneous',
    })
    const ss31FormulationId = await ensureFormulationId(supabase, {
      substanceId: ss31SubstanceId,
      routeId: intranasalRouteId,
      formulationName: 'SS-31 - intranasal',
    })
    const motsFormulationId = await ensureFormulationId(supabase, {
      substanceId: motsSubstanceId,
      routeId: subcutaneousRouteId,
      formulationName: 'MOTS-c - subcutaneous',
    })
    const ghkFormulationId = await ensureFormulationId(supabase, {
      substanceId: ghkSubstanceId,
      routeId: subcutaneousRouteId,
      formulationName: 'GHK-CU - subcutaneous',
    })
    const epithFormulationId = await ensureFormulationId(supabase, {
      substanceId: epithSubstanceId,
      routeId: subcutaneousRouteId,
      formulationName: 'Epithalon - subcutaneous',
    })

    // Orders from spreadsheetdata/2025 Peptide Protocol - Orders.csv
    const order1Id = await findOrCreateOrderId(supabase, {
      vendorId,
      orderedAtIso: '2025-09-24T00:00:00.000Z',
      shippingUsd: 70.0,
      totalUsd: 323.17,
      notes: orderNotes({
        label: 'Order I (RETA-PEPTIDE)',
        subtotalUsd: 206.0,
        platformFeeUsd: 41.2,
        shippingUsd: 70.0,
        taxUsd: 5.97,
        totalUsd: 323.17,
      }),
    })

    const order2Id = await findOrCreateOrderId(supabase, {
      vendorId,
      orderedAtIso: '2025-11-14T00:00:00.000Z',
      shippingUsd: 50.0,
      totalUsd: 267.62,
      notes: orderNotes({
        label: 'Order II (RETA-PEPTIDE)',
        subtotalUsd: 180.0,
        platformFeeUsd: 32.4,
        shippingUsd: 50.0,
        taxUsd: 5.22,
        totalUsd: 267.62,
      }),
    })

    // Each "Qty 1" is a case of 10 vials.
    const caseQty = 1
    const caseLabel = 'case'
    const expectedVials = 10

    const order1Items: PlannedOrderItem[] = [
      {
        substanceDisplayName: 'Semax',
        routeName: 'subcutaneous',
        formulationName: 'Semax - subcutaneous',
        productCode: 'XA10',
        contentMassMgPerVial: 10,
        expectedVials,
        qty: caseQty,
        unitLabel: caseLabel,
        priceTotalUsd: 56.0,
        notes: 'RETA-PEPTIDE Semax (XA10) 10mg; qty=1 case (10 vials).',
      },
      // BPC+TB are in the same physical vial. We represent them as two order_items/vial sets so
      // each substance can have an active vial (required for per-event cost/vial linkage). Costs
      // are split evenly so BPC+TB events sum to the physical vial cost.
      {
        substanceDisplayName: 'BPC-157',
        routeName: 'subcutaneous',
        formulationName: 'BPC-157 - subcutaneous',
        productCode: 'BB20',
        contentMassMgPerVial: 10,
        expectedVials,
        qty: caseQty,
        unitLabel: caseLabel,
        priceTotalUsd: 75.0,
        notes:
          'RETA-PEPTIDE BPC157+TB500 (BB20) 10mg+10mg; qty=1 case (10 vials). Cost split 50/50 with TB-500 for per-substance vial tracking.',
      },
      {
        substanceDisplayName: 'TB-500',
        routeName: 'subcutaneous',
        formulationName: 'TB-500 - subcutaneous',
        productCode: 'BB20',
        contentMassMgPerVial: 10,
        expectedVials,
        qty: caseQty,
        unitLabel: caseLabel,
        priceTotalUsd: 75.0,
        notes:
          'RETA-PEPTIDE BPC157+TB500 (BB20) 10mg+10mg; qty=1 case (10 vials). Cost split 50/50 with BPC-157 for per-substance vial tracking.',
      },
    ]

    const order2Items: PlannedOrderItem[] = [
      {
        substanceDisplayName: 'SS-31',
        routeName: 'intranasal',
        formulationName: 'SS-31 - intranasal',
        productCode: '2510',
        contentMassMgPerVial: 10,
        expectedVials,
        qty: caseQty,
        unitLabel: caseLabel,
        priceTotalUsd: 70.0,
        notes: 'RETA-PEPTIDE SS-31 (2510) 10mg; qty=1 case (10 vials).',
      },
      {
        substanceDisplayName: 'MOTS-c',
        routeName: 'subcutaneous',
        formulationName: 'MOTS-c - subcutaneous',
        productCode: 'MS10',
        contentMassMgPerVial: 10,
        expectedVials,
        qty: caseQty,
        unitLabel: caseLabel,
        priceTotalUsd: 48.0,
        notes: 'RETA-PEPTIDE MOTS-c (MS10) 10mg; qty=1 case (10 vials).',
      },
      {
        substanceDisplayName: 'GHK-CU',
        routeName: 'subcutaneous',
        formulationName: 'GHK-CU - subcutaneous',
        productCode: 'CU50',
        contentMassMgPerVial: 50,
        expectedVials,
        qty: caseQty,
        unitLabel: caseLabel,
        priceTotalUsd: 28.0,
        notes: 'RETA-PEPTIDE GHK-CU (CU50) 50mg; qty=1 case (10 vials).',
      },
      {
        substanceDisplayName: 'Epithalon',
        routeName: 'subcutaneous',
        formulationName: 'Epithalon - subcutaneous',
        productCode: 'ET10',
        contentMassMgPerVial: 10,
        expectedVials,
        qty: caseQty,
        unitLabel: caseLabel,
        priceTotalUsd: 34.0,
        notes: 'RETA-PEPTIDE Epithalon (ET10) 10mg; qty=1 case (10 vials).',
      },
    ]

    const resolvedItems: Array<
      PlannedOrderItem & {
        orderId: string
        substanceId: string
        formulationId: string
      }
    > = [
      ...order1Items.map((i) => ({
        ...i,
        orderId: order1Id,
        substanceId:
          i.substanceDisplayName === 'Semax'
            ? semaxSubstanceId
            : i.substanceDisplayName === 'BPC-157'
              ? bpcSubstanceId
              : tbSubstanceId,
        formulationId:
          i.substanceDisplayName === 'Semax'
            ? semaxFormulationId
            : i.substanceDisplayName === 'BPC-157'
              ? bpcFormulationId
              : tbFormulationId,
      })),
      ...order2Items.map((i) => ({
        ...i,
        orderId: order2Id,
        substanceId:
          i.substanceDisplayName === 'SS-31'
            ? ss31SubstanceId
            : i.substanceDisplayName === 'MOTS-c'
              ? motsSubstanceId
              : i.substanceDisplayName === 'GHK-CU'
                ? ghkSubstanceId
                : epithSubstanceId,
        formulationId:
          i.substanceDisplayName === 'SS-31'
            ? ss31FormulationId
            : i.substanceDisplayName === 'MOTS-c'
              ? motsFormulationId
              : i.substanceDisplayName === 'GHK-CU'
                ? ghkFormulationId
                : epithFormulationId,
      })),
    ]

    let createdOrderItems = 0
    let createdVials = 0

    for (const item of resolvedItems) {
      const orderItem = await findOrCreateOrderItemId(supabase, {
        orderId: item.orderId,
        substanceId: item.substanceId,
        formulationId: item.formulationId,
        qty: item.qty,
        unitLabel: item.unitLabel,
        expectedVials: item.expectedVials,
        priceTotalUsd: item.priceTotalUsd,
        notes: item.notes,
      })

      if (orderItem.created) createdOrderItems += 1

      const newVials = await generatePlannedVialsForOrderItem(supabase, {
        orderItemId: orderItem.id,
        substanceId: item.substanceId,
        formulationId: item.formulationId,
        expectedVials: item.expectedVials,
        contentMassMgPerVial: item.contentMassMgPerVial,
        priceTotalUsd: item.priceTotalUsd,
        notes: item.notes,
      })
      createdVials += newVials
    }

    revalidatePath('/orders')
    revalidatePath('/inventory')

    return {
      status: 'success',
      message: `Imported orders for RETA-PEPTIDE. Created/updated: 2 orders, ${createdOrderItems} order items, ${createdVials} vials.`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }
}
