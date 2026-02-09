import { createClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

import { getSupabaseServerEnv } from '@/lib/supabase/env'

export const runtime = 'nodejs'

function firstHeaderValue(v: string | null): string | null {
  if (!v) return null
  const first = v.split(',')[0]?.trim()
  return first || null
}

function getRequestOrigin(request: NextRequest): string {
  const url = new URL(request.url)
  const proto = firstHeaderValue(request.headers.get('x-forwarded-proto')) || url.protocol.replace(':', '')
  const host =
    firstHeaderValue(request.headers.get('x-forwarded-host')) ||
    firstHeaderValue(request.headers.get('host')) ||
    url.host
  return `${proto}://${host}`
}

export async function POST(request: NextRequest): Promise<Response> {
  let payload: unknown = null
  try {
    payload = await request.json()
  } catch {
    // ignore
  }

  const email = typeof (payload as any)?.email === 'string' ? String((payload as any).email).trim() : ''
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 })
  }

  const origin = getRequestOrigin(request)
  const { url: supabaseUrl, anonKey } = getSupabaseServerEnv()

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      flowType: 'pkce',
    },
  })

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

