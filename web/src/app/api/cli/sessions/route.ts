import { z } from 'zod'

import {
  sessionBatchRequestSchema,
  sessionCopyRequestSchema,
  sessionCreateRequestSchema,
  sessionListRequestSchema,
  sessionUpdateRequestSchema,
} from '@/lib/api/contracts/cli'
import { validateSameOrigin } from '@/lib/http/sameOrigin'

import { requireCliBearer } from '@/lib/api/cli/auth'
import { withIdempotency } from '@/lib/api/cli/idempotency'
import { readJsonBody, requireApply, validateBody } from '@/lib/api/cli/request'
import { runCliRoute } from '@/lib/api/cli/route'
import { CliApiError, okEnvelope } from '@/lib/api/cli/response'
import { createSession, type SessionCreateInput, type SessionCreateResult } from '@/lib/app/sessions/createSession'

export const runtime = 'nodejs'

type SessionsAction =
  | 'create'
  | 'create_from_text'
  | 'batch'
  | 'list'
  | 'get'
  | 'update'
  | 'delete'
  | 'restore'
  | 'copy'

const sessionGetRequestSchema = z.object({
  event_id: z.string().uuid(),
})

const sessionDeleteRequestSchema = z.object({
  event_id: z.string().uuid(),
  apply: z.boolean().optional(),
  dry_run: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

const sessionRestoreRequestSchema = sessionDeleteRequestSchema
type SessionCreateSuccess = Extract<SessionCreateResult, { status: 'success' }>

function readAction(payload: unknown): SessionsAction {
  const action =
    payload && typeof payload === 'object' && 'action' in payload
      ? String((payload as { action?: unknown }).action ?? '').trim()
      : ''

  switch (action) {
    case 'create':
    case 'create_from_text':
    case 'batch':
    case 'list':
    case 'get':
    case 'update':
    case 'delete':
    case 'restore':
    case 'copy':
      return action
    default:
      throw new CliApiError({
        code: 'validation_error',
        status: 400,
        message: 'Invalid sessions action.',
        details: ['Supported actions: create, create_from_text, batch, list, get, update, delete, restore, copy'],
      })
  }
}

function decodeCursor(raw: string | undefined): { offset: number } {
  if (!raw) return { offset: 0 }
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = JSON.parse(decoded) as { offset?: unknown }
    const offset = Number(parsed.offset)
    return Number.isInteger(offset) && offset >= 0 ? { offset } : { offset: 0 }
  } catch {
    return { offset: 0 }
  }
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url')
}

function parseYmd(raw: string): { year: number; month: number; day: number } {
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new Error('date must be YYYY-MM-DD.')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!(year >= 1970 && month >= 1 && month <= 12 && day >= 1 && day <= 31)) {
    throw new Error('Invalid date.')
  }
  const check = new Date(Date.UTC(year, month - 1, day))
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error('Invalid date.')
  }
  return { year, month, day }
}

function parseHm(raw: string): { hour: number; minute: number } {
  const match = raw.match(/^(\d{2}):(\d{2})$/)
  if (!match) throw new Error('time must be HH:MM.')
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) {
    throw new Error('Invalid time.')
  }
  return { hour, minute }
}

function dateTimeInZoneToIsoUtc(opts: {
  date: string
  time: string
  timezone: string
}): string {
  const targetDate = parseYmd(opts.date)
  const targetTime = parseHm(opts.time)

  // Start with a UTC guess and iteratively refine it to match the desired local time in timezone.
  let guessUtc = Date.UTC(
    targetDate.year,
    targetDate.month - 1,
    targetDate.day,
    targetTime.hour,
    targetTime.minute,
    0,
  )

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: opts.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const targetStamp = Date.UTC(
    targetDate.year,
    targetDate.month - 1,
    targetDate.day,
    targetTime.hour,
    targetTime.minute,
    0,
  )

  for (let i = 0; i < 8; i++) {
    const parts = formatter.formatToParts(new Date(guessUtc))
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

    const localYear = Number(values.year)
    const localMonth = Number(values.month)
    const localDay = Number(values.day)
    const localHour = Number(values.hour)
    const localMinute = Number(values.minute)

    const localStamp = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, 0)
    const diff = targetStamp - localStamp
    if (diff === 0) {
      return new Date(guessUtc).toISOString()
    }

    guessUtc += diff
  }

  return new Date(guessUtc).toISOString()
}

