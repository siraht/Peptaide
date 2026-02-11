import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/app/actions/auth'
import { CommandPalette } from '@/components/command-palette'
import { NotificationsBell } from '@/components/notifications/notifications-bell'
import { ToastProvider } from '@/components/toast/toast-provider'
import { listMyActiveNotifications, type NotificationItem } from '@/lib/notifications/notifications'
import { listFormulationsEnriched, type FormulationEnriched } from '@/lib/repos/formulationsRepo'
import { getMyProfile } from '@/lib/repos/profilesRepo'
import { createClient } from '@/lib/supabase/server'
import { formatLocalDate, safeTimeZone } from '@/lib/time'

async function sleep(ms: number): Promise<void> {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return
  await new Promise((r) => setTimeout(r, n))
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    redirect('/sign-in')
  }

  {
    const maxAttempts = 8
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ user_id: data.user.id }, { onConflict: 'user_id', ignoreDuplicates: true })

      if (!profileError) break

      const msg = String(profileError.message || '').toLowerCase()
      const retryable =
        msg.includes('jwt issued at future') ||
        msg.includes('profiles_user_id_fkey') ||
        msg.includes('violates foreign key constraint')

      if (!retryable || attempt === maxAttempts) {
        console.error('Failed to ensure profile row exists', profileError)
        break
      }

      await sleep(200 * attempt)
    }
  }

  let formulations: FormulationEnriched[] = []
  try {
    formulations = await listFormulationsEnriched(supabase)
  } catch (e) {
    console.error('Failed to load formulations for command palette', e)
    formulations = []
  }
  const logItems = formulations.map((f) => {
    const substance = f.substance?.display_name ?? 'Unknown substance'
    const route = f.route?.name ?? 'Unknown route'
    const deviceSuffix = f.device?.name ? ` / ${f.device.name}` : ''
    return {
      label: `${substance} / ${route} / ${f.formulation.name}${deviceSuffix}`,
      href: `/today?focus=log&formulation_id=${f.formulation.id}`,
      keywords: [f.formulation.name, substance, route, f.device?.name].filter(Boolean) as string[],
    }
  })

  let localDateLabel = formatLocalDate(new Date(), 'UTC')
  try {
    const profile = await getMyProfile(supabase)
    const tz = safeTimeZone(profile?.timezone ?? 'UTC')
    localDateLabel = formatLocalDate(new Date(), tz)
  } catch (e) {
    console.warn('Failed to load profile timezone for header date', e)
  }

  let notifications: NotificationItem[] = []
  try {
    notifications = await listMyActiveNotifications(supabase)
  } catch (e) {
    console.error('Failed to compute notifications', e)
    notifications = []
  }

  return (
    <ToastProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background-light text-gray-800 dark:bg-background-dark dark:text-gray-100">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-surface-light px-4 py-2 text-sm font-medium text-slate-900 shadow-lg ring-1 ring-border-light dark:bg-surface-dark dark:text-slate-100 dark:ring-border-dark"
        >
          Skip to content
        </a>

        <header className="shrink-0 border-b border-border-light/80 bg-surface-light/90 backdrop-blur supports-[backdrop-filter]:bg-surface-light/75 dark:border-border-dark dark:bg-background-dark/90 dark:supports-[backdrop-filter]:bg-background-dark/75">
          <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-3 px-3 sm:px-5 lg:px-6">
            <Link href="/today" className="group flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 transition-transform group-hover:scale-[1.03]">
                <span className="text-base font-bold">P</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[22px] font-semibold tracking-tight leading-none">Peptaide</p>
                <p className="mt-0.5 hidden truncate text-[11px] text-slate-500 sm:block dark:text-slate-400">
                  Log, inventory, and uncertainty-aware analytics
                </p>
              </div>
            </Link>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-xl border border-border-light bg-slate-50 px-3 py-1.5 text-sm text-slate-600 shadow-sm lg:flex dark:border-border-dark dark:bg-slate-900/30 dark:text-slate-300">
                <span className="material-icons-outlined text-[17px]" aria-hidden="true">
                  calendar_today
                </span>
                <span>{localDateLabel}</span>
              </div>

              <CommandPalette logItems={logItems} />

              <Link
                href="/settings"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-light dark:focus-visible:ring-offset-background-dark"
                aria-label="Open settings"
                title="Settings"
              >
                <span className="material-icons-outlined text-[20px]" aria-hidden="true">
                  settings
                </span>
              </Link>

              <NotificationsBell items={notifications} />

              <div className="hidden max-w-[15rem] truncate text-sm text-slate-500 xl:block dark:text-slate-400">{data.user.email}</div>

              <form action={signOut}>
                <button
                  className="inline-flex h-10 items-center rounded-xl border border-border-light bg-surface-light px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-primary/40 hover:text-primary dark:border-border-dark dark:bg-surface-dark dark:text-slate-200 dark:hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-light dark:focus-visible:ring-offset-background-dark"
                  type="submit"
                  data-e2e="app-sign-out"
                >
                  <span className="hidden sm:inline">Sign out</span>
                  <span className="sm:hidden">Exit</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">{children}</div>
        </main>
      </div>
    </ToastProvider>
  )
}
