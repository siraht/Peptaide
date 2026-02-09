'use client'

import { useState } from 'react'

import { createClient } from '@/lib/supabase/browser'

type Status = 'idle' | 'sending' | 'sent' | 'verifying' | 'error'

export function SignInForm() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)

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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setMessage(null)

    const supabase = createClient()
    const origin = window.location.origin

    let error: { message: string } | null = null
    try {
      const res = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      })
      error = res.error ? { message: res.error.message } : null
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus('error')
      setMessage(`Network error sending sign-in email: ${msg}`)
      return
    }

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }

    setStatus('sent')
    const host = window.location.hostname
    const mailpitHint = mailpitHintForHost(host)
    setMessage(`Check your email (or Mailpit) for a sign-in link or 6-digit code.${mailpitHint}`)
  }

  async function onVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('verifying')
    setMessage(null)

    const supabase = createClient()
    const token = code.trim()

    let error: { message: string } | null = null
    try {
      const res = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      })
      error = res.error ? { message: res.error.message } : null
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus('error')
      setMessage(`Network error verifying code: ${msg}`)
      return
    }

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }

    window.location.href = '/today'
  }

  const sendDisabled = status === 'sending' || status === 'verifying' || email.trim().length === 0
  const codeDisabled =
    status === 'sending' || status === 'verifying' || email.trim().length === 0 || code.trim().length === 0

  return (
    <div className="mt-4 space-y-3">
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            autoCapitalize="off"
            autoComplete="email"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            name="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>

        <button
          className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={sendDisabled}
          type="submit"
        >
          {status === 'sending' ? 'Sending...' : 'Send sign-in link'}
        </button>
      </form>

      <div className="rounded-md border bg-zinc-50 p-3">
        <p className="text-sm text-zinc-700">Have a code instead? Enter it below.</p>

        <form className="mt-2 flex gap-2" onSubmit={onVerifyCode}>
          <input
            autoComplete="one-time-code"
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            inputMode="numeric"
            name="code"
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            type="text"
            value={code}
          />
          <button
            className="shrink-0 rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={codeDisabled}
            type="submit"
          >
            {status === 'verifying' ? 'Verifying...' : 'Sign in'}
          </button>
        </form>
      </div>

      {message && (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
