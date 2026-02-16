import { describe, expect, test } from 'vitest'

import { parseFilterExpression, parseSortExpression } from '../src/filters.js'

describe('parseFilterExpression', () => {
  test('parses primitive filter expressions', () => {
    expect(parseFilterExpression('dose_mg=gte:2.5')).toEqual({
      field: 'dose_mg',
      op: 'gte',
      value: 2.5,
    })

    expect(parseFilterExpression('deleted_at=is:null')).toEqual({
      field: 'deleted_at',
      op: 'is',
      value: null,
    })
  })

  test('parses list values for in filters', () => {
    expect(parseFilterExpression('status=in:active,planned,done')).toEqual({
      field: 'status',
      op: 'in',
      value: ['active', 'planned', 'done'],
    })
  })

  test('throws for invalid format', () => {
    expect(() => parseFilterExpression('bad-filter')).toThrow('Invalid filter expression')
  })
})

describe('parseSortExpression', () => {
  test('defaults to asc and accepts desc', () => {
    expect(parseSortExpression('ts')).toEqual({ field: 'ts', direction: 'asc' })
    expect(parseSortExpression('ts:desc')).toEqual({ field: 'ts', direction: 'desc' })
  })

  test('throws for empty fields', () => {
    expect(() => parseSortExpression(':desc')).toThrow('Invalid sort expression')
  })
})
