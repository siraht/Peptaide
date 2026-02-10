import Link from 'next/link'

import { CreateDeviceForm } from './create-device-form'
import { deleteDeviceAction } from './actions'

import { listDevices } from '@/lib/repos/devicesRepo'
import { createClient } from '@/lib/supabase/server'

export default async function DevicesPage() {
  const supabase = await createClient()
  const devices = await listDevices(supabase)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Devices</h1>
        <p className="mt-1 text-sm text-zinc-700">
          Route-level device abstractions (syringe, spray, pen). Device calibrations live in each device detail page.
        </p>
      </div>

      <CreateDeviceForm />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">List</h2>
        {devices.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-700">No devices yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[800px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-600">
                  <th className="border-b px-2 py-2 font-medium">Name</th>
                  <th className="border-b px-2 py-2 font-medium">Kind</th>
                  <th className="border-b px-2 py-2 font-medium">Default unit</th>
                  <th className="border-b px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td className="border-b px-2 py-2 text-zinc-900">
                      <Link className="underline hover:text-zinc-900" href={`/devices/${d.id}`}>
                        {d.name}
                      </Link>
                    </td>
                    <td className="border-b px-2 py-2 text-zinc-700">{d.device_kind}</td>
                    <td className="border-b px-2 py-2 text-zinc-700">{d.default_unit}</td>
                    <td className="border-b px-2 py-2">
                      <form action={deleteDeviceAction}>
                        <input type="hidden" name="device_id" value={d.id} />
                        <button className="text-sm text-red-700" type="submit">
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

