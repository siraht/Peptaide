import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  queryResourceSchema,
  type QueryAggregateRequest,
  type QueryGetRequest,
  type QueryListRequest,
} from '@/lib/api/contracts/cli'
import type { Database } from '@/lib/supabase/database.types'

import { CliApiError } from './response'

type ResourceName = z.infer<typeof queryResourceSchema>

type ResourceSpec = {
  name: ResourceName
  source: string
  idField: string
  defaultSort: Array<{ field: string; direction: 'asc' | 'desc' }>
  filterFields: string[]
  description: string
  kind: 'table' | 'view'
}

type CursorState = {
  offset: number
}

const RESOURCE_SPECS: ResourceSpec[] = [
  {
    name: 'substances',
    source: 'substances',
    idField: 'id',
    defaultSort: [{ field: 'display_name', direction: 'asc' }],
    filterFields: ['id', 'canonical_name', 'display_name', 'family', 'target_compartment_default'],
    description: 'Reference data for tracked substances.',
    kind: 'table',
  },
  {
    name: 'routes',
    source: 'routes',
    idField: 'id',
    defaultSort: [{ field: 'name', direction: 'asc' }],
    filterFields: ['id', 'name', 'default_input_kind', 'default_input_unit'],
    description: 'Reference data for administration routes.',
    kind: 'table',
  },
  {
    name: 'formulations',
    source: 'formulations',
    idField: 'id',
    defaultSort: [{ field: 'name', direction: 'asc' }],
    filterFields: ['id', 'name', 'substance_id', 'route_id', 'device_id'],
    description: 'Formulation definitions linked to substances/routes.',
    kind: 'table',
  },
  {
    name: 'devices',
    source: 'devices',
    idField: 'id',
    defaultSort: [{ field: 'name', direction: 'asc' }],
    filterFields: ['id', 'name', 'device_kind', 'default_unit'],
    description: 'Device catalog used for calibrated inputs.',
    kind: 'table',
  },
  {
    name: 'distributions',
    source: 'distributions',
    idField: 'id',
    defaultSort: [{ field: 'name', direction: 'asc' }],
    filterFields: ['id', 'name', 'value_type', 'dist_type'],
    description: 'Uncertainty distributions used by BA/MC simulation.',
    kind: 'table',
  },
  {
    name: 'evidence_sources',
    source: 'evidence_sources',
    idField: 'id',
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    filterFields: ['id', 'source_type', 'citation'],
    description: 'Evidence references linked to recommendations/model data.',
    kind: 'table',
  },
  {
    name: 'administration_events',
    source: 'v_event_enriched',
    idField: 'event_id',
    defaultSort: [
      { field: 'ts', direction: 'desc' },
      { field: 'created_at', direction: 'desc' },
      { field: 'event_id', direction: 'desc' },
    ],
    filterFields: ['event_id', 'ts', 'substance_id', 'formulation_id', 'cycle_instance_id', 'deleted_at'],
    description: 'Dose history with formulation and compartment rollup columns.',
    kind: 'view',
  },
  {
    name: 'vials',
    source: 'vials',
    idField: 'id',
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    filterFields: ['id', 'substance_id', 'formulation_id', 'status', 'lot', 'deleted_at'],
    description: 'Raw vial inventory rows.',
    kind: 'table',
  },
  {
    name: 'v_inventory_status',
    source: 'v_inventory_status',
    idField: 'vial_id',
    defaultSort: [
      { field: 'status', direction: 'asc' },
      { field: 'substance_name', direction: 'asc' },
      { field: 'formulation_name', direction: 'asc' },
    ],
    filterFields: ['vial_id', 'substance_id', 'formulation_id', 'status', 'remaining_mass_mg'],
    description: 'Per-vial inventory remaining metrics and runway estimates.',
    kind: 'view',
  },
  {
    name: 'v_inventory_summary',
    source: 'v_inventory_summary',
    idField: 'formulation_id',
    defaultSort: [
      { field: 'substance_name', direction: 'asc' },
      { field: 'formulation_name', direction: 'asc' },
    ],
    filterFields: ['formulation_id', 'substance_id', 'active_vial_id', 'total_remaining_mass_mg'],
    description: 'Formulation-level inventory rollups including active vial remaining mass.',
    kind: 'view',
  },
  {
    name: 'cycle_instances',
    source: 'cycle_instances',
    idField: 'id',
    defaultSort: [{ field: 'start_ts', direction: 'desc' }],
    filterFields: ['id', 'substance_id', 'cycle_number', 'status'],
    description: 'Raw cycle instance rows.',
    kind: 'table',
  },
  {
    name: 'cycle_rules',
    source: 'cycle_rules',
    idField: 'id',
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    filterFields: ['id', 'substance_id', 'gap_days_to_suggest_new_cycle', 'auto_start_first_cycle'],
    description: 'Cycle suggestion rule configuration per substance.',
    kind: 'table',
  },
  {
    name: 'v_cycle_summary',
    source: 'v_cycle_summary',
    idField: 'cycle_instance_id',
    defaultSort: [
      { field: 'substance_name', direction: 'asc' },
      { field: 'cycle_number', direction: 'asc' },
    ],
    filterFields: ['cycle_instance_id', 'substance_id', 'status', 'start_ts', 'end_ts'],
    description: 'Cycle rollup view with lengths and administered totals.',
    kind: 'view',
  },
  {
    name: 'orders',
    source: 'orders',
    idField: 'id',
    defaultSort: [{ field: 'ordered_at', direction: 'desc' }],
    filterFields: ['id', 'vendor_id', 'ordered_at'],
    description: 'Order records tied to vendors.',
    kind: 'table',
  },
  {
    name: 'order_items',
    source: 'order_items',
    idField: 'id',
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    filterFields: ['id', 'order_id', 'substance_id', 'formulation_id'],
    description: 'Order line items with expected vial counts.',
    kind: 'table',
  },
  {
    name: 'vendors',
    source: 'vendors',
    idField: 'id',
    defaultSort: [{ field: 'name', direction: 'asc' }],
    filterFields: ['id', 'name'],
    description: 'Vendor directory for ordering.',
    kind: 'table',
  },
  {
    name: 'v_order_item_vial_counts',
    source: 'v_order_item_vial_counts',
    idField: 'order_item_id',
    defaultSort: [{ field: 'order_item_id', direction: 'asc' }],
    filterFields: ['order_item_id'],
    description: 'Order item vial/event cost and count rollups.',
    kind: 'view',
  },
  {
    name: 'profiles',
    source: 'profiles',
    idField: 'user_id',
    defaultSort: [{ field: 'created_at', direction: 'desc' }],
    filterFields: ['user_id', 'timezone'],
    description: 'Personal settings and notification preferences.',
    kind: 'table',
  },
  {
    name: 'v_daily_totals_admin',
    source: 'v_daily_totals_admin',
    idField: 'day_local',
    defaultSort: [{ field: 'day_local', direction: 'desc' }],
    filterFields: ['day_local', 'substance_id'],
    description: 'Daily administered-mass totals.',
    kind: 'view',
  },
  {
    name: 'v_daily_totals_effective_systemic',
    source: 'v_daily_totals_effective_systemic',
    idField: 'day_local',
    defaultSort: [{ field: 'day_local', direction: 'desc' }],
    filterFields: ['day_local', 'substance_id'],
    description: 'Daily systemic effective-dose totals.',
    kind: 'view',
  },
  {
    name: 'v_daily_totals_effective_cns',
    source: 'v_daily_totals_effective_cns',
    idField: 'day_local',
    defaultSort: [{ field: 'day_local', direction: 'desc' }],
    filterFields: ['day_local', 'substance_id'],
    description: 'Daily CNS effective-dose totals.',
    kind: 'view',
  },
  {
    name: 'v_spend_daily_weekly_monthly',
    source: 'v_spend_daily_weekly_monthly',
    idField: 'period_start_date',
    defaultSort: [{ field: 'period_start_date', direction: 'desc' }],
    filterFields: ['period_kind', 'period_start_date'],
    description: 'Spend rollups by day/week/month.',
    kind: 'view',
  },
  {
    name: 'v_dose_inventory_warnings',
    source: 'v_dose_inventory_warnings',
    idField: 'event_id',
    defaultSort: [{ field: 'event_ts', direction: 'desc' }],
    filterFields: ['event_id', 'event_date', 'substance_id', 'formulation_id', 'severity'],
    description: 'Dose logging warnings tied to inventory state.',
    kind: 'view',
  },
]

