import Link from 'next/link'

import { CreateDeviceForm } from './create-device-form'
import { deleteDeviceAction } from './actions'

import { listDevices } from '@/lib/repos/devicesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function DevicesPage() {
  const supabase = await createClient()
  const devices = await listDevices(supabase)

  return (
    <div className="h-full overflow-auto p-6 space-y-6 custom-scrollbar">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Devices</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Route-level device abstractions (syringe, spray, pen). Device calibrations live in each device detail page.
        </p>
      </div>

      <CreateDeviceForm />

      <section className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">List</h2>
        {devices.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No devices yet.</p>
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
