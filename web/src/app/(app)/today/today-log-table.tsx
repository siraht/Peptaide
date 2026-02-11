'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import type { EventEnrichedRow } from '@/lib/repos/eventsRepo'

import type { CreateEventState } from './actions'
import { createEventAction, deleteEventAction, restoreEventAction } from './actions'

export type TodayFormulationOption = {
  id: string
  label: string
}

type FormulationMeta = {
  formulationName: string
  substanceName: string
  routeName: string
}

function nowTimeHHMM(timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

function formatLocalTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatRecHint(h: { min: number | null; max: number | null; unit: string }): string {
  const min = h.min
  const max = h.max
  const unit = h.unit
  if (min != null && max != null) return `Rec: ${min}-${max}${unit}`
  if (min != null) return `Rec: >=${min}${unit}`
  if (max != null) return `Rec: <=${max}${unit}`
  return `Rec: ${unit}`
}

export function TodayLogTable(props: {
  timeZone: string
  formulations: TodayFormulationOption[]
  formulationMetaById: Record<string, FormulationMeta>
  doseRecommendationsByFormulationId?: Record<string, { min: number | null; max: number | null; unit: string } | null>
  events: EventEnrichedRow[]
  vialLabelByVialId: Record<string, string>
  showDeleted: boolean
  showDeletedHref: string
  hideDeletedHref: string
}) {
  const {
    timeZone,
    formulations,
    formulationMetaById,
    doseRecommendationsByFormulationId,
    events,
    vialLabelByVialId,
    showDeleted,
    showDeletedHref,
    hideDeletedHref,
  } = props

  const router = useRouter()
  const [, startTransition] = useTransition()
  const searchParams = useSearchParams()

  const focus = searchParams.get('focus')
  const formulationIdParam = searchParams.get('formulation_id')

  const defaultFormulationId = useMemo(() => {
    if (formulationIdParam && formulations.some((f) => f.id === formulationIdParam)) {
      return formulationIdParam
    }
    return formulations[0]?.id ?? ''
  }, [formulationIdParam, formulations])

  const [formulationId, setFormulationId] = useState<string>(defaultFormulationId)
  const [timeHHMM, setTimeHHMM] = useState<string>(() => nowTimeHHMM(timeZone))
  const [inputText, setInputText] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [status, setStatus] = useState<{ state: 'idle' | 'saving' | 'success' | 'error'; message: string }>({
    state: 'idle',
    message: '',
  })

  const doseRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setFormulationId(defaultFormulationId)
  }, [defaultFormulationId])

  useEffect(() => {
    if (focus !== 'log') return
    doseRef.current?.focus()
  }, [focus, formulationIdParam])

  const routeName = formulationMetaById[formulationId]?.routeName ?? '-'

  async function submit({ focusDose = true }: { focusDose?: boolean } = {}): Promise<void> {
    if (status.state === 'saving') return

    const fid = formulationId.trim()
    const txt = inputText.trim()

    if (!fid) {
      setStatus({ state: 'error', message: 'Missing formulation.' })
      return
    }
    if (!txt) {
      setStatus({ state: 'error', message: 'Missing dose input.' })
      return
    }

    setStatus({ state: 'saving', message: '' })

    const fd = new FormData()
    fd.append('formulation_id', fid)
    fd.append('input_text', txt)
    if (timeHHMM.trim()) fd.append('time_hhmm', timeHHMM.trim())
    if (notes.trim()) fd.append('notes', notes.trim())

    let res: CreateEventState
    try {
      res = await createEventAction({ status: 'idle' }, fd)
      if (res.status === 'confirm_new_cycle') {
        // Default-yes prompt: pressing Enter selects OK.
        const ok = window.confirm(res.message)
        fd.append('cycle_decision', ok ? 'new_cycle' : 'continue_cycle')
        res = await createEventAction({ status: 'idle' }, fd)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      res = { status: 'error', message: msg }
    }

    if (res.status === 'success') {
      setStatus({ state: 'success', message: res.message })
      setInputText('')
      setNotes('')
      setTimeHHMM(nowTimeHHMM(timeZone))
      if (focusDose) doseRef.current?.focus()
      startTransition(() => {
        router.refresh()
      })
      return
    }

    if (res.status === 'error') {
      setStatus({ state: 'error', message: res.message })
      if (focusDose) doseRef.current?.focus()
      return
    }

    setStatus({ state: 'error', message: 'Unexpected state.' })
    if (focusDose) doseRef.current?.focus()
  }

  function copyFromEvent(e: EventEnrichedRow): void {
    if (e.formulation_id && formulations.some((f) => f.id === e.formulation_id)) {
      setFormulationId(e.formulation_id)
    }
    setInputText(String(e.input_text ?? '').trim())
    setNotes(String(e.notes ?? '').trim())
    setTimeHHMM(nowTimeHHMM(timeZone))

    setStatus({ state: 'idle', message: '' })
    doseRef.current?.focus()
  }

  if (formulations.length === 0) return null

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-surface-dark" data-e2e="today-log-table">
      <div className="flex items-baseline justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Today log</h2>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            Table-based logging with inline entry. Press Enter to save.
          </p>
        </div>
        <Link
          className="text-sm text-gray-600 dark:text-gray-400 underline hover:text-primary"
          href={showDeleted ? hideDeletedHref : showDeletedHref}
        >
          {showDeleted ? 'Hide deleted' : 'Show deleted'}
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white/70 dark:bg-surface-dark z-10">
            <tr className="text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 dark:border-gray-800">
              <th className="py-3 pl-2 w-28">Time</th>
              <th className="py-3">Compound / Vial</th>
              <th className="py-3 text-right">Input</th>
              <th className="py-3 pl-4">Route</th>
              <th className="py-3">Notes</th>
              <th className="py-3 w-24 text-center">Action</th>
            </tr>
          </thead>

          <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-800">
            {events.map((e) => {
              const vialLabel = e.vial_id ? vialLabelByVialId[e.vial_id] ?? e.vial_id.slice(0, 8) : null
              const compound = e.substance_name ?? e.formulation_name ?? 'Unknown'
              const formulationName = e.formulation_name ?? null

              return (
                <tr
                  key={e.event_id ?? `${e.ts}-${e.input_text}`}
                  className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  data-e2e="today-log-row"
                >
                  <td className="py-3 pl-2 font-mono text-gray-600 dark:text-gray-400">{formatLocalTime(e.ts, timeZone)}</td>
                  <td className="py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{compound}</div>
                    <div className="text-xs text-gray-500">
                      {formulationName ? formulationName : '—'}
                      {vialLabel ? ` • ${vialLabel}` : ''}
                    </div>
                  </td>
                  <td className="py-3 text-right font-mono text-gray-900 dark:text-gray-100">{e.input_text ?? '-'}</td>
                  <td className="py-3 pl-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {e.route_name ?? '-'}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500 truncate max-w-[260px]">{e.notes ?? '-'}</td>
                  <td className="py-3 text-center">
                    {showDeleted && e.event_id ? (
                      <form action={restoreEventAction}>
                        <input type="hidden" name="event_id" value={e.event_id} />
                        <button className="text-emerald-400 hover:text-emerald-300 transition-colors p-1" type="submit">
                          <span className="sr-only">Restore</span>
                          <span className="material-icons text-sm">restore</span>
                        </button>
                      </form>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button
                          className="text-gray-400 hover:text-primary transition-colors p-1"
                          type="button"
                          onClick={() => copyFromEvent(e)}
                          data-e2e="today-log-row-copy"
                        >
                          <span className="sr-only">Copy</span>
                          <span className="material-icons text-sm">content_copy</span>
                        </button>
                        {e.event_id ? (
                          <form action={deleteEventAction}>
                            <input type="hidden" name="event_id" value={e.event_id} />
                            <button className="text-gray-400 hover:text-red-400 transition-colors p-1" type="submit">
                              <span className="sr-only">Delete</span>
                              <span className="material-icons text-sm">delete</span>
                            </button>
                          </form>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}

            <tr className="bg-primary/5 dark:bg-primary/10 border-l-2 border-primary" data-e2e="today-log-input-row">
              <td className="py-3 pl-2 font-mono text-gray-600 dark:text-gray-400 align-top">
                <input
                  className="bg-transparent border-0 p-0 text-sm focus:ring-0 text-gray-900 dark:text-gray-100 w-full"
                  type="time"
                  value={timeHHMM}
                  onChange={(e) => {
                    setTimeHHMM(e.target.value)
                    setStatus({ state: 'idle', message: '' })
                  }}
                  data-e2e="today-log-input-time"
                />
              </td>
              <td className="py-3 align-top">
                <select
                  className="bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-primary px-0 py-1 w-full text-sm focus:ring-0 text-gray-900 dark:text-gray-100"
                  value={formulationId}
                  onChange={(e) => {
                    setFormulationId(e.target.value)
                    setStatus({ state: 'idle', message: '' })
                  }}
                  data-e2e="today-log-input-formulation"
                >
                  {formulations.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-3 text-right align-top">
                <div className="flex flex-col items-end">
                  <input
                    ref={doseRef}
                    className="bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-primary px-0 py-1 w-40 text-right text-sm focus:ring-0 text-gray-900 dark:text-gray-100 font-mono"
                    placeholder='e.g. "0.3mL", "250mcg", "2 sprays"'
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value)
                      setStatus({ state: 'idle', message: '' })
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      void submit()
                    }}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    data-e2e="today-log-input-dose"
                  />

                  {(() => {
                    const hint = doseRecommendationsByFormulationId?.[formulationId] ?? null
                    if (!hint) return null
                    return (
                      <span className="text-[10px] text-primary/80 dark:text-blue-300/80 mt-1 font-medium bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <span className="material-icons text-[10px]">lightbulb</span>
                        {formatRecHint(hint)}
                      </span>
                    )
                  })()}

                  {status.state === 'error' ? (
                    <span className="text-[10px] text-red-700 dark:text-red-300 mt-1">{status.message}</span>
                  ) : status.state === 'success' ? (
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1">{status.message}</span>
                  ) : null}
                </div>
              </td>
              <td className="py-3 pl-4 align-top">
                <select
                  className="bg-transparent border-0 p-0 text-sm focus:ring-0 text-gray-500 dark:text-gray-400 cursor-pointer"
                  value={routeName}
                  disabled
                  aria-label="Route"
                >
                  <option>{routeName}</option>
                </select>
              </td>
              <td className="py-3 align-top">
                <input
                  className="bg-transparent border-0 p-0 w-full text-sm focus:ring-0 text-gray-900 dark:text-gray-100"
                  placeholder="Add notes…"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value)
                    setStatus({ state: 'idle', message: '' })
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    void submit()
                  }}
                  data-e2e="today-log-input-notes"
                />
              </td>
              <td className="py-3 text-center align-top">
                <button
                  className="text-primary hover:text-primary-dark transition-colors p-1 bg-primary/20 rounded-full disabled:opacity-50"
                  type="button"
                  disabled={status.state === 'saving'}
                  onClick={() => {
                    void submit()
                  }}
                  data-e2e="today-log-submit"
                >
                  <span className="sr-only">Save</span>
                  <span className="material-icons text-sm font-bold">check</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
