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
    <div className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark p-6">
      <div className="w-full max-w-sm rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Enter your email to receive a sign-in link and code.
        </p>
        <SignInForm />
      </div>
    </div>
  )
}
