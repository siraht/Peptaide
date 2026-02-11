import { CreateVialForm } from './create-vial-form'
import { activateVialAction, closeVialAction, discardVialAction } from './actions'
import { ReconcileImportedVialsForm } from './reconcile-imported-vials-form'

import { EmptyState } from '@/components/ui/empty-state'
import { listInventoryStatus } from '@/lib/repos/inventoryStatusRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listOrderItems } from '@/lib/repos/orderItemsRepo'
import { listOrders } from '@/lib/repos/ordersRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { listVendors } from '@/lib/repos/vendorsRepo'
import { createClient } from '@/lib/supabase/server'
import { buildVialOrderItemLinkOptions } from '@/lib/inventory/vialOrderItemLinkOptions'

export default async function InventoryPage() {
  const supabase = await createClient()

  const [formulations, inventory, orders, orderItems, substances, vendors] = await Promise.all([
    listFormulationsEnriched(supabase),
    listInventoryStatus(supabase),
    listOrders(supabase),
    listOrderItems(supabase),
    listSubstances(supabase),
    listVendors(supabase),
  ])

  const formulationOptions = formulations.map((f) => {
    const substance = f.substance?.display_name ?? 'Unknown substance'
    const route = f.route?.name ?? 'Unknown route'
    return { id: f.formulation.id, label: `${substance} / ${route} / ${f.formulation.name}` }
  })
  const orderItemLinkOptions = buildVialOrderItemLinkOptions({
    orders,
    orderItems,
    vendors,
    substances,
    formulations,
  })

  return (
    <div className="h-full overflow-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Inventory</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Vials and basic runway estimates.</p>
      </div>

      <ReconcileImportedVialsForm />

      {formulationOptions.length === 0 ? (
        <EmptyState
          icon="inventory_2"
          title="Vials need formulations"
          description="Create at least one formulation before creating vials."
          actionHref="/formulations"
          actionLabel="Open formulations"
        />
      ) : (
        <CreateVialForm formulations={formulationOptions} orderItemLinks={orderItemLinkOptions} />
      )}

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
