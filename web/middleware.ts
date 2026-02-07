import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { getSupabaseEnv } from '@/lib/supabase/env'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const { url, anonKey } = getSupabaseEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // Keep the request cookies in-sync so `getAll` sees the updates.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        // Refresh `response` and attach the cookies as Set-Cookie headers.
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  // Mandatory for correct session refresh in SSR frameworks.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

