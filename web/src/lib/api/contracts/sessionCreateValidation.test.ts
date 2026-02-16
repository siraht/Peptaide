import { describe, expect, test } from 'vitest'

import { hasEffectiveModelContext } from './sessionCreateValidation'

describe('hasEffectiveModelContext', () => {
  test('accepts formulation id context', () => {
    expect(hasEffectiveModelContext({ formulationId: 'f-1' })).toBe(true)
  })

  test('accepts formulation name context', () => {
    expect(hasEffectiveModelContext({ formulationName: 'My Formulation' })).toBe(true)
  })

  test('accepts substance+route context', () => {
    expect(hasEffectiveModelContext({ substanceId: 's-1', routeId: 'r-1' })).toBe(true)
  })

  test('rejects missing context', () => {
    expect(hasEffectiveModelContext({})).toBe(false)
  })
})
