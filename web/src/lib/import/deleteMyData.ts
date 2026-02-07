import { requireOk } from '@/lib/repos/errors'
import type { DbClient } from '@/lib/repos/types'

import type { ExportTableName } from '@/lib/export/exportColumns'

const DELETE_ORDER: readonly ExportTableName[] = [
  // Leaf tables first.
  'event_revisions',
  'administration_events',
  'component_modifier_specs',
  'formulation_modifier_specs',
  'bioavailability_specs',
  'substance_recommendations',
  'substance_aliases',
  'formulation_components',
  'device_calibrations',
  'vials',
  'order_items',
  'orders',
  'vendors',
  'cycle_instances',
  'cycle_rules',
  'formulations',
  'devices',
  'routes',
  'substances',
  'evidence_sources',
  'distributions',
  // Profiles last.
  'profiles',
]

export async function deleteAllMyData(
  supabase: DbClient,
  opts: { userId: string },
): Promise<void> {
  for (const table of DELETE_ORDER) {
    const res = await supabase.from(table).delete().eq('user_id', opts.userId)
    requireOk(res.error, `${table}.delete_all`)
  }
}
