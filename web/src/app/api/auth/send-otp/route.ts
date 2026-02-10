import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { validateSameOrigin } from '@/lib/http/sameOrigin'
import { getSupabaseServerEnv } from '@/lib/supabase/env'

export const runtime = 'nodejs'

type MailpitList = { messages?: Array<{ ID?: string; To?: Array<{ Address?: string }>; Created?: string }> }
type MailpitMessage = { Text?: string; HTML?: string }
type CookieOptions = {
  domain?: string
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  path?: string
  sameSite?: boolean | 'lax' | 'strict' | 'none'
  secure?: boolean
}

function firstHeaderValue(v: string | null): string | null {
  if (!v) return null
  const first = v.split(',')[0]?.trim()
  return first || null
}

function readEmail(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const email = (payload as { email?: unknown }).email
  return typeof email === 'string' ? email.trim() : ''
}

function extractOtpCodeFromMagicLinkText(text: string): string | null {
  const s = String(text || '')
  const match = s.match(/(?:enter the code:\\s*)(\\d{6})/i)
  if (match && match[1]) return match[1]
  const match2 = s.match(/\\b(\\d{6})\\b/)
  if (match2 && match2[1]) return match2[1]
  return null
}

async function mailpitFetchJson<T>(baseUrl: string, pathname: string): Promise<T> {
  const url = new URL(pathname, baseUrl)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Mailpit ${url.toString()} returned HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

async function mailpitMessageIdsForEmail(email: string, baseUrl: string): Promise<Set<string>> {
  const list = await mailpitFetchJson<MailpitList>(baseUrl, '/api/v1/messages')
  const messages = Array.isArray(list.messages) ? list.messages : []
  const ids = new Set<string>()

  for (const m of messages) {
    if (!m || !m.ID) continue
    const tos = Array.isArray(m.To) ? m.To : []
    const toMatch = tos.some((t) => t && String(t.Address || '').toLowerCase() === email.toLowerCase())
    if (toMatch) ids.add(String(m.ID))
  }

  return ids
}

async function waitForOtpCodeFromMailpit(
  email: string,
  opts: { baseUrl: string; excludeIds?: Set<string>; sinceMs?: number; timeoutMs?: number },
): Promise<string | null> {
  const timeoutMs = opts.timeoutMs ?? 8000
  const start = Date.now()
  for (;;) {
    const list = await mailpitFetchJson<MailpitList>(opts.baseUrl, '/api/v1/messages')
    const messages = Array.isArray(list.messages) ? list.messages : []

    const match = messages.find((m) => {
      if (!m || !m.ID) return false
      if (opts.excludeIds && opts.excludeIds.has(String(m.ID))) return false
      const createdMs = m.Created ? Date.parse(m.Created) : null
      if (opts.sinceMs && createdMs && createdMs < opts.sinceMs) return false
      const tos = Array.isArray(m.To) ? m.To : []
      return tos.some((t) => t && String(t.Address || '').toLowerCase() === email.toLowerCase())
    })

    if (match?.ID) {
      const msg = await mailpitFetchJson<MailpitMessage>(opts.baseUrl, `/api/v1/message/${match.ID}`)
      const code = extractOtpCodeFromMagicLinkText(msg.Text || msg.HTML || '')
      if (code) return code
    }

    if (Date.now() - start > timeoutMs) return null
    await new Promise((r) => setTimeout(r, 400))
  }
}

function getRequestOrigin(request: NextRequest): string {
  const url = new URL(request.url)
  const proto = firstHeaderValue(request.headers.get('x-forwarded-proto')) || url.protocol.replace(':', '')
  const host =
    firstHeaderValue(request.headers.get('x-forwarded-host')) ||
    firstHeaderValue(request.headers.get('host')) ||
    url.host
  return `${proto}://${host}`
}

export async function POST(request: NextRequest): Promise<Response> {
  let payload: unknown = null
  try {
    payload = await request.json()
  } catch {
    // ignore
  }

  const email = readEmail(payload)
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 })
  }

  const originError = validateSameOrigin(request)
  if (originError) {
    return NextResponse.json({ ok: false, error: originError }, { status: 403 })
  }

  // Dangerous: exposes OTP codes in the response (for private dev environments only).
  // Keep gated behind an explicit env var and same-origin enforcement.
  const shouldExposeOtp = String(process.env.PEPTAIDE_DEV_EXPOSE_OTP || '').trim() === '1'
  const mailpitBaseUrl = String(process.env.PEPTAIDE_MAILPIT_URL || 'http://127.0.0.1:54324').trim()
  let excludeMailpitIds: Set<string> | null = null
  if (shouldExposeOtp) {
    try {
      excludeMailpitIds = await mailpitMessageIdsForEmail(email, mailpitBaseUrl)
    } catch {
      excludeMailpitIds = null
    }
  }

  const origin = getRequestOrigin(request)
  const { url: supabaseUrl, anonKey } = getSupabaseServerEnv()

  const cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }> = []

  const supabase = createServerClient(supabaseUrl, anonKey, {
    auth: {
      flowType: 'pkce',
    },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(items) {
        // Keep request cookies in sync (important if multiple writes happen).
        items.forEach(({ name, value }) => request.cookies.set(name, value))
        // Buffer cookie writes so we can attach them to the final JSON response.
        items.forEach(({ name, value, options }) => cookiesToSet.push({ name, value, options }))
      },
    },
  })

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  const body: { ok: boolean; dev_code?: string } = { ok: true }

  if (shouldExposeOtp) {
    try {
      const devCode = await waitForOtpCodeFromMailpit(email, {
        baseUrl: mailpitBaseUrl,
        excludeIds: excludeMailpitIds ?? undefined,
        timeoutMs: 15000,
      })
      if (devCode) body.dev_code = devCode
    } catch {
      // Ignore mailpit issues; sending the email is the primary behavior.
    }
  }

  const response = NextResponse.json(body)
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}
