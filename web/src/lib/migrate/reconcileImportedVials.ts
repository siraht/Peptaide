import { eventCostFromVial } from '@/lib/domain/cost/cost'
import { toCanonicalMassMg, toCanonicalVolumeMl } from '@/lib/domain/units/canonicalize'
import { requireOk } from '@/lib/repos/errors'
import type { DbClient } from '@/lib/repos/types'
import type { Database } from '@/lib/supabase/database.types'

type EventRow = Pick<
  Database['public']['Tables']['administration_events']['Row'],
  | 'id'
  | 'formulation_id'
  | 'ts'
  | 'input_text'
  | 'dose_mass_mg'
  | 'dose_volume_ml'
  | 'tags'
  | 'vial_id'
  | 'cost_usd'
>

type VialRow = Pick<
  Database['public']['Tables']['vials']['Row'],
  | 'id'
  | 'formulation_id'
  | 'substance_id'
  | 'order_item_id'
  | 'lot'
  | 'status'
  | 'content_mass_value'
  | 'content_mass_unit'
  | 'total_volume_value'
  | 'total_volume_unit'
  | 'concentration_mg_per_ml'
  | 'cost_usd'
  | 'created_at'
  | 'opened_at'
  | 'closed_at'
>

type FormulationRow = Pick<
  Database['public']['Tables']['formulations']['Row'],
  'id' | 'name' | 'substance_id' | 'route_id'
>

type OrderItemRow = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'id' | 'order_id' | 'substance_id' | 'formulation_id' | 'expected_vials'
>

export type ReconcileImportedVialsResult = {
  ok: boolean
  summary: {
    scanned_events: number
    events_with_vial_tags: number
    updated_events: number
    updated_vials: number
    active_vials_set: number
  }
  warnings: string[]
}

const VIAL_TAG_RE = /^vial_(\d+)$/i

function toFiniteNumber(x: unknown): number | null {
  if (x == null) return null
  const n = typeof x === 'number' ? x : Number(x)
  return Number.isFinite(n) ? n : null
}

function parseVialNumberFromTags(tags: string[] | null): number | null {
  if (!tags || tags.length === 0) return null
  for (const t of tags) {
    const m = String(t || '').trim().match(VIAL_TAG_RE)
    if (!m) continue
    const n = Number(m[1])
    if (Number.isInteger(n) && n > 0) return n
  }
  return null
}

function parseVialNumberFromLot(lot: string | null): number | null {
  if (!lot) return null
  const m = String(lot).trim().match(VIAL_TAG_RE)
  if (!m) return null
  const n = Number(m[1])
  if (Number.isInteger(n) && n > 0) return n
  return null
}

function canonicalLot(n: number): string {
  return `vial_${n}`
}

function isDmsoVariantFormulationName(name: string): boolean {
  const s = String(name || '').toLowerCase()
  return s.includes('dmso')
}

function safeVialContentMassMg(v: VialRow): number | null {
  const value = toFiniteNumber(v.content_mass_value)
  if (value == null) return null
  try {
    return toCanonicalMassMg(value, v.content_mass_unit)
  } catch {
    return null
  }
}

function safeVialTotalVolumeMl(v: VialRow): number | null {
  if (v.total_volume_value == null || v.total_volume_unit == null) return null
  const value = toFiniteNumber(v.total_volume_value)
  if (value == null) return null
  try {
    return toCanonicalVolumeMl(value, v.total_volume_unit)
  } catch {
    return null
  }
}

type FormulationVialGroup = {
  formulationId: string
  maxVialNumber: number
  byVialNumber: Map<number, EventRow[]>
}

function summarizeGroup(events: EventRow[]): {
  firstTsIso: string
  lastTsIso: string
  totalDoseMassMg: number
  totalDoseVolumeMl: number
} {
  let firstTsIso = events[0]!.ts
  let lastTsIso = events[0]!.ts
  let totalDoseMassMg = 0
  let totalDoseVolumeMl = 0

  for (const e of events) {
    if (e.ts < firstTsIso) firstTsIso = e.ts
    if (e.ts > lastTsIso) lastTsIso = e.ts
    const mg = toFiniteNumber(e.dose_mass_mg)
    const ml = toFiniteNumber(e.dose_volume_ml)
    if (mg != null && mg >= 0) totalDoseMassMg += mg
    if (ml != null && ml >= 0) totalDoseVolumeMl += ml
  }

  return { firstTsIso, lastTsIso, totalDoseMassMg, totalDoseVolumeMl }
}

