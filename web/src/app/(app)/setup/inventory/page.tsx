import Link from 'next/link'

import { CreateVialForm } from '@/app/(app)/(hub)/inventory/create-vial-form'
import { GenerateVialsForm } from '@/app/(app)/(hub)/orders/generate-vials-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { CompactEntryModule } from '@/components/ui/compact-entry-module'
import { MetricsStrip } from '@/components/ui/metrics-strip'
import { buildVialSelectorSubstances } from '@/lib/inventory/vialSelectorData'
import { buildVialOrderItemLinkOptions } from '@/lib/inventory/vialOrderItemLinkOptions'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listInventoryStatus } from '@/lib/repos/inventoryStatusRepo'
import { listOrders } from '@/lib/repos/ordersRepo'
import { listOrderItems } from '@/lib/repos/orderItemsRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { listVendors } from '@/lib/repos/vendorsRepo'
import { createClient } from '@/lib/supabase/server'

function fmtCount(n: number): string {
  return new Intl.NumberFormat().format(n)
}

export default async function SetupInventoryPage() {
  const supabase = await createClient()

  const [formulations, inventory, orders, orderItems, substances, vendors] = await Promise.all([
    listFormulationsEnriched(supabase),
    listInventoryStatus(supabase),
    listOrders(supabase),
    listOrderItems(supabase),
    listSubstances(supabase),
    listVendors(supabase),
  ])

  const selectorSubstances = buildVialSelectorSubstances(formulations, inventory)
  const orderItemLinkOptions = buildVialOrderItemLinkOptions({
    orders,
    orderItems,
    vendors,
    substances,
    formulations,
  })

  const orderItemOptions = orderItemLinkOptions.map((oi) => ({ id: oi.id, label: oi.selectorLabel }))

  const totalFormulations = formulations.length

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

  const prereqMissing = selectorSubstances.length === 0

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
        <MetricsStrip
          items={[
            {
              label: 'Total vials',
              value: fmtCount(inventory.length),
              detail: `${fmtCount(vialsByStatus.active)} active, ${fmtCount(vialsByStatus.planned)} planned`,
              tone: inventory.length > 0 ? 'good' : 'warn',
            },
            {
              label: 'Formulations available',
              value: fmtCount(totalFormulations),
              detail: prereqMissing ? 'Add formulations before creating vials.' : 'Ready for manual vial creation.',
              tone: prereqMissing ? 'warn' : 'good',
            },
            {
              label: 'Order-item targets',
              value: fmtCount(orderItemOptions.length),
              detail: 'Eligible for planned vial generation.',
              tone: orderItemOptions.length > 0 ? 'good' : 'neutral',
            },
          ]}
        />

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
            <CompactEntryModule
              id="setup-inventory-add-vial"
              title="Add vial"
              description="Create inventory records directly for formulations you already track."
              summaryItems={[
                { label: 'Formulation options', value: fmtCount(totalFormulations), tone: totalFormulations > 0 ? 'good' : 'warn' },
                { label: 'Active vials', value: fmtCount(vialsByStatus.active), tone: vialsByStatus.active > 0 ? 'good' : 'neutral' },
              ]}
              defaultCollapsed
              storageKey="peptaide.module.setup.inventory.add-vial"
            >
              <CreateVialForm substances={selectorSubstances} orderItemLinks={orderItemLinkOptions} />
            </CompactEntryModule>

            <CompactEntryModule
              id="setup-inventory-generate-vials"
              title="Generate planned vials from orders"
              description="Use formulation-linked order items to pre-create planned inventory rows."
              summaryItems={[
                { label: 'Eligible order items', value: fmtCount(orderItemOptions.length), tone: orderItemOptions.length > 0 ? 'good' : 'warn' },
                { label: 'Planned vials', value: fmtCount(vialsByStatus.planned), tone: vialsByStatus.planned > 0 ? 'good' : 'neutral' },
              ]}
              defaultCollapsed
              storageKey="peptaide.module.setup.inventory.generate-vials"
              emptyCta={
                orderItemOptions.length === 0
                  ? { href: '/orders', label: 'Create formulation-linked order items first' }
                  : undefined
              }
            >
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
            </CompactEntryModule>
          </>
        )}

        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
          If you don&apos;t want to track costs, you can leave cost fields blank and still use runway estimates based on doses.
        </div>
      </div>
    </SetupStepShell>
  )
}
