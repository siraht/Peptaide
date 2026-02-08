import { createBrowserClient } from '@supabase/ssr'

import type { Database } from './database.types'
import { getSupabaseBrowserEnv } from './env'

export function createClient() {
  const { url, anonKey } = getSupabaseBrowserEnv()
  return createBrowserClient<Database>(url, anonKey, {
    auth: {
      flowType: 'pkce',
    },
  })
}
