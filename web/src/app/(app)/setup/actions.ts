'use server'

import { revalidatePath } from 'next/cache'

import { setBioavailabilitySpec } from '@/lib/repos/bioavailabilitySpecsRepo'
import { createDeviceCalibration } from '@/lib/repos/deviceCalibrationsRepo'
import { setFormulationModifierSpec } from '@/lib/repos/formulationModifierSpecsRepo'
import { normalizeDeviceUnitLabel } from '@/lib/domain/units/types'
import { toUserFacingDbErrorMessage } from '@/lib/errors/userFacingDbError'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type SetupSetBioavailabilitySpecState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export type SetupCreateDeviceCalibrationState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export type SetupSetFormulationModifierSpecState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function isCompartment(
  x: string,
): x is Extract<Database['public']['Enums']['compartment_t'], 'systemic' | 'cns'> {
  return x === 'systemic' || x === 'cns'
}

function isModifierCompartment(
  x: string,
): x is Database['public']['Enums']['compartment_t'] {
  return x === 'systemic' || x === 'cns' || x === 'both'
}

export async function setupSetBioavailabilitySpecAction(
  _prev: SetupSetBioavailabilitySpecState,
  formData: FormData,
): Promise<SetupSetBioavailabilitySpecState> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const routeId = String(formData.get('route_id') ?? '').trim()
  const compartmentRaw = String(formData.get('compartment') ?? '').trim()
  const baseFractionDistId = String(formData.get('base_fraction_dist_id') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const evidenceSourceIdRaw = String(formData.get('evidence_source_id') ?? '').trim()

  if (!substanceId) return { status: 'error', message: 'substance_id is required.' }
  if (!routeId) return { status: 'error', message: 'route_id is required.' }
  if (!isCompartment(compartmentRaw)) return { status: 'error', message: 'Invalid compartment.' }
  if (!baseFractionDistId) return { status: 'error', message: 'base_fraction_dist_id is required.' }

  const supabase = await createClient()

  try {
    await setBioavailabilitySpec(supabase, {
      substanceId,
      routeId,
      compartment: compartmentRaw,
      baseFractionDistId,
      notes: notes || null,
      evidenceSourceId: evidenceSourceIdRaw ? evidenceSourceIdRaw : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath('/setup')
  revalidatePath('/today')
  revalidatePath(`/substances/${substanceId}`)
  return { status: 'success', message: 'Saved.' }
}

export async function setupCreateDeviceCalibrationAction(
  _prev: SetupCreateDeviceCalibrationState,
  formData: FormData,
): Promise<SetupCreateDeviceCalibrationState> {
  const deviceId = String(formData.get('device_id') ?? '').trim()
  const routeId = String(formData.get('route_id') ?? '').trim()
  const unitLabelRaw = String(formData.get('unit_label') ?? '').trim()
  const volumeDistId = String(formData.get('volume_ml_per_unit_dist_id') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!deviceId) return { status: 'error', message: 'device_id is required.' }
  if (!routeId) return { status: 'error', message: 'route_id is required.' }
  if (!unitLabelRaw) return { status: 'error', message: 'unit_label is required.' }
  if (!volumeDistId) {
    return {
      status: 'error',
      message: 'volume_ml_per_unit_dist_id is required (create a volume_ml_per_unit distribution first).',
    }
  }

  const unitLabel = normalizeDeviceUnitLabel(unitLabelRaw)
  if (!unitLabel) return { status: 'error', message: 'unit_label is required.' }

  const supabase = await createClient()

  try {
    await createDeviceCalibration(supabase, {
      deviceId,
      routeId,
      unitLabel,
      volumeMlPerUnitDistId: volumeDistId,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath('/setup')
  revalidatePath('/today')
  revalidatePath(`/devices/${deviceId}`)
  return { status: 'success', message: 'Created.' }
}

export async function setupSetFormulationModifierSpecAction(
  _prev: SetupSetFormulationModifierSpecState,
  formData: FormData,
): Promise<SetupSetFormulationModifierSpecState> {
  const formulationId = String(formData.get('formulation_id') ?? '').trim()
  const compartmentRaw = String(formData.get('compartment') ?? '').trim()
  const multiplierDistId = String(formData.get('multiplier_dist_id') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!formulationId) return { status: 'error', message: 'formulation_id is required.' }
  if (!isModifierCompartment(compartmentRaw)) return { status: 'error', message: 'Invalid compartment.' }
  if (!multiplierDistId) return { status: 'error', message: 'multiplier_dist_id is required.' }

  const supabase = await createClient()

  try {
    await setFormulationModifierSpec(supabase, {
      formulationId,
      compartment: compartmentRaw,
      multiplierDistId,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath('/setup')
  revalidatePath('/today')
  revalidatePath(`/formulations/${formulationId}`)
  return { status: 'success', message: 'Saved.' }
}
