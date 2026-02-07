'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireOk } from '@/lib/repos/errors'
import {
  completeCycleInstance,
  createCycleInstance,
  getCycleInstanceById,
  getLastCycleForSubstance,
} from '@/lib/repos/cyclesRepo'
import { getAdministrationEventById } from '@/lib/repos/eventsRepo'
import { createClient } from '@/lib/supabase/server'

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

  const splitTs = event.ts

  // Ensure end_ts is never before start_ts (defensive; should not happen for in-cycle events).
  const start = new Date(cycle.start_ts).getTime()
  const split = new Date(splitTs).getTime()
  const safeSplitTs = split < start ? cycle.start_ts : splitTs

  // 1) Complete the old cycle at the split point.
  await completeCycleInstance(supabase, { cycleInstanceId, endTs: safeSplitTs })

  // 2) Create a new active cycle starting at the split event.
  const newCycleNumber = cycle.cycle_number + 1
  const newCycle = await createCycleInstance(supabase, {
    substanceId: cycle.substance_id,
    cycleNumber: newCycleNumber,
    startTs: safeSplitTs,
    status: 'active',
    goal: null,
    notes: null,
  })

  // 3) Move the split event and all later events to the new cycle (including soft-deleted events so restore is consistent).
  const updateRes = await supabase
    .from('administration_events')
    .update({ cycle_instance_id: newCycle.id })
    .eq('cycle_instance_id', cycleInstanceId)
    .gte('ts', safeSplitTs)

  requireOk(updateRes.error, 'administration_events.reassign_cycle_after_split')

  revalidatePath('/cycles')
  revalidatePath('/today')
  revalidatePath('/analytics')
  revalidatePath(`/cycles/${cycleInstanceId}`)
  revalidatePath(`/cycles/${newCycle.id}`)

  redirect(`/cycles/${newCycle.id}`)
}

