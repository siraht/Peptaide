import type { DbClient } from './types'
import { requireData, requireOk } from './errors'

import type { Database } from '@/lib/supabase/database.types'

export type ModelCoverageRow = Database['public']['Views']['v_model_coverage']['Row']

export async function listModelCoverage(supabase: DbClient): Promise<ModelCoverageRow[]> {
  // Local Supabase can occasionally return "JWT issued at future" immediately after stack resets
  // (container clock skew). Treat it as transient and retry briefly to avoid 500s on /today.
  const maxAttempts = 20

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await supabase
      .from('v_model_coverage')
      .select('*')
      .order('substance_name', { ascending: true })
      .order('formulation_name', { ascending: true })

    if (!res.error) {
      return requireData(res.data, res.error, 'v_model_coverage.select')
    }

    const msg = String(res.error.message || '')
    const isIatFuture = msg.toLowerCase().includes('jwt issued at future')
    if (!isIatFuture) {
      requireOk(res.error, 'v_model_coverage.select')
      return []
    }

    if (attempt === maxAttempts) {
      console.warn('v_model_coverage.select: JWT issued at future persisted after retries; returning empty list', res.error)
      return []
    }

    // Cap the backoff so we wait long enough for clock skew to resolve without making
    // any single request "hang" for too long. Total wait (20 attempts) is ~31s.
    const backoffMs = Math.min(200 * attempt, 2000)
    await new Promise((r) => setTimeout(r, backoffMs))
  }

  // Unreachable (loop always returns), but keep TS happy.
  return []
}
