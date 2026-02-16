export type FilterSpec = {
  field: string
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'like' | 'in' | 'is'
  value: string | number | boolean | null | Array<string | number | boolean>
}

export type SortSpec = {
  field: string
  direction: 'asc' | 'desc'
}

function parsePrimitive(raw: string): string | number | boolean | null {
  const trimmed = raw.trim()
  if (trimmed === 'null') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  const asNumber = Number(trimmed)
  if (trimmed.length > 0 && Number.isFinite(asNumber)) return asNumber
  return trimmed
}

export function parseFilterExpression(input: string): FilterSpec {
  const eqIndex = input.indexOf('=')
  const colonIndex = input.indexOf(':')
  if (eqIndex <= 0 || colonIndex <= eqIndex + 1) {
    throw new Error(`Invalid filter expression: ${input}`)
  }

  const field = input.slice(0, eqIndex).trim()
  const op = input.slice(eqIndex + 1, colonIndex).trim() as FilterSpec['op']
  const rawValue = input.slice(colonIndex + 1)

  if (!field) throw new Error(`Invalid filter field: ${input}`)

  switch (op) {
    case 'eq':
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
    case 'ilike':
    case 'like':
    case 'is':
      return { field, op, value: parsePrimitive(rawValue) }
    case 'in': {
      const values = rawValue
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => parsePrimitive(item))
        .filter((item): item is string | number | boolean => item !== null)
      return { field, op, value: values }
    }
    default:
      throw new Error(`Unsupported filter op: ${op}`)
  }
}

export function parseSortExpression(input: string): SortSpec {
  const [fieldRaw, dirRaw] = input.split(':')
  const field = String(fieldRaw || '').trim()
  const direction = (String(dirRaw || 'asc').trim().toLowerCase() === 'desc' ? 'desc' : 'asc') as
    | 'asc'
    | 'desc'

  if (!field) throw new Error(`Invalid sort expression: ${input}`)

  return { field, direction }
}
