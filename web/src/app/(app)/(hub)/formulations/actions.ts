'use server'

import { revalidatePath } from 'next/cache'

import { createFormulation } from '@/lib/repos/formulationsRepo'
import { toUserFacingDbErrorMessage } from '@/lib/errors/userFacingDbError'
import { createClient } from '@/lib/supabase/server'

export type FormulationSelectOption = { id: string; label: string }

export type CreateFormulationState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'success'
      message: string
      createdFormulationId?: string
      createdSubstanceId?: string
      returnTo?: string
    }

export type BulkAddFormulationsState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'success'
      message: string
      createdCount: number
      errors: string[]
    }

const ALLOWED_FORMULATION_RETURN_PATHS = new Set(['/inventory', '/setup/inventory'])

function sanitizeReturnToPath(raw: string): string | null {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null

  try {
    const url = new URL(raw, 'http://localhost')
    if (!ALLOWED_FORMULATION_RETURN_PATHS.has(url.pathname)) return null
    return url.pathname
  } catch {
    return null
  }
}

export async function createFormulationAction(
  _prev: CreateFormulationState,
  formData: FormData,
): Promise<CreateFormulationState> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const routeId = String(formData.get('route_id') ?? '').trim()
  const deviceIdRaw = String(formData.get('device_id') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const isDefaultForRoute = String(formData.get('is_default_for_route') ?? '') === 'on'
  const notes = String(formData.get('notes') ?? '').trim()
  const returnTo = sanitizeReturnToPath(String(formData.get('return_to') ?? '').trim())

  if (!substanceId) return { status: 'error', message: 'substance is required.' }
  if (!routeId) return { status: 'error', message: 'route is required.' }
  if (!name) return { status: 'error', message: 'name is required.' }

  const supabase = await createClient()
  let createdFormulationId = ''

  try {
    const created = await createFormulation(supabase, {
      substanceId,
      routeId,
      deviceId: deviceIdRaw ? deviceIdRaw : null,
      name,
      isDefaultForRoute,
      notes: notes || null,
    })
    createdFormulationId = created.id
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', message: toUserFacingDbErrorMessage(msg) ?? msg }
  }

  revalidatePath('/formulations')
  revalidatePath('/inventory')
  revalidatePath('/setup/inventory')

  return {
    status: 'success',
    message: 'Created.',
    createdFormulationId,
    createdSubstanceId: substanceId,
    returnTo: returnTo ?? undefined,
  }
}

export async function bulkAddFormulationsAction(
  _prev: BulkAddFormulationsState,
  formData: FormData,
): Promise<BulkAddFormulationsState> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  const routeId = String(formData.get('route_id') ?? '').trim()
  const deviceIdRaw = String(formData.get('device_id') ?? '').trim()
  const raw = String(formData.get('lines') ?? '')

  if (!substanceId) return { status: 'error', message: 'substance is required.' }
  if (!routeId) return { status: 'error', message: 'route is required.' }

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  if (lines.length === 0) {
    return { status: 'error', message: 'Paste one or more lines first.' }
  }
  if (lines.length > 200) {
    return { status: 'error', message: 'Too many lines (max 200 per bulk add).' }
  }

  const supabase = await createClient()

  let createdCount = 0
  const errors: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const name = lines[i]!
    try {
      await createFormulation(supabase, {
        substanceId,
        routeId,
        deviceId: deviceIdRaw ? deviceIdRaw : null,
        name,
        isDefaultForRoute: false,
        notes: null,
      })
      createdCount++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Line ${i + 1} (${name}): ${toUserFacingDbErrorMessage(msg) ?? msg}`)
    }
  }

  if (createdCount > 0) {
    revalidatePath('/formulations')
  }

  const createdPart =
    createdCount === 0
      ? 'No formulations created'
      : `Created ${createdCount} formulation${createdCount === 1 ? '' : 's'}`
  const errorSuffix =
    errors.length > 0 ? ` (${errors.length} error${errors.length === 1 ? '' : 's'})` : ''

  return {
    status: 'success',
    message: `${createdPart}${errorSuffix}.`,
    createdCount,
    errors,
  }
}
