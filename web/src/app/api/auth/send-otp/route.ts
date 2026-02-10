import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { validateSameOrigin } from '@/lib/http/sameOrigin'
import { getSupabaseServerEnv } from '@/lib/supabase/env'

export const runtime = 'nodejs'

type CookieOptions = {
  domain?: string
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  path?: string
  sameSite?: boolean | 'lax' | 'strict' | 'none'
  secure?: boolean
}

function firstHeaderValue(v: string | null): string | null {
  if (!v) return null
  const first = v.split(',')[0]?.trim()
  return first || null
}

function readEmail(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const email = (payload as { email?: unknown }).email
  return typeof email === 'string' ? email.trim() : ''
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

  const email = readEmail(payload)
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 })
  }

  const originError = validateSameOrigin(request)
  if (originError) {
    return NextResponse.json({ ok: false, error: originError }, { status: 403 })
  }

  // Dangerous: exposes OTP codes in the response (for private dev environments only).
  // Keep gated behind an explicit env var and same-origin enforcement.
  const shouldExposeOtp = String(process.env.PEPTAIDE_DEV_EXPOSE_OTP || '').trim() === '1'

  const origin = getRequestOrigin(request)
  const { url: supabaseUrl, anonKey } = getSupabaseServerEnv()

  const cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }> = []

  const supabase = createServerClient(supabaseUrl, anonKey, {
    auth: {
      flowType: 'pkce',
    },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(items) {
        // Keep request cookies in sync (important if multiple writes happen).
        items.forEach(({ name, value }) => request.cookies.set(name, value))
        // Buffer cookie writes so we can attach them to the final JSON response.
        items.forEach(({ name, value, options }) => cookiesToSet.push({ name, value, options }))
      },
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

  const response = NextResponse.json({ ok: true, dev_exposed: shouldExposeOtp })
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}
