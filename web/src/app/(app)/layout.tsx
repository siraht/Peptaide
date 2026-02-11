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

  // Ensure a profile row exists for the signed-in user. This is idempotent and relies on DB defaults
  // so it will not overwrite user preferences once a profile is configured.
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
      <div className="bg-background-light dark:bg-background-dark text-gray-800 dark:text-gray-100 h-screen overflow-hidden flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 rounded-md bg-surface-light dark:bg-surface-dark px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-lg ring-1 ring-border-light dark:ring-border-dark"
        >
          Skip to content
        </a>
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-surface-light dark:bg-background-dark flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/today" className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold text-lg shrink-0">
                P
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold tracking-tight truncate">Peptaide</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-none truncate">
                  Log, inventory, and uncertainty-aware analytics
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
              <span className="material-icons text-lg" aria-hidden="true">
                calendar_today
              </span>
              <span>{localDateLabel}</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="p-2 text-gray-500 hover:text-primary transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-light dark:focus-visible:ring-offset-background-dark"
                aria-label="Open settings"
                title="Settings"
              >
                <span className="material-icons" aria-hidden="true">
                  settings
                </span>
              </Link>

              <NotificationsBell items={notifications} />
            </div>

            <div className="hidden md:block">
              <CommandPalette logItems={logItems} />
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <div className="hidden sm:block max-w-[16rem] truncate">{data.user.email}</div>
              <form action={signOut}>
                <button
                  className="inline-flex h-9 items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-700 dark:text-gray-200 hover:border-primary/50 hover:text-primary dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-light dark:focus-visible:ring-offset-background-dark"
                  type="submit"
                >
                  Sign out
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
