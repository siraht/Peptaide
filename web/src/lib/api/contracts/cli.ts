import { z } from 'zod'
import { hasEffectiveModelContext, hasScopedBaseOverride } from './sessionCreateValidation'

export const CLI_CONTRACT_VERSION = '2026-02-16'

export const inputKindSchema = z.enum(['mass', 'volume', 'device_units', 'iu', 'other'])
export const compartmentSchema = z.enum(['systemic', 'cns', 'both'])
export const cycleDecisionSchema = z.enum(['auto', 'new_cycle', 'continue_cycle'])

export const isoDateTimeSchema = z.string().datetime({ offset: true })
export const ymdDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const hhmmSchema = z.string().regex(/^\d{2}:\d{2}$/)

export const cliEnvelopeSchema = z.object({
  ok: z.boolean(),
  code: z.string(),
  message: z.string(),
  data: z.unknown().nullable(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  request_id: z.string(),
})

export type CliEnvelope<T = unknown> = Omit<z.infer<typeof cliEnvelopeSchema>, 'data'> & {
  data: T | null
}

const baseInputSchema = z.object({
  input_text: z.string().min(1).optional(),
  input_kind: inputKindSchema.optional(),
  input_value: z.number().finite().nonnegative().optional(),
  input_unit: z.string().min(1).optional(),
  normalized_unit: z.string().min(1).optional(),
  prefer_structured: z.boolean().optional(),
})

function validateInputSelection(v: z.infer<typeof baseInputSchema>, ctx: z.RefinementCtx): void {
  const hasText = typeof v.input_text === 'string' && v.input_text.trim().length > 0
  const hasStructured =
    v.input_kind != null &&
    typeof v.input_value === 'number' &&
    Number.isFinite(v.input_value) &&
    typeof v.input_unit === 'string' &&
    v.input_unit.trim().length > 0

  if (!hasText && !hasStructured) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either input_text or input_kind+input_value+input_unit.',
      path: ['input_text'],
    })
    return
  }

  if (hasText && hasStructured && !v.prefer_structured) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'When both text and structured inputs are provided, set prefer_structured=true.',
      path: ['prefer_structured'],
    })
  }
}

export const calcParseRequestSchema = z.object({
  text: z.string().min(1),
})

export const calcDoseRequestSchema =
  baseInputSchema
    .extend({
      concentration_mg_per_ml: z.number().finite().positive().optional(),
      vial_content_mass_mg: z.number().finite().positive().optional(),
      vial_total_volume_ml: z.number().finite().positive().optional(),
      volume_ml_per_device_unit: z.number().finite().positive().optional(),
      prefer_direct_concentration: z.boolean().optional(),
    })
    .superRefine((v, ctx) => {
      validateInputSelection(v, ctx)

      const hasDirect = typeof v.concentration_mg_per_ml === 'number'
      const hasDerivedInputs =
        typeof v.vial_content_mass_mg === 'number' && typeof v.vial_total_volume_ml === 'number'

      if (!hasDirect && !hasDerivedInputs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Provide concentration_mg_per_ml or both vial_content_mass_mg and vial_total_volume_ml.',
          path: ['concentration_mg_per_ml'],
        })
      }

      if (v.input_kind === 'device_units' && typeof v.volume_ml_per_device_unit !== 'number') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'volume_ml_per_device_unit is required for device_units input.',
          path: ['volume_ml_per_device_unit'],
        })
      }
    })

