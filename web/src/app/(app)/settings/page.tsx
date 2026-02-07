import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { createClient } from '@/lib/supabase/server'

import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-zinc-700">Preferences and defaults.</p>
      </div>

      <SettingsForm profile={profile} />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Data</h2>
        <p className="mt-1 text-sm text-zinc-700">Export all tables as a ZIP of CSV files.</p>

        <div className="mt-3">
          <a
            className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white"
            href="/api/export"
          >
            Export CSV bundle
          </a>
        </div>
      </section>
    </div>
  )
}
