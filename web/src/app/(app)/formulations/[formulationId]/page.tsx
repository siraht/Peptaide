import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CreateFormulationComponentForm } from './create-component-form'
import { deleteFormulationComponentAction } from './actions'

import { listDistributions } from '@/lib/repos/distributionsRepo'
import { listFormulationComponents } from '@/lib/repos/formulationComponentsRepo'
import { getFormulationEnrichedById } from '@/lib/repos/formulationsRepo'
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

export default async function FormulationDetailPage({
  params,
}: {
  params: { formulationId: string }
}) {
  const { formulationId } = params

  const supabase = await createClient()

  const [formulationEnriched, components, dists] = await Promise.all([
    getFormulationEnrichedById(supabase, { formulationId }),
    listFormulationComponents({ supabase, formulationId }),
    listDistributions(supabase),
  ])

  if (!formulationEnriched) {
    notFound()
  }

  const multiplierDists = dists.filter((d) => d.value_type === 'multiplier')
  const distById = new Map(dists.map((d) => [d.id, d]))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{formulationEnriched.formulation.name}</h1>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
            {formulationEnriched.substance?.display_name ?? 'Unknown substance'}
          </span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
            {formulationEnriched.route?.name ?? 'Unknown route'}
          </span>
          {formulationEnriched.device ? (
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
              {formulationEnriched.device.name}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-zinc-700">
          <Link className="underline hover:text-zinc-900" href="/formulations">
            Back to list
          </Link>
        </p>
      </div>

      <CreateFormulationComponentForm
        formulationId={formulationId}
        multiplierDistributions={multiplierDists}
      />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Components</h2>
        {components.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No components yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Name</th>
                  <th className="border-b px-2 py-2 font-medium">Role</th>
                  <th className="border-b px-2 py-2 font-medium">Modifier</th>
                  <th className="border-b px-2 py-2 font-medium">Params</th>
                  <th className="border-b px-2 py-2 font-medium">Notes</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {components.map((c) => {
                  const dist = c.modifier_dist_id ? distById.get(c.modifier_dist_id) ?? null : null
                  return (
                    <tr key={c.id}>
                      <td className="border-b px-2 py-2 text-zinc-900">{c.component_name}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{c.role ?? '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {dist ? (
                          <>
                            {dist.name}{' '}
                            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
                              {dist.dist_type}
                            </span>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">{dist ? summarizeDist(dist) : '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{c.notes ?? '-'}</td>
                      <td className="border-b px-2 py-2">
                        <form action={deleteFormulationComponentAction}>
                          <input type="hidden" name="formulation_id" value={formulationId} />
                          <input type="hidden" name="component_id" value={c.id} />
                          <button className="text-sm text-red-700" type="submit">
                            Delete
                          </button>
                        </form>
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