const RESOURCE_BY_NAME = new Map<ResourceName, ResourceSpec>(RESOURCE_SPECS.map((x) => [x.name, x]))

function readResource(name: ResourceName): ResourceSpec {
  const spec = RESOURCE_BY_NAME.get(name)
  if (!spec) {
    throw new CliApiError({
      code: 'validation_error',
      status: 400,
      message: `Unsupported resource: ${name}`,
    })
  }
  return spec
}

function decodeCursor(raw: string | undefined): CursorState {
  if (!raw) return { offset: 0 }
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = JSON.parse(decoded) as CursorState
    if (!Number.isInteger(parsed.offset) || parsed.offset < 0) return { offset: 0 }
    return { offset: parsed.offset }
  } catch {
    return { offset: 0 }
  }
}

function encodeCursor(state: CursorState): string {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url')
}

function applyFilters(
  query: any,
  filters: QueryListRequest['filters'] | QueryAggregateRequest['filters'] | undefined,
): any {
  let q = query

  for (const filter of filters ?? []) {
    const field = filter.field
    switch (filter.op) {
      case 'eq':
        q = q.eq(field, filter.value)
        break
      case 'neq':
        q = q.neq(field, filter.value)
        break
      case 'gt':
        q = q.gt(field, filter.value)
        break
      case 'gte':
        q = q.gte(field, filter.value)
        break
      case 'lt':
        q = q.lt(field, filter.value)
        break
      case 'lte':
        q = q.lte(field, filter.value)
        break
      case 'ilike':
        q = q.ilike(field, String(filter.value))
        break
      case 'like':
        q = q.like(field, String(filter.value))
        break
      case 'in':
        q = q.in(field, Array.isArray(filter.value) ? filter.value : [filter.value])
        break
      case 'is':
        q = q.is(field, filter.value)
        break
      default:
        throw new CliApiError({
          code: 'validation_error',
          status: 400,
          message: `Unsupported filter op: ${String((filter as { op?: unknown }).op)}`,
        })
    }
  }

  return q
}

