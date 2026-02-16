import { describe, expect, test } from 'vitest'

import { listQueryableResources } from './query'

describe('listQueryableResources', () => {
  test('includes key resources needed by CLI shortcuts', () => {
    const resources = listQueryableResources()
    const names = new Set(resources.map((resource) => resource.name))

    expect(names.has('substances')).toBe(true)
    expect(names.has('routes')).toBe(true)
    expect(names.has('formulations')).toBe(true)
    expect(names.has('administration_events')).toBe(true)
    expect(names.has('v_inventory_status')).toBe(true)
    expect(names.has('v_inventory_summary')).toBe(true)
  })

  test('returns stable metadata fields', () => {
    const resources = listQueryableResources()
    const sample = resources.find((resource) => resource.name === 'administration_events')
    expect(sample).toBeDefined()
    expect(sample?.id_field).toBe('event_id')
    expect(sample?.default_sort.length).toBeGreaterThan(0)
    expect(sample?.filter_fields).toContain('substance_id')
  })
})
