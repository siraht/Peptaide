import { SettingsForm } from '@/app/(app)/(hub)/settings/settings-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { CompactEntryModule } from '@/components/ui/compact-entry-module'
import { MetricsStrip } from '@/components/ui/metrics-strip'
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
        <MetricsStrip
          items={[
            {
              label: 'Timezone',
              value: profile.timezone,
              detail: 'Used for day boundaries in logs and analytics.',
            },
            {
              label: 'Units',
              value: `${profile.default_mass_unit} / ${profile.default_volume_unit}`,
              detail: 'Defaults for new entries.',
            },
            {
              label: 'Simulation default',
              value: String(profile.default_simulation_n),
              detail: `Cycle gap default: ${profile.cycle_gap_default_days} day(s)`,
            },
          ]}
        />

        <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
          Your timezone controls what counts as “today” in the log and how daily analytics roll up. If you travel, you can
          update it at any time.
        </div>

        <CompactEntryModule
          id="setup-profile-defaults"
          title="Edit profile defaults"
          description="Open when you want to adjust timezone, units, Monte Carlo sample size, or cycle-gap defaults."
          summaryItems={[
            { label: 'Timezone', value: profile.timezone },
            { label: 'Mass / volume', value: `${profile.default_mass_unit} / ${profile.default_volume_unit}` },
            { label: 'Simulation N', value: String(profile.default_simulation_n) },
          ]}
          defaultCollapsed
          storageKey="peptaide.module.setup.profile.defaults"
        >
          <SettingsForm profile={profile} />
        </CompactEntryModule>
      </div>
    </SetupStepShell>
  )
}
