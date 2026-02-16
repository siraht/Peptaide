import { describe, expect, test } from 'vitest'

import { applyExplicitCompartmentOverrides } from './explicitOverrides'

function seedMaps(): {
  baseFractionDistIdByCompartment: Map<'systemic' | 'cns', string | null>
  multipliersByCompartment: Map<'systemic' | 'cns', string[]>
  missingByCompartment: Map<'systemic' | 'cns', string[]>
} {
  return {
    baseFractionDistIdByCompartment: new Map<'systemic' | 'cns', string | null>([
      ['systemic', 'base-systemic'],
      ['cns', 'base-cns'],
    ]),
    multipliersByCompartment: new Map<'systemic' | 'cns', string[]>([
      ['systemic', ['default-systemic']],
      ['cns', ['default-cns']],
    ]),
    missingByCompartment: new Map<'systemic' | 'cns', string[]>([
      ['systemic', []],
      ['cns', []],
    ]),
  }
}

describe('applyExplicitCompartmentOverrides', () => {
  test('keeps existing bases when only scoped multipliers are provided', () => {
    const maps = seedMaps()

    applyExplicitCompartmentOverrides({
      compartments: ['systemic', 'cns'],
      ...maps,
      explicitGlobalBase: null,
      explicitGlobalMultipliers: [],
      explicitGlobalMultipliersProvided: false,
      explicitSystemicBase: null,
      explicitCnsBase: null,
      explicitSystemicMultipliers: ['systemic-only'],
      explicitCnsMultipliers: ['cns-only'],
      explicitSystemicMultipliersProvided: true,
      explicitCnsMultipliersProvided: true,
    })

    expect(maps.baseFractionDistIdByCompartment.get('systemic')).toBe('base-systemic')
    expect(maps.baseFractionDistIdByCompartment.get('cns')).toBe('base-cns')
    expect(maps.multipliersByCompartment.get('systemic')).toEqual(['systemic-only'])
    expect(maps.multipliersByCompartment.get('cns')).toEqual(['cns-only'])
  })

  test('keeps existing bases when only global multipliers are provided', () => {
    const maps = seedMaps()

    applyExplicitCompartmentOverrides({
      compartments: ['systemic', 'cns'],
      ...maps,
      explicitGlobalBase: null,
      explicitGlobalMultipliers: ['global-m'],
      explicitGlobalMultipliersProvided: true,
      explicitSystemicBase: null,
      explicitCnsBase: null,
      explicitSystemicMultipliers: [],
      explicitCnsMultipliers: [],
      explicitSystemicMultipliersProvided: false,
      explicitCnsMultipliersProvided: false,
    })

    expect(maps.baseFractionDistIdByCompartment.get('systemic')).toBe('base-systemic')
    expect(maps.baseFractionDistIdByCompartment.get('cns')).toBe('base-cns')
    expect(maps.multipliersByCompartment.get('systemic')).toEqual(['global-m'])
    expect(maps.multipliersByCompartment.get('cns')).toEqual(['global-m'])
  })

  test('explicit base clears missing-base marker', () => {
    const maps = seedMaps()
    maps.baseFractionDistIdByCompartment.set('systemic', null)
    maps.missingByCompartment.set('systemic', ['missing_base_bioavailability_spec'])

    applyExplicitCompartmentOverrides({
      compartments: ['systemic', 'cns'],
      ...maps,
      explicitGlobalBase: null,
      explicitGlobalMultipliers: [],
      explicitGlobalMultipliersProvided: false,
      explicitSystemicBase: 'explicit-systemic',
      explicitCnsBase: null,
      explicitSystemicMultipliers: [],
      explicitCnsMultipliers: [],
      explicitSystemicMultipliersProvided: false,
      explicitCnsMultipliersProvided: false,
    })

    expect(maps.baseFractionDistIdByCompartment.get('systemic')).toBe('explicit-systemic')
    expect(maps.missingByCompartment.get('systemic')).toEqual([])
  })

  test('scoped overrides take precedence over global overrides', () => {
    const maps = seedMaps()

    applyExplicitCompartmentOverrides({
      compartments: ['systemic', 'cns'],
      ...maps,
      explicitGlobalBase: 'global-base',
      explicitGlobalMultipliers: ['global-m'],
      explicitGlobalMultipliersProvided: true,
      explicitSystemicBase: 'systemic-base',
      explicitCnsBase: null,
      explicitSystemicMultipliers: ['systemic-m'],
      explicitCnsMultipliers: [],
      explicitSystemicMultipliersProvided: true,
      explicitCnsMultipliersProvided: false,
    })

    expect(maps.baseFractionDistIdByCompartment.get('systemic')).toBe('systemic-base')
    expect(maps.baseFractionDistIdByCompartment.get('cns')).toBe('global-base')
    expect(maps.multipliersByCompartment.get('systemic')).toEqual(['systemic-m'])
    expect(maps.multipliersByCompartment.get('cns')).toEqual(['global-m'])
  })

  test('supports explicit clear of global multipliers via empty list', () => {
    const maps = seedMaps()

    applyExplicitCompartmentOverrides({
      compartments: ['systemic', 'cns'],
      ...maps,
      explicitGlobalBase: null,
      explicitGlobalMultipliers: [],
      explicitGlobalMultipliersProvided: true,
      explicitSystemicBase: null,
      explicitCnsBase: null,
      explicitSystemicMultipliers: [],
      explicitCnsMultipliers: [],
      explicitSystemicMultipliersProvided: false,
      explicitCnsMultipliersProvided: false,
    })

    expect(maps.multipliersByCompartment.get('systemic')).toEqual([])
    expect(maps.multipliersByCompartment.get('cns')).toEqual([])
  })

  test('keeps defaults when global multipliers were not provided', () => {
    const maps = seedMaps()

    applyExplicitCompartmentOverrides({
      compartments: ['systemic', 'cns'],
      ...maps,
      explicitGlobalBase: null,
      explicitGlobalMultipliers: [],
      explicitGlobalMultipliersProvided: false,
      explicitSystemicBase: null,
      explicitCnsBase: null,
      explicitSystemicMultipliers: [],
      explicitCnsMultipliers: [],
      explicitSystemicMultipliersProvided: false,
      explicitCnsMultipliersProvided: false,
    })

    expect(maps.multipliersByCompartment.get('systemic')).toEqual(['default-systemic'])
    expect(maps.multipliersByCompartment.get('cns')).toEqual(['default-cns'])
  })
})
