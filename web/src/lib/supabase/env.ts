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

  if (!publicUrl || !publicAnonKey) {
    throw new Error(
      'Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (for local dev, see `supabase status`).',
    )
  }

  // IMPORTANT: Supabase SSR stores auth state in cookies whose names are derived from the Supabase
  // project ref (and therefore from the Supabase URL hostname). If the server uses a different
  // hostname than the browser, cookie names won't match and PKCE exchanges (magic links / OAuth)
  // will fail. Only allow SUPABASE_INTERNAL_URL when it keeps the same hostname.
  const internalUrl = process.env.SUPABASE_INTERNAL_URL
  const internalAnonKey = process.env.SUPABASE_INTERNAL_ANON_KEY

  if (internalUrl) {
    try {
      const publicHost = new URL(publicUrl).hostname
      const internalHost = new URL(internalUrl).hostname
      if (publicHost === internalHost) {
        return { url: internalUrl, anonKey: internalAnonKey || publicAnonKey }
      }
    } catch {
      // Ignore invalid SUPABASE_INTERNAL_URL values and fall back to public env.
    }
  }

  return { url: publicUrl, anonKey: publicAnonKey }
}