function applySort(
  query: any,
  sort: QueryListRequest['sort'] | undefined,
  fallback: ResourceSpec['defaultSort'],
): any {
  let q = query
  const orderBy = sort && sort.length > 0 ? sort : fallback
  for (const item of orderBy) {
    q = q.order(item.field, { ascending: item.direction === 'asc' })
  }
  return q
}

function calcMetric(
  metric: QueryAggregateRequest['metric'],
  values: number[],
): number | null {
  if (metric === 'count') return values.length
  if (values.length === 0) return null

  if (metric === 'sum') return values.reduce((acc, x) => acc + x, 0)
  if (metric === 'avg') return values.reduce((acc, x) => acc + x, 0) / values.length
  if (metric === 'min') return Math.min(...values)
  if (metric === 'max') return Math.max(...values)
  return null
}

export function listQueryableResources(): Array<{
  name: ResourceName
  source: string
  kind: 'table' | 'view'
  id_field: string
  default_sort: ResourceSpec['defaultSort']
  filter_fields: string[]
  description: string
}> {
  return RESOURCE_SPECS.map((spec) => ({
    name: spec.name,
    source: spec.source,
    kind: spec.kind,
    id_field: spec.idField,
    default_sort: spec.defaultSort,
    filter_fields: spec.filterFields,
    description: spec.description,
  }))
}

