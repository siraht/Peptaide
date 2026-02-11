import { CreateVialForm } from './create-vial-form'
import { activateVialAction, closeVialAction, discardVialAction } from './actions'
import { ReconcileImportedVialsForm } from './reconcile-imported-vials-form'

import { CompactEntryModule } from '@/components/ui/compact-entry-module'
import { EmptyState } from '@/components/ui/empty-state'
import { MetricsStrip } from '@/components/ui/metrics-strip'
import { listInventoryStatus } from '@/lib/repos/inventoryStatusRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { createClient } from '@/lib/supabase/server'

function fmtCount(n: number): string {
  return new Intl.NumberFormat().format(n)
}

export default async function InventoryPage() {
  const supabase = await createClient()

  const [formulations, inventory] = await Promise.all([
    listFormulationsEnriched(supabase),
    listInventoryStatus(supabase),
  ])

  const formulationOptions = formulations.map((f) => {
    const substance = f.substance?.display_name ?? 'Unknown substance'
    const route = f.route?.name ?? 'Unknown route'
    return { id: f.formulation.id, label: `${substance} / ${route} / ${f.formulation.name}` }
  })

  let planned = 0
  let active = 0
  let closed = 0
  let discarded = 0

  for (const v of inventory) {
    if (v.status === 'planned') planned += 1
    else if (v.status === 'active') active += 1
    else if (v.status === 'closed') closed += 1
    else if (v.status === 'discarded') discarded += 1
  }

  return (
    <div className="h-full overflow-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6 custom-scrollbar" data-e2e="inventory-root">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Inventory</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Vials and basic runway estimates.</p>
      </div>

      <MetricsStrip
        items={[
          {
            label: 'Total vials',
            value: fmtCount(inventory.length),
            detail: `${fmtCount(active)} active, ${fmtCount(planned)} planned`,
            tone: inventory.length > 0 ? 'good' : 'warn',
          },
          {
            label: 'Closed / discarded',
            value: `${fmtCount(closed)} / ${fmtCount(discarded)}`,
            detail: 'Lifecycle outcomes from inventory operations.',
          },
          {
            label: 'Formulations',
            value: fmtCount(formulationOptions.length),
            detail: formulationOptions.length > 0 ? 'Available for manual vial entry.' : 'Create formulations first.',
            tone: formulationOptions.length > 0 ? 'good' : 'warn',
          },
        ]}
      />

      <CompactEntryModule
        id="inventory-reconcile-imported"
        title="Reconcile imported vials"
        description="Map imported vial records to existing formulations with a single submission."
        summaryItems={[
          { label: 'Current vials', value: fmtCount(inventory.length), tone: inventory.length > 0 ? 'good' : 'neutral' },
          { label: 'Known formulations', value: fmtCount(formulationOptions.length), tone: formulationOptions.length > 0 ? 'good' : 'warn' },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.inventory.reconcile"
      >
        <ReconcileImportedVialsForm />
      </CompactEntryModule>

      <CompactEntryModule
        id="inventory-add-vial"
        title="Add vial"
        description="Create a new vial manually when it is not coming from order-item generation."
        summaryItems={[
          { label: 'Formulation options', value: fmtCount(formulationOptions.length), tone: formulationOptions.length > 0 ? 'good' : 'warn' },
          { label: 'Active vials', value: fmtCount(active), tone: active > 0 ? 'good' : 'neutral' },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.inventory.add-vial"
        emptyCta={
          formulationOptions.length === 0
            ? { href: '/formulations', label: 'Create a formulation first' }
            : undefined
        }
      >
        {formulationOptions.length === 0 ? (
          <EmptyState
            icon="inventory_2"
            title="Vials need formulations"
            description="Create at least one formulation before creating vials."
            actionHref="/formulations"
            actionLabel="Open formulations"
          />
        ) : (
          <CreateVialForm formulations={formulationOptions} />
        )}
      </CompactEntryModule>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Vials</h2>
        {inventory.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="science"
            title="No vials yet"
            description="Create a vial here or generate planned vials from Orders."
            actionHref="/orders"
            actionLabel="Open orders"
            secondaryHref="/inventory"
            secondaryLabel="Add vial"
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1200px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Substance</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Formulation</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Route</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Vial</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Status</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Content</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Volume</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Conc (mg/mL)</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Remaining mg</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Runway days</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Cost USD</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((v) => (
                  <tr key={v.vial_id}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">{v.substance_name}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{v.formulation_name}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{v.route_name}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 font-mono text-slate-600 dark:text-slate-400">{v.lot ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{v.status}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                      {v.content_mass_value} {v.content_mass_unit}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                      {v.total_volume_value != null ? `${v.total_volume_value} ${v.total_volume_unit}` : '-'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">
                      {v.concentration_mg_per_ml_effective ?? '-'}
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{v.remaining_mass_mg ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{v.runway_days_estimate_mg ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{v.cost_usd ?? '-'}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2">
                      {v.status === 'planned' ? (
                        <div className="flex flex-wrap gap-3">
                          <form action={activateVialAction}>
                            <input type="hidden" name="vial_id" value={v.vial_id ?? ''} />
                            <button className="text-sm text-slate-600 dark:text-slate-400 underline hover:text-primary" type="submit">
                              Activate
                            </button>
                          </form>
                          <form action={discardVialAction}>
                            <input type="hidden" name="vial_id" value={v.vial_id ?? ''} />
                            <button className="text-sm text-red-600 dark:text-red-400 underline hover:text-red-700 dark:hover:text-red-300" type="submit">
                              Discard
                            </button>
                          </form>
                        </div>
                      ) : v.status === 'active' ? (
                        <div className="flex flex-wrap gap-3">
                          <form action={closeVialAction}>
                            <input type="hidden" name="vial_id" value={v.vial_id ?? ''} />
                            <button className="text-sm text-slate-600 dark:text-slate-400 underline hover:text-primary" type="submit">
                              Close
                            </button>
                          </form>
                          <form action={discardVialAction}>
                            <input type="hidden" name="vial_id" value={v.vial_id ?? ''} />
                            <button className="text-sm text-red-600 dark:text-red-400 underline hover:text-red-700 dark:hover:text-red-300" type="submit">
                              Discard
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">-</span>
                      )}
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
