import { z } from 'zod'

import {
  cycleRulesDeleteRequestSchema,
  cycleRulesSetRequestSchema,
  cycleSplitRequestSchema,
  cycleStartRequestSchema,
  cycleStateRequestSchema,
  cycleSuggestRequestSchema,
} from '@/lib/api/contracts/cli'
import { validateSameOrigin } from '@/lib/http/sameOrigin'

import {
  abandonCycleInstance,
  completeCycleInstance,
  createCycleInstance,
  getActiveCycleForSubstance,
  getCycleInstanceById,
  getCycleRuleForSubstance,
  getLastCycleForSubstance,
  listCycleRules,
  setCycleRuleForSubstance,
  softDeleteCycleRule,
} from '@/lib/repos/cyclesRepo'
import { getLastEventEnrichedForSubstance } from '@/lib/repos/eventsRepo'
import { ensureMyProfile } from '@/lib/repos/profilesRepo'
import { listCycleSummary } from '@/lib/repos/cycleSummaryRepo'
import { suggestCycleAction } from '@/lib/domain/cycles/suggest'

import { requireCliBearer } from '@/lib/api/cli/auth'
import { withIdempotency } from '@/lib/api/cli/idempotency'
import { readJsonBody, requireApply, validateBody } from '@/lib/api/cli/request'
import { runCliRoute } from '@/lib/api/cli/route'
import { CliApiError, okEnvelope } from '@/lib/api/cli/response'

export const runtime = 'nodejs'

type CyclesAction =
  | 'suggest'
  | 'start'
  | 'end'
  | 'abandon'
  | 'split'
  | 'list'
  | 'get'
  | 'rules_get'
  | 'rules_set'
  | 'rules_delete'

const cycleListRequestSchema = z.object({
  substance_id: z.string().uuid().optional(),
  active: z.boolean().optional(),
})

const cycleGetRequestSchema = z.object({
  cycle_id: z.string().uuid(),
})

const cycleRulesGetRequestSchema = z.object({
  substance_id: z.string().uuid(),
})

function readAction(payload: unknown): CyclesAction {
  const action =
    payload && typeof payload === 'object' && 'action' in payload
      ? String((payload as { action?: unknown }).action ?? '').trim()
      : ''

  switch (action) {
    case 'suggest':
    case 'start':
    case 'end':
    case 'abandon':
    case 'split':
    case 'list':
    case 'get':
    case 'rules_get':
    case 'rules_set':
    case 'rules_delete':
      return action
    default:
      throw new CliApiError({
        code: 'validation_error',
        status: 400,
        message: 'Invalid cycles action.',
        details: ['Supported actions: suggest, start, end, abandon, split, list, get, rules_get, rules_set, rules_delete'],
      })
  }
}

