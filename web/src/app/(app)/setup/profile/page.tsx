import { SettingsForm } from '@/app/(app)/(hub)/settings/settings-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function SetupProfilePage() {
  const supabase = await createClient()
  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))

  return (
    <SetupStepShell
      title="Profile defaults"
      description="Set timezone and units so day grouping, analytics, and new entries behave the way you expect."
      nextHref="/setup/substances"
      nextLabel="Substances"
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
          Your timezone controls what counts as “today” in the log and how daily analytics roll up. If you travel, you can
          update it at any time.
        </div>

        <SettingsForm profile={profile} />
      </div>
    </SetupStepShell>
  )
}

