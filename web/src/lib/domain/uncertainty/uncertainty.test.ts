import { describe, expect, test } from 'vitest'

import { composeBioavailability, simulateEffectiveDose } from './monteCarlo'
import { distributionMean } from './sample'
import type { Distribution } from './types'

describe('uncertainty.composeBioavailability', () => {
  test('clamps to [0,1]', () => {
    expect(composeBioavailability(0.6, [2])).toBe(1)
    expect(composeBioavailability(0.6, [0])).toBe(0)
  })
})

describe('uncertainty.distributionMean', () => {
  test('beta-PERT mean matches (min + 4*mode + max)/6', () => {
    const d: Distribution = {
      id: 'd',
      valueType: 'fraction',
      distType: 'beta_pert',
      p1: 0.1,
      p2: 0.2,
      p3: 0.7,
      minValue: null,
      maxValue: null,
    }
    expect(distributionMean(d)).toBeCloseTo((0.1 + 4 * 0.2 + 0.7) / 6)
  })
})

describe('uncertainty.simulateEffectiveDose', () => {
  test('is deterministic for a fixed seed', () => {
    const base: Distribution = {
      id: 'base',
      valueType: 'fraction',
      distType: 'beta_pert',
      p1: 0.1,
      p2: 0.2,
      p3: 0.3,
      minValue: null,
      maxValue: null,
    }

    const mult: Distribution = {
      id: 'm',
      valueType: 'multiplier',
      distType: 'lognormal',
      p1: 1.0,
      p2: 0.25,
      p3: null,
      minValue: null,
      maxValue: null,
    }

    const run1 = simulateEffectiveDose({
      doseMg: 10,
      baseFractionDist: base,
      multiplierDists: [mult],
      n: 256,
      seed: 123456789n,
    })

    const run2 = simulateEffectiveDose({
      doseMg: 10,
      baseFractionDist: base,
      multiplierDists: [mult],
      n: 256,
      seed: 123456789n,
    })

    expect(run1).toEqual(run2)
  })

  test('returns expected percentiles for deterministic distributions', () => {
    const base: Distribution = {
      id: 'base',
      valueType: 'fraction',
      distType: 'point',
      p1: 0.5,
      p2: null,
      p3: null,
      minValue: null,
      maxValue: null,
    }

    const mult: Distribution = {
      id: 'm',
      valueType: 'multiplier',
      distType: 'point',
      p1: 2,
      p2: null,
      p3: null,
      minValue: null,
      maxValue: null,
    }

    const res = simulateEffectiveDose({
      doseMg: 10,
      baseFractionDist: base,
      multiplierDists: [mult],
      n: 32,
      seed: 1n,
    })

    // BA_total = clamp(0.5 * 2, 0, 1) = 1
    expect(res.p05).toBe(10)
    expect(res.p50).toBe(10)
    expect(res.p95).toBe(10)
  })
})

