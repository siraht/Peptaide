import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { getSupabaseServerEnv } from '@/lib/supabase/env'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<Response> {
  let payload: unknown = null
  try {
    payload = await request.json()
  } catch {
    // ignore
  }

  const email = typeof (payload as any)?.email === 'string' ? String((payload as any).email).trim() : ''
  const token = typeof (payload as any)?.token === 'string' ? String((payload as any).token).trim() : ''
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 })
  }
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Code is required.' }, { status: 400 })
  }

  const { url: supabaseUrl, anonKey } = getSupabaseServerEnv()
  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(supabaseUrl, anonKey, {
    auth: {
      flowType: 'pkce',
    },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // Keep request cookies in sync (important if multiple writes happen).
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        // Attach to the response as Set-Cookie headers.
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  return response
}

