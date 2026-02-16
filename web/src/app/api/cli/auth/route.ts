import { authLoginRequestSchema, authRefreshRequestSchema, authVerifyRequestSchema } from '@/lib/api/contracts/cli'
import { ensureMyProfile } from '@/lib/repos/profilesRepo'
import { validateSameOrigin } from '@/lib/http/sameOrigin'

import { createAnonSupabaseClient, requireCliBearer } from '@/lib/api/cli/auth'
import { readJsonBody, validateBody } from '@/lib/api/cli/request'
import { runCliRoute } from '@/lib/api/cli/route'
import { CliApiError, okEnvelope } from '@/lib/api/cli/response'

export const runtime = 'nodejs'

type AuthAction = 'login' | 'verify' | 'refresh' | 'whoami' | 'logout'

function readAction(payload: unknown): AuthAction {
  const action =
    payload && typeof payload === 'object' && 'action' in payload
      ? String((payload as { action?: unknown }).action ?? '').trim()
      : ''

  switch (action) {
    case 'login':
    case 'verify':
    case 'refresh':
    case 'whoami':
    case 'logout':
      return action
    default:
      throw new CliApiError({
        code: 'validation_error',
        status: 400,
        message: 'Invalid auth action.',
        details: ['Supported actions: login, verify, refresh, whoami, logout'],
      })
  }
}

export async function POST(request: Request): Promise<Response> {
  return runCliRoute(request, async (requestId) => {
    const originError = validateSameOrigin(request)
    if (originError) {
      throw new CliApiError({
        code: 'forbidden',
        status: 403,
        message: originError,
      })
    }

    const body = await readJsonBody(request)
    const action = readAction(body)

    if (action === 'login') {
      const payload = validateBody(authLoginRequestSchema, body)
      const supabase = createAnonSupabaseClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: payload.email,
      })
      if (error) {
        throw new CliApiError({
          code: 'auth_failed',
          status: 400,
          message: 'Failed to send OTP email.',
          details: [error.message],
        })
      }

      return {
        envelope: okEnvelope({
          requestId,
          message: 'OTP code sent. Check your email and run `peptaide auth verify`.',
          data: {
            email: payload.email,
          },
        }),
      }
    }

    if (action === 'verify') {
      const payload = validateBody(authVerifyRequestSchema, body)
      const supabase = createAnonSupabaseClient()
      const { data, error } = await supabase.auth.verifyOtp({
        email: payload.email,
        token: payload.code,
        type: 'email',
      })

      if (error || !data.session) {
        throw new CliApiError({
          code: 'auth_failed',
          status: 401,
          message: 'OTP verification failed.',
          details: [error?.message ?? 'No session was returned by Supabase.'],
        })
      }

      return {
        envelope: okEnvelope({
          requestId,
          message: 'Authenticated.',
          data: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            expires_in: data.session.expires_in,
            token_type: data.session.token_type,
            user: data.user,
          },
        }),
      }
    }

    if (action === 'refresh') {
      const payload = validateBody(authRefreshRequestSchema, body)
      const supabase = createAnonSupabaseClient()
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: payload.refresh_token,
      })

      if (error || !data.session) {
        throw new CliApiError({
          code: 'auth_failed',
          status: 401,
          message: 'Refresh token is invalid or expired.',
          details: [error?.message ?? 'No refreshed session returned.'],
        })
      }

      return {
        envelope: okEnvelope({
          requestId,
          message: 'Token refreshed.',
          data: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            expires_in: data.session.expires_in,
            token_type: data.session.token_type,
            user: data.user,
          },
        }),
      }
    }

    if (action === 'whoami') {
      const auth = await requireCliBearer(request)
      const profile = await ensureMyProfile(auth.supabase)

      return {
        envelope: okEnvelope({
          requestId,
          message: 'Authenticated user context loaded.',
          data: {
            user: auth.user,
            profile,
          },
        }),
      }
    }

    const auth = await requireCliBearer(request)
    await auth.supabase.auth.signOut()
    return {
      envelope: okEnvelope({
        requestId,
        message: 'Logged out from current bearer session.',
        data: null,
      }),
    }
  })
}
