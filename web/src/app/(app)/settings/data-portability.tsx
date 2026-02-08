'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type ImportMode = 'dry-run' | 'apply'

type ImportTableReport = {
  table: string
  rowCount: number
  insertedCount?: number
  warnings: string[]
  errors: string[]
}

type ImportBundleResult = {
  ok: boolean
  mode: ImportMode
  format?: string
  exported_at?: string
  tables: ImportTableReport[]
  errors: string[]
}

type SimpleEventsImportResult = {
  ok: boolean
  mode: ImportMode
  summary: {
    input_rows: number
    imported_events: number
    created_substances: number
    created_routes: number
    created_formulations: number
    created_cycles: number
  }
  warnings: string[]
  errors: string[]
  row_errors: Array<{ row: number; error: string }>
}

function firstImportError(result: ImportBundleResult): string | null {
  const top = result.errors?.[0]
  if (top) return top

  const tableWithError = result.tables.find((t) => t.errors.length > 0)
  if (tableWithError) {
    return `${tableWithError.table}: ${tableWithError.errors[0]}`
  }

  return null
}

export function DataPortabilitySection() {
  const [bundleFile, setBundleFile] = useState<File | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [busy, setBusy] = useState<ImportMode | 'delete' | null>(null)
  const [result, setResult] = useState<ImportBundleResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [eventsFile, setEventsFile] = useState<File | null>(null)
  const [eventsReplaceExisting, setEventsReplaceExisting] = useState(false)
  const [eventsInferCycles, setEventsInferCycles] = useState(true)
  const [eventsBusy, setEventsBusy] = useState<ImportMode | null>(null)
  const [eventsResult, setEventsResult] = useState<SimpleEventsImportResult | null>(null)
  const [eventsError, setEventsError] = useState<string | null>(null)

  const router = useRouter()

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const canDelete = deleteConfirm.trim() === 'DELETE'

  const totalRows = useMemo(() => {
    if (!result) return null
    return result.tables.reduce((acc, t) => acc + (t.rowCount ?? 0), 0)
  }, [result])

  async function runImport(mode: ImportMode) {
    setError(null)
    setResult(null)

    if (!bundleFile) {
      setError('Choose an export ZIP file first.')
      return
    }

    if (mode === 'apply' && replaceExisting) {
      const ok = window.confirm(
        'This will DELETE ALL your data, then import from the ZIP bundle. Make sure you exported first. Continue?',
      )
      if (!ok) return
    }

    setBusy(mode)
    try {
      const form = new FormData()
      form.set('bundle', bundleFile)

      const qs = new URLSearchParams()
      qs.set('mode', mode)
      if (replaceExisting) qs.set('replace', '1')

      const res = await fetch(`/api/import?${qs.toString()}`, { method: 'POST', body: form })
      const json = (await res.json()) as ImportBundleResult
      setResult(json)
      if (!json.ok) {
        setError(firstImportError(json) ?? 'Import failed.')
      } else if (mode === 'apply') {
        // Ensure the rest of the app reflects the imported data immediately.
        router.refresh()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setBusy(null)
    }
  }

  async function runSimpleEventsImport(mode: ImportMode) {
    setEventsError(null)
    setEventsResult(null)

    if (!eventsFile) {
      setEventsError('Choose a CSV file first.')
      return
    }

    if (mode === 'apply' && eventsReplaceExisting) {
      const ok = window.confirm(
        'This will DELETE ALL your data, then import events from the CSV. Make sure you exported first. Continue?',
      )
      if (!ok) return
    }

    setEventsBusy(mode)
    try {
      const form = new FormData()
      form.set('file', eventsFile)

      const qs = new URLSearchParams()
      qs.set('mode', mode)
      if (eventsReplaceExisting) qs.set('replace', '1')
      if (!eventsInferCycles) qs.set('infer_cycles', '0')

      const res = await fetch(`/api/import-simple-events?${qs.toString()}`, { method: 'POST', body: form })
      const json = (await res.json()) as SimpleEventsImportResult
      setEventsResult(json)

      if (!json.ok) {
        const first = json.errors?.[0] ?? (json.row_errors?.[0] ? `Row ${json.row_errors[0].row}: ${json.row_errors[0].error}` : null)
        setEventsError(first ?? 'Import failed.')
      } else if (mode === 'apply') {
        router.refresh()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setEventsError(msg)
    } finally {
      setEventsBusy(null)
    }
  }

  async function deleteMyData() {
    setError(null)
    setResult(null)

    if (!canDelete) {
      setError('Type DELETE to enable deletion.')
      return
    }

    setBusy('delete')
    try {
      const res = await fetch('/api/delete-my-data', { method: 'POST' })
      const contentType = res.headers.get('content-type') ?? ''
      const payload: unknown = contentType.includes('application/json') ? await res.json() : await res.text()

      if (!res.ok) {
        if (typeof payload === 'string') {
          setError(payload || 'Delete failed.')
          return
        }
        if (payload && typeof payload === 'object') {
          const errors = (payload as Record<string, unknown>).errors
          if (Array.isArray(errors) && typeof errors[0] === 'string') {
            setError(errors[0])
            return
          }
        }
        setError('Delete failed.')
        return
      }

      setDeleteConfirm('')
      // Ensure the rest of the app reflects the deletion immediately.
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Data</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Export or import a ZIP of CSV files. Imports run under your signed-in session (RLS enforced).
      </p>

      <div className="mt-3">
        <a
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white"
          href="/api/export"
        >
          Export CSV bundle
        </a>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-zinc-900">Simple import: events CSV</h3>
        <p className="mt-1 text-sm text-zinc-700">
          For sparse spreadsheets, import a single CSV of administration events. The importer will create missing
          substances/routes/formulations with sane defaults and can infer cycles from timestamps. If you already have
          data in this account, enable replace mode (this is not a merge importer).
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-zinc-700">Events CSV file</span>
            <input
              data-e2e="simple-events-file"
              className="h-10 rounded-md border bg-white px-3 text-sm"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setEventsFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              data-e2e="simple-events-infer-cycles"
              type="checkbox"
              checked={eventsInferCycles}
              onChange={(e) => setEventsInferCycles(e.target.checked)}
            />
            <span className="text-zinc-700">Infer cycles from timestamps</span>
          </label>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              data-e2e="simple-events-replace"
              type="checkbox"
              checked={eventsReplaceExisting}
              onChange={(e) => setEventsReplaceExisting(e.target.checked)}
            />
            <span className="text-zinc-700">Replace existing data (delete all my data first)</span>
          </label>

          <div className="flex gap-2 sm:col-span-2">
            <button
              data-e2e="simple-events-dry-run"
              className="h-10 rounded-md border bg-white px-4 text-sm font-medium text-zinc-900 disabled:opacity-50"
              type="button"
              disabled={eventsBusy != null}
              onClick={() => runSimpleEventsImport('dry-run')}
            >
              {eventsBusy === 'dry-run' ? 'Running...' : 'Dry run'}
            </button>
            <button
              data-e2e="simple-events-apply"
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
              type="button"
              disabled={eventsBusy != null}
              onClick={() => runSimpleEventsImport('apply')}
            >
              {eventsBusy === 'apply' ? 'Importing...' : 'Import'}
            </button>
          </div>

          {eventsResult ? (
            <div className="rounded-md border bg-zinc-50 p-3 text-sm text-zinc-900 sm:col-span-2">
              <div className="text-xs text-zinc-600" data-e2e="simple-events-summary">
                {`mode=${eventsResult.mode} rows=${eventsResult.summary.input_rows} imported_events=${eventsResult.summary.imported_events} substances=${eventsResult.summary.created_substances} routes=${eventsResult.summary.created_routes} formulations=${eventsResult.summary.created_formulations} cycles=${eventsResult.summary.created_cycles}`}
              </div>

              {eventsResult.row_errors?.length ? (
                <div className="mt-2 text-xs text-zinc-700">
                  {eventsResult.row_errors.slice(0, 3).map((e) => (
                    <div key={e.row} className="font-mono">
                      {`row ${e.row}: ${e.error}`}
                    </div>
                  ))}
                  {eventsResult.row_errors.length > 3 ? (
                    <div className="text-zinc-600">{`... and ${eventsResult.row_errors.length - 3} more`}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {eventsError ? (
          <p className="mt-2 text-sm text-red-700" role="status" data-e2e="simple-events-error">
            {eventsError}
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-zinc-900">Import bundle</h3>
        <p className="mt-1 text-sm text-zinc-700">
          Use <span className="font-medium">Dry run</span> first to validate the ZIP. Import can optionally replace your
          existing data.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-zinc-700">Export ZIP file</span>
            <input
              data-e2e="bundle-zip-file"
              className="h-10 rounded-md border bg-white px-3 text-sm"
              type="file"
              accept=".zip"
              onChange={(e) => setBundleFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              data-e2e="bundle-replace"
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            <span className="text-zinc-700">Replace existing data (delete all my data first)</span>
          </label>

          <div className="flex gap-2 sm:col-span-2">
            <button
              data-e2e="bundle-dry-run"
              className="h-10 rounded-md border bg-white px-4 text-sm font-medium text-zinc-900 disabled:opacity-50"
              type="button"
              disabled={busy != null}
              onClick={() => runImport('dry-run')}
            >
              {busy === 'dry-run' ? 'Running...' : 'Dry run'}
            </button>
            <button
              data-e2e="bundle-apply"
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
              type="button"
              disabled={busy != null}
              onClick={() => runImport('apply')}
            >
              {busy === 'apply' ? 'Importing...' : 'Import'}
            </button>
          </div>

          {result ? (
            <div className="rounded-md border bg-zinc-50 p-3 text-sm text-zinc-900 sm:col-span-2">
              <div className="text-xs text-zinc-600">
                {result.format ? `format=${result.format}` : 'format=?'}
                {result.exported_at ? ` exported_at=${result.exported_at}` : ''}
                {totalRows != null ? ` total_rows=${totalRows}` : ''}
              </div>

              <div className="mt-2 overflow-x-auto">
                <table className="min-w-[700px] border-separate border-spacing-0 text-left text-xs">
                  <thead>
                    <tr className="text-zinc-600">
                      <th className="border-b px-2 py-2 font-medium">Table</th>
                      <th className="border-b px-2 py-2 font-medium">Rows</th>
                      <th className="border-b px-2 py-2 font-medium">Inserted</th>
                      <th className="border-b px-2 py-2 font-medium">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.tables.map((t) => (
                      <tr key={t.table}>
                        <td className="border-b px-2 py-2 font-mono">{t.table}</td>
                        <td className="border-b px-2 py-2">{t.rowCount}</td>
                        <td className="border-b px-2 py-2">{t.insertedCount ?? '-'}</td>
                        <td className="border-b px-2 py-2">{t.errors.length > 0 ? t.errors[0] : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 border-t pt-6">
        <h3 className="text-sm font-semibold text-red-800">Danger zone</h3>
        <p className="mt-1 text-sm text-zinc-700">
          Delete all data for your account (this does not delete your Supabase Auth user). Type{' '}
          <span className="font-mono">DELETE</span> to enable.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700">Confirm</span>
            <input
              className="h-10 rounded-md border px-3 text-sm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
            />
          </label>

          <button
            className="h-10 rounded-md bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-50"
            type="button"
            disabled={busy != null || !canDelete}
            onClick={deleteMyData}
          >
            {busy === 'delete' ? 'Deleting...' : 'Delete all my data'}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  )
}
