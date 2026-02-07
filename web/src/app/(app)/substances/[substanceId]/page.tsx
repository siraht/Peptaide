import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BaseBioavailabilitySpecForm } from './base-ba-form'
import { deleteSubstanceRecommendationAction } from './actions'
import { SubstanceRecommendationsForm } from './recommendations-form'

import { listBioavailabilitySpecsForSubstance } from '@/lib/repos/bioavailabilitySpecsRepo'
import { listDistributions } from '@/lib/repos/distributionsRepo'
import { listEvidenceSources } from '@/lib/repos/evidenceSourcesRepo'
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
  params: { substanceId: string }
}) {
  const { substanceId } = params

  const supabase = await createClient()

  const [substance, routes, dists, evidenceSources, specs, recs] = await Promise.all([
    getSubstanceById(supabase, { substanceId }),
    listRoutes(supabase),
    listDistributions(supabase),
    listEvidenceSources(supabase),
    listBioavailabilitySpecsForSubstance({ supabase, substanceId }),
    listSubstanceRecommendationsForSubstance(supabase, { substanceId }),
  ])

  if (!substance) {
    notFound()
  }

  const fractionDists = dists.filter((d) => d.value_type === 'fraction')
  const routeById = new Map(routes.map((r) => [r.id, r]))
  const distById = new Map(dists.map((d) => [d.id, d]))
  const evidenceById = new Map(evidenceSources.map((e) => [e.id, e]))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{substance.display_name}</h1>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
            {substance.canonical_name}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-700">
          <Link className="underline hover:text-zinc-900" href="/substances">
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

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Recommendations</h2>
        {recs.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No recommendations yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Category</th>
                  <th className="border-b px-2 py-2 font-medium">Route</th>
                  <th className="border-b px-2 py-2 font-medium">Range</th>
                  <th className="border-b px-2 py-2 font-medium">Unit</th>
                  <th className="border-b px-2 py-2 font-medium">Notes</th>
                  <th className="border-b px-2 py-2 font-medium">Evidence</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.id}>
                    <td className="border-b px-2 py-2 text-zinc-900">{r.category}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {r.route_id ? routeById.get(r.route_id)?.name ?? r.route_id : '-'}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {fmtRange(
                        r.min_value == null ? null : Number(r.min_value),
                        r.max_value == null ? null : Number(r.max_value),
                      )}
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">{r.unit}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{r.notes ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {r.evidence_source_id ? (
                        (() => {
                          const e = evidenceById.get(r.evidence_source_id)
                          return e ? `${e.source_type}: ${e.citation}` : r.evidence_source_id
                        })()
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border-b px-2 py-2">
                      <form action={deleteSubstanceRecommendationAction}>
                        <input type="hidden" name="substance_id" value={substanceId} />
                        <input type="hidden" name="recommendation_id" value={r.id} />
                        <button className="text-sm text-red-700" type="submit">
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

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Base BA specs</h2>
        {specs.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No specs for this substance yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Route</th>
                  <th className="border-b px-2 py-2 font-medium">Compartment</th>
                  <th className="border-b px-2 py-2 font-medium">Distribution</th>
                  <th className="border-b px-2 py-2 font-medium">Params</th>
                  <th className="border-b px-2 py-2 font-medium">Notes</th>
                  <th className="border-b px-2 py-2 font-medium">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((s) => {
                  const route = routeById.get(s.route_id)
                  const dist = distById.get(s.base_fraction_dist_id)
                  return (
                    <tr key={s.id}>
                      <td className="border-b px-2 py-2 text-zinc-900">{route?.name ?? s.route_id}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{s.compartment}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {dist?.name ?? s.base_fraction_dist_id}
                        {dist ? (
                          <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
                            {dist.dist_type}
                          </span>
                        ) : null}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {dist ? summarizeDist(dist) : '-'}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">{s.notes ?? '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">
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
