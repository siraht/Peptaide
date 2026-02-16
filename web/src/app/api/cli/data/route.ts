import JSZip from 'jszip'
import { z } from 'zod'

import { dataDeleteAllRequestSchema } from '@/lib/api/contracts/cli'
import { rowsToCsv } from '@/lib/export/csv'
import { EXPORT_COLUMNS, type ExportTableName } from '@/lib/export/exportColumns'
import { exportAllRowsForTable } from '@/lib/repos/exportRepo'
import { importCsvBundleZip } from '@/lib/import/csvBundle'
import { deleteAllMyData } from '@/lib/import/deleteMyData'
import { importSimpleEventsCsv } from '@/lib/import/simpleEvents'
import { validateSameOrigin } from '@/lib/http/sameOrigin'

import { requireCliBearer } from '@/lib/api/cli/auth'
import { withIdempotency } from '@/lib/api/cli/idempotency'
import { readJsonBody, requireApply, validateBody } from '@/lib/api/cli/request'
import { runCliRoute } from '@/lib/api/cli/route'
import { CliApiError, okEnvelope } from '@/lib/api/cli/response'

export const runtime = 'nodejs'

type DataAction = 'export' | 'import_bundle' | 'import_simple_events' | 'delete_all'

const exportRequestSchema = z.object({
  out: z.string().optional(),
})

const importBundleRequestSchema = z.object({
  zip_base64: z.string().min(1),
  replace: z.boolean().optional(),
  apply: z.boolean().optional(),
  dry_run: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

const importSimpleEventsRequestSchema = z.object({
  csv_text: z.string().min(1),
  replace: z.boolean().optional(),
  infer_cycles: z.boolean().optional(),
  apply: z.boolean().optional(),
  dry_run: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

function readAction(payload: unknown): DataAction {
  const action =
    payload && typeof payload === 'object' && 'action' in payload
      ? String((payload as { action?: unknown }).action ?? '').trim()
      : ''

  switch (action) {
    case 'export':
    case 'import_bundle':
    case 'import_simple_events':
    case 'delete_all':
      return action
    default:
      throw new CliApiError({
        code: 'validation_error',
        status: 400,
        message: 'Invalid data action.',
        details: ['Supported actions: export, import_bundle, import_simple_events, delete_all'],
      })
  }
}

export async function POST(request: Request): Promise<Response> {
  return runCliRoute(request, async (requestId) => {
    const originError = validateSameOrigin(request)
    if (originError) {
      throw new CliApiError({ code: 'forbidden', status: 403, message: originError })
    }

    const auth = await requireCliBearer(request)
    const body = await readJsonBody(request)
    const action = readAction(body)

    if (action === 'export') {
      validateBody(exportRequestSchema, body)

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
        const rows = await exportAllRowsForTable(auth.supabase, { table })
        const columns = EXPORT_COLUMNS[table]
        zip.file(`tables/${table}.csv`, rowsToCsv(rows, columns))
      }

      const buf = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })

      return {
        envelope: okEnvelope({
          requestId,
          message: 'Export bundle generated.',
          data: {
            filename: `peptaide-export-${exportedAt.slice(0, 10)}.zip`,
            format: 'base64',
            zip_base64: buf.toString('base64'),
            bytes: buf.length,
          },
        }),
      }
    }

    if (action === 'import_bundle') {
      const payload = validateBody(importBundleRequestSchema, body)
      const applyMode = requireApply({ apply: payload.apply, dryRun: payload.dry_run, command: 'data import-bundle' })

      const execImportBundle = async () => {
        const mode = applyMode.dryRun ? 'dry-run' : 'apply'
        const bytes = Buffer.from(payload.zip_base64, 'base64')
        const zipData = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer
        const result = await importCsvBundleZip(auth.supabase, {
          userId: auth.user.id,
          zipData,
          mode,
          replaceExisting: Boolean(payload.replace),
        })

        return {
          status: result.ok ? 200 : 400,
          envelope: okEnvelope({
            requestId,
            code: applyMode.dryRun ? 'dry_run' : result.ok ? 'ok' : 'validation_error',
            message: result.ok ? 'Import bundle processed.' : 'Import bundle reported errors.',
            data: result,
          }),
        }
      }

      if (!applyMode.dryRun && payload.idempotency_key) {
        return withIdempotency({
          supabase: auth.supabase,
          operation: 'data.import_bundle',
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: execImportBundle,
        })
      }

      return execImportBundle()
    }

    if (action === 'import_simple_events') {
      const payload = validateBody(importSimpleEventsRequestSchema, body)
      const applyMode = requireApply({
        apply: payload.apply,
        dryRun: payload.dry_run,
        command: 'data import-simple-events',
      })

      const execImportSimpleEvents = async () => {
        const mode = applyMode.dryRun ? 'dry-run' : 'apply'
        const result = await importSimpleEventsCsv(auth.supabase, {
          userId: auth.user.id,
          csvText: payload.csv_text,
          mode,
          replaceExisting: Boolean(payload.replace),
          inferCycles: payload.infer_cycles ?? true,
        })

        return {
          status: result.ok ? 200 : 400,
          envelope: okEnvelope({
            requestId,
            code: applyMode.dryRun ? 'dry_run' : result.ok ? 'ok' : 'validation_error',
            message: result.ok ? 'Simple-events import processed.' : 'Simple-events import reported errors.',
            data: result,
          }),
        }
      }

      if (!applyMode.dryRun && payload.idempotency_key) {
        return withIdempotency({
          supabase: auth.supabase,
          operation: 'data.import_simple_events',
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: execImportSimpleEvents,
        })
      }

      return execImportSimpleEvents()
    }

    const payload = validateBody(dataDeleteAllRequestSchema, body)
    const applyMode = requireApply({ apply: payload.apply, dryRun: payload.dry_run, command: 'data delete-all' })

    const execDeleteAll = async () => {
      if (applyMode.dryRun) {
        return {
          status: 200,
          envelope: okEnvelope({
            requestId,
            code: 'dry_run',
            message: 'Dry run complete.',
            data: {
              action: 'delete_all',
              confirm: payload.confirm,
            },
          }),
        }
      }

      await deleteAllMyData(auth.supabase, { userId: auth.user.id })
      return {
        status: 200,
        envelope: okEnvelope({
          requestId,
          message: 'All user data deleted.',
          data: { deleted: true },
        }),
      }
    }

    if (payload.idempotency_key) {
      return withIdempotency({
        supabase: auth.supabase,
        operation: 'data.delete_all',
        idempotencyKey: payload.idempotency_key,
        requestPayload: payload,
        execute: execDeleteAll,
      })
    }

    return execDeleteAll()
  })
}
