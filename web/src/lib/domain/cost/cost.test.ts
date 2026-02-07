import { describe, expect, test } from 'vitest'

import { allocateVialCost, eventCostFromVial } from './cost'

describe('cost.allocateVialCost', () => {
  test('allocates cost per vial', () => {
    expect(allocateVialCost({ priceTotalUsd: 100, expectedVials: 10 })).toBeCloseTo(
      10,
    )
  })
})

describe('cost.eventCostFromVial', () => {
  test('uses mass fraction when possible', () => {
    expect(
      eventCostFromVial({
        doseMassMg: 1,
        doseVolumeMl: null,
        vialContentMassMg: 10,
        vialTotalVolumeMl: null,
        vialCostUsd: 50,
      }),
    ).toBeCloseTo(5)
  })

  test('falls back to volume fraction', () => {
    expect(
      eventCostFromVial({
        doseMassMg: null,
        doseVolumeMl: 1,
        vialContentMassMg: null,
        vialTotalVolumeMl: 10,
        vialCostUsd: 50,
      }),
    ).toBeCloseTo(5)
  })

  test('returns null when insufficient info', () => {
    expect(
      eventCostFromVial({
        doseMassMg: null,
        doseVolumeMl: null,
        vialContentMassMg: 10,
        vialTotalVolumeMl: 10,
        vialCostUsd: 50,
      }),
    ).toBeNull()
  })
})

