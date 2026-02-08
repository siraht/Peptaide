import { importSimpleEventsCsv, type ImportMode } from '@/lib/import/simpleEvents'
import { validateSameOrigin } from '@/lib/http/sameOrigin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_CSV_BYTES = 10 * 1024 * 1024

function emptySummary() {
  return {
    input_rows: 0,
    imported_events: 0,
    created_substances: 0,
    created_routes: 0,
    created_formulations: 0,
    created_cycles: 0,
  }
}

function parseMode(raw: string | null): ImportMode {
  if (raw === 'apply') return 'apply'
  return 'dry-run'
}

function parseBool(raw: string | null, defaultValue: boolean): boolean {
  if (raw == null) return defaultValue
  if (raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes') return true
  if (raw === '0' || raw.toLowerCase() === 'false' || raw.toLowerCase() === 'no') return false
  return defaultValue
}

export async function POST(request: Request): Promise<Response> {
  let mode: ImportMode = 'dry-run'

  try {
    const url = new URL(request.url)
    mode = parseMode(url.searchParams.get('mode'))
    const replaceExisting = url.searchParams.get('replace') === '1'
    const inferCycles = parseBool(url.searchParams.get('infer_cycles'), true)

    const originError = validateSameOrigin(request)
    if (originError) {
      return Response.json(
        { ok: false, mode, errors: [originError], warnings: [], row_errors: [], summary: emptySummary() },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      return Response.json(
        { ok: false, mode, errors: ['Unauthorized'], warnings: [], row_errors: [], summary: emptySummary() },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const form = await request.formData()
    const rawFile = form.get('file') ?? form.get('events') ?? form.get('csv')
    if (!(rawFile instanceof File)) {
      return Response.json(
        { ok: false, mode, errors: ['Missing file field "file" (or "events"/"csv").'], warnings: [], row_errors: [], summary: emptySummary() },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (rawFile.size > MAX_CSV_BYTES) {
      return Response.json(
        {
          ok: false,
          mode,
          errors: [`CSV file is too large (${rawFile.size} bytes). Maximum supported size is ${MAX_CSV_BYTES} bytes.`],
          warnings: [],
          row_errors: [],
          summary: emptySummary(),
        },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const csvText = await rawFile.text()
    const result = await importSimpleEventsCsv(supabase, {
      userId: data.user.id,
      csvText,
      mode,
      replaceExisting,
      inferCycles,
    })

    return Response.json(result, {
      status: result.ok ? 200 : 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json(
      { ok: false, mode, errors: [msg], warnings: [], row_errors: [], summary: emptySummary() },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
