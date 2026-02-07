import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { SignInForm } from './sign-in-form'

export default async function SignInPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (data.user) {
    redirect('/today')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Enter your email to receive a sign-in link.
        </p>
        <SignInForm />
      </div>
    </div>
  )
}

