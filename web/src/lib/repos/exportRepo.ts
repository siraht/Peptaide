import { requireOk } from './errors'
import type { DbClient } from './types'

import { EXPORT_COLUMNS, type ExportTableName } from '@/lib/export/exportColumns'

function chooseStableOrderColumn(columns: readonly string[]): string | null {
  // Try to produce deterministic CSV output without having to special-case per table.
  if (columns.includes('created_at')) return 'created_at'
  if (columns.includes('ts')) return 'ts'
  if (columns.includes('ordered_at')) return 'ordered_at'
  if (columns.includes('revised_at')) return 'revised_at'
  if (columns.includes('id')) return 'id'
  if (columns.includes('user_id')) return 'user_id'
  return null
}

export async function exportAllRowsForTable(
  supabase: DbClient,
  opts: { table: ExportTableName; pageSize?: number },
): Promise<Record<string, unknown>[]> {
  const pageSize = opts.pageSize ?? 1000
  const columns = EXPORT_COLUMNS[opts.table]
  const orderColumn = chooseStableOrderColumn(columns)

  const all: Record<string, unknown>[] = []
  let from = 0

  while (true) {
    // Note: using `.select('*')` keeps exports forward-compatible when new columns are added.
    // The CSV writer uses EXPORT_COLUMNS to pick a stable column order.
    let q = supabase.from(opts.table).select('*')
    if (orderColumn) {
      q = q.order(orderColumn as never, { ascending: true })
    }

    const res = await q.range(from, from + pageSize - 1)
    requireOk(res.error, `${opts.table}.export_page`)

    const rows = (res.data ?? []) as Record<string, unknown>[]
    all.push(...rows)
    if (rows.length < pageSize) {
      break
    }
    from += pageSize
  }

  return all
}

