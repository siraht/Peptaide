import Link from 'next/link'

import { SettingsForm } from '@/app/(app)/settings/settings-form'
import { BulkAddFormulationsForm } from '@/app/(app)/formulations/bulk-add-formulations-form'
import { BulkAddRoutesForm } from '@/app/(app)/routes/bulk-add-routes-form'
import { BulkAddSubstancesForm } from '@/app/(app)/substances/bulk-add-substances-form'
import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { listDevices } from '@/lib/repos/devicesRepo'
import { listFormulationsEnriched } from '@/lib/repos/formulationsRepo'
import { listRoutes } from '@/lib/repos/routesRepo'
import { listSubstances } from '@/lib/repos/substancesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function SetupPage() {
  const supabase = await createClient()

  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))

  const [substances, routes, devices, formulations] = await Promise.all([
    listSubstances(supabase),
    listRoutes(supabase),
    listDevices(supabase),
    listFormulationsEnriched(supabase),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Setup</h1>
        <p className="mt-1 text-sm text-zinc-700">
          MVP onboarding flow. Goal: add your core reference data so you can log events and see model coverage gaps.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">1. Profile defaults</h2>
          <p className="mt-1 text-sm text-zinc-700">
            Configure timezone and units. These affect day grouping and default entry behavior.
          </p>
        </div>
        <SettingsForm profile={profile} />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">2. Substances</h2>
            <p className="mt-1 text-sm text-zinc-700">Add substances you plan to track.</p>
          </div>
          <Link className="text-sm text-zinc-700 underline hover:text-zinc-900" href="/substances">
            Manage
          </Link>
        </div>
        <BulkAddSubstancesForm />
        <p className="text-sm text-zinc-700">Current: {substances.length}.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">3. Routes</h2>
            <p className="mt-1 text-sm text-zinc-700">Add routes and choose defaults (kind/unit).</p>
          </div>
          <Link className="text-sm text-zinc-700 underline hover:text-zinc-900" href="/routes">
            Manage
          </Link>
        </div>
        <BulkAddRoutesForm />
        <p className="text-sm text-zinc-700">Current: {routes.length}.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">4. Formulations</h2>
            <p className="mt-1 text-sm text-zinc-700">
              Create loggable combinations of (substance + route + optional device).
            </p>
          </div>
          <Link className="text-sm text-zinc-700 underline hover:text-zinc-900" href="/formulations">
            Manage
          </Link>
        </div>

        {substances.length === 0 || routes.length === 0 ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-700">
            Add at least one substance and one route first.
          </div>
        ) : (
          <BulkAddFormulationsForm
            substances={substances.map((s) => ({ id: s.id, label: s.display_name }))}
            routes={routes.map((r) => ({ id: r.id, label: r.name }))}
            devices={devices.map((d) => ({ id: d.id, label: d.name }))}
          />
        )}
        <p className="text-sm text-zinc-700">Current: {formulations.length}.</p>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">5. Inventory and model specs</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Next, create vials (or generate them from orders), and set base bioavailability specs and optional modifiers
          so effective dose percentiles can be computed.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link className="underline hover:text-zinc-900" href="/inventory">
            Inventory
          </Link>
          <Link className="underline hover:text-zinc-900" href="/orders">
            Orders
          </Link>
          <Link className="underline hover:text-zinc-900" href="/today">
            Today (model coverage)
          </Link>
        </div>
      </section>
    </div>
  )
}

