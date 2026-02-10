import { type NextRequest, NextResponse } from 'next/server'

import { validateSameOrigin } from '@/lib/http/sameOrigin'

export const runtime = 'nodejs'

type MailpitList = {
  messages?: Array<{
    ID?: string
    To?: Array<{ Address?: string }>
    Created?: string
    Snippet?: string
  }>
}

type MailpitMessage = { Text?: string; HTML?: string }

function extractOtpCode(text: string): string | null {
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

export async function GET(request: NextRequest): Promise<Response> {
  const originError = validateSameOrigin(request)
  if (originError) {
    return NextResponse.json({ ok: false, error: originError }, { status: 403 })
  }

  const enabled = String(process.env.PEPTAIDE_DEV_EXPOSE_OTP || '').trim() === '1'
  if (!enabled) {
    // Do not advertise this endpoint unless explicitly enabled.
    return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 })
  }

  const email = String(request.nextUrl.searchParams.get('email') || '').trim()
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 })
  }

  const sinceRaw = request.nextUrl.searchParams.get('since')
  const sinceMs = sinceRaw != null ? Number(sinceRaw) : null
  // Allow a generous tolerance for inter-container clock skew.
  const cutoffMs = sinceMs != null && Number.isFinite(sinceMs) ? sinceMs - 5 * 60 * 1000 : null

  const mailpitBaseUrl = String(process.env.PEPTAIDE_MAILPIT_URL || 'http://127.0.0.1:54324').trim()

  try {
    const list = await mailpitFetchJson<MailpitList>(mailpitBaseUrl, '/api/v1/messages')
    const messages = Array.isArray(list.messages) ? list.messages : []

    const candidates = messages
      .filter((m) => {
        if (!m) return false
        const tos = Array.isArray(m.To) ? m.To : []
        const toMatch = tos.some((t) => t && String(t.Address || '').toLowerCase() === email.toLowerCase())
        if (!toMatch) return false

        if (cutoffMs == null) return true
        const createdMs = m.Created ? Date.parse(m.Created) : null
        return createdMs == null || createdMs >= cutoffMs
      })
      .sort((a, b) => {
        const aMs = a?.Created ? Date.parse(a.Created) : 0
        const bMs = b?.Created ? Date.parse(b.Created) : 0
        return bMs - aMs
      })

    const latest = candidates[0]
    if (!latest?.ID) {
      return NextResponse.json({ ok: true, code: null }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const fromSnippet = extractOtpCode(latest.Snippet || '')
    if (fromSnippet) {
      return NextResponse.json({ ok: true, code: fromSnippet }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const msg = await mailpitFetchJson<MailpitMessage>(mailpitBaseUrl, `/api/v1/message/${latest.ID}`)
    const fromBody = extractOtpCode(msg.Text || msg.HTML || '')
    return NextResponse.json({ ok: true, code: fromBody ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

