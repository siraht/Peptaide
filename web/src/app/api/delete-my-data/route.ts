import { deleteAllMyData } from '@/lib/import/deleteMyData'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      return Response.json(
        { ok: false, errors: ['Unauthorized'] },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    await deleteAllMyData(supabase, { userId: data.user.id })

    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json(
      { ok: false, errors: [msg] },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
