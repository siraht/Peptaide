'use server'

import { revalidatePath } from 'next/cache'

import { toCanonicalMassMg, toCanonicalVolumeMl } from '@/lib/domain/units/canonicalize'
import { createVial, closeActiveVialsForFormulation } from '@/lib/repos/vialsRepo'
import { getFormulationEnrichedById } from '@/lib/repos/formulationsRepo'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type CreateVialState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function isVialStatus(x: string): x is Database['public']['Enums']['vial_status_t'] {
  return x === 'planned' || x === 'active' || x === 'closed' || x === 'discarded'
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const x = Number(t)
  if (!Number.isFinite(x)) return null
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

  const totalVolumeValue = parseOptionalNumber(totalVolumeValueRaw)
  const costUsd = parseOptionalNumber(costUsdRaw)

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
    return { status: 'error', message: msg }
  }

  revalidatePath('/inventory')
  revalidatePath('/today')
  return { status: 'success', message: 'Created.' }
}
