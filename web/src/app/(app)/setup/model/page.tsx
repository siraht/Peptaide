import Link from 'next/link'

import { SetupBaseBioavailabilitySpecForm } from '@/app/(app)/setup/base-ba-spec-form'
import { SetupDeviceCalibrationForm } from '@/app/(app)/setup/device-calibration-form'
import { SetupFormulationModifierSpecForm } from '@/app/(app)/setup/formulation-modifier-form'
import { SetupStepShell } from '@/app/(app)/setup/step-shell'
import { listDevices } from '@/lib/repos/devicesRepo'
import { listDistributions } from '@/lib/repos/distributionsRepo'
import { listEvidenceSources } from '@/lib/repos/evidenceSourcesRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listModelCoverage } from '@/lib/repos/modelCoverageRepo'
import { listRoutes } from '@/lib/repos/routesRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

type TargetCompartment = 'systemic' | 'cns' | 'both'

export default async function SetupModelPage() {
  const supabase = await createClient()

  const [substances, routes, devices, dists, evidenceSources, formulations, coverage] = await Promise.all([
    listSubstances(supabase),
    listRoutes(supabase),
    listDevices(supabase),
    listDistributions(supabase),
    listEvidenceSources(supabase),
    listFormulationsEnriched(supabase),
    listModelCoverage(supabase),
  ])

  const substanceById = new Map(substances.map((s) => [s.id, s] as const))

  const fractionDists = dists.filter((d) => d.value_type === 'fraction')
  const volumeDists = dists.filter((d) => d.value_type === 'volume_ml_per_unit')
  const multiplierDists = dists.filter((d) => d.value_type === 'multiplier')
  const calibrationRoutes = routes.filter((r) => r.supports_device_calibration)

  const coverageGaps = coverage.filter((c) => {
    const target: TargetCompartment = c.substance_id
      ? (substanceById.get(c.substance_id)?.target_compartment_default ?? 'systemic')
      : 'systemic'
    const systemicRelevant = target !== 'cns'
    const cnsRelevant = target !== 'systemic'

    const missingBaseSystemic = systemicRelevant && c.missing_base_systemic
    const missingBaseCns = cnsRelevant && c.missing_base_cns
    const missingDeviceCal = c.supports_device_calibration && c.missing_any_device_calibration

    return missingBaseSystemic || missingBaseCns || missingDeviceCal
  })

  const formulationOptions = formulations.map((f) => {
    const substance = f.substance?.display_name ?? 'Unknown substance'
    const route = f.route?.name ?? 'Unknown route'
    return { id: f.formulation.id, label: `${substance} / ${route} / ${f.formulation.name}` }
  })

  const prereqMissing = substances.length === 0 || routes.length === 0 || formulations.length === 0

  return (
    <SetupStepShell
      title="Model coverage"
      description="Fill the gaps so Peptaide can convert units, estimate effective dose, and show uncertainty bands."
      backHref="/setup/inventory"
      backLabel="Inventory"
      nextHref="/setup/finish"
      nextLabel="Finish"
      nextDisabledReason={prereqMissing ? 'Add substances, routes, and formulations first.' : null}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Distributions</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{dists.length}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              fraction {fractionDists.length}, volume {volumeDists.length}, multiplier {multiplierDists.length}
            </div>
          </div>
          <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Coverage gaps</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{coverageGaps.length}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">Based on current substances + routes.</div>
          </div>
          <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Evidence sources</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{evidenceSources.length}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Use evidence sources to keep citations for model assumptions.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-slate-600 dark:text-slate-400">
            Recommended: create distributions first, then fill the quick-add forms below.
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="underline hover:text-primary text-slate-600 dark:text-slate-400" href="/distributions">
              Manage distributions
            </Link>
            <Link className="underline hover:text-primary text-slate-600 dark:text-slate-400" href="/evidence-sources">
              Evidence sources
            </Link>
          </div>
        </div>

        {prereqMissing ? (
          <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
            Model coverage is computed from your formulations. Add substances, routes, and at least one formulation first.
          </div>
        ) : (
          <>
            {fractionDists.length === 0 ? (
              <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
                Create at least one <span className="font-medium">fraction</span> distribution before adding base bioavailability.
              </div>
            ) : (
              <SetupBaseBioavailabilitySpecForm
                substances={substances}
                routes={routes}
                fractionDistributions={fractionDists}
                evidenceSources={evidenceSources}
              />
            )}

            {calibrationRoutes.length > 0 ? (
              volumeDists.length === 0 ? (
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
                  Create at least one <span className="font-medium">volume per unit</span> distribution before adding device calibrations.
                </div>
              ) : (
                <SetupDeviceCalibrationForm
                  routes={calibrationRoutes}
                  devices={devices}
                  volumeDistributions={volumeDists}
                />
              )
            ) : (
              <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
                No routes currently support device calibration. Enable it on a route if you want spray/syringe conversions.
              </div>
            )}

            {multiplierDists.length === 0 ? (
              <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
                Create at least one <span className="font-medium">multiplier</span> distribution before adding enhancers/modifiers.
              </div>
            ) : formulationOptions.length === 0 ? (
              <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-400">
                Create at least one formulation before adding formulation modifiers.
              </div>
            ) : (
              <SetupFormulationModifierSpecForm
                formulations={formulationOptions}
                multiplierDistributions={multiplierDists}
              />
            )}
          </>
        )}

        {coverageGaps.length > 0 ? (
          <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Coverage gaps</div>
                <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                  These are the most obvious missing specs for effective dose percentiles and conversions.
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Showing {Math.min(12, coverageGaps.length)} of {coverageGaps.length}
              </div>
            </div>

            <div className="mt-3 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="p-2 border-b border-border-light dark:border-border-dark">Substance</th>
                    <th className="p-2 border-b border-border-light dark:border-border-dark">Route</th>
                    <th className="p-2 border-b border-border-light dark:border-border-dark">Missing</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {coverageGaps.slice(0, 12).map((g) => {
                    const missing: string[] = []
                    if (g.missing_base_systemic) missing.push('base systemic')
                    if (g.missing_base_cns) missing.push('base cns')
                    if (g.supports_device_calibration && g.missing_any_device_calibration) missing.push('device calibration')
                    return (
                      <tr key={`${g.substance_id ?? 'x'}-${g.route_id ?? 'x'}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-2 border-b border-border-light dark:border-border-dark">
                          {g.substance_name ?? '(substance)'}
                        </td>
                        <td className="p-2 border-b border-border-light dark:border-border-dark">{g.route_name ?? '(route)'}</td>
                        <td className="p-2 border-b border-border-light dark:border-border-dark text-slate-600 dark:text-slate-400">
                          {missing.length === 0 ? '-' : missing.join(', ')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border-light dark:border-border-dark bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm text-emerald-800 dark:text-emerald-200">
            Nice. No obvious coverage gaps right now.
          </div>
        )}
      </div>
    </SetupStepShell>
  )
}
