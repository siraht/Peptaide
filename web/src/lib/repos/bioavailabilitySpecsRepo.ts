import type { DbClient } from './types'
import { requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type BioavailabilitySpecRow =
  Database['public']['Tables']['bioavailability_specs']['Row']

export async function getBioavailabilitySpec(opts: {
  supabase: DbClient
  substanceId: string
  routeId: string
  compartment: Database['public']['Enums']['compartment_t']
}): Promise<BioavailabilitySpecRow | null> {
  const { supabase, substanceId, routeId, compartment } = opts

  const res = await supabase
    .from('bioavailability_specs')
    .select('*')
    .eq('substance_id', substanceId)
    .eq('route_id', routeId)
    .eq('compartment', compartment)
    .is('deleted_at', null)
    .maybeSingle()

  requireOk(res.error, 'bioavailability_specs.select')
  return res.data
}

