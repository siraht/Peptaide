'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createSession } from '@/lib/app/sessions/createSession'
import { requireData, requireOk } from '@/lib/repos/errors'
import { discardVial, getVialById } from '@/lib/repos/vialsRepo'
import { createClient } from '@/lib/supabase/server'
import type { EventEnrichedRow } from '@/lib/repos/eventsRepo'
import { createVialAction } from '../(hub)/inventory/actions'

export type CreateEventState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'confirm_new_cycle'; message: string }
  | { status: 'success'; message: string; eventId: string; event: EventEnrichedRow | null }

export async function seedDemoDataAction(): Promise<void> {
  const supabase = await createClient()
  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) {
    throw new Error('Not authenticated.')
  }

  // 1) Substance + route
  const substanceUpsert = await supabase
    .from('substances')
    .upsert(
      {
        user_id: user.id,
        canonical_name: 'demo_substance',
        display_name: 'Demo substance',
        family: 'peptide',
        target_compartment_default: 'systemic',
      },
      { onConflict: 'user_id,canonical_name' },
    )
    .select('*')
    .single()
  const substance = requireData(substanceUpsert.data, substanceUpsert.error, 'demo.substance.upsert')

  const routeUpsert = await supabase
    .from('routes')
    .upsert(
      {
        user_id: user.id,
        name: 'demo_route_subq',
        default_input_kind: 'mass',
        default_input_unit: 'mg',
        supports_device_calibration: false,
      },
      { onConflict: 'user_id,name' },
    )
    .select('*')
    .single()
  const route = requireData(routeUpsert.data, routeUpsert.error, 'demo.route.upsert')

  // 2) Formulation
  const formulationUpsert = await supabase
    .from('formulations')
    .upsert(
      {
        user_id: user.id,
        substance_id: substance.id,
        route_id: route.id,
        name: 'Demo formulation',
        is_default_for_route: true,
      },
      { onConflict: 'user_id,substance_id,route_id,name' },
    )
    .select('*')
    .single()
  const formulation = requireData(
    formulationUpsert.data,
    formulationUpsert.error,
    'demo.formulation.upsert',
  )

  // 2b) Second formulation for the same substance (used by E2E to validate substance-level grouping
  // in the /today Control Center when multiple formulations are in stock).
  const formulationAltUpsert = await supabase
    .from('formulations')
    .upsert(
      {
        user_id: user.id,
        substance_id: substance.id,
        route_id: route.id,
        name: 'Demo formulation (alt)',
        is_default_for_route: false,
      },
      { onConflict: 'user_id,substance_id,route_id,name' },
    )
    .select('*')
    .single()
  const formulationAlt = requireData(
    formulationAltUpsert.data,
    formulationAltUpsert.error,
    'demo.formulation_alt.upsert',
  )

  // 3) Active vial (if missing)
  const activeVialRes = await supabase
    .from('vials')
    .select('*')
    .eq('formulation_id', formulation.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()
  requireOk(activeVialRes.error, 'demo.vials.select_active')
  if (!activeVialRes.data) {
    const vialInsert = await supabase.from('vials').insert({
      user_id: user.id,
      substance_id: substance.id,
      formulation_id: formulation.id,
      status: 'active',
      content_mass_value: 10,
      content_mass_unit: 'mg',
      total_volume_value: 10,
      total_volume_unit: 'mL',
      concentration_mg_per_ml: 1,
      cost_usd: 100,
    })
    requireOk(vialInsert.error, 'demo.vials.insert')
  }

  // 3b) Active vial for the alt formulation (if missing)
  const altActiveVialRes = await supabase
    .from('vials')
    .select('*')
    .eq('formulation_id', formulationAlt.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()
  requireOk(altActiveVialRes.error, 'demo.vials.select_active_alt')
  if (!altActiveVialRes.data) {
    const vialInsert = await supabase.from('vials').insert({
      user_id: user.id,
      substance_id: substance.id,
      formulation_id: formulationAlt.id,
      status: 'active',
      lot: 'DEMO-ALT',
      content_mass_value: 10,
      content_mass_unit: 'mg',
      total_volume_value: 10,
      total_volume_unit: 'mL',
      concentration_mg_per_ml: 1,
      cost_usd: 100,
    })
    requireOk(vialInsert.error, 'demo.vials.insert_alt')
  }

  // 4) Distributions + specs (systemic only)
  const existingBaseDistRes = await supabase
    .from('distributions')
    .select('*')
    .eq('name', 'DEMO: base BA systemic')
    .eq('value_type', 'fraction')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  requireOk(existingBaseDistRes.error, 'demo.dists.select_base')

  let baseDist = existingBaseDistRes.data
  if (!baseDist) {
    const insertRes = await supabase
      .from('distributions')
      .insert({
        user_id: user.id,
        name: 'DEMO: base BA systemic',
        value_type: 'fraction',
        dist_type: 'beta_pert',
        p1: 0.1,
        p2: 0.3,
        p3: 0.6,
        units: 'fraction',
        quality_score: 1,
        evidence_summary: 'Demo only',
      })
      .select('*')
      .single()

    baseDist = requireData(insertRes.data, insertRes.error, 'demo.dists.insert_base')
  }

  const baseSpecUpsert = await supabase.from('bioavailability_specs').upsert(
    {
      user_id: user.id,
      substance_id: substance.id,
      route_id: route.id,
      compartment: 'systemic',
      base_fraction_dist_id: baseDist.id,
      notes: 'Demo only',
    },
    { onConflict: 'user_id,substance_id,route_id,compartment' },
  )
  requireOk(baseSpecUpsert.error, 'demo.bioavailability_specs.upsert')

  revalidatePath('/today')
}

function normalizeHistoryParam(raw: string): '90' | '180' | 'all' {
  const parsed = parseHistoryParam(raw)
  return parsed ?? '90'
}

function parseHistoryParam(raw: string): '90' | '180' | 'all' | null {
  if (raw === '90') return '90'
  if (raw === '180') return '180'
  if (raw === 'all') return 'all'
  return null
}

function buildTodayReturnParams(raw: string): URLSearchParams {
  const input = new URLSearchParams(raw)
  const out = new URLSearchParams()

  const focus = String(input.get('focus') ?? '').trim()
  if (focus === 'log') out.set('focus', focus)

  const formulationId = String(input.get('formulation_id') ?? '').trim()
  if (formulationId) out.set('formulation_id', formulationId)

  const showDeleted = String(input.get('show_deleted') ?? '').trim()
  if (showDeleted === '1') out.set('show_deleted', '1')

  const history = parseHistoryParam(String(input.get('cc_history') ?? '').trim())
  if (history) out.set('cc_history', history)

  return out
}

export async function createVialFromTodayAction(formData: FormData): Promise<void> {
  const substanceId = String(formData.get('cc_substance_id') ?? '').trim()
  const history = normalizeHistoryParam(String(formData.get('cc_history') ?? '').trim())
  const returnParams = buildTodayReturnParams(String(formData.get('cc_return_q') ?? '').trim())

  const result = await createVialAction({ status: 'idle' }, formData)

  const params = new URLSearchParams(returnParams)
  params.set('cc_modal', 'add-vial')
  if (substanceId) params.set('cc_substance_id', substanceId)
  params.set('cc_history', history)

  if (result.status === 'error') {
    params.set('cc_error', result.message)
  } else if (result.status === 'success') {
    params.set('cc_notice', result.message)
  }

  redirect(`/today?${params.toString()}`)
}

export async function createEventAction(
  prevState: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  void prevState

  const formulationId = String(formData.get('formulation_id') ?? '').trim()
  const inputText = String(formData.get('input_text') ?? '').trim()
  const cycleDecisionRaw = String(formData.get('cycle_decision') ?? '').trim()
  const dateYMD = String(formData.get('date_ymd') ?? '').trim()
  const timeHHMM = String(formData.get('time_hhmm') ?? '').trim()
  const notesRaw = String(formData.get('notes') ?? '').trim()

  const cycleDecision =
    cycleDecisionRaw === 'new_cycle' || cycleDecisionRaw === 'continue_cycle'
      ? cycleDecisionRaw
      : cycleDecisionRaw === ''
        ? 'auto'
        : null

  if (!cycleDecision) {
    return { status: 'error', message: 'Invalid cycle decision.' }
  }

  const supabase = await createClient()
  const result = await createSession(supabase, {
    formulationId,
    inputText,
    cycleDecision,
    dateYMD,
    timeHHMM,
    notes: notesRaw ? notesRaw : null,
  })

  if (result.status === 'error') {
    return { status: 'error', message: result.message }
  }

  if (result.status === 'confirm_new_cycle') {
    return { status: 'confirm_new_cycle', message: result.message }
  }

  revalidatePath('/today')
  revalidatePath('/analytics')
  revalidatePath('/cycles')
  revalidatePath('/inventory')
  revalidatePath('/orders')
  if (result.session.cycleInstanceId) {
    revalidatePath(`/cycles/${result.session.cycleInstanceId}`)
  }

  let event: EventEnrichedRow | null = null
  const eventRes = await supabase
    .from('v_event_enriched')
    .select('*')
    .eq('event_id', result.session.eventId)
    .maybeSingle()
  if (eventRes.error) {
    console.warn('v_event_enriched.select_after_create failed', {
      eventId: result.session.eventId,
      error: eventRes.error,
    })
  } else {
    event = eventRes.data ?? null
  }

  return { status: 'success', message: result.message, eventId: result.session.eventId, event }
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim()
  if (!eventId) return

  const supabase = await createClient()
  const res = await supabase
    .from('administration_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', eventId)
    .is('deleted_at', null)

  requireOk(res.error, 'administration_events.soft_delete')
  revalidatePath('/today')
  revalidatePath('/analytics')
}

export async function discardVialFromControlCenterAction(formData: FormData): Promise<void> {
  const vialId = String(formData.get('vial_id') ?? '').trim()
  const discardReasonRaw = String(formData.get('discard_reason') ?? '').trim()
  const discardReason = discardReasonRaw ? discardReasonRaw : null
  const returnParams = buildTodayReturnParams(String(formData.get('cc_return_q') ?? '').trim())
  if (!vialId) return

  const supabase = await createClient()
  const vial = await getVialById(supabase, { vialId })
  if (!vial) return

  const existingReason = String(vial.discard_reason ?? '').trim() || null
  if (vial.status !== 'discarded' || existingReason !== discardReason) {
    const nowIso = new Date().toISOString()
    const closedAt = vial.status === 'discarded' ? (vial.closed_at ?? nowIso) : nowIso
    await discardVial(supabase, { vialId, closedAt, discardReason })
  }

  revalidatePath('/today')
  revalidatePath('/inventory')
  revalidatePath('/setup/inventory')
  revalidatePath('/orders')
  const q = returnParams.toString()
  redirect(q ? `/today?${q}` : '/today')
}

export async function restoreEventAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim()
  if (!eventId) return

  const supabase = await createClient()
  const res = await supabase
    .from('administration_events')
    .update({ deleted_at: null })
    .eq('id', eventId)
    .not('deleted_at', 'is', null)

  requireOk(res.error, 'administration_events.restore')
  revalidatePath('/today')
  revalidatePath('/analytics')
}
