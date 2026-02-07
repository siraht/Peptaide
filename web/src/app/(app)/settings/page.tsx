import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { createClient } from '@/lib/supabase/server'

import { DataPortabilitySection } from './data-portability'
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

      <DataPortabilitySection />
    </div>
  )
}
