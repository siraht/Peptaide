'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  createCycleInstance,
  getActiveCycleForSubstance,
  getLastCycleForSubstance,
} from '@/lib/repos/cyclesRepo'
import { createClient } from '@/lib/supabase/server'

export type CreateCycleNowState =
  | { status: 'idle' }
  | { status: 'error'; message: string }

export async function createCycleNowAction(
  _prev: CreateCycleNowState,
  formData: FormData,
): Promise<CreateCycleNowState> {
  const substanceId = String(formData.get('substance_id') ?? '').trim()
  if (!substanceId) return { status: 'error', message: 'substance_id is required.' }

  const supabase = await createClient()

  let newCycleId: string | null = null
  try {
    const activeCycle = await getActiveCycleForSubstance(supabase, { substanceId })
    if (activeCycle) {
      return {
        status: 'error',
        message: 'An active cycle already exists for this substance. End it first.',
      }
    }

    const lastCycle = await getLastCycleForSubstance(supabase, { substanceId })
    const nextCycleNumber = (lastCycle?.cycle_number ?? 0) + 1

    const nowTs = new Date().toISOString()
    const newCycle = await createCycleInstance(supabase, {
      substanceId,
      cycleNumber: nextCycleNumber,
      startTs: nowTs,
      status: 'active',
      goal: null,
      notes: null,
    })
    newCycleId = newCycle.id
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (
      msg.includes('cycle_instances_one_active_per_substance_key') ||
      msg.includes('cycle_instances_user_substance_cycle_number_key')
    ) {
      return {
        status: 'error',
        message: 'An active cycle already exists for this substance. End it first.',
      }
    }
    return { status: 'error', message: msg }
  }

  if (!newCycleId) {
    return { status: 'error', message: 'Failed to create cycle.' }
  }

  // `redirect()` throws, so keep it outside the try/catch to avoid catching the redirect exception.
  revalidatePath('/cycles')
  revalidatePath('/today')
  revalidatePath('/analytics')
  revalidatePath(`/cycles/${newCycleId}`)

  redirect(`/cycles/${newCycleId}`)
}
