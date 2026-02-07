import JSZip from 'jszip'

import { EXPORT_COLUMN_KINDS, type ExportColumnKind } from '@/lib/export/exportColumnKinds'
import { EXPORT_COLUMNS, type ExportTableName } from '@/lib/export/exportColumns'
import { requireOk } from '@/lib/repos/errors'
import type { DbClient } from '@/lib/repos/types'
import type { Database } from '@/lib/supabase/database.types'

import { parseCsv } from './csv'
import { deleteAllMyData } from './deleteMyData'

export type ImportMode = 'dry-run' | 'apply'

export type ImportTableReport = {
  table: ExportTableName
  rowCount: number
  insertedCount?: number
  warnings: string[]
  errors: string[]
}

export type ImportBundleResult = {
  ok: boolean
  mode: ImportMode
  format?: string
  exported_at?: string
  tables: ImportTableReport[]
  errors: string[]
}

const IMPORT_ORDER: readonly ExportTableName[] = [
  // Reference roots.
  'profiles',
  'distributions',
  'evidence_sources',
  'substances',
  'substance_aliases',
  'routes',
  'devices',
  'device_calibrations',
  'vendors',
  'orders',
  'formulations',
  'formulation_components',
  'bioavailability_specs',
  'formulation_modifier_specs',
  'component_modifier_specs',
  'cycle_rules',
  'cycle_instances',
  'order_items',
  'vials',
  'administration_events',
  'event_revisions',
  'substance_recommendations',
]

function parseCell(raw: string, kind: ExportColumnKind): unknown {
  if (raw === '') return null

  if (kind === 'string') return raw
  if (kind === 'number') {
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      throw new Error(`expected a number, got ${JSON.stringify(raw)}`)
    }
    return n
  }
  if (kind === 'boolean') {
    if (raw === 'true') return true
    if (raw === 'false') return false
    throw new Error(`expected boolean 'true'/'false', got ${JSON.stringify(raw)}`)
  }

  // kind === 'json'
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`expected JSON, got ${JSON.stringify(raw)}`)
  }
}

function normalizeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function getObjectStringField(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : undefined
}

type InsertRow<T extends ExportTableName> = Database['public']['Tables'][T]['Insert']

async function assertEmptyForImport(
  supabase: DbClient,
  opts: { userId: string },
): Promise<string | null> {
  const tableNames = Object.keys(EXPORT_COLUMNS) as ExportTableName[]

  for (const table of tableNames) {
    if (table === 'profiles') continue
    const res = await supabase.from(table).select('id').eq('user_id', opts.userId).limit(1)
    requireOk(res.error, `${table}.empty_check`)
    if ((res.data ?? []).length > 0) {
      return `Refusing to import: table ${table} is not empty. Export your data, then use replace mode (or delete your data) before importing.`
    }
  }

  return null
}

