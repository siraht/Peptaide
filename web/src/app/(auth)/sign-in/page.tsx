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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background-light p-4 dark:bg-background-dark sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(19,91,236,0.12),transparent_50%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(19,91,236,0.18),transparent_50%)]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border-light bg-surface-light shadow-2xl dark:border-border-dark dark:bg-surface-dark lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden border-r border-border-light bg-gradient-to-b from-slate-50 to-white px-8 py-10 dark:border-border-dark dark:from-slate-900/30 dark:to-surface-dark lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/30">
              P
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Peptaide</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Precision logging and inventory control</p>
            </div>
          </div>

          <div className="mt-10 space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Stay on top of every vial and dose.</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Sign in securely to continue tracking administration events, inventory runway, and cost trends.
              </p>
            </div>

            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <span className="material-icons-outlined mt-0.5 text-[18px] text-primary" aria-hidden="true">
                  task_alt
                </span>
                OTP-only auth for fast, passwordless access.
              </li>
              <li className="flex items-start gap-2">
                <span className="material-icons-outlined mt-0.5 text-[18px] text-primary" aria-hidden="true">
                  inventory_2
                </span>
                Unified view of stock runway and active vials.
              </li>
              <li className="flex items-start gap-2">
                <span className="material-icons-outlined mt-0.5 text-[18px] text-primary" aria-hidden="true">
                  insights
                </span>
                Built-in uncertainty-aware analytics surfaces.
              </li>
            </ul>
          </div>
        </section>

        <section className="px-5 py-7 sm:px-8 sm:py-9">
          <div className="mb-5 lg:hidden">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-light bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-border-dark dark:bg-slate-900/30 dark:text-slate-300">
              <span className="material-icons-outlined text-[16px]" aria-hidden="true">
                lock
              </span>
              Secure sign-in
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Sign in</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Enter your email to receive a sign-in link and one-time code.
          </p>

          <SignInForm />
        </section>
      </div>
    </div>
  )
}
