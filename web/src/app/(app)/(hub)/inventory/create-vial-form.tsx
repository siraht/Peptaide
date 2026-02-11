'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { CreateVialState } from './actions'
import { createVialAction } from './actions'
import type { VialOrderItemLinkOption } from '@/lib/inventory/vialOrderItemLinkOptions'
import type { VialSelectorSubstance } from '@/lib/inventory/vialSelectorData'

export function CreateVialForm(props: {
  substances: VialSelectorSubstance[]
  orderItemLinks: VialOrderItemLinkOption[]
}) {
  const { substances, orderItemLinks } = props

  const [state, formAction] = useActionState<CreateVialState, FormData>(createVialAction, {
    status: 'idle',
  })

  const [selectedFormulationId, setSelectedFormulationId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [linkEnabled, setLinkEnabled] = useState(false)
  const [orderItemSearch, setOrderItemSearch] = useState('')
  const [selectedOrderItemId, setSelectedOrderItemId] = useState('')
  const [costUsdInput, setCostUsdInput] = useState('')
  const [costManuallyEdited, setCostManuallyEdited] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const createdFormulationId = searchParams.get('created_formulation_id')
  const queryFormulationId = searchParams.get('formulation_id')

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  function normalizeSearchToken(value: string): string {
    return value.trim().toLowerCase()
  }

  function buildAddFormulationHref(substanceId: string, returnTo: string): string {
    const params = new URLSearchParams()
    params.set('focus', 'new')
    params.set('substance_id', substanceId)
    params.set('return_to', returnTo)
    return `/formulations?${params.toString()}`
  }

  function stockSummaryLabel(substance: VialSelectorSubstance): string {
    const fragments: string[] = []
    if (substance.activeVialCount > 0) fragments.push(`${substance.activeVialCount} active`)
    if (substance.plannedVialCount > 0) fragments.push(`${substance.plannedVialCount} planned`)
    if (substance.totalVialCount > 0) fragments.push(`${substance.totalVialCount} total`)
    if (fragments.length === 0) return 'No vials yet'
    return fragments.join(' · ')
  }

  function miniCardSummary(active: number, planned: number, total: number): string {
    if (total === 0) return 'No vials'
    const parts: string[] = []
    if (active > 0) parts.push(`${active} active`)
    if (planned > 0) parts.push(`${planned} planned`)
    if (parts.length === 0) parts.push(`${total} total`)
    return parts.join(' · ')
  }

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

  // Formulation mapping from PR-1
  const formulationToSubstance = useMemo(() => {
    const index = new Map<string, { substance: VialSelectorSubstance; formulation: VialSelectorSubstance['formulations'][number] }>()
    for (const substance of substances) {
      for (const formulation of substance.formulations) {
        index.set(formulation.id, { substance, formulation })
      }
    }
    return index
  }, [substances])

  // Preferred formulation selection logic from PR-1
  const preferredFormulationId = useMemo(() => {
    if (createdFormulationId && formulationToSubstance.has(createdFormulationId)) return createdFormulationId

    if (queryFormulationId && formulationToSubstance.has(queryFormulationId)) return queryFormulationId

    return substances[0]?.formulations[0]?.id ?? ''
  }, [createdFormulationId, formulationToSubstance, queryFormulationId, substances])

  // Initialize selected formulation if not set
  const activeFormulationId = useMemo(() => {
    const candidate = selectedFormulationId || preferredFormulationId
    if (candidate && formulationToSubstance.has(candidate)) return candidate
    return preferredFormulationId
  }, [selectedFormulationId, preferredFormulationId, formulationToSubstance])

  const activeSelection = activeFormulationId ? formulationToSubstance.get(activeFormulationId) ?? null : null
  const currentSubstanceId = activeSelection?.substance.id ?? ''
  const returnTo = pathname === '/setup/inventory' ? '/setup/inventory' : '/inventory'

  // Search filtering from PR-1
  const queryToken = normalizeSearchToken(searchQuery)
  const filteredSubstances = useMemo(() => {
    if (!queryToken) return substances
    return substances.filter((substance) => {
      if (normalizeSearchToken(substance.name).includes(queryToken)) return true
      return substance.formulations.some((formulation) => {
        const searchText = [formulation.name, formulation.routeName, formulation.deviceName ?? ''].join(' ')
        return normalizeSearchToken(searchText).includes(queryToken)
      })
    })
  }, [queryToken, substances])

  // Order item linkage logic from PR-2
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
  const canSubmit = activeFormulationId !== '' && (!linkEnabled || selectedOrderItem != null)

  if (substances.length === 0) {
    return (
      <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add vial</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Add at least one formulation before creating vials.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add vial</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Select a substance card, then choose a formulation mini card. Creating an{' '}
        <code className="rounded bg-slate-100 dark:bg-slate-800 px-1">active</code> vial will close any prior active
        vial for that formulation.
      </p>

      <form className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" action={formAction} data-e2e="vial-create-form">
        <input name="formulation_id" type="hidden" value={activeFormulationId} required />

        {/* Card-based substance/formulation selector from PR-1 */}
        <div className="sm:col-span-2 rounded-lg border border-border-light dark:border-border-dark bg-slate-50/80 dark:bg-slate-900/30 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Formulation selector
              </p>
              {activeSelection ? (
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  Selected:{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {activeSelection.substance.name} / {activeSelection.formulation.routeName} /{' '}
                    {activeSelection.formulation.name}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">Select a formulation to continue.</p>
              )}
              {createdFormulationId && createdFormulationId === activeFormulationId ? (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  Newly created formulation is preselected.
                </p>
              ) : null}
            </div>

            <label className="flex w-full flex-col gap-1 text-sm sm:max-w-xs">
              <span className="text-slate-600 dark:text-slate-400">Search</span>
              <input
                className="h-10 rounded-md bg-white dark:bg-slate-800 border border-transparent focus:border-primary focus-visible:ring-1 focus-visible:ring-primary px-3 text-sm transition-colors outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500"
                placeholder="Substance, route, formulation"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
              />
            </label>
          </div>

          {filteredSubstances.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              No substances match "{searchQuery}".
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredSubstances.map((substance) => {
                const isSelectedSubstance = currentSubstanceId === substance.id
                return (
                  <section
                    key={substance.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      isSelectedSubstance
                        ? 'border-primary/60 bg-primary/5 dark:bg-primary/10'
                        : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark'
                    }`}
                    data-e2e="vial-substance-card"
                    data-substance-id={substance.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {substance.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {substance.formulationCount} formulation{substance.formulationCount === 1 ? '' : 's'} ·{' '}
                          {stockSummaryLabel(substance)}
                        </p>
                      </div>

                      <Link
                        className="inline-flex shrink-0 items-center rounded-md border border-primary/30 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        href={buildAddFormulationHref(substance.id, returnTo)}
                        data-e2e="vial-add-formulation"
                        data-substance-id={substance.id}
                      >
                        Add formulation
                      </Link>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {substance.formulations.map((formulation) => {
                        const selected = formulation.id === activeFormulationId
                        return (
                          <button
                            key={formulation.id}
                            type="button"
                            className={`rounded-md border px-3 py-2 text-left transition-colors ${
                              selected
                                ? 'border-primary bg-primary/10 text-slate-900 dark:text-white'
                                : 'border-border-light dark:border-border-dark hover:border-primary/40 text-slate-700 dark:text-slate-200'
                            }`}
                            onClick={() => {
                              setSelectedFormulationId(formulation.id)
                              setOrderItemSearch('')
                              setSelectedOrderItemId('')
                            }}
                            aria-pressed={selected}
                            data-e2e="vial-formulation-card"
                            data-formulation-id={formulation.id}
                          >
                            <div className="text-sm font-medium">{formulation.name}</div>
                            <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                              {formulation.routeName}
                              {formulation.deviceName ? ` · ${formulation.deviceName}` : ''}
                            </div>
                            <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {miniCardSummary(
                                formulation.activeVialCount,
                                formulation.plannedVialCount,
                                formulation.totalVialCount,
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>

        {/* Order linkage section from PR-2 */}
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

        {/* Form fields from PR-2 */}
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
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
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
