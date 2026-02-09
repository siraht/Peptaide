'use server'

import { revalidatePath } from 'next/cache'

import { toCanonicalMassMg, toCanonicalVolumeMl } from '@/lib/domain/units/canonicalize'
import { toUserFacingDbErrorMessage } from '@/lib/errors/userFacingDbError'
import { reconcileImportedVialsFromTags } from '@/lib/migrate/reconcileImportedVials'
import {
  activateVial,
  closeActiveVialsForFormulation,
  closeVial,
  createVial,
  discardVial,
  getVialById,
} from '@/lib/repos/vialsRepo'
import { getFormulationEnrichedById } from '@/lib/repos/formulationsRepo'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

import { importRetaPeptideOrdersAction } from '../orders/actions'

export type CreateVialState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export type ReconcileImportedVialsState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string; warnings: string[] }

function isVialStatus(x: string): x is Database['public']['Enums']['vial_status_t'] {
  return x === 'planned' || x === 'active' || x === 'closed' || x === 'discarded'
}

function parseOptionalNumber(raw: string, label: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const x = Number(t)
  if (!Number.isFinite(x)) {
    throw new Error(`${label} must be a number.`)
  }
  return x
}

export async function createVialAction(_prev: CreateVialState, formData: FormData): Promise<CreateVialState> {
  const formulationId = String(formData.get('formulation_id') ?? '').trim()
  const statusRaw = String(formData.get('status') ?? '').trim()
  const contentMassValueRaw = String(formData.get('content_mass_value') ?? '').trim()
  const contentMassUnit = String(formData.get('content_mass_unit') ?? '').trim()
  const totalVolumeValueRaw = String(formData.get('total_volume_value') ?? '').trim()
  const totalVolumeUnit = String(formData.get('total_volume_unit') ?? '').trim()
  const costUsdRaw = String(formData.get('cost_usd') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!formulationId) return { status: 'error', message: 'formulation_id is required.' }
  if (!isVialStatus(statusRaw)) return { status: 'error', message: 'Invalid status.' }
  if (!contentMassUnit) return { status: 'error', message: 'content_mass_unit is required.' }

  const contentMassValue = Number(contentMassValueRaw)
  if (!Number.isFinite(contentMassValue) || contentMassValue <= 0) {
    return { status: 'error', message: 'content_mass_value must be a number > 0.' }
  }

  let totalVolumeValue: number | null = null
  let costUsd: number | null = null

  try {
    totalVolumeValue = parseOptionalNumber(totalVolumeValueRaw, 'total_volume_value')
    costUsd = parseOptionalNumber(costUsdRaw, 'cost_usd')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: msg }
  }

  if (totalVolumeValue != null && totalVolumeValue <= 0) {
    return { status: 'error', message: 'total_volume_value must be > 0 when provided.' }
  }
  if (totalVolumeValue != null && !totalVolumeUnit) {
    return { status: 'error', message: 'total_volume_unit is required when total_volume_value is provided.' }
  }
  if (costUsd != null && costUsd < 0) {
    return { status: 'error', message: 'cost_usd must be >= 0.' }
  }

  const supabase = await createClient()

  const formulationEnriched = await getFormulationEnrichedById(supabase, { formulationId })
  if (!formulationEnriched) {
    return { status: 'error', message: 'Formulation not found.' }
  }

  const substanceId = formulationEnriched.formulation.substance_id

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

  try {
    if (statusRaw === 'active') {
      // Best-effort: close any prior active vial so the partial unique index is satisfied.
      await closeActiveVialsForFormulation(supabase, { formulationId })
    }

    await createVial(supabase, {
      substanceId,
      formulationId,
      orderItemId: null,
      status: statusRaw,
      contentMassValue,
      contentMassUnit,
      totalVolumeValue,
      totalVolumeUnit: totalVolumeValue != null ? totalVolumeUnit : null,
      concentrationMgPerMl: concentration,
      costUsd,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('vials_one_active_per_formulation_key')) {
      return {
        status: 'error',
        message:
          'An active vial already exists for this formulation. Close/discard it first (or create this vial as planned).',
      }
    }
    return { status: 'error', message: msg }
  }

  revalidatePath('/inventory')
  revalidatePath('/today')
  return { status: 'success', message: 'Created.' }
}

export async function activateVialAction(formData: FormData): Promise<void> {
  const vialId = String(formData.get('vial_id') ?? '').trim()
  if (!vialId) return

  const supabase = await createClient()
  const vial = await getVialById(supabase, { vialId })
  if (!vial) return

  if (vial.status !== 'active') {
    await closeActiveVialsForFormulation(supabase, { formulationId: vial.formulation_id })
    await activateVial(supabase, { vialId, openedAt: new Date().toISOString() })
  }

  revalidatePath('/inventory')
  revalidatePath('/today')
}

export async function closeVialAction(formData: FormData): Promise<void> {
  const vialId = String(formData.get('vial_id') ?? '').trim()
  if (!vialId) return

  const supabase = await createClient()
  const vial = await getVialById(supabase, { vialId })
  if (!vial) return

  if (vial.status !== 'closed') {
    await closeVial(supabase, { vialId, closedAt: new Date().toISOString() })
  }

  revalidatePath('/inventory')
  revalidatePath('/today')
}

export async function discardVialAction(formData: FormData): Promise<void> {
  const vialId = String(formData.get('vial_id') ?? '').trim()
  if (!vialId) return

  const supabase = await createClient()
  const vial = await getVialById(supabase, { vialId })
  if (!vial) return

  if (vial.status !== 'discarded') {
    await discardVial(supabase, { vialId, closedAt: new Date().toISOString() })
  }

  revalidatePath('/inventory')
  revalidatePath('/today')
}

export async function reconcileImportedVialsAction(
  _prev: ReconcileImportedVialsState,
  formData: FormData,
): Promise<ReconcileImportedVialsState> {
  void formData

  const supabase = await createClient()
  const authRes = await supabase.auth.getUser()
  const user = authRes.data.user
  if (!user) return { status: 'error', message: 'Not signed in.' }

  try {
    // If no order-backed vials exist yet, import the user's RETA-PEPTIDE orders/vials first
    // (idempotent; safe to re-run). This makes the reconciliation able to attach costs.
    const countRes = await supabase
      .from('vials')
      .select('id', { count: 'exact', head: true })
      .not('order_item_id', 'is', null)
      .is('deleted_at', null)
    if (countRes.error) throw countRes.error

    if ((countRes.count ?? 0) === 0) {
      const importRes = await importRetaPeptideOrdersAction({ status: 'idle' }, new FormData())
      if (importRes.status === 'error') {
        return { status: 'error', message: importRes.message }
      }
    }

    const res = await reconcileImportedVialsFromTags(supabase)

    revalidatePath('/orders')
    revalidatePath('/inventory')
    revalidatePath('/today')
    revalidatePath('/analytics')

    const warnings = res.warnings ?? []
    const summary = res.summary
    return {
      status: 'success',
      warnings,
      message: `Reconciled imported vial tags. Updated ${summary.updated_events} event(s) and ${summary.updated_vials} vial(s). Active vials set: ${summary.active_vials_set}.`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }
}
