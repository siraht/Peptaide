import { z } from 'zod'

import { validateSameOrigin } from '@/lib/http/sameOrigin'

import { requireCliBearer } from '@/lib/api/cli/auth'
import { queryList } from '@/lib/api/cli/query'
import { readJsonBody, validateBody } from '@/lib/api/cli/request'
import { runCliRoute } from '@/lib/api/cli/route'
import { CliApiError, okEnvelope } from '@/lib/api/cli/response'

export const runtime = 'nodejs'

type CatalogAction = 'substances' | 'routes' | 'formulations' | 'vials'

const catalogRequestSchema = z.object({
  query: z.string().optional(),
  substance_id: z.string().uuid().optional(),
  formulation_id: z.string().uuid().optional(),
  status: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  cursor: z.string().optional(),
})

function readAction(payload: unknown): CatalogAction {
  const action =
    payload && typeof payload === 'object' && 'action' in payload
      ? String((payload as { action?: unknown }).action ?? '').trim()
      : ''

  switch (action) {
    case 'substances':
    case 'routes':
    case 'formulations':
    case 'vials':
      return action
    default:
      throw new CliApiError({
        code: 'validation_error',
        status: 400,
        message: 'Invalid catalog action.',
        details: ['Supported actions: substances, routes, formulations, vials'],
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
    const payload = validateBody(catalogRequestSchema, body)

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
          message: 'Catalog substances listed.',
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
          message: 'Catalog routes listed.',
          data: result,
        }),
      }
    }

    if (action === 'formulations') {
      const filters: Array<{ field: string; op: 'eq' | 'ilike'; value: string }> = []
      if (payload.query) filters.push({ field: 'name', op: 'ilike', value: `%${payload.query}%` })
      if (payload.substance_id) {
        filters.push({ field: 'substance_id', op: 'eq', value: payload.substance_id })
      }

      const result = await queryList(auth.supabase, {
        resource: 'formulations',
        filters,
        sort: [{ field: 'name', direction: 'asc' }],
        limit: payload.limit,
        cursor: payload.cursor,
      })

      return {
        envelope: okEnvelope({
          requestId,
          message: 'Catalog formulations listed.',
          data: result,
        }),
      }
    }

    const filters: Array<{ field: string; op: 'eq' | 'ilike'; value: string }> = []
    if (payload.formulation_id) {
      filters.push({ field: 'formulation_id', op: 'eq', value: payload.formulation_id })
    }
    if (payload.status) {
      filters.push({ field: 'status', op: 'eq', value: payload.status })
    }
    if (payload.query) {
      filters.push({ field: 'lot', op: 'ilike', value: `%${payload.query}%` })
    }

    const result = await queryList(auth.supabase, {
      resource: 'vials',
      filters,
      sort: [{ field: 'created_at', direction: 'desc' }],
      limit: payload.limit,
      cursor: payload.cursor,
    })

    return {
      envelope: okEnvelope({
        requestId,
        message: 'Catalog vials listed.',
        data: result,
      }),
    }
  })
}
