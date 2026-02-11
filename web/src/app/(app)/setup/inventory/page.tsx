import Link from 'next/link'

import { CreateVialForm } from '@/app/(app)/(hub)/inventory/create-vial-form'
import { GenerateVialsForm } from '@/app/(app)/(hub)/orders/generate-vials-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listInventoryStatus } from '@/lib/repos/inventoryStatusRepo'
import { listOrders } from '@/lib/repos/ordersRepo'
import { listOrderItems } from '@/lib/repos/orderItemsRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { listVendors } from '@/lib/repos/vendorsRepo'
import { createClient } from '@/lib/supabase/server'

export default async function SetupInventoryPage() {
  const supabase = await createClient()

  const [formulations, inventory, substances, vendors, orders, orderItems] = await Promise.all([
    listFormulationsEnriched(supabase),
    listInventoryStatus(supabase),
    listSubstances(supabase),
    listVendors(supabase),
    listOrders(supabase),
    listOrderItems(supabase),
  ])

  const vendorById = new Map(vendors.map((v) => [v.id, v] as const))
  const substanceById = new Map(substances.map((s) => [s.id, s] as const))
  const formulationById = new Map(formulations.map((f) => [f.formulation.id, f] as const))
  const orderById = new Map(orders.map((o) => [o.id, o] as const))

  const formulationOptions = formulations.map((f) => {
    const substance = f.substance?.display_name ?? 'Unknown substance'
    const route = f.route?.name ?? 'Unknown route'
    return { id: f.formulation.id, label: `${substance} / ${route} / ${f.formulation.name}` }
  })

  const orderIds = new Set(orders.map((o) => o.id))
  const eligibleOrderItems = orderItems.filter((oi) => orderIds.has(oi.order_id) && oi.formulation_id != null)
  const orderItemOptions = eligibleOrderItems.map((oi) => {
    const order = orderById.get(oi.order_id)
    const vendorName = order ? vendorById.get(order.vendor_id)?.name ?? '(vendor)' : '(order)'
    const orderDay = order?.ordered_at ? order.ordered_at.slice(0, 10) : '(date)'
    const substanceName = substanceById.get(oi.substance_id)?.display_name ?? '(substance)'
    const formulationName =
      oi.formulation_id ? formulationById.get(oi.formulation_id)?.formulation.name ?? '(formulation)' : '(formulation)'

    return {
      id: oi.id,
      label: `${vendorName} / ${orderDay} - ${substanceName} - ${formulationName} (${oi.qty} ${oi.unit_label})`,
    }
  })

  const vialsByStatus = inventory.reduce(
    (acc, row) => {
      const status = row.status ?? null
      if (status === 'planned') acc.planned++
      else if (status === 'active') acc.active++
      else if (status === 'closed') acc.closed++
      else if (status === 'discarded') acc.discarded++
      else acc.unknown++
      return acc
    },
    { planned: 0, active: 0, closed: 0, discarded: 0, unknown: 0 },
  )

  const prereqMissing = formulationOptions.length === 0

  return (
    <SetupStepShell
      title="Inventory"
      description="Add vials so Peptaide can estimate runway and attribute cost to logged events."
      backHref="/setup/formulations"
      backLabel="Formulations"
      nextHref="/setup/model"
      nextLabel="Model coverage"
      nextDisabledReason={prereqMissing ? 'Add at least one formulation first.' : null}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Current vials: {inventory.length} total (active {vialsByStatus.active}, planned {vialsByStatus.planned}, closed{' '}
            {vialsByStatus.closed}, discarded {vialsByStatus.discarded}
            {vialsByStatus.unknown > 0 ? `, unknown ${vialsByStatus.unknown}` : ''}
            ).
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="text-slate-600 dark:text-slate-400 underline hover:text-primary" href="/inventory">
              Manage inventory
            </Link>
            <Link className="text-slate-600 dark:text-slate-400 underline hover:text-primary" href="/orders">
              Manage orders
            </Link>
          </div>
        </div>

        {prereqMissing ? (
          <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
            You need at least one formulation before you can create vials.
            <div className="mt-2">
              <Link className="underline hover:text-primary" href="/setup/formulations">
                Go to Formulations
              </Link>
            </div>
          </div>
        ) : (
          <>
            <CreateVialForm formulations={formulationOptions} />

            {orderItemOptions.length === 0 ? (
              <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
                To generate planned vials from orders, create an order item linked to a formulation (see{' '}
                <Link className="underline hover:text-primary" href="/orders">
                  Orders
                </Link>
                ).
              </div>
            ) : (
              <GenerateVialsForm orderItems={orderItemOptions} />
            )}
          </>
        )}

        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
          If you don’t want to track costs, you can leave cost fields blank and still use runway estimates based on doses.
        </div>
      </div>
    </SetupStepShell>
  )
}

