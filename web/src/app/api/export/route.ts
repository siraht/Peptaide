import JSZip from 'jszip'

import { rowsToCsv } from '@/lib/export/csv'
import { EXPORT_COLUMNS, type ExportTableName } from '@/lib/export/exportColumns'
import { exportAllRowsForTable } from '@/lib/repos/exportRepo'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const exportedAt = new Date().toISOString()
  const tableNames = Object.keys(EXPORT_COLUMNS).sort((a, b) => a.localeCompare(b)) as ExportTableName[]

  const zip = new JSZip()
  zip.file(
    'meta.json',
    `${JSON.stringify(
      {
        format: 'peptaide-csv-bundle-v1',
        exported_at: exportedAt,
        tables: tableNames,
      },
      null,
      2,
    )}\n`,
  )
  zip.file(
    'README.txt',
    [
      'Peptaide data export (CSV bundle).',
      '',
      '- Each public table is exported to tables/<table>.csv with a header row.',
      '- Values are exported as strings; arrays/objects are JSON-encoded within a single CSV cell.',
      '- This export is generated under the signed-in user session (RLS enforced).',
      '',
    ].join('\n'),
  )

  for (const table of tableNames) {
    const rows = await exportAllRowsForTable(supabase, { table })
    const columns = EXPORT_COLUMNS[table]
    const csv = rowsToCsv(rows, columns)
    zip.file(`tables/${table}.csv`, csv)
  }

  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const filename = `peptaide-export-${exportedAt.slice(0, 10)}.zip`
  // Some TS lib setups don't treat Node's Buffer as a valid Response body type.
  // Convert to a Uint8Array to satisfy the DOM BodyInit type.
  const body = new Uint8Array(buf)
  return new Response(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
