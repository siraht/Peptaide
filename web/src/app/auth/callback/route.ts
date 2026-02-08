import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { getSupabaseServerEnv } from '@/lib/supabase/env'

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const origin = getRequestOrigin(request)

  const code = url.searchParams.get('code')
  const nextRaw = url.searchParams.get('next')
  let next = '/today'
  if (nextRaw) {
    try {
      const resolved = new URL(nextRaw, origin)
      // Prevent open-redirects; only allow same-origin return URLs.
      if (resolved.origin === origin) {
        next = `${resolved.pathname}${resolved.search}${resolved.hash}`
      }
    } catch {
      // Ignore invalid `next` values and fall back to default.
    }
  }

  // Create the redirect response up front so we can attach Set-Cookie headers.
  const response = NextResponse.redirect(new URL(next, origin))

  if (code) {
    const { url: supabaseUrl, anonKey } = getSupabaseServerEnv()
    const supabase = createServerClient(supabaseUrl, anonKey, {
      auth: {
        flowType: 'pkce',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Keep request cookies in sync and attach Set-Cookie headers to the redirect response.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })
    await supabase.auth.exchangeCodeForSession(code)
  }

  return response
}