export async function queryList(
  supabase: SupabaseClient<Database>,
  request: QueryListRequest,
): Promise<{
  resource: ResourceName
  items: unknown[]
  next_cursor: string | null
  applied_limit: number
}> {
  const spec = readResource(request.resource)
  const state = decodeCursor(request.cursor)
  const limit = request.limit ?? 100

  const selectedFields = request.fields && request.fields.length > 0 ? request.fields.join(',') : '*'

  let q = supabase.from(spec.source as any).select(selectedFields)
  q = applyFilters(q, request.filters)
  q = applySort(q, request.sort, spec.defaultSort)
  q = q.range(state.offset, state.offset + limit - 1)

  const res = await q
  if (res.error) {
    throw new Error(res.error.message)
  }

  const rows = (res.data ?? []) as unknown[]
  const nextCursor = rows.length === limit ? encodeCursor({ offset: state.offset + rows.length }) : null

  return {
    resource: request.resource,
    items: rows,
    next_cursor: nextCursor,
    applied_limit: limit,
  }
}

export async function queryGet(
  supabase: SupabaseClient<Database>,
  request: QueryGetRequest,
): Promise<{
  resource: ResourceName
  item: unknown | null
}> {
  const spec = readResource(request.resource)
  const selectedFields = request.fields && request.fields.length > 0 ? request.fields.join(',') : '*'

  const res = await supabase
    .from(spec.source as any)
    .select(selectedFields)
    .eq(spec.idField, request.id)
    .maybeSingle()

  if (res.error) {
    throw new Error(res.error.message)
  }

  return {
    resource: request.resource,
    item: res.data ?? null,
  }
}

export async function queryAggregate(
  supabase: SupabaseClient<Database>,
  request: QueryAggregateRequest,
): Promise<{
  resource: ResourceName
  metric: QueryAggregateRequest['metric']
  field: string | null
  value: number | null
  groups: Array<{ key: Record<string, unknown>; value: number | null }>
}> {
  const spec = readResource(request.resource)

  if (request.metric === 'count' && (!request.group_by || request.group_by.length === 0)) {
    let q = supabase.from(spec.source as any).select(spec.idField, { count: 'exact', head: true })
    q = applyFilters(q, request.filters)
    const res = await q
    if (res.error) throw new Error(res.error.message)

    return {
      resource: request.resource,
      metric: request.metric,
      field: null,
      value: res.count ?? 0,
      groups: [],
    }
  }

  const fields = new Set<string>()
  if (request.field) fields.add(request.field)
  for (const item of request.group_by ?? []) fields.add(item)

  const selectExpr = fields.size > 0 ? [...fields].join(',') : spec.idField
  let q = supabase.from(spec.source as any).select(selectExpr)
  q = applyFilters(q, request.filters)

  const res = await q
  if (res.error) {
    throw new Error(res.error.message)
  }

  const rows = (res.data ?? []) as unknown as Array<Record<string, unknown>>

  const numericValues = request.field
    ? rows
        .map((row) => row[request.field!])
        .map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : null))
        .filter((value): value is number => value != null)
    : rows.map(() => 1)

  const globalValue = calcMetric(request.metric, numericValues)

  const groups: Array<{ key: Record<string, unknown>; value: number | null }> = []
  if (request.group_by && request.group_by.length > 0) {
    const grouped = new Map<string, { key: Record<string, unknown>; values: number[] }>()

    for (const row of rows) {
      const keyObj: Record<string, unknown> = {}
      for (const key of request.group_by) {
        keyObj[key] = row[key] ?? null
      }
      const keyJson = JSON.stringify(keyObj)

      const value = request.field
        ? row[request.field]
        : 1
      const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null

      const entry = grouped.get(keyJson) ?? { key: keyObj, values: [] }
      if (numeric != null) entry.values.push(numeric)
      grouped.set(keyJson, entry)
    }

    for (const entry of grouped.values()) {
      groups.push({
        key: entry.key,
        value: calcMetric(request.metric, entry.values),
      })
    }
  }

  return {
    resource: request.resource,
    metric: request.metric,
    field: request.field ?? null,
    value: globalValue,
    groups,
  }
}
