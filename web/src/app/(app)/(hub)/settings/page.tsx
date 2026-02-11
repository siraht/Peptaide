import Link from 'next/link'

import { BaseBioavailabilitySpecForm } from '../substances/[substanceId]/base-ba-form'
import { CycleRuleForm } from '../substances/[substanceId]/cycle-rule-form'
import { SubstanceRecommendationsForm } from '../substances/[substanceId]/recommendations-form'

import { listCycleRules } from '@/lib/repos/cyclesRepo'
import { listDistributions } from '@/lib/repos/distributionsRepo'
import { listEvidenceSources } from '@/lib/repos/evidenceSourcesRepo'
import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { listRoutes } from '@/lib/repos/routesRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

import { DataPortabilitySection } from './data-portability'
import { NotificationSettingsForm } from './notification-settings-form'
import { SettingsForm } from './settings-form'

type SettingsTab = 'substances' | 'app'

function firstSearchParam(x: string | string[] | undefined): string | null {
  if (x == null) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

function isTab(x: string | null): x is SettingsTab {
  return x === 'substances' || x === 'app'
}

function tabHref(tab: SettingsTab, extra?: Record<string, string | undefined | null>): string {
  const sp = new URLSearchParams()
  sp.set('tab', tab)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (!v) continue
      sp.set(k, v)
    }
  }
  return `/settings?${sp.toString()}`
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const tabRaw = firstSearchParam(sp.tab)
  const tab: SettingsTab = isTab(tabRaw) ? tabRaw : 'substances'
  const selectedSubstanceId = firstSearchParam(sp.substance_id)

  const supabase = await createClient()
  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))

  const [substances, routes, dists, evidenceSources, cycleRules] = await Promise.all([
    listSubstances(supabase),
    listRoutes(supabase),
    listDistributions(supabase),
    listEvidenceSources(supabase),
    listCycleRules(supabase),
  ])

  const fractionDists = dists.filter((d) => d.value_type === 'fraction')
  const cycleRuleBySubstanceId = new Map(cycleRules.map((r) => [r.substance_id, r]))

  const selectedSubstance =
    tab === 'substances'
      ? substances.find((s) => s.id === selectedSubstanceId) ?? null
      : null

  return (
    <div className="flex h-full overflow-hidden relative" data-e2e="settings-root">
      <main className="flex-1 flex flex-col bg-background-light dark:bg-background-dark min-w-0">
        {tab === 'substances' ? (
          <>
            <div className="flex-none border-b border-border-light bg-surface-light/90 px-4 py-3 dark:border-border-dark dark:bg-surface-dark/90 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl">Substances</h2>
                <div className="flex items-center gap-2">
                  <a
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border-light bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-primary/30 hover:text-primary dark:border-border-dark dark:bg-slate-900/30 dark:text-slate-200"
                    href="/api/export"
                  >
                    <span className="material-icons-outlined text-[18px]" aria-hidden="true">
                      file_download
                    </span>
                    <span className="hidden sm:inline">Export CSV bundle</span>
                    <span className="sm:hidden">Export</span>
                  </a>
                  <Link
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
                    href="/substances?focus=new"
                  >
                    <span className="material-icons-outlined text-[18px]" aria-hidden="true">
                      add
                    </span>
                    <span className="hidden sm:inline">New Substance</span>
                    <span className="sm:hidden">New</span>
                  </Link>
                </div>
              </div>

              <div className="relative mt-3 max-w-xl">
                <span
                  className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"
                  aria-hidden="true"
                >
                  search
                </span>
                <input
                  className="w-full rounded-xl border border-transparent bg-slate-100 py-2 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder-slate-500 focus:border-primary focus-visible:ring-1 focus-visible:ring-primary dark:bg-slate-800 dark:text-slate-100"
                  placeholder="Search by name…"
                  type="text"
                  name="substance_search"
                  data-e2e="settings-substance-search"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar relative">
              <table className="w-full text-left border-collapse" data-e2e="settings-substance-table">
                <thead className="bg-surface-light dark:bg-surface-dark sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 border-b border-border-light dark:border-border-dark text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24">
                      Canonical
                    </th>
                    <th className="p-4 border-b border-border-light dark:border-border-dark text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Display Name
                    </th>
                    <th className="p-4 border-b border-border-light dark:border-border-dark text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">
                      Family
                    </th>
                    <th className="p-4 border-b border-border-light dark:border-border-dark text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">
                      Target
                    </th>
                    <th className="p-4 border-b border-border-light dark:border-border-dark w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark bg-surface-light dark:bg-surface-dark">
                  {substances.length === 0 ? (
                    <tr>
                      <td className="p-6 text-sm text-slate-500" colSpan={5}>
                        No substances yet. Create one with <span className="font-medium">New Substance</span>.
                      </td>
                    </tr>
                  ) : (
                    substances.map((s) => {
                      const isSelected = selectedSubstanceId === s.id
                      return (
                        <tr
                          key={s.id}
                          className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border-l-4 ${
                            isSelected ? 'bg-primary/5 dark:bg-primary/10 border-l-primary' : 'border-l-transparent'
                          }`}
                        >
                          <td className="p-4 text-sm font-mono text-slate-500">{s.canonical_name}</td>
                          <td className="p-4">
                            <Link
                              className="font-medium text-slate-900 dark:text-slate-100 underline-offset-2 hover:underline"
                              href={tabHref('substances', { substance_id: s.id })}
                              data-e2e={`settings-substance-select-${s.id}`}
                            >
                              {s.display_name}
                            </Link>
                            {s.notes ? <div className="text-xs text-slate-500 truncate max-w-[36rem]">{s.notes}</div> : null}
                          </td>
                          <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{s.family ?? '-'}</td>
                          <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{s.target_compartment_default}</td>
                          <td className="p-4 text-right">
                            <Link
                              className="text-slate-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                              href={`/substances/${s.id}`}
                              aria-label={`Open ${s.display_name} detail`}
                            >
                              <span className="material-icons text-sm">open_in_new</span>
                            </Link>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="h-10 border-t border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-6 flex items-center justify-between text-xs text-slate-500">
              <div>Showing {substances.length} substance{substances.length === 1 ? '' : 's'}</div>
              <div className="flex gap-4">
                <span>
                  Selected: <strong className="text-primary">{selectedSubstance ? '1' : '0'}</strong>
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Preferences, defaults, and data portability.</p>
            </div>

            <SettingsForm profile={profile} />

            <NotificationSettingsForm profile={profile} />

            <DataPortabilitySection />
          </div>
        )}
      </main>

      {tab === 'substances' && selectedSubstance ? (
        <>
          <Link
            className="absolute inset-0 z-10 bg-slate-900/45 backdrop-blur-[1px] sm:hidden"
            href={tabHref('substances')}
            aria-label="Close substance editor"
          />
          <aside
            className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-border-light bg-surface-light shadow-2xl dark:border-border-dark dark:bg-surface-dark sm:relative sm:w-96 sm:max-w-none sm:shadow-xl"
            data-e2e="settings-substance-editor"
          >
          <div className="p-6 border-b border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-800/20">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs uppercase font-bold text-primary tracking-wider mb-1">Editing</div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedSubstance.display_name}</h2>
                <p className="text-sm text-slate-500">Canonical: {selectedSubstance.canonical_name}</p>
              </div>
              <Link
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                href={tabHref('substances')}
                aria-label="Close editor"
                data-e2e="settings-editor-close"
              >
                <span className="material-icons">close</span>
              </Link>
            </div>
            <div className="flex gap-2">
              <Link
                className="flex-1 rounded border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors text-center"
                href={`/substances/${selectedSubstance.id}`}
              >
                View Detail
              </Link>
              <Link
                className="flex-1 rounded border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors text-center"
                href="/evidence-sources"
              >
                Evidence
              </Link>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <BaseBioavailabilitySpecForm
              substanceId={selectedSubstance.id}
              routes={routes}
              fractionDistributions={fractionDists}
              evidenceSources={evidenceSources}
            />

            <SubstanceRecommendationsForm substanceId={selectedSubstance.id} routes={routes} evidenceSources={evidenceSources} />

            <CycleRuleForm
              substanceId={selectedSubstance.id}
              cycleRule={cycleRuleBySubstanceId.get(selectedSubstance.id) ?? null}
              profileGapDefaultDays={profile.cycle_gap_default_days}
            />
          </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}
