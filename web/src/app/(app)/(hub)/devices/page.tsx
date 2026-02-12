import Link from 'next/link'

import { CreateDeviceForm } from './create-device-form'
import { deleteDeviceAction } from './actions'

import { CompactEntryModule } from '@/components/ui/compact-entry-module'
import { EmptyState } from '@/components/ui/empty-state'
import { MetricsStrip } from '@/components/ui/metrics-strip'
import { listDevices } from '@/lib/repos/devicesRepo'
import { createClient } from '@/lib/supabase/server'

function fmtCount(n: number): string {
  return new Intl.NumberFormat().format(n)
}

export default async function DevicesPage() {
  const supabase = await createClient()
  const devices = await listDevices(supabase)

  const kindCount = new Set(devices.map((d) => d.device_kind)).size
  const defaultUnitCount = new Set(devices.map((d) => d.default_unit)).size

  return (
    <div className="h-full overflow-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Devices</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Route-level device abstractions (syringe, spray, pen). Device calibrations live in each device detail page.
        </p>
      </div>

      <MetricsStrip
        items={[
          {
            label: 'Devices',
            value: fmtCount(devices.length),
            detail: devices.length > 0 ? 'Reusable delivery hardware profiles.' : 'No device profiles yet.',
            tone: devices.length > 0 ? 'good' : 'warn',
          },
          {
            label: 'Kinds',
            value: fmtCount(kindCount),
            detail: kindCount > 0 ? 'Distinct delivery modalities represented.' : 'No device kinds defined yet.',
            tone: kindCount > 0 ? 'good' : 'warn',
          },
          {
            label: 'Default units',
            value: fmtCount(defaultUnitCount),
            detail: defaultUnitCount > 0 ? 'Distinct default unit labels in use.' : 'No default units yet.',
            tone: defaultUnitCount > 0 ? 'good' : 'warn',
          },
        ]}
      />

      <CompactEntryModule
        id="devices-add"
        title="Add device"
        description="Create a reusable delivery device profile used by formulations and calibrations."
        summaryItems={[
          { label: 'Devices', value: fmtCount(devices.length), tone: devices.length > 0 ? 'good' : 'neutral' },
          { label: 'Kinds', value: fmtCount(kindCount), tone: kindCount > 0 ? 'good' : 'neutral' },
        ]}
        defaultCollapsed
        storageKey="peptaide.module.devices.add"
      >
        <CreateDeviceForm />
      </CompactEntryModule>

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">List</h2>
        {devices.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="vaccines"
            title="No devices yet"
            description="Create reusable device profiles such as spray heads, syringes, or pens."
            actionHref="/devices?focus=new"
            actionLabel="Create device"
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[800px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Name</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Kind</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Default unit</th>
                  <th className="border-b border-border-light dark:border-border-dark px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-900 dark:text-slate-100">
                      <Link className="underline hover:text-primary" href={`/devices/${d.id}`}>
                        {d.name}
                      </Link>
                    </td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.device_kind}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2 text-slate-600 dark:text-slate-400">{d.default_unit}</td>
                    <td className="border-b border-border-light dark:border-border-dark px-2 py-2">
                      <form action={deleteDeviceAction}>
                        <input type="hidden" name="device_id" value={d.id} />
                        <button className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
