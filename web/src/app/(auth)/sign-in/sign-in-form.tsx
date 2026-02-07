'use client'

import { useState } from 'react'

import { createClient } from '@/lib/supabase/browser'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function SignInForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    setMessage(null)

    const supabase = createClient()
    const origin = window.location.origin

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/today`,
      },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }

    setStatus('sent')
    setMessage(
      'Check your email for a sign-in link. For local Supabase, open Mailpit at http://127.0.0.1:54324.',
    )
  }

  const disabled = status === 'sending' || email.trim().length === 0

  return (
    <form className="mt-4 space-y-3" onSubmit={onSubmit}>
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
        disabled={disabled}
        type="submit"
      >
        {status === 'sending' ? 'Sending...' : 'Send sign-in link'}
      </button>

      {message && (
        <p className="text-sm text-zinc-700" role="status">
          {message}
        </p>
      )}
    </form>
  )
}

