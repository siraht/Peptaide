import { z } from 'zod'

import {
  queryAggregateRequestSchema,
  queryGetRequestSchema,
  queryListRequestSchema,
} from '@/lib/api/contracts/cli'
import { validateSameOrigin } from '@/lib/http/sameOrigin'

import { requireCliBearer } from '@/lib/api/cli/auth'
import { readJsonBody, validateBody } from '@/lib/api/cli/request'
import { runCliRoute } from '@/lib/api/cli/route'
import { CliApiError, okEnvelope } from '@/lib/api/cli/response'
import {
  listQueryableResources,
  queryAggregate,
  queryGet,
  queryList,
} from '@/lib/api/cli/query'

export const runtime = 'nodejs'

type QueryAction =
  | 'resources'
  | 'list'
  | 'get'
  | 'aggregate'
  | 'substances'
  | 'routes'
  | 'formulations'
  | 'dose_history'
  | 'inventory'
  | 'inventory_summary'
  | 'active_vials'

const queryShortcutSchema = z.object({
  query: z.string().optional(),
  substance_id: z.string().uuid().optional(),
  formulation_id: z.string().uuid().optional(),
  status: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  include_deleted: z.boolean().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  cursor: z.string().optional(),
})

function readAction(payload: unknown): QueryAction {
  const action =
    payload && typeof payload === 'object' && 'action' in payload
      ? String((payload as { action?: unknown }).action ?? '').trim()
      : ''

  switch (action) {
    case 'resources':
    case 'list':
    case 'get':
    case 'aggregate':
    case 'substances':
    case 'routes':
    case 'formulations':
    case 'dose_history':
    case 'inventory':
    case 'inventory_summary':
    case 'active_vials':
      return action
    default:
      throw new CliApiError({
        code: 'validation_error',
        status: 400,
        message: 'Invalid query action.',
        details: [
          'Supported actions: resources, list, get, aggregate, substances, routes, formulations, dose_history, inventory, inventory_summary, active_vials',
        ],
      })
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

    if (action === 'resources') {
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Queryable resource catalog.',
          data: {
            schema_version: '2026-02-16',
            resources: listQueryableResources(),
          },
        }),
      }
    }

    if (action === 'list') {
      const payload = validateBody(queryListRequestSchema, body)
      const result = await queryList(auth.supabase, payload)
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Query list complete.',
          data: result,
        }),
      }
    }

    if (action === 'get') {
      const payload = validateBody(queryGetRequestSchema, body)
      const result = await queryGet(auth.supabase, payload)
      if (!result.item) {
        throw new CliApiError({ code: 'not_found', status: 404, message: 'Query item not found.' })
      }
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Query get complete.',
          data: result,
        }),
      }
    }

    if (action === 'aggregate') {
      const payload = validateBody(queryAggregateRequestSchema, body)
      const result = await queryAggregate(auth.supabase, payload)
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Query aggregate complete.',
          data: result,
        }),
      }
    }

    const payload = validateBody(queryShortcutSchema, body)

    if (action === 'substances') {
      const result = await queryList(auth.supabase, {
        resource: 'substances',
        filters: payload.query
          ? [{ field: 'display_name', op: 'ilike', value: `%${payload.query}%` }]
          : undefined,
        sort: [{ field: 'display_name', direction: 'asc' }],
        limit: payload.limit,
        cursor: payload.cursor,
      })
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Substances query complete.',
          data: result,
        }),
      }
    }

    if (action === 'routes') {
      const result = await queryList(auth.supabase, {
        resource: 'routes',
        filters: payload.query
          ? [{ field: 'name', op: 'ilike', value: `%${payload.query}%` }]
          : undefined,
        sort: [{ field: 'name', direction: 'asc' }],
        limit: payload.limit,
        cursor: payload.cursor,
      })
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Routes query complete.',
          data: result,
        }),
      }
    }

    if (action === 'formulations') {
      const filters: NonNullable<z.infer<typeof queryListRequestSchema>['filters']> = []
      if (payload.query) filters.push({ field: 'name', op: 'ilike', value: `%${payload.query}%` })
      if (payload.substance_id) filters.push({ field: 'substance_id', op: 'eq', value: payload.substance_id })

      const result = await queryList(auth.supabase, {
        resource: 'formulations',
        filters: filters.length > 0 ? filters : undefined,
        sort: [{ field: 'name', direction: 'asc' }],
        limit: payload.limit,
        cursor: payload.cursor,
      })
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Formulations query complete.',
          data: result,
        }),
      }
    }

    if (action === 'dose_history') {
      const filters: NonNullable<z.infer<typeof queryListRequestSchema>['filters']> = []
      if (payload.from) filters.push({ field: 'ts', op: 'gte', value: payload.from })
      if (payload.to) filters.push({ field: 'ts', op: 'lte', value: payload.to })
      if (payload.substance_id) filters.push({ field: 'substance_id', op: 'eq', value: payload.substance_id })
      if (payload.formulation_id) {
        filters.push({ field: 'formulation_id', op: 'eq', value: payload.formulation_id })
      }
      if (!payload.include_deleted) {
        filters.push({ field: 'deleted_at', op: 'is', value: null })
      }

      const result = await queryList(auth.supabase, {
        resource: 'administration_events',
        filters,
        sort: [
          { field: 'ts', direction: 'desc' },
          { field: 'created_at', direction: 'desc' },
          { field: 'event_id', direction: 'desc' },
        ],
        limit: payload.limit,
        cursor: payload.cursor,
      })
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Dose history query complete.',
          data: result,
        }),
      }
    }

    if (action === 'inventory') {
      const filters: NonNullable<z.infer<typeof queryListRequestSchema>['filters']> = []
      if (payload.substance_id) filters.push({ field: 'substance_id', op: 'eq', value: payload.substance_id })
      if (payload.formulation_id) {
        filters.push({ field: 'formulation_id', op: 'eq', value: payload.formulation_id })
      }
      if (payload.status) filters.push({ field: 'status', op: 'eq', value: payload.status })

      const result = await queryList(auth.supabase, {
        resource: 'v_inventory_status',
        filters: filters.length > 0 ? filters : undefined,
        limit: payload.limit,
        cursor: payload.cursor,
      })
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Inventory query complete.',
          data: result,
        }),
      }
    }

    if (action === 'inventory_summary') {
      const filters: NonNullable<z.infer<typeof queryListRequestSchema>['filters']> = []
      if (payload.substance_id) filters.push({ field: 'substance_id', op: 'eq', value: payload.substance_id })

      const result = await queryList(auth.supabase, {
        resource: 'v_inventory_summary',
        filters: filters.length > 0 ? filters : undefined,
        limit: payload.limit,
        cursor: payload.cursor,
      })
      return {
        envelope: okEnvelope({
          requestId,
          message: 'Inventory summary query complete.',
          data: result,
        }),
      }
    }

    const filters: NonNullable<z.infer<typeof queryListRequestSchema>['filters']> = [{
      field: 'active_vial_id',
      op: 'neq',
      value: null,
    }]
    if (payload.substance_id) filters.push({ field: 'substance_id', op: 'eq', value: payload.substance_id })
    if (payload.formulation_id) {
      filters.push({ field: 'formulation_id', op: 'eq', value: payload.formulation_id })
    }

    const result = await queryList(auth.supabase, {
      resource: 'v_inventory_summary',
      filters,
      fields: ['substance_id', 'substance_name', 'formulation_id', 'formulation_name', 'active_vial_id', 'active_remaining_mass_mg'],
      limit: payload.limit,
      cursor: payload.cursor,
    })

    return {
      envelope: okEnvelope({
        requestId,
        message: 'Active-vials query complete.',
        data: result,
      }),
    }
  })
}
