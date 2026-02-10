import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BaseBioavailabilitySpecForm } from './base-ba-form'
import { deleteSubstanceRecommendationAction } from './actions'
import { CycleRuleForm } from './cycle-rule-form'
import { SubstanceRecommendationsForm } from './recommendations-form'

import { listBioavailabilitySpecsForSubstance } from '@/lib/repos/bioavailabilitySpecsRepo'
import { getCycleRuleForSubstance } from '@/lib/repos/cyclesRepo'
import { listDistributions } from '@/lib/repos/distributionsRepo'
import { listEvidenceSources } from '@/lib/repos/evidenceSourcesRepo'
import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { listRoutes } from '@/lib/repos/routesRepo'
import { listSubstanceRecommendationsForSubstance } from '@/lib/repos/substanceRecommendationsRepo'
import { getSubstanceById } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

function summarizeDist(dist: {
  dist_type: string
  p1: number | null
  p2: number | null
  p3: number | null
  min_value: number | null
  max_value: number | null
}): string {
  switch (dist.dist_type) {
    case 'point':
      return `value=${dist.p1 ?? '-'}`
    case 'uniform':
      return `[${dist.min_value ?? '-'}, ${dist.max_value ?? '-'}]`
    case 'triangular':
      return `min=${dist.p1 ?? '-'} mode=${dist.p2 ?? '-'} max=${dist.p3 ?? '-'}`
    case 'beta_pert':
      return `min=${dist.p1 ?? '-'} mode=${dist.p2 ?? '-'} max=${dist.p3 ?? '-'}`
    case 'lognormal':
      return `median=${dist.p1 ?? '-'} log_sigma=${dist.p2 ?? '-'}`
    default:
      return '-'
  }
}

function fmtRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return '-'
  if (min != null && max != null) return `${min} - ${max}`
  if (min != null) return `>= ${min}`
  return `<= ${max}`
}

export default async function SubstanceDetailPage({
  params,
}: {
  params: Promise<{ substanceId: string }>
}) {
  const { substanceId } = await params

  const supabase = await createClient()

  const profilePromise = getMyProfile(supabase).then((p) => p ?? ensureMyProfile(supabase))

  const [profile, substance, routes, dists, evidenceSources, specs, recs, cycleRule] = await Promise.all([
    profilePromise,
    getSubstanceById(supabase, { substanceId }),
    listRoutes(supabase),
    listDistributions(supabase),
    listEvidenceSources(supabase),
    listBioavailabilitySpecsForSubstance({ supabase, substanceId }),
    listSubstanceRecommendationsForSubstance(supabase, { substanceId }),
    getCycleRuleForSubstance(supabase, { substanceId }),
  ])

  if (!substance) {
    notFound()
  }

  const fractionDists = dists.filter((d) => d.value_type === 'fraction')
  const routeById = new Map(routes.map((r) => [r.id, r]))
  const distById = new Map(dists.map((d) => [d.id, d]))
  const evidenceById = new Map(evidenceSources.map((e) => [e.id, e]))

  return (
    <div className="h-full overflow-auto p-6 space-y-6 custom-scrollbar">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{substance.display_name}</h1>
          <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-200">
            {substance.canonical_name}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          <Link className="underline hover:text-primary" href="/substances">
            Back to list
          </Link>
        </p>
      </div>

      <BaseBioavailabilitySpecForm
        substanceId={substanceId}
        routes={routes}
        fractionDistributions={fractionDists}
        evidenceSources={evidenceSources}
      />

      <SubstanceRecommendationsForm substanceId={substanceId} routes={routes} evidenceSources={evidenceSources} />

      <CycleRuleForm
        substanceId={substanceId}
        cycleRule={cycleRule}
        profileGapDefaultDays={profile.cycle_gap_default_days}
      />

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recommendations</h2>
        {recs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No recommendations yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Category</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Route</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Range</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Unit</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Notes</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Evidence</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.id}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">{r.category}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                      {r.route_id ? routeById.get(r.route_id)?.name ?? r.route_id : '-'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                      {fmtRange(
                        r.min_value == null ? null : Number(r.min_value),
                        r.max_value == null ? null : Number(r.max_value),
                      )}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{r.unit}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{r.notes ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                      {r.evidence_source_id ? (
                        (() => {
                          const e = evidenceById.get(r.evidence_source_id)
                          return e ? `${e.source_type}: ${e.citation}` : r.evidence_source_id
                        })()
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2">
                      <form action={deleteSubstanceRecommendationAction}>
                        <input type="hidden" name="substance_id" value={substanceId} />
                        <input type="hidden" name="recommendation_id" value={r.id} />
                        <button className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Base BA specs</h2>
        {specs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No specs for this substance yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Route</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Compartment</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Distribution</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Params</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Notes</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((s) => {
                  const route = routeById.get(s.route_id)
                  const dist = distById.get(s.base_fraction_dist_id)
                  return (
                    <tr key={s.id}>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">{route?.name ?? s.route_id}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{s.compartment}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                        {dist?.name ?? s.base_fraction_dist_id}
                        {dist ? (
                          <span className="ml-2 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-200">
                            {dist.dist_type}
                          </span>
                        ) : null}
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                        {dist ? summarizeDist(dist) : '-'}
                      </td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{s.notes ?? '-'}</td>
                      <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                        {s.evidence_source_id ? (
                          (() => {
                            const e = evidenceById.get(s.evidence_source_id)
                            return e ? `${e.source_type}: ${e.citation}` : s.evidence_source_id
                          })()
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
