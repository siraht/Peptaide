import { describe, expect, test } from 'vitest'

import {
  buildSessionUpdateRecomputeInput,
  normalizeSessionNotes,
  normalizeSessionTags,
  payloadHasOwnKey,
} from './sessionUpdate'

describe('payloadHasOwnKey', () => {
  test('returns true for explicit null and false for missing keys', () => {
    expect(payloadHasOwnKey({ notes: null }, 'notes')).toBe(true)
    expect(payloadHasOwnKey({}, 'notes')).toBe(false)
  })
})

describe('buildSessionUpdateRecomputeInput', () => {
  test('treats structured-only updates as structured by default', () => {
    const input = buildSessionUpdateRecomputeInput({
      payload: {
        input_value: 2.5,
      },
      current: {
        formulation_id: 'f-1',
        input_text: '1 mg',
        input_kind: 'mass',
        input_value: 1,
        input_unit: 'mg',
        ts: '2026-02-16T00:00:00.000Z',
        notes: 'keep',
        tags: ['a'],
        vial_id: 'v-1',
      },
    })

    expect(input.inputText).toBeUndefined()
    expect(input.inputKind).toBe('mass')
    expect(input.inputValue).toBe(2.5)
    expect(input.inputUnit).toBe('mg')
    expect(input.preferStructured).toBe(true)
  })

  test('uses text-only recompute path for text-only updates', () => {
    const input = buildSessionUpdateRecomputeInput({
      payload: {
        input_text: '0.5 mL',
      },
      current: {
        formulation_id: 'f-1',
        input_text: '1 mg',
        input_kind: 'mass',
        input_value: 1,
        input_unit: 'mg',
        ts: '2026-02-16T00:00:00.000Z',
        notes: 'keep',
        tags: ['a'],
        vial_id: null,
      },
    })

    expect(input.inputText).toBe('0.5 mL')
    expect(input.inputKind).toBeUndefined()
    expect(input.inputValue).toBeUndefined()
    expect(input.inputUnit).toBeUndefined()
    expect(input.preferStructured).toBe(false)
  })

  test('preserves explicit notes clearing with null', () => {
    const input = buildSessionUpdateRecomputeInput({
      payload: {
        input_value: 1.2,
        notes: null,
      },
      current: {
        formulation_id: 'f-1',
        input_text: '1 mg',
        input_kind: 'mass',
        input_value: 1,
        input_unit: 'mg',
        ts: '2026-02-16T00:00:00.000Z',
        notes: 'old note',
        tags: ['a'],
        vial_id: null,
      },
    })

    expect(input.notes).toBeNull()
  })
})

describe('normalizeSessionNotes', () => {
  test('trims non-empty notes', () => {
    expect(normalizeSessionNotes('  hello  ')).toBe('hello')
  })

  test('coerces empty notes to null', () => {
    expect(normalizeSessionNotes('   ')).toBeNull()
  })

  test('preserves explicit null', () => {
    expect(normalizeSessionNotes(null)).toBeNull()
  })
})

describe('normalizeSessionTags', () => {
  test('trims, drops empty values, and de-duplicates tags', () => {
    expect(normalizeSessionTags(['  alpha', 'alpha ', ' ', 'beta'])).toEqual(['alpha', 'beta'])
  })
})
