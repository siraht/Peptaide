'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { CreateVialState } from './actions'
import { createVialAction } from './actions'
import type { VialOrderItemLinkOption } from '@/lib/inventory/vialOrderItemLinkOptions'

export type InventoryFormulationOption = { id: string; label: string }

function formatMoney(x: number | null): string {
  if (x == null) return '-'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(x)
}

function formatCostInput(x: number): string {
  return x.toFixed(4).replace(/\.?0+$/, '')
}

function includesQuery(text: string, query: string): boolean {
  if (!query) return true
  return text.toLowerCase().includes(query)
}

export function CreateVialForm(props: {
  formulations: InventoryFormulationOption[]
  orderItemLinks: VialOrderItemLinkOption[]
}) {
  const { formulations, orderItemLinks } = props

  const [state, formAction] = useActionState<CreateVialState, FormData>(createVialAction, {
    status: 'idle',
  })

  const [selectedFormulationId, setSelectedFormulationId] = useState(formulations[0]?.id ?? '')
  const [linkEnabled, setLinkEnabled] = useState(false)
  const [orderItemSearch, setOrderItemSearch] = useState('')
  const [selectedOrderItemId, setSelectedOrderItemId] = useState('')
  const [costUsdInput, setCostUsdInput] = useState('')
  const [costManuallyEdited, setCostManuallyEdited] = useState(false)

  const router = useRouter()

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  const activeFormulationId = useMemo(() => {
    if (formulations.some((f) => f.id === selectedFormulationId)) return selectedFormulationId
    return formulations[0]?.id ?? ''
  }, [formulations, selectedFormulationId])

  const formulationOrderItems = useMemo(
    () => orderItemLinks.filter((oi) => oi.formulationId === activeFormulationId),
    [orderItemLinks, activeFormulationId],
  )

  const normalizedOrderItemSearch = orderItemSearch.trim().toLowerCase()

  const filteredOrderItems = useMemo(
    () =>
      formulationOrderItems.filter((oi) =>
        includesQuery(
          `${oi.selectorLabel} ${oi.orderRefLabel} ${oi.vendorName} ${oi.substanceName} ${oi.formulationName}`,
          normalizedOrderItemSearch,
        ),
      ),
    [formulationOrderItems, normalizedOrderItemSearch],
  )

  const activeSelectedOrderItemId = useMemo(() => {
    if (!linkEnabled) return ''
    if (filteredOrderItems.length === 0) return ''
    if (filteredOrderItems.some((oi) => oi.id === selectedOrderItemId)) return selectedOrderItemId
    return filteredOrderItems[0]?.id ?? ''
  }, [linkEnabled, filteredOrderItems, selectedOrderItemId])

  const selectedOrderItem = useMemo(
    () => filteredOrderItems.find((oi) => oi.id === activeSelectedOrderItemId) ?? null,
    [filteredOrderItems, activeSelectedOrderItemId],
  )

  const linkedDefaultCost = selectedOrderItem?.impliedCostUsd ?? null
  const effectiveCostUsdInput = useMemo(() => {
    if (costManuallyEdited) return costUsdInput
    if (linkEnabled) {
      return linkedDefaultCost == null ? '' : formatCostInput(linkedDefaultCost)
    }
    return costUsdInput
  }, [costManuallyEdited, costUsdInput, linkEnabled, linkedDefaultCost])
  const canSubmit = !linkEnabled || selectedOrderItem != null

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add vial</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Minimal inventory UI. Creating an <code className="rounded bg-slate-100 dark:bg-slate-800 px-1">active</code> vial will close any
        prior active vial for that formulation.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Formulation</span>
          <select
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100"
            name="formulation_id"
            required
            value={activeFormulationId}
            onChange={(e) => {
              setSelectedFormulationId(e.target.value)
              setOrderItemSearch('')
              setSelectedOrderItemId('')
            }}
          >
            {formulations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2 rounded-lg border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-3 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Order linkage (optional)</h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Link this vial to an order item to inherit provenance and recommended cost.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              className="h-4 w-4 rounded border-border-light dark:border-border-dark text-primary focus:ring-primary"
              type="checkbox"
              data-e2e="vial-link-order-item-toggle"
              checked={linkEnabled}
              onChange={(e) => setLinkEnabled(e.target.checked)}
            />
            Link to order item
          </label>

          {linkEnabled ? (
            formulationOrderItems.length === 0 ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                No order items are linked to this formulation yet. Continue unlinked or create matching order items first.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Find order item</span>
                  <input
                    className="h-10 rounded-md bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500"
                    type="search"
                    value={orderItemSearch}
                    onChange={(e) => setOrderItemSearch(e.target.value)}
                    placeholder="Search vendor, date, substance, formulation..."
                  />
                </label>

                {filteredOrderItems.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No order items match the current search for this formulation.
                  </p>
                ) : (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Order item</span>
                    <select
                      className="h-10 rounded-md bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100"
                      name="order_item_id"
                      data-e2e="vial-link-order-item-select"
                      required
                      value={activeSelectedOrderItemId}
                      onChange={(e) => setSelectedOrderItemId(e.target.value)}
                    >
                      {filteredOrderItems.map((oi) => (
                        <option key={oi.id} value={oi.id}>
                          {oi.selectorLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {selectedOrderItem ? (
                  <div className="rounded-md border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-3 text-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Provenance preview</div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" data-e2e="vial-link-provenance-preview">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Vendor</div>
                        <div className="text-slate-900 dark:text-slate-100">{selectedOrderItem.vendorName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Order</div>
                        <div className="text-slate-900 dark:text-slate-100">{selectedOrderItem.orderRefLabel}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Item</div>
                        <div className="text-slate-900 dark:text-slate-100">{`${selectedOrderItem.substanceName} / ${selectedOrderItem.formulationName} (${selectedOrderItem.qty} ${selectedOrderItem.unitLabel})`}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Expected vials</div>
                        <div className="text-slate-900 dark:text-slate-100">{selectedOrderItem.expectedVials ?? '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Order price total</div>
                        <div className="text-slate-900 dark:text-slate-100">{formatMoney(selectedOrderItem.priceTotalUsd)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Implied per-vial cost</div>
                        <div className="text-slate-900 dark:text-slate-100">{formatMoney(selectedOrderItem.impliedCostUsd)}</div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          ) : (
            <>
              <input type="hidden" name="order_item_id" value="" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Leave unlinked to create a manual vial without procurement provenance.
              </p>
            </>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Status</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100" name="status" defaultValue="active">
            <option value="active">active</option>
            <option value="planned">planned</option>
            <option value="closed">closed</option>
            <option value="discarded">discarded</option>
          </select>
        </label>

        <div className="hidden sm:block" />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Content mass</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="content_mass_value" required inputMode="decimal" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Mass unit</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100" name="content_mass_unit" defaultValue="mg">
            <option value="mg">mg</option>
            <option value="mcg">mcg</option>
            <option value="ug">ug</option>
            <option value="g">g</option>
            <option value="IU">IU</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Total volume (optional)</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="total_volume_value" inputMode="decimal" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Volume unit</span>
          <select className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100" name="total_volume_unit" defaultValue="mL">
            <option value="mL">mL</option>
            <option value="cc">cc</option>
            <option value="uL">uL</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Cost USD (optional)</span>
          <input
            className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500"
            name="cost_usd"
            inputMode="decimal"
            value={effectiveCostUsdInput}
            onChange={(e) => {
              setCostUsdInput(e.target.value)
              setCostManuallyEdited(true)
            }}
            data-e2e="vial-cost-usd-input"
          />
          <input type="hidden" name="cost_manual_override" value={costManuallyEdited ? '1' : '0'} />
          {linkEnabled && selectedOrderItem ? (
            <div className="flex items-start justify-between gap-2 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                {linkedDefaultCost == null
                  ? 'No linked default cost is available for this order item.'
                  : costManuallyEdited
                    ? `Manual override is active. Linked default: ${formatMoney(linkedDefaultCost)}.`
                    : `Using linked default: ${formatMoney(linkedDefaultCost)}.`}
              </p>
              {linkedDefaultCost != null && costManuallyEdited ? (
                <button
                  className="shrink-0 rounded border border-border-light dark:border-border-dark px-2 py-1 text-slate-700 dark:text-slate-300 hover:text-primary"
                  type="button"
                  onClick={() => {
                    setCostUsdInput('')
                    setCostManuallyEdited(false)
                  }}
                >
                  Use linked default
                </button>
              ) : null}
            </div>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-600 dark:text-slate-400">Notes (optional)</span>
          <input className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500" name="notes" />
        </label>

        <div className="sm:col-span-2">
          <button
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={!canSubmit}
          >
            Create
          </button>
          {!canSubmit ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Select an order item or disable linkage before creating the vial.
            </p>
          ) : null}
        </div>
      </form>

      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.message}</p>
      ) : null}
      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p>
      ) : null}
    </div>
  )
}
