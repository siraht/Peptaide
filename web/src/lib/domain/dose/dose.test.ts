import { describe, expect, test } from 'vitest'

import { computeDose } from './computeDose'

describe('dose.computeDose', () => {
  test('mass input computes mg and volume when concentration is known', () => {
    const res = computeDose({
      inputText: '250mcg',
      inputKind: 'mass',
      inputValue: 250,
      inputUnit: 'mcg',
      vial: { contentMassMg: null, totalVolumeMl: null, concentrationMgPerMl: 10 },
      volumeMlPerDeviceUnit: null,
    })
    expect(res.doseMassMg).toBeCloseTo(0.25)
    expect(res.doseVolumeMl).toBeCloseTo(0.025)
  })

  test('volume input computes mL and mg when concentration is known', () => {
    const res = computeDose({
      inputText: '0.3mL',
      inputKind: 'volume',
      inputValue: 0.3,
      inputUnit: 'mL',
      vial: { contentMassMg: null, totalVolumeMl: null, concentrationMgPerMl: 10 },
      volumeMlPerDeviceUnit: null,
    })
    expect(res.doseVolumeMl).toBeCloseTo(0.3)
    expect(res.doseMassMg).toBeCloseTo(3)
  })

  test('device units use calibration point estimate', () => {
    const res = computeDose({
      inputText: '2 sprays',
      inputKind: 'device_units',
      inputValue: 2,
      inputUnit: 'sprays',
      vial: { contentMassMg: null, totalVolumeMl: null, concentrationMgPerMl: 10 },
      volumeMlPerDeviceUnit: 0.1,
    })
    expect(res.doseVolumeMl).toBeCloseTo(0.2)
    expect(res.doseMassMg).toBeCloseTo(2)
  })

  test('device units without calibration returns null canonical dose', () => {
    const res = computeDose({
      inputText: '2 sprays',
      inputKind: 'device_units',
      inputValue: 2,
      inputUnit: 'sprays',
      vial: { contentMassMg: null, totalVolumeMl: null, concentrationMgPerMl: 10 },
      volumeMlPerDeviceUnit: null,
    })
    expect(res.doseVolumeMl).toBeNull()
    expect(res.doseMassMg).toBeNull()
  })

  test('IU input does not auto-convert', () => {
    const res = computeDose({
      inputText: '200 IU',
      inputKind: 'iu',
      inputValue: 200,
      inputUnit: 'IU',
      vial: { contentMassMg: null, totalVolumeMl: null, concentrationMgPerMl: 10 },
      volumeMlPerDeviceUnit: null,
    })
    expect(res.doseVolumeMl).toBeNull()
    expect(res.doseMassMg).toBeNull()
  })

  test('uses vial-derived concentration when explicit concentration is missing', () => {
    const res = computeDose({
      inputText: '0.5mL',
      inputKind: 'volume',
      inputValue: 0.5,
      inputUnit: 'mL',
      vial: { contentMassMg: 10, totalVolumeMl: 2, concentrationMgPerMl: null },
      volumeMlPerDeviceUnit: null,
    })
    expect(res.doseVolumeMl).toBeCloseTo(0.5)
    expect(res.doseMassMg).toBeCloseTo(2.5)
  })
})

