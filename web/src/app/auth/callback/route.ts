import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { getSupabaseServerEnv } from '@/lib/supabase/env'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const nextRaw = url.searchParams.get('next')
  let next = '/today'
  if (nextRaw) {
    try {
      const resolved = new URL(nextRaw, url.origin)
      // Prevent open-redirects; only allow same-origin return URLs.
      if (resolved.origin === url.origin) {
        next = `${resolved.pathname}${resolved.search}${resolved.hash}`
      }
    } catch {
      // Ignore invalid `next` values and fall back to default.
    }
  }

  // Create the redirect response up front so we can attach Set-Cookie headers.
  const response = NextResponse.redirect(new URL(next, url.origin))

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