async function resolveFormulationId(supabase: Awaited<ReturnType<typeof requireCliBearer>>['supabase'], payload: {
  formulation_id?: string
  formulation_name?: string
}): Promise<string> {
  if (payload.formulation_id) return payload.formulation_id

  const name = String(payload.formulation_name ?? '').trim()
  if (!name) {
    throw new CliApiError({
      code: 'validation_error',
      status: 400,
      message: 'formulation_id or formulation_name is required.',
    })
  }

  const res = await supabase
    .from('formulations')
    .select('id,name')
    .eq('name', name)
    .is('deleted_at', null)

  if (res.error) {
    throw new Error(res.error.message)
  }

  const rows = res.data ?? []
  if (rows.length === 0) {
    throw new CliApiError({
      code: 'not_found',
      status: 404,
      message: `No formulation found for name: ${name}`,
    })
  }

  if (rows.length > 1) {
    throw new CliApiError({
      code: 'conflict',
      status: 409,
      message: `formulation_name matched ${rows.length} formulations. Use formulation_id instead.`,
    })
  }

  return rows[0]!.id
}

async function buildCreateInput(
  auth: Awaited<ReturnType<typeof requireCliBearer>>,
  payload: z.infer<typeof sessionCreateRequestSchema>,
  opts: { dryRun: boolean },
): Promise<SessionCreateInput> {
  const formulationId = await resolveFormulationId(auth.supabase, payload)

  const resolvedTs = (() => {
    if (payload.ts) return payload.ts
    if (payload.date && payload.time && payload.timezone) {
      try {
        return dateTimeInZoneToIsoUtc({
          date: payload.date,
          time: payload.time,
          timezone: payload.timezone,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new CliApiError({
          code: 'validation_error',
          status: 400,
          message: 'Invalid date/time/timezone input.',
          details: [message],
        })
      }
    }
    return undefined
  })()

  return {
    formulationId,
    inputText: payload.input_text,
    inputKind: payload.input_kind,
    inputValue: payload.input_value,
    inputUnit: payload.input_unit,
    normalizedUnit: payload.normalized_unit,
    preferStructured: payload.prefer_structured,
    ts: resolvedTs,
    notes: payload.notes ?? null,
    tags: payload.tags,
    cycleDecision: payload.cycle_decision,
    vialId: payload.vial_id,
    concentrationMgPerMl: payload.concentration_mg_per_ml,
    vialContentMassMg: payload.vial_content_mass_mg,
    vialTotalVolumeMl: payload.vial_total_volume_ml,
    volumeMlPerDeviceUnit: payload.volume_ml_per_device_unit,
    preferDirectConcentration: payload.prefer_direct_concentration,
    doseMgOverride: payload.dose_mg,
    compartment: payload.compartment,
    baseFractionDistId: payload.base_fraction_dist_id,
    multiplierDistIds: payload.multiplier_dist_id,
    systemicBaseFractionDistId: payload.systemic_base_fraction_dist_id,
    cnsBaseFractionDistId: payload.cns_base_fraction_dist_id,
    systemicMultiplierDistIds: payload.systemic_multiplier_dist_id,
    cnsMultiplierDistIds: payload.cns_multiplier_dist_id,
    mcN: payload.mc_n,
    mcSeed: payload.mc_seed,
    deterministicSeedMode: payload.deterministic_seed_mode,
    strictModelCoverage: payload.strict_model_coverage,
    dryRun: opts.dryRun,
  }
}

async function executeCreate(
  auth: Awaited<ReturnType<typeof requireCliBearer>>,
  payload: z.infer<typeof sessionCreateRequestSchema>,
  dryRun: boolean,
): Promise<{ status: number; envelopeData: SessionCreateSuccess }> {
  const input = await buildCreateInput(auth, payload, { dryRun })
  const result = await createSession(auth.supabase, input)

  if (result.status === 'error') {
    throw new CliApiError({
      code: 'validation_error',
      status: 400,
      message: result.message,
      warnings: result.warnings,
    })
  }

  if (result.status === 'confirm_new_cycle') {
    throw new CliApiError({
      code: 'conflict',
      status: 409,
      message: result.message,
      warnings: result.warnings,
      data: result.preview,
      details: ['Specify cycle_decision=new_cycle or cycle_decision=continue_cycle to proceed.'],
    })
  }

  return {
    status: dryRun ? 200 : 201,
    envelopeData: result,
  }
}

export async function POST(request: Request): Promise<Response> {
  return runCliRoute(request, async (requestId) => {
    const originError = validateSameOrigin(request)
    if (originError) {
      throw new CliApiError({ code: 'forbidden', status: 403, message: originError })
    }

    const auth = await requireCliBearer(request)
    const body = await readJsonBody(request)
    const action = readAction(body)

    if (action === 'create' || action === 'create_from_text') {
      const payload = validateBody(sessionCreateRequestSchema, body)
      const applyMode = requireApply({
        apply: payload.apply,
        dryRun: payload.dry_run,
        command: action === 'create' ? 'sessions create' : 'sessions create-from-text',
      })

      const runCreate = async () => {
        const created = await executeCreate(auth, payload, applyMode.dryRun)
        return {
          status: created.status,
          envelope: okEnvelope({
            requestId,
            code: applyMode.dryRun ? 'dry_run' : 'ok',
            message: created.envelopeData.message,
            data: {
              saved: created.envelopeData.saved,
              session: created.envelopeData.session,
            },
            warnings: created.envelopeData.warnings,
          }),
        }
      }

      if (!applyMode.dryRun && payload.idempotency_key) {
        const idempotent = await withIdempotency({
          supabase: auth.supabase,
          operation: action,
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: runCreate,
        })

        const extraWarnings = idempotent.replayed
          ? [...idempotent.envelope.warnings, 'Idempotency replay returned a cached response.']
          : idempotent.envelope.warnings

        return {
          status: idempotent.status,
          envelope: {
            ...idempotent.envelope,
            warnings: extraWarnings,
          },
        }
      }

      return runCreate()
    }

    if (action === 'batch') {
      const payload = validateBody(sessionBatchRequestSchema, body)
      const applyMode = requireApply({
        apply: payload.apply,
        dryRun: payload.dry_run,
        command: 'sessions batch',
      })

      const items: Array<{
        idempotency_key: string
        ok: boolean
        message: string
        session: unknown | null
      }> = []

      for (const item of payload.items) {
        try {
          let created: Awaited<ReturnType<typeof executeCreate>> | null = null

          if (applyMode.dryRun) {
            created = await executeCreate(auth, item, true)
          } else {
            const idempotent = await withIdempotency({
              supabase: auth.supabase,
              operation: 'sessions.batch.create',
              idempotencyKey: item.idempotency_key,
              requestPayload: item,
              execute: async () => {
                const run = await executeCreate(auth, item, false)
                return {
                  status: run.status,
                  envelope: okEnvelope({
                    requestId,
                    message: run.envelopeData.message,
                    data: {
                      saved: run.envelopeData.saved,
                      session: run.envelopeData.session,
                    },
                    warnings: run.envelopeData.warnings,
                  }),
                }
              },
            })

            const envelopeData =
              idempotent.envelope.data &&
              typeof idempotent.envelope.data === 'object'
                ? (idempotent.envelope.data as Record<string, unknown>)
                : null
            const session = envelopeData?.session ?? null

            items.push({
              idempotency_key: item.idempotency_key,
              ok: true,
              message: idempotent.replayed
                ? `${idempotent.envelope.message} (replayed from idempotency cache)`
                : idempotent.envelope.message,
              session,
            })
            continue
          }

          if (!created) {
            throw new Error('Internal error: batch item create did not execute.')
          }

          items.push({
            idempotency_key: item.idempotency_key,
            ok: true,
            message: created.envelopeData.message,
            session: created.envelopeData.session,
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          items.push({
            idempotency_key: item.idempotency_key,
            ok: false,
            message: msg,
            session: null,
          })
        }
      }

      const okCount = items.filter((x) => x.ok).length
      const failCount = items.length - okCount
      const summary = {
        total: items.length,
        succeeded: okCount,
        failed: failCount,
      }
      const message =
        failCount === 0
          ? `Batch processed ${okCount} item(s).`
          : `Batch processed with partial failures (${okCount} ok / ${failCount} failed).`

      if (failCount > 0) {
        throw new CliApiError({
          code: 'conflict',
          status: 409,
          message,
          data: {
            summary,
            items,
          },
          details: ['One or more batch items failed.'],
        })
      }

      return {
        status: applyMode.dryRun ? 200 : 201,
        envelope: okEnvelope({
          requestId,
          code: applyMode.dryRun ? 'dry_run' : 'ok',
          message,
          data: {
            summary,
            items,
          },
        }),
      }
    }

    if (action === 'list') {
      const payload = validateBody(sessionListRequestSchema, body)
      const state = decodeCursor(payload.cursor)
      const limit = payload.limit ?? 100

      let q = auth.supabase.from('v_event_enriched').select('*')

      if (payload.deleted_only) {
        q = q.not('deleted_at', 'is', null)
      } else if (!payload.include_deleted) {
        q = q.is('deleted_at', null)
      }

      if (payload.from) q = q.gte('ts', payload.from)
      if (payload.to) q = q.lte('ts', payload.to)
      if (payload.substance_id) q = q.eq('substance_id', payload.substance_id)
      if (payload.formulation_id) q = q.eq('formulation_id', payload.formulation_id)
      if (payload.cycle_id) q = q.eq('cycle_instance_id', payload.cycle_id)

      const res = await q
        .order('ts', { ascending: false })
        .order('created_at', { ascending: false })
        .order('event_id', { ascending: false })
        .range(state.offset, state.offset + limit - 1)

      if (res.error) {
        throw new Error(res.error.message)
      }

      const rows = res.data ?? []
      const nextCursor = rows.length === limit ? encodeCursor(state.offset + rows.length) : null

      return {
        envelope: okEnvelope({
          requestId,
          message: 'Listed sessions.',
          data: {
            items: rows,
            next_cursor: nextCursor,
            applied_limit: limit,
          },
        }),
      }
    }

    if (action === 'get') {
      const payload = validateBody(sessionGetRequestSchema, body)
      const res = await auth.supabase
        .from('v_event_enriched')
        .select('*')
        .eq('event_id', payload.event_id)
        .maybeSingle()

      if (res.error) throw new Error(res.error.message)
      if (!res.data) {
        throw new CliApiError({
          code: 'not_found',
          status: 404,
          message: 'Session not found.',
        })
      }

      return {
        envelope: okEnvelope({
          requestId,
          message: 'Loaded session.',
          data: res.data,
        }),
      }
    }

    if (action === 'update') {
      const payload = validateBody(sessionUpdateRequestSchema, body)
      const applyMode = requireApply({
        apply: payload.apply,
        dryRun: payload.dry_run,
        command: 'sessions update',
      })

      const currentRes = await auth.supabase
        .from('administration_events')
        .select('*')
        .eq('id', payload.event_id)
        .maybeSingle()

      if (currentRes.error) throw new Error(currentRes.error.message)
      if (!currentRes.data) {
        throw new CliApiError({ code: 'not_found', status: 404, message: 'Session not found.' })
      }

      const current = currentRes.data
      const updates: Record<string, unknown> = {}

      if (payload.ts != null) updates.ts = payload.ts
      if (payload.notes != null) updates.notes = payload.notes
      if (payload.tags != null) updates.tags = payload.tags

      const needsRecompute =
        payload.input_text != null ||
        payload.input_kind != null ||
        payload.input_value != null ||
        payload.input_unit != null

      if (needsRecompute) {
        const recompute = await createSession(auth.supabase, {
          formulationId: current.formulation_id,
          inputText: payload.input_text ?? current.input_text,
          inputKind: payload.input_kind ?? current.input_kind,
          inputValue: payload.input_value ?? current.input_value ?? undefined,
          inputUnit: payload.input_unit ?? current.input_unit ?? undefined,
          normalizedUnit: payload.normalized_unit,
          preferStructured: payload.prefer_structured,
          ts: payload.ts ?? current.ts,
          notes: payload.notes ?? current.notes,
          tags: payload.tags ?? current.tags,
          cycleDecision: payload.cycle_decision,
          vialId: current.vial_id,
          dryRun: true,
        })

        if (recompute.status !== 'success') {
          throw new CliApiError({
            code: recompute.status === 'confirm_new_cycle' ? 'conflict' : 'validation_error',
            status: recompute.status === 'confirm_new_cycle' ? 409 : 400,
            message: recompute.message,
          })
        }

        updates.input_text = recompute.session.inputText
        updates.input_kind = recompute.session.inputKind
        updates.input_value = recompute.session.inputValue
        updates.input_unit = recompute.session.inputUnit
        updates.dose_mass_mg = recompute.session.doseMassMg
        updates.dose_volume_ml = recompute.session.doseVolumeMl
        updates.eff_systemic_p05_mg = recompute.session.effectiveDose.systemic?.p05 ?? null
        updates.eff_systemic_p50_mg = recompute.session.effectiveDose.systemic?.p50 ?? null
        updates.eff_systemic_p95_mg = recompute.session.effectiveDose.systemic?.p95 ?? null
        updates.eff_cns_p05_mg = recompute.session.effectiveDose.cns?.p05 ?? null
        updates.eff_cns_p50_mg = recompute.session.effectiveDose.cns?.p50 ?? null
        updates.eff_cns_p95_mg = recompute.session.effectiveDose.cns?.p95 ?? null
        updates.mc_n = recompute.session.mcN
        updates.mc_seed = recompute.session.mcSeed
        updates.model_snapshot = recompute.session.modelSnapshot
        updates.cost_usd = recompute.session.costUsd
      }

      if (Object.keys(updates).length === 0) {
        throw new CliApiError({
          code: 'validation_error',
          status: 400,
          message: 'No editable fields were provided for update.',
        })
      }

      if (applyMode.dryRun) {
        return {
          envelope: okEnvelope({
            requestId,
            code: 'dry_run',
            message: 'Dry run complete.',
            data: {
              event_id: payload.event_id,
              updates,
            },
          }),
        }
      }

      const execUpdate = async () => {
        const updateRes = await auth.supabase
          .from('administration_events')
          .update(updates)
          .eq('id', payload.event_id)
          .select('*')
          .single()

        if (updateRes.error) throw new Error(updateRes.error.message)

        return {
          status: 200,
          envelope: okEnvelope({
            requestId,
            message: 'Session updated.',
            data: updateRes.data,
          }),
        }
      }

      if (payload.idempotency_key) {
        return withIdempotency({
          supabase: auth.supabase,
          operation: 'sessions.update',
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: execUpdate,
        })
      }

      return execUpdate()
    }

    if (action === 'delete') {
      const payload = validateBody(sessionDeleteRequestSchema, body)
      const applyMode = requireApply({
        apply: payload.apply,
        dryRun: payload.dry_run,
        command: 'sessions delete',
      })

      if (applyMode.dryRun) {
        return {
          envelope: okEnvelope({
            requestId,
            code: 'dry_run',
            message: 'Dry run complete.',
            data: { event_id: payload.event_id, action: 'delete' },
          }),
        }
      }

      const execDelete = async () => {
        const res = await auth.supabase
          .from('administration_events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', payload.event_id)
          .is('deleted_at', null)
          .select('*')
          .maybeSingle()

        if (res.error) throw new Error(res.error.message)
        if (!res.data) {
          throw new CliApiError({ code: 'not_found', status: 404, message: 'Session not found or already deleted.' })
        }

        return {
          status: 200,
          envelope: okEnvelope({
            requestId,
            message: 'Session deleted.',
            data: res.data,
          }),
        }
      }

      if (payload.idempotency_key) {
        return withIdempotency({
          supabase: auth.supabase,
          operation: 'sessions.delete',
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: execDelete,
        })
      }

      return execDelete()
    }

    if (action === 'restore') {
      const payload = validateBody(sessionRestoreRequestSchema, body)
      const applyMode = requireApply({
        apply: payload.apply,
        dryRun: payload.dry_run,
        command: 'sessions restore',
      })

      if (applyMode.dryRun) {
        return {
          envelope: okEnvelope({
            requestId,
            code: 'dry_run',
            message: 'Dry run complete.',
            data: { event_id: payload.event_id, action: 'restore' },
          }),
        }
      }

      const execRestore = async () => {
        const res = await auth.supabase
          .from('administration_events')
          .update({ deleted_at: null })
          .eq('id', payload.event_id)
          .not('deleted_at', 'is', null)
          .select('*')
          .maybeSingle()

        if (res.error) throw new Error(res.error.message)
        if (!res.data) {
          throw new CliApiError({ code: 'not_found', status: 404, message: 'Session not found or already active.' })
        }

        return {
          status: 200,
          envelope: okEnvelope({
            requestId,
            message: 'Session restored.',
            data: res.data,
          }),
        }
      }

      if (payload.idempotency_key) {
        return withIdempotency({
          supabase: auth.supabase,
          operation: 'sessions.restore',
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: execRestore,
        })
      }

      return execRestore()
    }

    const payload = validateBody(sessionCopyRequestSchema, body)
    const applyMode = requireApply({
      apply: payload.apply,
      dryRun: payload.dry_run,
      command: 'sessions copy',
    })

    const sourceRes = await auth.supabase
      .from('administration_events')
      .select('*')
      .eq('id', payload.event_id)
      .maybeSingle()

    if (sourceRes.error) throw new Error(sourceRes.error.message)
    if (!sourceRes.data) {
      throw new CliApiError({ code: 'not_found', status: 404, message: 'Source session not found.' })
    }

    const source = sourceRes.data

    const mergedPayload: z.infer<typeof sessionCreateRequestSchema> = {
      ...payload,
      formulation_id: payload.formulation_id ?? source.formulation_id,
      input_text: payload.input_text ?? source.input_text,
      input_kind: payload.input_kind ?? source.input_kind,
      input_value: payload.input_value ?? source.input_value ?? undefined,
      input_unit: payload.input_unit ?? source.input_unit ?? undefined,
      ts: payload.ts ?? source.ts,
      notes: payload.notes ?? source.notes ?? undefined,
      tags: payload.tags ?? source.tags,
      vial_id: payload.vial_id ?? source.vial_id ?? undefined,
    }

    const execCopy = async () => {
      const created = await executeCreate(auth, mergedPayload, applyMode.dryRun)
      return {
        status: created.status,
        envelope: okEnvelope({
          requestId,
          code: applyMode.dryRun ? 'dry_run' : 'ok',
          message: created.envelopeData.message,
          data: {
            source_event_id: payload.event_id,
            copied_session: created.envelopeData.session,
            saved: created.envelopeData.saved,
          },
          warnings: created.envelopeData.warnings,
        }),
      }
    }

    if (!applyMode.dryRun && payload.idempotency_key) {
      return withIdempotency({
        supabase: auth.supabase,
        operation: 'sessions.copy',
        idempotencyKey: payload.idempotency_key,
        requestPayload: mergedPayload,
        execute: execCopy,
      })
    }

    return execCopy()
  })
}