function splitCycleErrorMessage(raw: string): string {
  if (raw.includes('cycle_not_found')) return 'Cycle not found.'
  if (raw.includes('cycle_not_active')) return 'Only active cycles can be split in the MVP.'
  if (raw.includes('event_not_found_or_deleted')) return 'Event not found (or deleted).'
  if (raw.includes('event_not_in_cycle')) return 'Event does not belong to this cycle.'
  if (raw.includes('event_before_cycle_start')) {
    return 'Cannot split: selected event time is before cycle start time.'
  }
  if (raw.includes('cycle_not_most_recent')) {
    return 'Only the most recent cycle can be split in the MVP.'
  }
  return raw
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

    if (action === 'suggest') {
      const payload = validateBody(cycleSuggestRequestSchema, body)

      const [profile, cycleRule, lastEvent, activeCycle, lastCycle] = await Promise.all([
        ensureMyProfile(auth.supabase),
        getCycleRuleForSubstance(auth.supabase, { substanceId: payload.substance_id }),
        getLastEventEnrichedForSubstance(auth.supabase, { substanceId: payload.substance_id }),
        getActiveCycleForSubstance(auth.supabase, { substanceId: payload.substance_id }),
        getLastCycleForSubstance(auth.supabase, { substanceId: payload.substance_id }),
      ])

      const gapDaysThreshold =
        cycleRule?.gap_days_to_suggest_new_cycle ?? profile.cycle_gap_default_days
      const autoStartFirstCycle = cycleRule?.auto_start_first_cycle ?? true

      const lastEventTs = lastEvent?.ts ? new Date(lastEvent.ts) : null
      const actionSuggestion = suggestCycleAction({
        lastEventTs,
        newEventTs: new Date(payload.new_event_ts),
        gapDaysThreshold,
        autoStartFirstCycle,
      })

      return {
        envelope: okEnvelope({
          requestId,
          message: 'Cycle suggestion evaluated.',
          data: {
            action: actionSuggestion,
            gap_days_threshold: gapDaysThreshold,
            auto_start_first_cycle: autoStartFirstCycle,
            active_cycle_id: activeCycle?.id ?? null,
            last_cycle_id: lastCycle?.id ?? null,
            last_event_ts: lastEvent?.ts ?? null,
          },
        }),
      }
    }

    if (action === 'start') {
      const payload = validateBody(cycleStartRequestSchema, body)
      const applyMode = requireApply({ apply: payload.apply, dryRun: payload.dry_run, command: 'cycles start' })

      const activeCycle = await getActiveCycleForSubstance(auth.supabase, { substanceId: payload.substance_id })
      if (activeCycle) {
        throw new CliApiError({
          code: 'conflict',
          status: 409,
          message: 'An active cycle already exists for this substance.',
          data: { active_cycle_id: activeCycle.id },
        })
      }

      const lastCycle = await getLastCycleForSubstance(auth.supabase, { substanceId: payload.substance_id })
      const nextCycleNumber = (lastCycle?.cycle_number ?? 0) + 1
      const startTs = payload.start_ts ?? new Date().toISOString()

      const execStart = async () => {
        if (applyMode.dryRun) {
          return {
            status: 200,
            envelope: okEnvelope({
              requestId,
              code: 'dry_run',
              message: 'Dry run complete.',
              data: {
                substance_id: payload.substance_id,
                cycle_number: nextCycleNumber,
                start_ts: startTs,
              },
            }),
          }
        }

        const created = await createCycleInstance(auth.supabase, {
          substanceId: payload.substance_id,
          cycleNumber: nextCycleNumber,
          startTs,
          status: 'active',
          goal: null,
          notes: null,
        })

        return {
          status: 201,
          envelope: okEnvelope({
            requestId,
            message: 'Cycle started.',
            data: created,
          }),
        }
      }

      if (!applyMode.dryRun && payload.idempotency_key) {
        return withIdempotency({
          supabase: auth.supabase,
          operation: 'cycles.start',
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: execStart,
        })
      }

      return execStart()
    }

    if (action === 'end' || action === 'abandon') {
      const payload = validateBody(cycleStateRequestSchema, body)
      const command = action === 'end' ? 'cycles end' : 'cycles abandon'
      const applyMode = requireApply({ apply: payload.apply, dryRun: payload.dry_run, command })

      const cycle = await getCycleInstanceById(auth.supabase, { cycleInstanceId: payload.cycle_id })
      if (!cycle) {
        throw new CliApiError({ code: 'not_found', status: 404, message: 'Cycle not found.' })
      }
      if (cycle.status !== 'active') {
        throw new CliApiError({
          code: 'conflict',
          status: 409,
          message: 'Only active cycles can be ended/abandoned.',
        })
      }

      const requestedEndTs = payload.end_ts ? new Date(payload.end_ts).toISOString() : new Date().toISOString()
      const safeEndTs =
        new Date(requestedEndTs).getTime() < new Date(cycle.start_ts).getTime()
          ? new Date(cycle.start_ts).toISOString()
          : requestedEndTs

      const execStateChange = async () => {
        if (applyMode.dryRun) {
          return {
            status: 200,
            envelope: okEnvelope({
              requestId,
              code: 'dry_run',
              message: 'Dry run complete.',
              data: {
                cycle_id: payload.cycle_id,
                action,
                end_ts: safeEndTs,
              },
            }),
          }
        }

        if (action === 'end') {
          await completeCycleInstance(auth.supabase, { cycleInstanceId: payload.cycle_id, endTs: safeEndTs })
        } else {
          await abandonCycleInstance(auth.supabase, { cycleInstanceId: payload.cycle_id, endTs: safeEndTs })
        }

        const updated = await getCycleInstanceById(auth.supabase, { cycleInstanceId: payload.cycle_id })

        return {
          status: 200,
          envelope: okEnvelope({
            requestId,
            message: action === 'end' ? 'Cycle ended.' : 'Cycle abandoned.',
            data: updated,
          }),
        }
      }

      if (!applyMode.dryRun && payload.idempotency_key) {
        return withIdempotency({
          supabase: auth.supabase,
          operation: action === 'end' ? 'cycles.end' : 'cycles.abandon',
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: execStateChange,
        })
      }

      return execStateChange()
    }

    if (action === 'split') {
      const payload = validateBody(cycleSplitRequestSchema, body)
      const applyMode = requireApply({ apply: payload.apply, dryRun: payload.dry_run, command: 'cycles split' })

      const execSplit = async () => {
        if (applyMode.dryRun) {
          return {
            status: 200,
            envelope: okEnvelope({
              requestId,
              code: 'dry_run',
              message: 'Dry run complete.',
              data: {
                cycle_id: payload.cycle_id,
                event_id: payload.event_id,
              },
            }),
          }
        }

        const rpcRes = await auth.supabase.rpc('split_cycle_at_event', {
          cycle_instance_id: payload.cycle_id,
          event_id: payload.event_id,
        })

        if (rpcRes.error) {
          throw new CliApiError({
            code: 'conflict',
            status: 409,
            message: splitCycleErrorMessage(rpcRes.error.message),
          })
        }

        return {
          status: 200,
          envelope: okEnvelope({
            requestId,
            message: 'Cycle split complete.',
            data: {
              previous_cycle_id: payload.cycle_id,
              new_cycle_id: rpcRes.data,
            },
          }),
        }
      }

      if (!applyMode.dryRun && payload.idempotency_key) {
        return withIdempotency({
          supabase: auth.supabase,
          operation: 'cycles.split',
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: execSplit,
        })
      }

      return execSplit()
    }

    if (action === 'list') {
      const payload = validateBody(cycleListRequestSchema, body)
      const rows = await listCycleSummary(auth.supabase)
      const filtered = rows.filter((row) => {
        if (payload.active && row.status !== 'active') return false
        if (payload.substance_id && row.substance_id !== payload.substance_id) return false
        return true
      })

      return {
        envelope: okEnvelope({
          requestId,
          message: 'Listed cycles.',
          data: {
            items: filtered,
          },
        }),
      }
    }

    if (action === 'get') {
      const payload = validateBody(cycleGetRequestSchema, body)
      const rows = await listCycleSummary(auth.supabase)
      const row = rows.find((item) => item.cycle_instance_id === payload.cycle_id) ?? null

      if (!row) {
        throw new CliApiError({
          code: 'not_found',
          status: 404,
          message: 'Cycle not found.',
        })
      }

      return {
        envelope: okEnvelope({
          requestId,
          message: 'Loaded cycle.',
          data: row,
        }),
      }
    }

    if (action === 'rules_get') {
      const payload = validateBody(cycleRulesGetRequestSchema, body)
      const rule = await getCycleRuleForSubstance(auth.supabase, { substanceId: payload.substance_id })

      return {
        envelope: okEnvelope({
          requestId,
          message: rule ? 'Loaded cycle rule.' : 'No cycle rule for substance.',
          data: rule,
        }),
      }
    }

    if (action === 'rules_set') {
      const payload = validateBody(cycleRulesSetRequestSchema, body)
      const applyMode = requireApply({ apply: payload.apply, dryRun: payload.dry_run, command: 'cycles rules set' })

      const execSet = async () => {
        if (applyMode.dryRun) {
          return {
            status: 200,
            envelope: okEnvelope({
              requestId,
              code: 'dry_run',
              message: 'Dry run complete.',
              data: payload,
            }),
          }
        }

        const row = await setCycleRuleForSubstance(auth.supabase, {
          substanceId: payload.substance_id,
          gapDaysToSuggestNewCycle: payload.gap_days_to_suggest_new_cycle,
          autoStartFirstCycle: payload.auto_start_first_cycle,
          notes: payload.notes ?? null,
        })

        return {
          status: 200,
          envelope: okEnvelope({
            requestId,
            message: 'Cycle rule saved.',
            data: row,
          }),
        }
      }

      if (!applyMode.dryRun && payload.idempotency_key) {
        return withIdempotency({
          supabase: auth.supabase,
          operation: 'cycles.rules_set',
          idempotencyKey: payload.idempotency_key,
          requestPayload: payload,
          execute: execSet,
        })
      }

      return execSet()
    }

    const payload = validateBody(cycleRulesDeleteRequestSchema, body)
    const applyMode = requireApply({ apply: payload.apply, dryRun: payload.dry_run, command: 'cycles rules delete' })

    const existingRules = await listCycleRules(auth.supabase)
    const existing = existingRules.find((rule) => rule.id === payload.cycle_rule_id) ?? null
    if (!existing) {
      throw new CliApiError({ code: 'not_found', status: 404, message: 'Cycle rule not found.' })
    }

    const execDelete = async () => {
      if (applyMode.dryRun) {
        return {
          status: 200,
          envelope: okEnvelope({
            requestId,
            code: 'dry_run',
            message: 'Dry run complete.',
            data: existing,
          }),
        }
      }

      await softDeleteCycleRule(auth.supabase, { cycleRuleId: payload.cycle_rule_id })
      return {
        status: 200,
        envelope: okEnvelope({
          requestId,
          message: 'Cycle rule deleted.',
          data: {
            cycle_rule_id: payload.cycle_rule_id,
          },
        }),
      }
    }

    if (!applyMode.dryRun && payload.idempotency_key) {
      return withIdempotency({
        supabase: auth.supabase,
        operation: 'cycles.rules_delete',
        idempotencyKey: payload.idempotency_key,
        requestPayload: payload,
        execute: execDelete,
      })
    }

    return execDelete()
  })
}
