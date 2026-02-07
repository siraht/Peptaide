'use server'

import { revalidatePath } from 'next/cache'

import {
  createFormulationComponent,
  softDeleteFormulationComponent,
} from '@/lib/repos/formulationComponentsRepo'
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
    return { status: 'error', message: msg }
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

