function getPublicEnv(): { url: string | undefined; anonKey: string | undefined } {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

export function getSupabaseBrowserEnv(): { url: string; anonKey: string } {
  const { url, anonKey } = getPublicEnv()

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (for local dev, see `supabase status`).',
    )
  }

  return { url, anonKey }
}

export function getSupabaseServerEnv(): { url: string; anonKey: string } {
  const { url: publicUrl, anonKey: publicAnonKey } = getPublicEnv()
  const url = process.env.SUPABASE_INTERNAL_URL || publicUrl
  const anonKey = process.env.SUPABASE_INTERNAL_ANON_KEY || publicAnonKey

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (for local dev), and optionally SUPABASE_INTERNAL_URL for server-only access.',
    )
  }

  return { url, anonKey }
}
