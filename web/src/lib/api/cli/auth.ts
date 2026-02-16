import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js'

import { getSupabaseServerEnv } from '@/lib/supabase/env'
import type { Database } from '@/lib/supabase/database.types'

import { CliApiError } from './response'

type CliAuthed = {
  accessToken: string
  supabase: SupabaseClient<Database>
  user: User
}

export function readBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match || !match[1]) return null
  const token = match[1].trim()
  return token || null
}

export function createAnonSupabaseClient(): SupabaseClient<Database> {
  const { url, anonKey } = getSupabaseServerEnv()
  return createSupabaseClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function createBearerSupabaseClient(accessToken: string): SupabaseClient<Database> {
  const { url, anonKey } = getSupabaseServerEnv()
  return createSupabaseClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

export async function requireCliBearer(request: Request): Promise<CliAuthed> {
  const accessToken = readBearerToken(request)
  if (!accessToken) {
    throw new CliApiError({
      code: 'auth_required',
      status: 401,
      message: 'Missing bearer token. Run `peptaide auth verify` or provide PEPTAIDE_AUTH_TOKEN.',
    })
  }

  const supabase = createBearerSupabaseClient(accessToken)
  const userRes = await supabase.auth.getUser(accessToken)
  if (userRes.error || !userRes.data.user) {
    throw new CliApiError({
      code: 'auth_failed',
      status: 401,
      message: 'Invalid or expired bearer token.',
      details: [userRes.error?.message ?? 'No authenticated user.'],
    })
  }

  return {
    accessToken,
    supabase,
    user: userRes.data.user,
  }
}
