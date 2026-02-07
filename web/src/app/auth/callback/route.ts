import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { getSupabaseEnv } from '@/lib/supabase/env'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/today'

  // Create the redirect response up front so we can attach Set-Cookie headers.
  const response = NextResponse.redirect(new URL(next, url.origin))

  if (code) {
    const { url: supabaseUrl, anonKey } = getSupabaseEnv()
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
