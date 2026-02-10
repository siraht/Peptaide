import { CreateRouteForm } from './create-route-form'
import { BulkAddRoutesForm } from './bulk-add-routes-form'
import { deleteRouteAction } from './actions'

import { listRoutes } from '@/lib/repos/routesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function RoutesPage() {
  const supabase = await createClient()
  const routes = await listRoutes(supabase)

  return (
    <div className="h-full overflow-auto p-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Routes</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Reference table for administration routes.</p>
      </div>

      <CreateRouteForm />

      <BulkAddRoutesForm />

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">List</h2>
        {routes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No routes yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[800px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Name</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Default kind</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Default unit</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Device calibration</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">{r.name}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{r.default_input_kind}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{r.default_input_unit}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                      {r.supports_device_calibration ? 'yes' : 'no'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2">
                      <form action={deleteRouteAction}>
                        <input type="hidden" name="route_id" value={r.id} />
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
    </div>
  )
}