export const calcEffectiveRequestSchema =
  calcDoseRequestSchema
    .extend({
      dose_mg: z.number().finite().nonnegative().optional(),
      compartment: compartmentSchema.optional(),
      base_fraction_dist_id: z.string().uuid().optional(),
      multiplier_dist_id: z.array(z.string().uuid()).optional(),
      formulation_id: z.string().uuid().optional(),
      substance_id: z.string().uuid().optional(),
      route_id: z.string().uuid().optional(),
      systemic_base_fraction_dist_id: z.string().uuid().optional(),
      cns_base_fraction_dist_id: z.string().uuid().optional(),
      systemic_multiplier_dist_id: z.array(z.string().uuid()).optional(),
      cns_multiplier_dist_id: z.array(z.string().uuid()).optional(),
      mc_n: z.number().int().positive().max(1_000_000).optional(),
      mc_seed: z.union([z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), z.literal('auto')]).optional(),
      strict_model_coverage: z.boolean().optional(),
    })
    .superRefine((v, ctx) => {
      const hasContext = hasEffectiveModelContext({
        formulationId: typeof v.formulation_id === 'string' ? v.formulation_id : null,
        formulationName:
          typeof (v as Record<string, unknown>).formulation_name === 'string'
            ? String((v as Record<string, unknown>).formulation_name)
            : null,
        substanceId: typeof v.substance_id === 'string' ? v.substance_id : null,
        routeId: typeof v.route_id === 'string' ? v.route_id : null,
      })

      const hasGlobalDists =
        typeof v.base_fraction_dist_id === 'string' ||
        (Array.isArray(v.multiplier_dist_id) && v.multiplier_dist_id.length > 0)

      const hasScopedDists =
        typeof v.systemic_base_fraction_dist_id === 'string' ||
        typeof v.cns_base_fraction_dist_id === 'string' ||
        (Array.isArray(v.systemic_multiplier_dist_id) && v.systemic_multiplier_dist_id.length > 0) ||
        (Array.isArray(v.cns_multiplier_dist_id) && v.cns_multiplier_dist_id.length > 0)

      if (!hasContext && !hasGlobalDists && !hasScopedDists) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Provide model context via formulation_id or substance_id+route_id, or pass explicit distributions.',
          path: ['formulation_id'],
        })
      }

      if (v.compartment === 'both' && hasGlobalDists) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'For compartment=both with explicit distributions, use systemic_* and cns_* distribution flags.',
          path: ['compartment'],
        })
      }

      if (
        hasScopedBaseOverride({
          compartment: v.compartment ?? null,
          systemicBaseFractionDistId: v.systemic_base_fraction_dist_id ?? null,
          cnsBaseFractionDistId: v.cns_base_fraction_dist_id ?? null,
        })
      ) {
        if (!v.systemic_base_fraction_dist_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'systemic_base_fraction_dist_id is required when compartment=both with explicit modeling.',
            path: ['systemic_base_fraction_dist_id'],
          })
        }
        if (!v.cns_base_fraction_dist_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'cns_base_fraction_dist_id is required when compartment=both with explicit modeling.',
            path: ['cns_base_fraction_dist_id'],
          })
        }
      }
    })

export const sessionCreateRequestSchema =
  calcEffectiveRequestSchema
    .extend({
      formulation_name: z.string().min(1).optional(),
      vial_id: z.string().uuid().optional(),
      ts: isoDateTimeSchema.optional(),
      date: ymdDateSchema.optional(),
      time: hhmmSchema.optional(),
      timezone: z.string().min(1).optional(),
      notes: z.string().max(4000).optional(),
      tags: z.array(z.string().min(1).max(128)).max(32).optional(),
      cycle_decision: cycleDecisionSchema.optional(),
      idempotency_key: z.string().min(1).max(256).optional(),
      dry_run: z.boolean().optional(),
      apply: z.boolean().optional(),
      deterministic_seed_mode: z.boolean().optional(),
    })
    .superRefine((v, ctx) => {
      if (!v.formulation_id && !v.formulation_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide formulation_id or formulation_name.',
          path: ['formulation_id'],
        })
      }

      const hasTs = typeof v.ts === 'string'
      const hasLocal = typeof v.date === 'string' || typeof v.time === 'string' || typeof v.timezone === 'string'

      if (!hasTs && !hasLocal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide ts or date+time+timezone.',
          path: ['ts'],
        })
      }

      if (!hasTs && hasLocal) {
        if (!v.date || !v.time || !v.timezone) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'date, time, and timezone are all required when ts is omitted.',
            path: ['date'],
          })
        }
      }
    })

export const sessionUpdateRequestSchema = z
  .object({
    event_id: z.string().uuid(),
    input_text: z.string().min(1).optional(),
    input_kind: inputKindSchema.optional(),
    input_value: z.number().finite().nonnegative().optional(),
    input_unit: z.string().min(1).optional(),
    normalized_unit: z.string().min(1).optional(),
    prefer_structured: z.boolean().optional(),
    ts: isoDateTimeSchema.optional(),
    notes: z.string().max(4000).nullable().optional(),
    tags: z.array(z.string().min(1).max(128)).max(32).optional(),
    cycle_decision: cycleDecisionSchema.optional(),
    idempotency_key: z.string().min(1).max(256).optional(),
    dry_run: z.boolean().optional(),
    apply: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const hasText = typeof v.input_text === 'string'
    const hasStructured =
      v.input_kind != null &&
      typeof v.input_value === 'number' &&
      typeof v.input_unit === 'string'

    if (hasText && hasStructured && !v.prefer_structured) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'When updating with both text and structured values, set prefer_structured=true.',
        path: ['prefer_structured'],
      })
    }
  })

export const sessionListRequestSchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  substance_id: z.string().uuid().optional(),
  formulation_id: z.string().uuid().optional(),
  cycle_id: z.string().uuid().optional(),
  include_deleted: z.boolean().optional(),
  deleted_only: z.boolean().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  cursor: z.string().optional(),
})

export const sessionCopyRequestSchema = sessionCreateRequestSchema.extend({
  event_id: z.string().uuid(),
})

export const sessionBatchItemSchema = sessionCreateRequestSchema.safeExtend({
  idempotency_key: z.string().min(1).max(256),
})

export const sessionBatchRequestSchema = z.object({
  items: z.array(sessionBatchItemSchema).min(1).max(500),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
})

