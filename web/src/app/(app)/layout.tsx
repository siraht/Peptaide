import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/app/actions/auth'
import { CommandPalette } from '@/components/command-palette'
import { listFormulationsEnriched, type FormulationEnriched } from '@/lib/repos/formulationsRepo'
import { createClient } from '@/lib/supabase/server'

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

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link className="font-semibold" href="/today">
              Peptaide
            </Link>
            <nav className="flex flex-wrap gap-3 text-sm text-zinc-700">
              <Link className="hover:text-zinc-900" href="/today">
                Today
              </Link>
              <Link className="hover:text-zinc-900" href="/analytics">
                Analytics
              </Link>
              <Link className="hover:text-zinc-900" href="/substances">
                Substances
              </Link>
              <Link className="hover:text-zinc-900" href="/routes">
                Routes
              </Link>
              <Link className="hover:text-zinc-900" href="/devices">
                Devices
              </Link>
              <Link className="hover:text-zinc-900" href="/formulations">
                Formulations
              </Link>
              <Link className="hover:text-zinc-900" href="/inventory">
                Inventory
              </Link>
              <Link className="hover:text-zinc-900" href="/orders">
                Orders
              </Link>
              <Link className="hover:text-zinc-900" href="/cycles">
                Cycles
              </Link>
              <Link className="hover:text-zinc-900" href="/distributions">
                Distributions
              </Link>
              <Link className="hover:text-zinc-900" href="/evidence-sources">
                Evidence
              </Link>
              <Link className="hover:text-zinc-900" href="/settings">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-700">
            <CommandPalette logItems={logItems} />
            <div className="max-w-[16rem] truncate">{data.user.email}</div>
            <form action={signOut}>
              <button
                className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm text-zinc-700 hover:text-zinc-900"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  )
}
