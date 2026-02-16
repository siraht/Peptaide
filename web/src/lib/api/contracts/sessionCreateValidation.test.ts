import { describe, expect, test } from 'vitest'

import { hasEffectiveModelContext, hasScopedBaseOverride } from './sessionCreateValidation'

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

describe('hasScopedBaseOverride', () => {
  test('returns false when compartment is not both', () => {
    expect(
      hasScopedBaseOverride({
        compartment: 'systemic',
        systemicBaseFractionDistId: 'systemic-base',
      }),
    ).toBe(false)
  })

  test('returns false for both compartment when no scoped base IDs are provided', () => {
    expect(hasScopedBaseOverride({ compartment: 'both' })).toBe(false)
  })

  test('returns true when either scoped base ID is provided for both compartment', () => {
    expect(
      hasScopedBaseOverride({
        compartment: 'both',
        systemicBaseFractionDistId: 'systemic-base',
      }),
    ).toBe(true)
    expect(
      hasScopedBaseOverride({
        compartment: 'both',
        cnsBaseFractionDistId: 'cns-base',
      }),
    ).toBe(true)
  })
})
