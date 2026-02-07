'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  completeCycleInstance,
  getCycleInstanceById,
  getLastCycleForSubstance,
} from '@/lib/repos/cyclesRepo'
import { getAdministrationEventById } from '@/lib/repos/eventsRepo'
import { createClient } from '@/lib/supabase/server'

function splitCycleErrorMessage(raw: string): string {
  // Keep these strings stable; they come from the DB exception messages in
  // `supabase/migrations/*_cycle_split_fn.sql`.
  if (raw.includes('cycle_not_found')) return 'Cycle not found.'
  if (raw.includes('cycle_not_active')) return 'Only active cycles can be split in the MVP.'
  if (raw.includes('event_not_found_or_deleted')) return 'Event not found (or deleted).'
  if (raw.includes('event_not_in_cycle')) return 'Event does not belong to this cycle.'
  if (raw.includes('cycle_not_most_recent')) {
    return 'Only the most recent cycle can be split in the MVP.'
  }
  return raw
}

export async function splitCycleAtEventAction(formData: FormData): Promise<void> {
  const cycleInstanceId = String(formData.get('cycle_instance_id') ?? '').trim()
  const eventId = String(formData.get('event_id') ?? '').trim()
  if (!cycleInstanceId || !eventId) return

  const supabase = await createClient()

  const cycle = await getCycleInstanceById(supabase, { cycleInstanceId })
  if (!cycle) {
    redirect('/cycles')
  }

  if (cycle.status !== 'active') {
    redirect(`/cycles/${cycleInstanceId}?error=Only%20active%20cycles%20can%20be%20split%20in%20the%20MVP.`)
  }

  const lastCycle = await getLastCycleForSubstance(supabase, { substanceId: cycle.substance_id })
  if (!lastCycle || lastCycle.id !== cycle.id) {
    redirect(
      `/cycles/${cycleInstanceId}?error=Only%20the%20most%20recent%20cycle%20can%20be%20split%20in%20the%20MVP.`,
    )
  }

  const event = await getAdministrationEventById(supabase, { eventId })
  if (!event || event.deleted_at != null) {
    redirect(`/cycles/${cycleInstanceId}?error=Event%20not%20found%20(or%20deleted).`)
  }

  if (event.cycle_instance_id !== cycleInstanceId) {
    redirect(`/cycles/${cycleInstanceId}?error=Event%20does%20not%20belong%20to%20this%20cycle.`)
  }

  const rpcRes = await supabase.rpc('split_cycle_at_event', {
    cycle_instance_id: cycleInstanceId,
    event_id: eventId,
  })
  if (rpcRes.error) {
    const msg = splitCycleErrorMessage(rpcRes.error.message)
    redirect(`/cycles/${cycleInstanceId}?error=${encodeURIComponent(msg)}`)
  }

  const newCycleId = rpcRes.data
  if (!newCycleId) {
    redirect(`/cycles/${cycleInstanceId}?error=Split%20failed%20(no%20new%20cycle%20id).`)
  }

  revalidatePath('/cycles')
  revalidatePath('/today')
  revalidatePath('/analytics')
  revalidatePath(`/cycles/${cycleInstanceId}`)
  revalidatePath(`/cycles/${newCycleId}`)

  redirect(`/cycles/${newCycleId}`)
}

export async function endCycleNowAction(formData: FormData): Promise<void> {
  const cycleInstanceId = String(formData.get('cycle_instance_id') ?? '').trim()
  if (!cycleInstanceId) return

  const supabase = await createClient()

  const cycle = await getCycleInstanceById(supabase, { cycleInstanceId })
  if (!cycle) {
    redirect('/cycles')
  }

  if (cycle.status !== 'active') {
    redirect(`/cycles/${cycleInstanceId}?error=Only%20active%20cycles%20can%20be%20ended.`)
  }

  const start = new Date(cycle.start_ts).getTime()
  const now = new Date()
  const safeEndTs = now.getTime() < start ? new Date(cycle.start_ts).toISOString() : now.toISOString()

  await completeCycleInstance(supabase, {
    cycleInstanceId,
    endTs: safeEndTs,
  })

  revalidatePath('/cycles')
  revalidatePath('/today')
  revalidatePath('/analytics')
  revalidatePath(`/cycles/${cycleInstanceId}`)

  redirect(`/cycles/${cycleInstanceId}`)
}
