import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type BioavailabilitySpecRow =
  Database['public']['Tables']['bioavailability_specs']['Row']

export async function listBioavailabilitySpecsForSubstance(opts: {
  supabase: DbClient
  substanceId: string
}): Promise<BioavailabilitySpecRow[]> {
  const { supabase, substanceId } = opts

  const res = await supabase
    .from('bioavailability_specs')
    .select('*')
    .eq('substance_id', substanceId)
    .is('deleted_at', null)
    .order('route_id', { ascending: true })
    .order('compartment', { ascending: true })

  return requireData(res.data, res.error, 'bioavailability_specs.select_for_substance')
}

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

export async function setBioavailabilitySpec(
  supabase: DbClient,
  opts: {
    substanceId: string
    routeId: string
    compartment: Extract<Database['public']['Enums']['compartment_t'], 'systemic' | 'cns'>
    baseFractionDistId: string
    notes: string | null
    evidenceSourceId: string | null
  },
): Promise<BioavailabilitySpecRow> {
  const { substanceId, routeId, compartment, baseFractionDistId, notes, evidenceSourceId } = opts

  const insertRes = await supabase
    .from('bioavailability_specs')
    .insert({
      substance_id: substanceId,
      route_id: routeId,
      compartment,
      base_fraction_dist_id: baseFractionDistId,
      notes,
      evidence_source_id: evidenceSourceId,
    })
    .select('*')
    .single()

  // If the unique constraint already exists, update in-place (and clear deleted_at if it was soft-deleted).
  if (insertRes.error?.code === '23505') {
    const updateRes = await supabase
      .from('bioavailability_specs')
      .update({
        base_fraction_dist_id: baseFractionDistId,
        notes,
        evidence_source_id: evidenceSourceId,
        deleted_at: null,
      })
      .eq('substance_id', substanceId)
      .eq('route_id', routeId)
      .eq('compartment', compartment)
      .select('*')
      .single()

    return requireData(updateRes.data, updateRes.error, 'bioavailability_specs.update')
  }

  return requireData(insertRes.data, insertRes.error, 'bioavailability_specs.insert')
}
