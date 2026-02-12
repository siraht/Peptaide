import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'

function requiredEnv(name: string): string {
  const value = String(process.env[name] || '').trim()
  if (!value) {
    throw new Error(`Missing env ${name}. For local tests, run \`supabase status\` and export the value.`)
  }
  return value
}

/**
 * Returns a service-role Supabase client for integration tests.
 *
 * Expected env vars:
 * - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL fallback)
 * - SUPABASE_SERVICE_ROLE_KEY
 */
export function createServiceRoleTestClient() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim() || requiredEnv('SUPABASE_URL')
  const serviceRole = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createClient<Database>(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
