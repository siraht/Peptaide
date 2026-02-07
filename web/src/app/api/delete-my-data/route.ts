import { deleteAllMyData } from '@/lib/import/deleteMyData'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(): Promise<Response> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  await deleteAllMyData(supabase, { userId: data.user.id })

  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

