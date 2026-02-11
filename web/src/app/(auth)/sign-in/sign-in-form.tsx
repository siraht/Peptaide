'use client'

import { useRef, useState } from 'react'

type Status = 'idle' | 'sending' | 'sent' | 'verifying' | 'error'

export function SignInForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const devPollRef = useRef(0)

  function emailFromDom(): string {
    try {
      const el = document.querySelector('input[name="email"]') as HTMLInputElement | null
      return String(el?.value || '').trim()
    } catch {
      return ''
    }
  }

  function setCodeInputValue(value: string) {
    try {
      const el = document.querySelector('input[name="code"]') as HTMLInputElement | null
      if (!el) return
      el.value = value
      // Ensure form validation and any listeners (if added later) see the update.
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.focus()
    } catch {
      // ignore
    }
  }

  function mailpitHintForHost(host: string): string {
    const h = String(host || '').trim()
    if (!h) return ''

    // Localhost: mailpit is directly reachable on the same host.
    if (h === 'localhost' || h === '127.0.0.1') {
      return ` For local Supabase, open Mailpit at http://${h}:54324.`
    }

    // MagicDNS host: prefer Tailscale Serve, but also mention the direct port (useful if MagicDNS
    // is broken only in the browser due to DNS-over-HTTPS).
    if (h.endsWith('.ts.net')) {
      return ` For local Supabase, open Mailpit at https://${h}:15433 (Tailscale Serve) or http://${h}:54324 (direct).`
    }

    // Generic host (often a Tailscale IP). Direct ports are typically reachable over tailnet.
    return ` For local Supabase, open Mailpit at http://${h}:54324.`
  }

  async function postJson<T>(url: string, body: unknown, { timeoutMs = 15000 }: { timeoutMs?: number } = {}): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const data = (await res.json().catch(() => null)) as T | null
      if (!res.ok || !data) {
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error?: unknown }).error ?? '')
            : ''
        throw new Error(msg || `Request failed (HTTP ${res.status}).`)
      }
      return data
    } finally {
      clearTimeout(timer)
    }
  }

  async function sleep(ms: number) {
    await new Promise((r) => setTimeout(r, ms))
  }

  async function fetchDevOtpCode(opts: { email: string; sinceMs: number }): Promise<string | null> {
    const sp = new URLSearchParams()
    sp.set('email', opts.email)
    sp.set('since', String(opts.sinceMs))
    const res = await fetch(`/api/auth/dev-otp?${sp.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    const data = (await res.json().catch(() => null)) as { ok?: boolean; code?: string | null } | null
    if (!res.ok || !data?.ok) return null
    return typeof data.code === 'string' && data.code.trim() ? data.code.trim() : null
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setMessage(null)
    setDevCode(null)

    try {
      const form = new FormData(e.currentTarget)
      const emailRaw = String(form.get('email') || '').trim()
      setEmail(emailRaw)

      if (!emailRaw) {
        setStatus('error')
        setMessage('Email is required.')
        return
      }

      const sinceMs = Date.now()
      const data = await postJson<{ ok: boolean; error?: string; dev_exposed?: boolean }>(
        '/api/auth/send-otp',
        { email: emailRaw },
        { timeoutMs: 15000 },
      )

      if (!data.ok) {
        setStatus('error')
        setMessage(data.error || 'Failed to send sign-in email.')
        return
      }

      setStatus('sent')
      const host = window.location.hostname
      const mailpitHint = mailpitHintForHost(host)
      const devExposed = Boolean(data.dev_exposed)
      const hint = devExposed ? ' (Dev: code will appear below.)' : ''
      setMessage(`Check your email (or Mailpit) for a sign-in link or 6-digit code.${mailpitHint}${hint}`)

      if (devExposed) {
        const pollId = ++devPollRef.current
        ;(async () => {
          const started = Date.now()
          while (Date.now() - started < 60000) {
            if (devPollRef.current !== pollId) return
            const code = await fetchDevOtpCode({ email: emailRaw, sinceMs }).catch(() => null)
            if (code) {
              setDevCode(code)
              return
            }
            await sleep(750)
          }
        })()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus('error')
      setMessage(`Failed to send sign-in email: ${msg}`)
      return
    }
  }

  async function onVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('verifying')
    setMessage(null)

    const token = String(new FormData(e.currentTarget).get('code') || '').trim()
    const emailEffective = email.trim() || emailFromDom()
    setEmail(emailEffective)

    if (!emailEffective) {
      setStatus('error')
      setMessage('Email is required.')
      return
    }
    if (!token) {
      setStatus('error')
      setMessage('Code is required.')
      return
    }

    try {
      const data = await postJson<{ ok: boolean; error?: string }>('/api/auth/verify-otp', {
        email: emailEffective,
        token,
      })
      if (!data.ok) {
        setStatus('error')
        setMessage(data.error || 'Failed to verify code.')
        return
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus('error')
      setMessage(`Network error verifying code: ${msg}`)
      return
    }

    window.location.href = '/today'
  }

  const sendDisabled = status === 'sending' || status === 'verifying'
  const codeDisabled = status === 'sending' || status === 'verifying'

  return (
    <div className="mt-4 space-y-3">
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
          <input
            autoCapitalize="off"
            autoComplete="email"
            className="mt-1 h-10 w-full rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none"
            name="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
          />
        </label>

        <button
          className="h-10 w-full rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          disabled={sendDisabled}
          type="submit"
        >
          {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
        </button>
      </form>

      <div className="rounded-lg border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">Have a code instead? Enter it below.</p>

        <form className="mt-2 flex gap-2" onSubmit={onVerifyCode}>
          <input
            autoComplete="one-time-code"
            className="h-10 w-full rounded-md bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary focus:ring-1 focus:ring-primary px-3 text-sm text-slate-900 dark:text-slate-100 outline-none"
            inputMode="numeric"
            name="code"
            placeholder="6-digit code"
            type="text"
          />
          <button
            className="h-10 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            disabled={codeDisabled}
            type="submit"
          >
            {status === 'verifying' ? 'Verifying…' : 'Sign in'}
          </button>
        </form>
      </div>

      {devCode ? (
        <div className="rounded-lg border border-border-light dark:border-border-dark bg-primary/10 p-3 text-sm text-slate-900 dark:text-slate-100">
          <div className="text-xs font-semibold text-primary">Dev OTP code</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="font-mono text-lg tracking-widest">{devCode}</div>
            <button
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
              type="button"
              onClick={() => setCodeInputValue(devCode)}
            >
              Use code
            </button>
          </div>
        </div>
      ) : null}

      {message && (
        <p className="text-sm text-slate-600 dark:text-slate-300" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
