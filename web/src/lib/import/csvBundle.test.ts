import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import type { DbClient } from '@/lib/repos/types'

import { EXPORT_COLUMNS, type ExportTableName } from '@/lib/export/exportColumns'

import { importCsvBundleZip } from './csvBundle'

function makeEmptyCsvForTable(table: ExportTableName): string {
  return `${EXPORT_COLUMNS[table].join(',')}\n`
}

describe('importCsvBundleZip (dry-run)', () => {
  it('accepts a structurally valid empty bundle', async () => {
    const zip = new JSZip()
    const tables = (Object.keys(EXPORT_COLUMNS) as ExportTableName[]).sort((a, b) => a.localeCompare(b))

    zip.file(
      'meta.json',
      `${JSON.stringify(
        { format: 'peptaide-csv-bundle-v1', exported_at: '2026-02-07T00:00:00.000Z', tables },
        null,
        2,
      )}\n`,
    )

    for (const table of tables) {
      zip.file(`tables/${table}.csv`, makeEmptyCsvForTable(table))
    }

    const buf = await zip.generateAsync({ type: 'arraybuffer' })
    const res = await importCsvBundleZip({} as unknown as DbClient, {
      userId: '11111111-1111-1111-1111-111111111111',
      zipData: buf,
      mode: 'dry-run',
    })

    expect(res.ok).toBe(true)
    expect(res.format).toBe('peptaide-csv-bundle-v1')
    expect(res.tables).toHaveLength(tables.length)
    expect(res.errors).toEqual([])
  })

  it('returns a structured error for invalid ZIP data', async () => {
    const buf = new TextEncoder().encode('not a zip').buffer
    const res = await importCsvBundleZip({} as unknown as DbClient, {
      userId: '11111111-1111-1111-1111-111111111111',
      zipData: buf,
      mode: 'dry-run',
    })

    expect(res.ok).toBe(false)
    expect(res.errors[0]).toMatch(/Invalid ZIP/i)
    expect(res.tables).toEqual([])
  })

  it('rejects bundles missing table CSVs', async () => {
    const zip = new JSZip()
    zip.file(
      'meta.json',
      `${JSON.stringify(
        { format: 'peptaide-csv-bundle-v1', exported_at: '2026-02-07T00:00:00.000Z', tables: [] },
        null,
        2,
      )}\n`,
    )

    const buf = await zip.generateAsync({ type: 'arraybuffer' })
    const res = await importCsvBundleZip({} as unknown as DbClient, {
      userId: '11111111-1111-1111-1111-111111111111',
      zipData: buf,
      mode: 'dry-run',
    })

    expect(res.ok).toBe(false)
    expect(res.tables.some((t) => t.errors.some((e) => e.includes('Missing tables/')))).toBe(true)
  })
})
