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
}) {
  const { formulations, defaultFormulationId: defaultFormulationIdProp } = props

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

  useLayoutEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (focus !== 'log') return
    inputRefs.current[0]?.focus()
  }, [focus])

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
      setRows((prev) => {
        const next = [...prev]
        const current = next[rowIndex]
        if (!current) return prev
        next[rowIndex] = { ...current, inputText: '', status: 'success', message: res.message }
        return next
      })
      if (opts.focusDirection !== 'none') {
        focusRowInput(opts.focusDirection === 'prev' ? rowIndex - 1 : rowIndex + 1)
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
      for (let i = 0; i < lines.length; i++) {
        const idx = rowIndex + i
        if (idx >= next.length) break
        const current = next[idx]
        if (!current) continue
        next[idx] = { ...current, inputText: lines[i] ?? '', status: 'idle', message: '' }
      }
      return next
    })
  }

  if (formulations.length === 0) return null

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Log (grid)</h2>
          <p className="mt-1 text-sm text-zinc-700">
            Enter a dose and press Enter to save; focus advances row-by-row. Paste multiple lines of doses to fill
            subsequent rows.
          </p>
        </div>
        <button
          className="rounded-md border bg-white px-3 py-2 text-sm text-zinc-900"
          type="button"
          onClick={saveAllFilled}
        >
          Save filled rows
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs text-zinc-600">
              <th className="border-b px-2 py-2 font-medium">Formulation</th>
              <th className="border-b px-2 py-2 font-medium">Dose</th>
              <th className="border-b px-2 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="border-b px-2 py-2">
                  <select
                    className="h-10 w-full rounded-md border px-3 text-sm"
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
                  >
                    {formulations.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b px-2 py-2">
                  <input
                    ref={(el) => {
                      inputRefs.current[idx] = el
                    }}
                    className="h-10 w-full rounded-md border px-3 text-sm"
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
                </td>
                <td className="border-b px-2 py-2 text-zinc-700">
                  {row.status === 'saving' ? (
                    <span>Saving...</span>
                  ) : row.status === 'success' ? (
                    <span className="text-emerald-700">Saved</span>
                  ) : row.status === 'error' ? (
                    <span className="text-red-700">{row.message}</span>
                  ) : (
                    <span className="text-zinc-500">-</span>
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
