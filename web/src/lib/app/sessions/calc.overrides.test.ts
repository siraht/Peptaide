import { describe, expect, test } from 'vitest'

import { applyCalcExplicitCompartmentOverrides } from './calc'

describe('applyCalcExplicitCompartmentOverrides', () => {
  test('keeps unresolved compartments on model defaults when only one scoped base is provided', () => {
    const baseByCompartment = new Map<'systemic' | 'cns', string | null>([
      ['systemic', 'base-systemic'],
      ['cns', 'base-cns'],
    ])
    const multipliersByCompartment = new Map<'systemic' | 'cns', string[]>([
      ['systemic', ['m-systemic']],
      ['cns', ['m-cns']],
    ])

    applyCalcExplicitCompartmentOverrides({
      compartments: ['systemic', 'cns'],
      baseByCompartment,
      multipliersByCompartment,
      request: {
        systemic_base_fraction_dist_id: 'base-systemic-override',
      },
    })

    expect(baseByCompartment.get('systemic')).toBe('base-systemic-override')
    expect(baseByCompartment.get('cns')).toBe('base-cns')
    expect(multipliersByCompartment.get('systemic')).toEqual(['m-systemic'])
    expect(multipliersByCompartment.get('cns')).toEqual(['m-cns'])
  })

  test('applies global defaults first and scoped overrides second', () => {
    const baseByCompartment = new Map<'systemic' | 'cns', string | null>([
      ['systemic', 'base-systemic'],
      ['cns', 'base-cns'],
    ])
    const multipliersByCompartment = new Map<'systemic' | 'cns', string[]>([
      ['systemic', ['m-systemic']],
      ['cns', ['m-cns']],
    ])

    applyCalcExplicitCompartmentOverrides({
      compartments: ['systemic', 'cns'],
      baseByCompartment,
      multipliersByCompartment,
      request: {
        base_fraction_dist_id: 'global-base',
        multiplier_dist_id: ['global-m'],
        systemic_multiplier_dist_id: ['systemic-m'],
      },
    })

    expect(baseByCompartment.get('systemic')).toBe('global-base')
    expect(baseByCompartment.get('cns')).toBe('global-base')
    expect(multipliersByCompartment.get('systemic')).toEqual(['systemic-m'])
    expect(multipliersByCompartment.get('cns')).toEqual(['global-m'])
  })

  test('supports explicit scoped multiplier clear using an empty list', () => {
    const baseByCompartment = new Map<'systemic' | 'cns', string | null>([
      ['systemic', 'base-systemic'],
      ['cns', 'base-cns'],
    ])
    const multipliersByCompartment = new Map<'systemic' | 'cns', string[]>([
      ['systemic', ['m-systemic']],
      ['cns', ['m-cns']],
    ])

    applyCalcExplicitCompartmentOverrides({
      compartments: ['systemic', 'cns'],
      baseByCompartment,
      multipliersByCompartment,
      request: {
        systemic_multiplier_dist_id: [],
      },
    })

    expect(multipliersByCompartment.get('systemic')).toEqual([])
    expect(multipliersByCompartment.get('cns')).toEqual(['m-cns'])
  })
})
