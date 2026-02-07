'use server'

import { revalidatePath } from 'next/cache'

import {
  createFormulationComponent,
  softDeleteFormulationComponent,
} from '@/lib/repos/formulationComponentsRepo'
import {
  setComponentModifierSpec,
  softDeleteComponentModifierSpec,
} from '@/lib/repos/componentModifierSpecsRepo'
import { toUserFacingDbErrorMessage } from '@/lib/errors/userFacingDbError'
import { createClient } from '@/lib/supabase/server'

export type CreateFormulationComponentState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export async function createFormulationComponentAction(
  _prev: CreateFormulationComponentState,
  formData: FormData,
): Promise<CreateFormulationComponentState> {
  const formulationId = String(formData.get('formulation_id') ?? '').trim()
  const componentName = String(formData.get('component_name') ?? '').trim()
  const role = String(formData.get('role') ?? '').trim()
  const modifierDistId = String(formData.get('modifier_dist_id') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!formulationId) return { status: 'error', message: 'Missing formulation_id.' }
  if (!componentName) return { status: 'error', message: 'component_name is required.' }

  const supabase = await createClient()

  try {
    await createFormulationComponent(supabase, {
      formulationId,
      componentName,
      role: role || null,
      modifierDistId: modifierDistId || null,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath(`/formulations/${formulationId}`)
  return { status: 'success', message: 'Created.' }
}

export async function deleteFormulationComponentAction(formData: FormData): Promise<void> {
  const formulationId = String(formData.get('formulation_id') ?? '').trim()
  const componentId = String(formData.get('component_id') ?? '').trim()
  if (!formulationId || !componentId) return

  const supabase = await createClient()
  await softDeleteFormulationComponent(supabase, { componentId })
  revalidatePath(`/formulations/${formulationId}`)
}

export type SetComponentModifierSpecState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

function isCompartment(x: string): x is 'systemic' | 'cns' | 'both' {
  return x === 'systemic' || x === 'cns' || x === 'both'
}

export async function setComponentModifierSpecAction(
  _prev: SetComponentModifierSpecState,
  formData: FormData,
): Promise<SetComponentModifierSpecState> {
  const formulationId = String(formData.get('formulation_id') ?? '').trim()
  const componentId = String(formData.get('formulation_component_id') ?? '').trim()
  const compartmentRaw = String(formData.get('compartment') ?? '').trim()
  const multiplierDistId = String(formData.get('multiplier_dist_id') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!formulationId) return { status: 'error', message: 'Missing formulation_id.' }
  if (!componentId) return { status: 'error', message: 'Missing formulation_component_id.' }
  if (!isCompartment(compartmentRaw)) {
    return { status: 'error', message: 'compartment must be one of: systemic, cns, both.' }
  }
  if (!multiplierDistId) return { status: 'error', message: 'multiplier_dist_id is required.' }

  const supabase = await createClient()

  try {
    await setComponentModifierSpec(supabase, {
      formulationComponentId: componentId,
      compartment: compartmentRaw,
      multiplierDistId,
      notes: notes || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath(`/formulations/${formulationId}`)
  return { status: 'success', message: 'Saved.' }
}

export async function deleteComponentModifierSpecAction(formData: FormData): Promise<void> {
  const formulationId = String(formData.get('formulation_id') ?? '').trim()
  const specId = String(formData.get('component_modifier_spec_id') ?? '').trim()
  if (!formulationId || !specId) return

  const supabase = await createClient()
  await softDeleteComponentModifierSpec(supabase, { componentModifierSpecId: specId })
  revalidatePath(`/formulations/${formulationId}`)
}