function chooseBestOrderItemForFormulation(opts: {
  formulation: FormulationRow | null
  formulationItems: OrderItemRow[]
  substanceItems: OrderItemRow[]
  vialsByOrderItemId: Map<string, VialRow[]>
}): OrderItemRow | null {
  const candidates = opts.formulationItems.length > 0 ? opts.formulationItems : opts.substanceItems
  if (candidates.length === 0) return null

  let best: OrderItemRow | null = null
  let bestScore = -1
  for (const item of candidates) {
    const vials = opts.vialsByOrderItemId.get(item.id) ?? []
    const expected = item.expected_vials ?? 0
    // Prefer items that already have generated vials; fall back to higher expected count.
    const score = vials.length * 1000 + expected
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }
  return best
}

export async function reconcileImportedVialsFromTags(
  supabase: DbClient,
): Promise<ReconcileImportedVialsResult> {
  const warnings: string[] = []

  const [eventsRes, vialsRes, itemsRes, formulationsRes] = await Promise.all([
    supabase
      .from('administration_events')
      .select(
        'id,formulation_id,ts,input_text,dose_mass_mg,dose_volume_ml,tags,vial_id,cost_usd',
      )
      .is('deleted_at', null)
      .order('ts', { ascending: true })
      .range(0, 20000),
    supabase
      .from('vials')
      .select(
        'id,formulation_id,substance_id,order_item_id,lot,status,content_mass_value,content_mass_unit,total_volume_value,total_volume_unit,concentration_mg_per_ml,cost_usd,created_at,opened_at,closed_at',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(0, 20000),
    supabase
      .from('order_items')
      .select('id,order_id,substance_id,formulation_id,expected_vials')
      .is('deleted_at', null)
      .range(0, 20000),
    supabase
      .from('formulations')
      .select('id,name,substance_id,route_id')
      .is('deleted_at', null)
      .range(0, 20000),
  ])

  requireOk(eventsRes.error, 'administration_events.select_reconcile_vials')
  requireOk(vialsRes.error, 'vials.select_reconcile_vials')
  requireOk(itemsRes.error, 'order_items.select_reconcile_vials')
  requireOk(formulationsRes.error, 'formulations.select_reconcile_vials')

  const events = (eventsRes.data ?? []) as EventRow[]
  const vials = (vialsRes.data ?? []) as VialRow[]
  const orderItems = (itemsRes.data ?? []) as OrderItemRow[]
  const formulations = (formulationsRes.data ?? []) as FormulationRow[]

  const formulationById = new Map(formulations.map((f) => [f.id, f] as const))

  const orderItemsByFormulationId = new Map<string, OrderItemRow[]>()
  const orderItemsBySubstanceId = new Map<string, OrderItemRow[]>()
  for (const oi of orderItems) {
    if (oi.formulation_id) {
      const arr = orderItemsByFormulationId.get(oi.formulation_id) ?? []
      arr.push(oi)
      orderItemsByFormulationId.set(oi.formulation_id, arr)
    }
    {
      const arr = orderItemsBySubstanceId.get(oi.substance_id) ?? []
      arr.push(oi)
      orderItemsBySubstanceId.set(oi.substance_id, arr)
    }
  }

  const vialsByOrderItemId = new Map<string, VialRow[]>()
  for (const v of vials) {
    if (!v.order_item_id) continue
    const arr = vialsByOrderItemId.get(v.order_item_id) ?? []
    arr.push(v)
    vialsByOrderItemId.set(v.order_item_id, arr)
  }

  // Group events by (formulation, vial_number).
  const groupByFormulationId = new Map<string, Map<number, EventRow[]>>()
  let eventsWithVialTags = 0
  for (const e of events) {
    const n = parseVialNumberFromTags(e.tags)
    if (n == null) continue
    eventsWithVialTags += 1

    const byVial = groupByFormulationId.get(e.formulation_id) ?? new Map<number, EventRow[]>()
    const list = byVial.get(n) ?? []
    list.push(e)
    byVial.set(n, list)
    groupByFormulationId.set(e.formulation_id, byVial)
  }

  if (eventsWithVialTags === 0) {
    return {
      ok: true,
      summary: {
        scanned_events: events.length,
        events_with_vial_tags: 0,
        updated_events: 0,
        updated_vials: 0,
        active_vials_set: 0,
      },
      warnings: ['No events with vial_# tags were found; nothing to reconcile.'],
    }
  }

  // Build per-formulation groups (and max vial number).
  const formulationGroups: FormulationVialGroup[] = []
  for (const [formulationId, byVialNumber] of groupByFormulationId.entries()) {
    let maxVialNumber = 0
    for (const n of byVialNumber.keys()) maxVialNumber = Math.max(maxVialNumber, n)
    formulationGroups.push({ formulationId, maxVialNumber, byVialNumber })
  }

  // Resolve which order_item each formulation should use (prefer matching formulation_id; fall back to substance_id).
  const orderItemIdByFormulationId = new Map<string, string>()
  const orderItemById = new Map(orderItems.map((oi) => [oi.id, oi] as const))
  const orderItemIdsTouched = new Set<string>()

  for (const fg of formulationGroups) {
    const formulation = formulationById.get(fg.formulationId) ?? null
    const formulationItems = orderItemsByFormulationId.get(fg.formulationId) ?? []
    const substanceItems = formulation ? orderItemsBySubstanceId.get(formulation.substance_id) ?? [] : []

    const best = chooseBestOrderItemForFormulation({
      formulation,
      formulationItems,
      substanceItems,
      vialsByOrderItemId,
    })

    if (!best) {
      const name = formulation ? formulation.name : fg.formulationId
      warnings.push(`No order item found for formulation "${name}". Events will be linked to placeholder vials (no cost).`)
      continue
    }

    orderItemIdByFormulationId.set(fg.formulationId, best.id)
    orderItemIdsTouched.add(best.id)
  }

  // Ensure lots `vial_1..vial_expected` exist for each touched order_item's vials.
  let updatedVials = 0

  for (const orderItemId of orderItemIdsTouched) {
    const item = orderItemById.get(orderItemId)
    const itemVials = (vialsByOrderItemId.get(orderItemId) ?? []).slice()
    itemVials.sort((a, b) => {
      const ca = String(a.created_at || '')
      const cb = String(b.created_at || '')
      if (ca !== cb) return ca.localeCompare(cb)
      return String(a.id).localeCompare(String(b.id))
    })

    if (!item || itemVials.length === 0) continue

    const expected = item.expected_vials != null && item.expected_vials > 0 ? item.expected_vials : itemVials.length

    const usedNumbers = new Set<number>()
    const availableForAssignment: VialRow[] = []
    for (const v of itemVials) {
      const n = parseVialNumberFromLot(v.lot)
      if (n != null) {
        usedNumbers.add(n)
      } else {
        availableForAssignment.push(v)
      }
    }

    for (let n = 1; n <= expected; n++) {
      if (usedNumbers.has(n)) continue
      const v = availableForAssignment.shift()
      if (!v) {
        warnings.push(`Order item ${orderItemId}: expected ${expected} vials but only found ${itemVials.length}.`)
        break
      }
      const res = await supabase.from('vials').update({ lot: canonicalLot(n) }).eq('id', v.id)
      requireOk(res.error, 'vials.set_lot_reconcile')
      v.lot = canonicalLot(n)
      updatedVials += 1
      usedNumbers.add(n)
    }
  }

  // Variant formulations (e.g., SS-31 w/DMSO): for any order_item that maps to multiple formulations,
  // assign each vial_N to the formulation that actually has events with that vial tag.
  for (const orderItemId of orderItemIdsTouched) {
    const item = orderItemById.get(orderItemId)
    if (!item) continue

    const itemVials = vialsByOrderItemId.get(orderItemId) ?? []
    if (itemVials.length === 0) continue

    // Which formulations are trying to use this order item?
    const formulationsForItem = new Set<string>()
    for (const fg of formulationGroups) {
      const mapped = orderItemIdByFormulationId.get(fg.formulationId)
      if (mapped === orderItemId) formulationsForItem.add(fg.formulationId)
    }
    if (formulationsForItem.size <= 1) continue

    // For each vial_N, pick the single formulation that has events tagged vial_N (for this item).
    const desiredFormulationByVialNumber = new Map<number, string>()
    for (const fg of formulationGroups) {
      if (orderItemIdByFormulationId.get(fg.formulationId) !== orderItemId) continue
      for (const n of fg.byVialNumber.keys()) {
        const prev = desiredFormulationByVialNumber.get(n)
        if (!prev) {
          desiredFormulationByVialNumber.set(n, fg.formulationId)
        } else if (prev !== fg.formulationId) {
          // Conflict: two formulations claim the same physical vial number. Keep base formulation_id.
          const keep = item.formulation_id ?? prev
          desiredFormulationByVialNumber.set(n, keep)
          const a = formulationById.get(prev)?.name ?? prev
          const b = formulationById.get(fg.formulationId)?.name ?? fg.formulationId
          warnings.push(
            `Conflict for order item ${orderItemId} vial_${n}: events reference multiple formulations (${a}, ${b}). Keeping ${formulationById.get(keep)?.name ?? keep}.`,
          )
        }
      }
    }

    // Move the physical vials to the desired formulation when needed.
    for (const [n, desiredFormulationId] of desiredFormulationByVialNumber.entries()) {
      const lot = canonicalLot(n)
      const vial = itemVials.find((v) => String(v.lot || '').toLowerCase() === lot.toLowerCase())
      if (!vial) {
        warnings.push(`Order item ${orderItemId}: could not find physical vial with lot ${lot} to assign to a formulation.`)
        continue
      }

      // Only treat "dmso-like" formulation names as eligible for moves to avoid surprising remaps.
      const desiredName = formulationById.get(desiredFormulationId)?.name ?? ''
      const baseName = item.formulation_id ? formulationById.get(item.formulation_id)?.name ?? '' : ''
      const isVariant = isDmsoVariantFormulationName(desiredName) && !isDmsoVariantFormulationName(baseName)

      if (!isVariant) continue
      if (vial.formulation_id === desiredFormulationId) continue

      const up = await supabase.from('vials').update({ formulation_id: desiredFormulationId }).eq('id', vial.id)
      requireOk(up.error, 'vials.move_variant_formulation_reconcile')
      vial.formulation_id = desiredFormulationId
      updatedVials += 1
    }
  }

  // Build a lookup (formulation_id, vial_number) -> vial.
  const vialByFormulationAndNumber = new Map<string, VialRow>()
  for (const v of vials) {
    const n = parseVialNumberFromLot(v.lot)
    if (n == null) continue
    const key = `${v.formulation_id}::${n}`
    if (!vialByFormulationAndNumber.has(key)) {
      vialByFormulationAndNumber.set(key, v)
    }
  }

  // Set vial statuses and opened/closed timestamps based on usage.
  let activeVialsSet = 0

  for (const fg of formulationGroups) {
    const maxN = fg.maxVialNumber
    const activeKey = `${fg.formulationId}::${maxN}`
    const activeVial = vialByFormulationAndNumber.get(activeKey) ?? null
    if (!activeVial) {
      const name = formulationById.get(fg.formulationId)?.name ?? fg.formulationId
      warnings.push(`Missing vial for formulation "${name}" ${canonicalLot(maxN)}; cannot set active vial.`)
      continue
    }

    // Close any other active vials (best-effort), then set the intended active vial.
    const activeToClose = vials.filter(
      (v) => v.formulation_id === fg.formulationId && v.status === 'active' && v.id !== activeVial.id,
    )
    for (const v of activeToClose) {
      const up = await supabase
        .from('vials')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', v.id)
      requireOk(up.error, 'vials.close_prior_active_reconcile')
      v.status = 'closed'
      v.closed_at = new Date().toISOString()
      updatedVials += 1
    }

    for (const [n, evs] of fg.byVialNumber.entries()) {
      const key = `${fg.formulationId}::${n}`
      const vial = vialByFormulationAndNumber.get(key)
      if (!vial) continue

      const { firstTsIso, lastTsIso } = summarizeGroup(evs)

      const desiredStatus: Database['public']['Enums']['vial_status_t'] = n === maxN ? 'active' : 'closed'
      const desiredOpenedAt = vial.opened_at ? (vial.opened_at < firstTsIso ? vial.opened_at : firstTsIso) : firstTsIso
      const desiredClosedAt = desiredStatus === 'closed' ? lastTsIso : null

      const patch: Partial<Database['public']['Tables']['vials']['Update']> = {}
      if (vial.status !== desiredStatus) patch.status = desiredStatus
      if (desiredOpenedAt && vial.opened_at !== desiredOpenedAt) patch.opened_at = desiredOpenedAt
      if (desiredClosedAt !== (vial.closed_at ?? null)) patch.closed_at = desiredClosedAt

      if (Object.keys(patch).length > 0) {
        const up = await supabase.from('vials').update(patch).eq('id', vial.id)
        requireOk(up.error, 'vials.update_status_times_reconcile')
        if (patch.status != null) vial.status = patch.status
        if (patch.opened_at !== undefined) vial.opened_at = patch.opened_at
        if (patch.closed_at !== undefined) vial.closed_at = patch.closed_at
        updatedVials += 1
      }
    }

    // Ensure the intended active vial is active even if there were no events for intermediate vial numbers.
    if (activeVial.status !== 'active') {
      const up = await supabase.from('vials').update({ status: 'active' }).eq('id', activeVial.id)
      requireOk(up.error, 'vials.force_active_reconcile')
      activeVial.status = 'active'
      updatedVials += 1
    }
    activeVialsSet += 1
  }

  // Backfill events: set vial_id + cost_usd.
  const eventUpdates: Array<Database['public']['Tables']['administration_events']['Insert']> = []
  let updatedEvents = 0

  for (const fg of formulationGroups) {
    const maxN = fg.maxVialNumber
    for (const [n, evs] of fg.byVialNumber.entries()) {
      const vial = vialByFormulationAndNumber.get(`${fg.formulationId}::${n}`)
      if (!vial) continue

      const vialCostUsd = toFiniteNumber(vial.cost_usd)
      const vialContentMassMg = safeVialContentMassMg(vial)
      const vialTotalVolumeMl = safeVialTotalVolumeMl(vial)

      const { totalDoseMassMg, totalDoseVolumeMl } = summarizeGroup(evs)
      const isActiveVial = n === maxN

      for (const e of evs) {
        const needsVial = e.vial_id == null
        const needsCost = e.cost_usd == null
        if (!needsVial && !needsCost) continue

        let costUsd: number | null = e.cost_usd == null ? null : toFiniteNumber(e.cost_usd)
        if (needsCost && vialCostUsd != null) {
          const doseMassMg = toFiniteNumber(e.dose_mass_mg)
          const doseVolumeMl = toFiniteNumber(e.dose_volume_ml)

          if (!isActiveVial && doseMassMg != null && totalDoseMassMg > 0) {
            // Closed vials: scale costs so the vial's events sum to the vial cost.
            costUsd = (vialCostUsd * doseMassMg) / totalDoseMassMg
          } else if (!isActiveVial && doseVolumeMl != null && totalDoseVolumeMl > 0) {
            costUsd = (vialCostUsd * doseVolumeMl) / totalDoseVolumeMl
          } else {
            // Active vial (or fallback): simple fraction-of-vial model.
            costUsd = eventCostFromVial({
              doseMassMg,
              doseVolumeMl,
              vialContentMassMg,
              vialTotalVolumeMl,
              vialCostUsd,
            })
          }
        }

        eventUpdates.push({
          id: e.id,
          ts: e.ts,
          formulation_id: e.formulation_id,
          input_text: e.input_text,
          vial_id: vial.id,
          cost_usd: costUsd,
        })
        updatedEvents += 1
      }
    }
  }

  if (eventUpdates.length > 0) {
    const batchSize = 500
    for (let i = 0; i < eventUpdates.length; i += batchSize) {
      const batch = eventUpdates.slice(i, i + batchSize)
      const up = await supabase.from('administration_events').upsert(batch, { onConflict: 'id' })
      requireOk(up.error, 'administration_events.upsert_reconcile')
    }
  }

  return {
    ok: true,
    summary: {
      scanned_events: events.length,
      events_with_vial_tags: eventsWithVialTags,
      updated_events: updatedEvents,
      updated_vials: updatedVials,
      active_vials_set: activeVialsSet,
    },
    warnings,
  }
}
