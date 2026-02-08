import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from './database.types'
import { getSupabaseServerEnv } from './env'

export async function createClient() {
  const { url, anonKey } = getSupabaseServerEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, anonKey, {
    auth: {
      flowType: 'pkce',
    },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components can't set cookies. Route handlers and Server Actions can.
        }
      },
    },
  })
}