export async function importCsvBundleZip(
  supabase: DbClient,
  opts: {
    userId: string
    zipData: ArrayBuffer
    mode: ImportMode
    replaceExisting?: boolean
  },
): Promise<ImportBundleResult> {
  const { userId, zipData, mode } = opts
  const replaceExisting = opts.replaceExisting ?? false

  const topErrors: string[] = []
  const tableReports: ImportTableReport[] = []

  const allTables = Object.keys(EXPORT_COLUMNS).sort((a, b) => a.localeCompare(b)) as ExportTableName[]

  {
    const allSet = new Set(allTables)
    const orderSet = new Set<ExportTableName>()
    const dupes: ExportTableName[] = []
    for (const t of IMPORT_ORDER) {
      if (orderSet.has(t)) dupes.push(t)
      orderSet.add(t)
    }

    const missingFromOrder = allTables.filter((t) => !orderSet.has(t))
    const extraInOrder = IMPORT_ORDER.filter((t) => !allSet.has(t))
    if (dupes.length > 0 || missingFromOrder.length > 0 || extraInOrder.length > 0) {
      topErrors.push(
        `Internal error: IMPORT_ORDER must contain each export table exactly once. Missing: ${missingFromOrder.join(
          ', ',
        )}; extra: ${extraInOrder.join(', ')}; dupes: ${dupes.join(', ')}`,
      )
    }
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(zipData)
  } catch (e) {
    return {
      ok: false,
      mode,
      tables: [],
      errors: [`Invalid ZIP: ${normalizeError(e)}`],
    }
  }

  let meta: unknown = null
  if (zip.file('meta.json')) {
    try {
      meta = JSON.parse(await zip.file('meta.json')!.async('string'))
    } catch (e) {
      topErrors.push(`meta.json is not valid JSON: ${normalizeError(e)}`)
    }
  } else {
    topErrors.push('Missing meta.json in ZIP bundle.')
  }

  const format = getObjectStringField(meta, 'format')
  const exportedAt = getObjectStringField(meta, 'exported_at')

  if (format !== 'peptaide-csv-bundle-v1') {
    topErrors.push(`Unsupported or missing export format: ${format ?? '(missing)'}`)
  }

  // Parse all CSVs first (so dry-run can report everything).
  const parsedByTable = new Map<ExportTableName, Record<string, unknown>[]>()

  for (const table of allTables) {
    const warnings: string[] = []
    const errors: string[] = []

    const csvFile = zip.file(`tables/${table}.csv`)
    if (!csvFile) {
      errors.push(`Missing tables/${table}.csv`)
      tableReports.push({ table, rowCount: 0, warnings, errors })
      continue
    }

    const csvText = await csvFile.async('string')
    let parsed: ReturnType<typeof parseCsv>
    try {
      parsed = parseCsv(csvText)
    } catch (e) {
      errors.push(`CSV parse error: ${normalizeError(e)}`)
      tableReports.push({ table, rowCount: 0, warnings, errors })
      continue
    }

    const expectedHeader = EXPORT_COLUMNS[table]
    const headerOk =
      parsed.header.length === expectedHeader.length &&
      parsed.header.every((col, idx) => col === expectedHeader[idx])
    if (!headerOk) {
      errors.push(
        `Unexpected header. Expected: ${JSON.stringify(expectedHeader)}; got: ${JSON.stringify(parsed.header)}`,
      )
      tableReports.push({ table, rowCount: parsed.rows.length, warnings, errors })
      continue
    }

    const kindMap = EXPORT_COLUMN_KINDS[table]
    const records: Record<string, unknown>[] = []
    const pkCol = table === 'profiles' ? 'user_id' : 'id'
    const seenPks = new Set<string>()

    for (let rowIdx = 0; rowIdx < parsed.rows.length; rowIdx++) {
      const row = parsed.rows[rowIdx]
      if (row.length !== parsed.header.length) {
        errors.push(
          `Row ${rowIdx + 2}: expected ${parsed.header.length} columns, got ${row.length}`,
        )
        continue
      }

      const rec: Record<string, unknown> = {}
      for (let colIdx = 0; colIdx < parsed.header.length; colIdx++) {
        const col = parsed.header[colIdx]!
        const kind = kindMap[col] ?? 'string'

        try {
          rec[col] = parseCell(row[colIdx] ?? '', kind as ExportColumnKind)
        } catch (e) {
          errors.push(`Row ${rowIdx + 2} col ${col}: ${normalizeError(e)}`)
        }
      }

      // Never import the old user_id; rebind everything to the current session user.
      rec.user_id = userId

      const pk = typeof rec[pkCol] === 'string' ? (rec[pkCol] as string) : null
      if (!pk) {
        errors.push(`Row ${rowIdx + 2}: missing ${pkCol}`)
      } else if (seenPks.has(pk)) {
        errors.push(`Row ${rowIdx + 2}: duplicate ${pkCol} ${pk}`)
      } else {
        seenPks.add(pk)
      }

      records.push(rec)
    }

    tableReports.push({ table, rowCount: records.length, warnings, errors })
    parsedByTable.set(table, records)
  }

  const ok = topErrors.length === 0 && tableReports.every((r) => r.errors.length === 0)

  if (mode === 'dry-run' || !ok) {
    return {
      ok,
      mode,
      format,
      exported_at: exportedAt,
      tables: tableReports,
      errors: topErrors,
    }
  }

  // mode === 'apply' and parsing/validation succeeded
  if (replaceExisting) {
    await deleteAllMyData(supabase, { userId })
  } else {
    const msg = await assertEmptyForImport(supabase, { userId })
    if (msg) {
      return {
        ok: false,
        mode,
        format,
        exported_at: exportedAt,
        tables: tableReports,
        errors: [msg],
      }
    }
  }

  const insertedByTable = new Map<ExportTableName, number>()

  for (const table of IMPORT_ORDER) {
    const rows = parsedByTable.get(table) ?? []
    if (rows.length === 0) {
      insertedByTable.set(table, 0)
      continue
    }

    if (table === 'profiles') {
      // `profiles.user_id` is the PK and has no default; upsert for safety.
      const profileRow = rows[0] ?? null
      if (!profileRow) {
        insertedByTable.set(table, 0)
        continue
      }

      const res = await supabase
        .from('profiles')
        .upsert(profileRow as unknown as InsertRow<'profiles'>, { onConflict: 'user_id' })
      requireOk(res.error, 'profiles.upsert_import')
      insertedByTable.set(table, 1)
      continue
    }

    const batchSize = 500
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const res = await supabase
        .from(table)
        .insert(batch as unknown as InsertRow<typeof table>[])
      requireOk(res.error, `${table}.insert_import`)
    }

    insertedByTable.set(table, rows.length)
  }

  const tablesWithInserted = tableReports.map((t) => ({
    ...t,
    insertedCount: insertedByTable.get(t.table) ?? 0,
  }))

  return {
    ok: true,
    mode,
    format,
    exported_at: exportedAt,
    tables: tablesWithInserted,
    errors: [],
  }
}
