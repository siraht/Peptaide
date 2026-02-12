import { CreateRouteForm } from './create-route-form'
import { BulkAddRoutesForm } from './bulk-add-routes-form'
import { deleteRouteAction } from './actions'

import { CompactEntryModule } from '@/components/ui/compact-entry-module'
import { EmptyState } from '@/components/ui/empty-state'
import { MetricsStrip } from '@/components/ui/metrics-strip'
import { listRoutes } from '@/lib/repos/routesRepo'
import { createClient } from '@/lib/supabase/server'

function fmtCount(n: number): string {
  return new Intl.NumberFormat().format(n)
}

export default async function RoutesPage() {
  const supabase = await createClient()
  const routes = await listRoutes(supabase)

  const calibrated = routes.filter((r) => r.supports_device_calibration).length
  const deviceUnitDefaultCount = routes.filter((r) => r.default_input_kind === 'device_units').length
  const uniqueDefaultUnits = new Set(routes.map((r) => r.default_input_unit)).size

  return (
    <div className="h-full overflow-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Routes</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Reference table for administration routes.</p>
      </div>

      <MetricsStrip
        items={[
          {
            label: 'Routes',
            value: fmtCount(routes.length),
            detail: `${fmtCount(calibrated)} calibration-capable`,
            tone: routes.length > 0 ? 'good' : 'warn',
          },
          {
            label: 'Device-unit defaults',
            value: fmtCount(deviceUnitDefaultCount),
            detail: 'Routes configured for device-unit input by default.',
            tone: deviceUnitDefaultCount > 0 ? 'good' : 'neutral',
          },
          {
            label: 'Default unit variants',
            value: fmtCount(uniqueDefaultUnits),
            detail: uniqueDefaultUnits > 0 ? 'Distinct default dose units currently used.' : 'No default unit values yet.',
            tone: uniqueDefaultUnits > 0 ? 'good' : 'warn',
          },
        ]}
      />

      <CompactEntryModule
        id="routes-add-single"
        title="Add route"
        description="Create a single administration route with default input semantics."
        summaryItems={[
          { label: 'Routes', value: fmtCount(routes.length), tone: routes.length > 0 ? 'good' : 'neutral' },
          { label: 'Calibrated', value: fmtCount(calibrated), tone: calibrated > 0 ? 'good' : 'neutral' },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.routes.add-single"
      >
        <CreateRouteForm />
      </CompactEntryModule>

      <CompactEntryModule
        id="routes-bulk-add"
        title="Bulk add routes"
        description="Seed multiple route rows in one submission with shared defaults."
        summaryItems={[
          { label: 'Routes', value: fmtCount(routes.length), tone: routes.length > 0 ? 'good' : 'neutral' },
          { label: 'Device units', value: fmtCount(deviceUnitDefaultCount), tone: deviceUnitDefaultCount > 0 ? 'good' : 'neutral' },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.routes.bulk-add"
      >
        <BulkAddRoutesForm />
      </CompactEntryModule>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">List</h2>
        {routes.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="alt_route"
            title="No routes yet"
            description="Routes define how doses are entered and interpreted."
            actionHref="/routes?focus=new"
            actionLabel="Create route"
          />
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
