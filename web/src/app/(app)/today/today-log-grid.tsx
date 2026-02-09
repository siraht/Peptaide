'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ClipboardEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import type { CreateEventState } from './actions'
import { createEventAction } from './actions'

export type TodayFormulationOption = {
  id: string
  label: string
}

type GridRow = {
  formulationId: string
  inputText: string
  status: 'idle' | 'saving' | 'success' | 'error'
  message: string
}

type FocusDirection = 'next' | 'prev' | 'none'

function blankRow(formulationId: string): GridRow {
  return { formulationId, inputText: '', status: 'idle', message: '' }
}

export function TodayLogGrid(props: {
  formulations: TodayFormulationOption[]
  defaultFormulationId?: string | null
  doseRecommendationsByFormulationId?: Record<
    string,
    { min: number | null; max: number | null; unit: string } | null
  >
}) {
  const { formulations, defaultFormulationId: defaultFormulationIdProp, doseRecommendationsByFormulationId } = props

  const router = useRouter()
  const [, startTransition] = useTransition()

  const searchParams = useSearchParams()
  const focus = searchParams.get('focus')

  const defaultFormulationId = useMemo(() => {
    const candidate = defaultFormulationIdProp
      ? formulations.find((f) => f.id === defaultFormulationIdProp) ?? null
      : null
    return candidate?.id ?? formulations[0]?.id ?? ''
  }, [defaultFormulationIdProp, formulations])

  const [rows, setRows] = useState<GridRow[]>(() => {
    if (!defaultFormulationId) return []
    // A small fixed grid is enough for the MVP; we can virtualize later.
    return Array.from({ length: 8 }, () => blankRow(defaultFormulationId))
  })
  const rowsRef = useRef(rows)
  const savingRowIndexesRef = useRef<Set<number>>(new Set())
  const pendingFocusRowIndexRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (focus !== 'log') return
    inputRefs.current[0]?.focus()
  }, [focus])

  useEffect(() => {
    const idx = pendingFocusRowIndexRef.current
    if (idx == null) return
    pendingFocusRowIndexRef.current = null
    focusRowInput(idx)
  }, [rows.length])

  function focusRowInput(rowIndex: number): void {
    const idx = Math.max(0, Math.min(rowIndex, rowsRef.current.length - 1))
    inputRefs.current[idx]?.focus()
  }

  async function saveRow(rowIndex: number, opts: { focusDirection: FocusDirection }): Promise<void> {
    if (savingRowIndexesRef.current.has(rowIndex)) return

    const row = rowsRef.current[rowIndex]
    if (!row) return
    if (row.status === 'saving') return

    const formulationId = row.formulationId.trim()
    const inputText = row.inputText.trim()
    if (!formulationId || !inputText) {
      setRows((prev) => {
        const next = [...prev]
        const current = next[rowIndex]
        if (!current) return prev
        next[rowIndex] = {
          ...current,
          status: 'error',
          message: !formulationId ? 'Missing formulation.' : 'Missing dose input.',
        }
        return next
      })
      return
    }

    savingRowIndexesRef.current.add(rowIndex)
    setRows((prev) => {
      const next = [...prev]
      const current = next[rowIndex]
      if (!current) return prev
      next[rowIndex] = { ...current, status: 'saving', message: '' }
      return next
    })

    const fd = new FormData()
    fd.append('formulation_id', formulationId)
    fd.append('input_text', inputText)

    let res: CreateEventState
    try {
      res = await createEventAction({ status: 'idle' }, fd)
      if (res.status === 'confirm_new_cycle') {
        // Default-yes prompt: pressing Enter selects OK.
        const ok = window.confirm(res.message)
        const fd2 = new FormData()
        fd2.append('formulation_id', formulationId)
        fd2.append('input_text', inputText)
        fd2.append('cycle_decision', ok ? 'new_cycle' : 'continue_cycle')
        res = await createEventAction({ status: 'idle' }, fd2)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      res = { status: 'error', message: msg }
    } finally {
      savingRowIndexesRef.current.delete(rowIndex)
    }

    if (res.status === 'success') {
      const focusDirection = opts.focusDirection
      const nextIndex = focusDirection === 'prev' ? rowIndex - 1 : rowIndex + 1
      const shouldAppendRow = focusDirection === 'next' && rowIndex === rowsRef.current.length - 1

      setRows((prev) => {
        const next = [...prev]
        const current = next[rowIndex]
        if (!current) return prev
        next[rowIndex] = { ...current, inputText: '', status: 'success', message: res.message }
        if (shouldAppendRow) {
          next.push(blankRow(formulationId))
        }
        return next
      })

      if (focusDirection !== 'none') {
        if (shouldAppendRow) {
          pendingFocusRowIndexRef.current = nextIndex
        } else {
          focusRowInput(nextIndex)
        }
      }
      startTransition(() => {
        router.refresh()
      })
      return
    }

    if (res.status === 'error') {
      setRows((prev) => {
        const next = [...prev]
        const current = next[rowIndex]
        if (!current) return prev
        next[rowIndex] = { ...current, status: 'error', message: res.message }
        return next
      })
      return
    }

    if (res.status === 'confirm_new_cycle') {
      setRows((prev) => {
        const next = [...prev]
        const current = next[rowIndex]
        if (!current) return prev
        next[rowIndex] = { ...current, status: 'error', message: 'Cycle confirmation required.' }
        return next
      })
      return
    }

    setRows((prev) => {
      const next = [...prev]
      const current = next[rowIndex]
      if (!current) return prev
      next[rowIndex] = { ...current, status: 'error', message: 'Unexpected state.' }
      return next
    })
  }

  async function saveAllFilled(): Promise<void> {
    for (let i = 0; i < rowsRef.current.length; i++) {
      const row = rowsRef.current[i]
      if (!row) continue
      if (!row.inputText.trim()) continue
      await saveRow(i, { focusDirection: 'none' })
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>, rowIndex: number) {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\n')) return

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return

    e.preventDefault()
    setRows((prev) => {
      const next = [...prev]
      const seedFormulationId = next[rowIndex]?.formulationId ?? defaultFormulationId
      const needed = rowIndex + lines.length - next.length
      if (needed > 0) {
        for (let i = 0; i < needed; i++) {
          next.push(blankRow(seedFormulationId))
        }
      }
      for (let i = 0; i < lines.length; i++) {
        const idx = rowIndex + i
        const current = next[idx]
        if (!current) continue
        next[idx] = { ...current, inputText: lines[i] ?? '', status: 'idle', message: '' }
      }
      return next
    })
  }

  if (formulations.length === 0) return null

  function formatRecHint(h: { min: number | null; max: number | null; unit: string }): string {
    const min = h.min
    const max = h.max
    const unit = h.unit
    if (min != null && max != null) return `Rec: ${min}-${max}${unit}`
    if (min != null) return `Rec: >=${min}${unit}`
    if (max != null) return `Rec: <=${max}${unit}`
    return `Rec: ${unit}`
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-surface-dark p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Log (grid)</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Enter a dose and press Enter to save; focus advances row-by-row. Paste multiple lines of doses to fill
            subsequent rows.
          </p>
        </div>
        <button
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:border-primary/50 transition-colors"
          type="button"
          onClick={saveAllFilled}
        >
          Save filled rows
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide">
              <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Formulation</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Dose</th>
              <th className="border-b border-gray-200 dark:border-gray-800 px-2 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="border-b px-2 py-2">
                  <select
                    className="h-10 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100"
                    value={row.formulationId}
                    onChange={(e) => {
                      const value = e.target.value
                      setRows((prev) => {
                        const next = [...prev]
                        const current = next[idx]
                        if (!current) return prev
                        next[idx] = { ...current, formulationId: value, status: 'idle', message: '' }
                        return next
                      })
                    }}
                    aria-label={`Formulation row ${idx + 1}`}
                    disabled={row.status === 'saving'}
                  >
                    {formulations.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b px-2 py-2">
                  <div className="flex flex-col items-end">
                    <input
                      ref={(el) => {
                        inputRefs.current[idx] = el
                      }}
                      className="h-10 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                      value={row.inputText}
                      onChange={(e) => {
                        const value = e.target.value
                        setRows((prev) => {
                          const next = [...prev]
                          const current = next[idx]
                          if (!current) return prev
                          next[idx] = { ...current, inputText: value, status: 'idle', message: '' }
                          return next
                        })
                      }}
                      onPaste={(e) => handlePaste(e, idx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (!row.inputText.trim()) {
                            focusRowInput(e.shiftKey ? idx - 1 : idx + 1)
                            return
                          }
                          void saveRow(idx, { focusDirection: e.shiftKey ? 'prev' : 'next' })
                          return
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          focusRowInput(idx + 1)
                          return
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          focusRowInput(idx - 1)
                          return
                        }
                      }}
                      placeholder='e.g. "0.3mL", "250mcg", "2 sprays"'
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label={`Dose row ${idx + 1}`}
                      disabled={row.status === 'saving'}
                    />
                    {(() => {
                      const hint = doseRecommendationsByFormulationId?.[row.formulationId] ?? null
                      if (!hint) return null
                      return (
                        <span className="text-[10px] text-primary/80 dark:text-blue-300/80 mt-1 font-medium bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <span className="material-icons text-[10px]">lightbulb</span>
                          {formatRecHint(hint)}
                        </span>
                      )
                    })()}
                  </div>
                </td>
                <td className="border-b px-2 py-2 text-gray-600 dark:text-gray-400">
                  {row.status === 'saving' ? (
                    <span>Saving...</span>
                  ) : row.status === 'success' ? (
                    <span className="text-emerald-700 dark:text-emerald-300">Saved</span>
                  ) : row.status === 'error' ? (
                    <span className="text-red-700 dark:text-red-300">{row.message}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
