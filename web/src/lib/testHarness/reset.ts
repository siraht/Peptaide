import type { DbClient } from '@/lib/repos/types'

// Child-first delete order to satisfy FK constraints.
const DELETE_ORDER = [
  'event_revisions',
  'administration_events',
  'component_modifier_specs',
  'formulation_modifier_specs',
  'formulation_components',
  'bioavailability_specs',
  'device_calibrations',
  'substance_recommendations',
  'vials',
  'order_items',
  'orders',
  'vendors',
  'cycle_instances',
  'cycle_rules',
  'formulations',
  'substance_aliases',
  'substances',
  'routes',
  'devices',
  'distributions',
  'evidence_sources',
  'profiles',
] as const

export async function resetUserData(db: DbClient, userId: string): Promise<void> {
  for (const table of DELETE_ORDER) {
    const { error } = await db.from(table).delete().eq('user_id', userId)
    if (error) {
      throw new Error(`Failed clearing ${table} for user ${userId}: ${error.message}`)
    }
  }
}
