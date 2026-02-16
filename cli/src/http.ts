import type { CliEnvelope, RuntimeConfig, StoredTokens } from './types.js'
import { getProfile, saveTokens } from './profile-store.js'
import { requestId } from './config.js'

function normalizeEnvelope(payload: unknown, rid: string): CliEnvelope {
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      code: 'runtime_error',
      message: 'Invalid response payload from server.',
      data: null,
      warnings: [],
      errors: [String(payload)],
      request_id: rid,
    }
  }

  const data = payload as Partial<CliEnvelope>
  return {
    ok: Boolean(data.ok),
    code: typeof data.code === 'string' ? data.code : 'runtime_error',
    message: typeof data.message === 'string' ? data.message : 'Unknown server response.',
    data: data.data ?? null,
    warnings: Array.isArray(data.warnings) ? data.warnings.map((x) => String(x)) : [],
    errors: Array.isArray(data.errors) ? data.errors.map((x) => String(x)) : [],
    request_id: typeof data.request_id === 'string' ? data.request_id : rid,
  }
}

function buildNetworkError(message: string, rid: string, code: string = 'runtime_error'): CliEnvelope {
  return {
    ok: false,
    code,
    message,
    data: null,
    warnings: [],
    errors: [message],
    request_id: rid,
  }
}

function tokensFromProfile(config: RuntimeConfig): StoredTokens | null {
  const profile = getProfile(config.profile)
  if (!profile.access_token || !profile.refresh_token) return null
  return {
    access_token: profile.access_token,
    refresh_token: profile.refresh_token,
    expires_at: typeof profile.expires_at === 'number' ? profile.expires_at : null,
    token_type: profile.token_type || 'bearer',
  }
}

export async function callApi(opts: {
  config: RuntimeConfig
  domain: string
  payload: Record<string, unknown>
  authRequired?: boolean
}): Promise<CliEnvelope> {
  const config = opts.config
  const rid = requestId(config.requestId)

  let bearerToken = config.envAuthToken
  const stored = tokensFromProfile(config)
  if (!bearerToken && stored?.access_token) {
    bearerToken = stored.access_token
  }

  if (opts.authRequired && !bearerToken) {
    return {
      ok: false,
      code: 'auth_required',
      message: 'Missing auth token. Run `peptaide auth verify` first.',
      data: null,
      warnings: [],
      errors: ['No access token found in environment or profile store.'],
      request_id: rid,
    }
  }

  const baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : `${config.apiUrl}/`
  const url = new URL(`api/cli/${opts.domain}`, baseUrl)

  const doFetch = async (token: string | null): Promise<CliEnvelope> => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': rid,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(opts.payload),
        signal: AbortSignal.timeout(config.timeoutMs),
      })

      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        const raw = await response.text().catch(() => '')
        return buildNetworkError(
          `Server returned non-JSON response (HTTP ${response.status}): ${raw.slice(0, 200)}`,
          rid,
        )
      }

      return normalizeEnvelope(payload, rid)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const timedOut = message.toLowerCase().includes('aborted') || message.toLowerCase().includes('timeout')
      return buildNetworkError(timedOut ? 'Network request timed out.' : message, rid, timedOut ? 'network_timeout' : 'runtime_error')
    }
  }

  let envelope = await doFetch(bearerToken)

  if (
    opts.authRequired &&
    !config.envAuthToken &&
    !envelope.ok &&
    (envelope.code === 'auth_failed' || envelope.code === 'auth_required') &&
    stored?.refresh_token
  ) {
    const isAlreadyRefreshCall =
      opts.domain === 'auth' &&
      typeof opts.payload.action === 'string' &&
      String(opts.payload.action) === 'refresh'

    if (!isAlreadyRefreshCall) {
      const refreshResult = await callApi({
        config,
        domain: 'auth',
        payload: {
          action: 'refresh',
          refresh_token: stored.refresh_token,
        },
        authRequired: false,
      })

      if (refreshResult.ok && refreshResult.data && typeof refreshResult.data === 'object') {
        const tokenData = refreshResult.data as Record<string, unknown>
        const accessToken = String(tokenData.access_token ?? '')
        const refreshToken = String(tokenData.refresh_token ?? '')
        if (accessToken && refreshToken) {
          saveTokens(config.profile, {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at:
              typeof tokenData.expires_at === 'number' && Number.isFinite(tokenData.expires_at)
                ? tokenData.expires_at
                : null,
            token_type: String(tokenData.token_type ?? 'bearer'),
          })
          envelope = await doFetch(accessToken)
        }
      } else if (config.verbose) {
        return refreshResult
      }
    }
  }

  return envelope
}
