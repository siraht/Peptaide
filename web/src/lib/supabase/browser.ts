import { createBrowserClient } from '@supabase/ssr'

import type { Database } from './database.types'
import { getSupabaseBrowserEnv } from './env'

function fetchWithTimeout(timeoutMs: number): typeof fetch {
  const ms = Math.max(1, Number(timeoutMs) || 1)

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController()

    // Propagate upstream abort (if any) into our controller so either signal cancels the fetch.
    const upstream = init?.signal
    if (upstream) {
      if (upstream.aborted) {
        controller.abort()
      } else {
        upstream.addEventListener('abort', () => controller.abort(), { once: true })
      }
    }

    const timeoutId = setTimeout(() => controller.abort(), ms)
    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export function createClient() {
  const { url, anonKey } = getSupabaseBrowserEnv()
  return createBrowserClient<Database>(url, anonKey, {
    auth: {
      flowType: 'pkce',
    },
    // Avoid infinite "Sending..." hangs when the browser cannot reach the Supabase gateway.
    global: {
      fetch: fetchWithTimeout(12_000),
    },
  })
}