export const cycleSuggestRequestSchema = z.object({
  substance_id: z.string().uuid(),
  new_event_ts: isoDateTimeSchema,
})

export const cycleStartRequestSchema = z.object({
  substance_id: z.string().uuid(),
  start_ts: isoDateTimeSchema.optional(),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

export const cycleStateRequestSchema = z.object({
  cycle_id: z.string().uuid(),
  end_ts: isoDateTimeSchema.optional(),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

export const cycleSplitRequestSchema = z.object({
  cycle_id: z.string().uuid(),
  event_id: z.string().uuid(),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

export const cycleRulesSetRequestSchema = z.object({
  substance_id: z.string().uuid(),
  gap_days_to_suggest_new_cycle: z.number().int().nonnegative(),
  auto_start_first_cycle: z.boolean(),
  notes: z.string().max(4000).nullable().optional(),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

export const cycleRulesDeleteRequestSchema = z.object({
  cycle_rule_id: z.string().uuid(),
  force: z.boolean().optional(),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

export const profileSetRequestSchema = z.object({
  timezone: z.string().min(1),
  default_mass_unit: z.enum(['mg', 'mcg', 'g']),
  default_volume_unit: z.enum(['mL', 'cc', 'uL']),
  default_simulation_n: z.number().int().positive(),
  cycle_gap_default_days: z.number().int().nonnegative(),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

export const notificationSetRequestSchema = z.object({
  notify_low_stock_enabled: z.boolean(),
  notify_low_stock_runway_days_threshold: z.number().int().nonnegative(),
  notify_spend_enabled: z.boolean(),
  notify_spend_usd_per_day_threshold: z.number().finite().nonnegative(),
  notify_spend_window_days: z.number().int().min(1).max(365),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

export const dataDeleteAllRequestSchema = z.object({
  confirm: z.literal('DELETE'),
  force: z.boolean().optional(),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(256).optional(),
})

export const queryResourceSchema = z.enum([
  'substances',
  'routes',
  'formulations',
  'devices',
  'distributions',
  'evidence_sources',
  'administration_events',
  'vials',
  'v_inventory_status',
  'v_inventory_summary',
  'cycle_instances',
  'cycle_rules',
  'v_cycle_summary',
  'orders',
  'order_items',
  'vendors',
  'v_order_item_vial_counts',
  'profiles',
  'v_daily_totals_admin',
  'v_daily_totals_effective_systemic',
  'v_daily_totals_effective_cns',
  'v_spend_daily_weekly_monthly',
  'v_dose_inventory_warnings',
])

export const queryFilterSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike', 'like', 'in', 'is']),
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number(), z.boolean()]))]),
})

export const queryListRequestSchema = z.object({
  resource: queryResourceSchema,
  filters: z.array(queryFilterSchema).optional(),
  sort: z.array(z.object({ field: z.string().min(1), direction: z.enum(['asc', 'desc']) })).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  cursor: z.string().optional(),
  fields: z.array(z.string().min(1)).optional(),
})

export const queryGetRequestSchema = z.object({
  resource: queryResourceSchema,
  id: z.string().min(1),
  fields: z.array(z.string().min(1)).optional(),
})

export const queryAggregateRequestSchema = z.object({
  resource: queryResourceSchema,
  metric: z.enum(['count', 'sum', 'avg', 'min', 'max']),
  field: z.string().min(1).optional(),
  filters: z.array(queryFilterSchema).optional(),
  group_by: z.array(z.string().min(1)).optional(),
})

export const authLoginRequestSchema = z.object({
  email: z.string().email(),
})

export const authVerifyRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
})

export const authRefreshRequestSchema = z.object({
  refresh_token: z.string().min(1),
})

export const authTokenCreateRequestSchema = z.object({
  name: z.string().min(1).max(128),
  expires_days: z.number().int().positive().max(3650).optional(),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
})

export const authTokenRevokeRequestSchema = z.object({
  token_id: z.string().min(1),
  force: z.boolean().optional(),
  dry_run: z.boolean().optional(),
  apply: z.boolean().optional(),
})

export type CalcDoseRequest = z.infer<typeof calcDoseRequestSchema>
export type CalcEffectiveRequest = z.infer<typeof calcEffectiveRequestSchema>
export type SessionCreateRequest = z.infer<typeof sessionCreateRequestSchema>
export type SessionUpdateRequest = z.infer<typeof sessionUpdateRequestSchema>
export type SessionListRequest = z.infer<typeof sessionListRequestSchema>
export type SessionBatchRequest = z.infer<typeof sessionBatchRequestSchema>
export type QueryFilter = z.infer<typeof queryFilterSchema>
export type QueryListRequest = z.infer<typeof queryListRequestSchema>
export type QueryGetRequest = z.infer<typeof queryGetRequestSchema>
export type QueryAggregateRequest = z.infer<typeof queryAggregateRequestSchema>
