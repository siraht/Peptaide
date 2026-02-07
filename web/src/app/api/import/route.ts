import { importCsvBundleZip, type ImportMode } from '@/lib/import/csvBundle'
import { validateSameOrigin } from '@/lib/http/sameOrigin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAX_ZIP_BYTES = 50 * 1024 * 1024

function parseMode(raw: string | null): ImportMode {
  if (raw === 'apply') return 'apply'
  return 'dry-run'
}

export async function POST(request: Request): Promise<Response> {
  let mode: ImportMode = 'dry-run'

  try {
    const url = new URL(request.url)
    mode = parseMode(url.searchParams.get('mode'))
    const replaceExisting = url.searchParams.get('replace') === '1'

    const originError = validateSameOrigin(request)
    if (originError) {
      return Response.json(
        { ok: false, mode, errors: [originError], tables: [] },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      return Response.json(
        { ok: false, mode, errors: ['Unauthorized'], tables: [] },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const form = await request.formData()
    const rawFile = form.get('bundle') ?? form.get('file')
    if (!(rawFile instanceof File)) {
      return Response.json(
        { ok: false, mode, errors: ['Missing file field "bundle" (or "file").'], tables: [] },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (rawFile.size > MAX_ZIP_BYTES) {
      return Response.json(
        {
          ok: false,
          mode,
          errors: [
            `ZIP bundle is too large (${rawFile.size} bytes). Maximum supported size is ${MAX_ZIP_BYTES} bytes.`,
          ],
          tables: [],
        },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const buf = await rawFile.arrayBuffer()
    const result = await importCsvBundleZip(supabase, {
      userId: data.user.id,
      zipData: buf,
      mode,
      replaceExisting,
    })

    return Response.json(result, {
      status: result.ok ? 200 : 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json(
      { ok: false, mode, errors: [msg], tables: [] },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
