import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ComponentModifierSpecForm } from './component-modifier-spec-form'
import { CreateFormulationComponentForm } from './create-component-form'
import { deleteComponentModifierSpecAction, deleteFormulationComponentAction } from './actions'

import { listDistributions } from '@/lib/repos/distributionsRepo'
import { listComponentModifierSpecs } from '@/lib/repos/componentModifierSpecsRepo'
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
  params: Promise<{ formulationId: string }>
}) {
  const { formulationId } = await params

  const supabase = await createClient()

  const [formulationEnriched, components, dists] = await Promise.all([
    getFormulationEnrichedById(supabase, { formulationId }),
    listFormulationComponents({ supabase, formulationId }),
    listDistributions(supabase),
  ])

  if (!formulationEnriched) {
    notFound()
  }

  const componentSpecs = await listComponentModifierSpecs({
    supabase,
    formulationComponentIds: components.map((c) => c.id),
    compartments: ['systemic', 'cns', 'both'],
  })

  const multiplierDists = dists.filter((d) => d.value_type === 'multiplier')
  const distById = new Map(dists.map((d) => [d.id, d]))
  const componentById = new Map(components.map((c) => [c.id, c] as const))

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

      <ComponentModifierSpecForm
        formulationId={formulationId}
        components={components}
        multiplierDistributions={multiplierDists}
      />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Component modifier specs (saved)</h2>
        {componentSpecs.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No per-compartment component modifier specs yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[950px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Component</th>
                  <th className="border-b px-2 py-2 font-medium">Compartment</th>
                  <th className="border-b px-2 py-2 font-medium">Multiplier</th>
                  <th className="border-b px-2 py-2 font-medium">Params</th>
                  <th className="border-b px-2 py-2 font-medium">Notes</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {componentSpecs.map((s) => {
                  const c = componentById.get(s.formulation_component_id) ?? null
                  const dist = distById.get(s.multiplier_dist_id) ?? null
                  return (
                    <tr key={s.id}>
                      <td className="border-b px-2 py-2 text-zinc-900">{c?.component_name ?? '(component)'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{s.compartment}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">
                        {dist ? (
                          <>
                            {dist.name}{' '}
                            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
                              {dist.dist_type}
                            </span>
                          </>
                        ) : (
                          '(missing dist)'
                        )}
                      </td>
                      <td className="border-b px-2 py-2 text-zinc-700">{dist ? summarizeDist(dist) : '-'}</td>
                      <td className="border-b px-2 py-2 text-zinc-700">{s.notes ?? '-'}</td>
                      <td className="border-b px-2 py-2">
                        <form action={deleteComponentModifierSpecAction}>
                          <input type="hidden" name="formulation_id" value={formulationId} />
                          <input type="hidden" name="component_modifier_spec_id" value={s.id} />
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
