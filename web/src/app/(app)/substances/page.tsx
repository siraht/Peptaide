import Link from 'next/link'

import { CreateSubstanceForm } from './create-substance-form'
import { deleteSubstanceAction } from './actions'

import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function SubstancesPage() {
  const supabase = await createClient()
  const substances = await listSubstances(supabase)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Substances</h1>
        <p className="mt-1 text-sm text-zinc-700">
          Reference table for substances you track.
        </p>
      </div>

      <CreateSubstanceForm />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">List</h2>
        {substances.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No substances yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[700px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Display</th>
                  <th className="border-b px-2 py-2 font-medium">Canonical</th>
                  <th className="border-b px-2 py-2 font-medium">Family</th>
                  <th className="border-b px-2 py-2 font-medium">Target</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {substances.map((s) => (
                  <tr key={s.id}>
                    <td className="border-b px-2 py-2 text-zinc-900">
                      <Link className="underline hover:text-zinc-900" href={`/substances/${s.id}`}>
                        {s.display_name}
                      </Link>
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">{s.canonical_name}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{s.family ?? '-'}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {s.target_compartment_default}
                    </td>
                    <td className="border-b px-2 py-2">
                      <form action={deleteSubstanceAction}>
                        <input type="hidden" name="substance_id" value={s.id} />
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
    </div>
  )
}
