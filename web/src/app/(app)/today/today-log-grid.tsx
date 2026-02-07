'use client'

import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import { useSearchParams } from 'next/navigation'

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

function blankRow(formulationId: string): GridRow {
  return { formulationId, inputText: '', status: 'idle', message: '' }
}

export function TodayLogGrid(props: {
  formulations: TodayFormulationOption[]
  defaultFormulationId?: string | null
}) {
  const { formulations, defaultFormulationId: defaultFormulationIdProp } = props

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

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (focus !== 'log') return
    inputRefs.current[0]?.focus()
  }, [focus])

  async function saveRow(rowIndex: number): Promise<void> {
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      res = { status: 'error', message: msg }
    }

    if (res.status === 'success') {
      setRows((prev) => {
        const next = [...prev]
        const current = next[rowIndex]
        if (!current) return prev
        next[rowIndex] = { ...current, inputText: '', status: 'success', message: res.message }
        return next
      })
      // Focus next row input for rapid entry.
      const nextIndex = Math.min(rowIndex + 1, rowsRef.current.length - 1)
      inputRefs.current[nextIndex]?.focus()
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
      await saveRow(i)
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
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      void saveRow(idx)
                    }}
                    placeholder='e.g. "0.3mL", "250mcg", "2 sprays"'
                    autoComplete="off"
                    inputMode="decimal"
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
