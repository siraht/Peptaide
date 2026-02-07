import { CreateRouteForm } from './create-route-form'
import { BulkAddRoutesForm } from './bulk-add-routes-form'
import { deleteRouteAction } from './actions'

import { listRoutes } from '@/lib/repos/routesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function RoutesPage() {
  const supabase = await createClient()
  const routes = await listRoutes(supabase)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Routes</h1>
        <p className="mt-1 text-sm text-zinc-700">Reference table for administration routes.</p>
      </div>

      <CreateRouteForm />

      <BulkAddRoutesForm />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">List</h2>
        {routes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No routes yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[800px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Name</th>
                  <th className="border-b px-2 py-2 font-medium">Default kind</th>
                  <th className="border-b px-2 py-2 font-medium">Default unit</th>
                  <th className="border-b px-2 py-2 font-medium">Device calibration</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id}>
                    <td className="border-b px-2 py-2 text-zinc-900">{r.name}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{r.default_input_kind}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{r.default_input_unit}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">
                      {r.supports_device_calibration ? 'yes' : 'no'}
                    </td>
                    <td className="border-b px-2 py-2">
                      <form action={deleteRouteAction}>
                        <input type="hidden" name="route_id" value={r.id} />
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
