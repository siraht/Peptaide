import { randomUUID } from 'node:crypto'

import type { DbClient } from '@/lib/repos/types'

export async function seedMinimalGraph(db: DbClient, userId: string): Promise<{
  substanceId: string
  routeId: string
  formulationId: string
}> {
  const now = new Date().toISOString()

  const substanceId = randomUUID()
  const routeId = randomUUID()
  const formulationId = randomUUID()

  const { error: substanceError } = await db.from('substances').insert({
    id: substanceId,
    user_id: userId,
    canonical_name: `seed_substance_${substanceId.slice(0, 8)}`,
    display_name: `Seed Substance ${substanceId.slice(0, 8)}`,
    family: 'seed',
    target_compartment_default: 'systemic',
    created_at: now,
    updated_at: now,
  })
  if (substanceError) throw new Error(`Seed substances failed: ${substanceError.message}`)

  const { error: routeError } = await db.from('routes').insert({
    id: routeId,
    user_id: userId,
    name: `seed_route_${routeId.slice(0, 8)}`,
    default_input_kind: 'mass',
    default_input_unit: 'mg',
    supports_device_calibration: false,
    created_at: now,
    updated_at: now,
  })
  if (routeError) throw new Error(`Seed routes failed: ${routeError.message}`)

  const { error: formulationError } = await db.from('formulations').insert({
    id: formulationId,
    user_id: userId,
    name: `seed_formulation_${formulationId.slice(0, 8)}`,
    substance_id: substanceId,
    route_id: routeId,
    is_default_for_route: false,
    created_at: now,
    updated_at: now,
  })
  if (formulationError) throw new Error(`Seed formulations failed: ${formulationError.message}`)

  return {
    substanceId,
    routeId,
    formulationId,
  }
}
