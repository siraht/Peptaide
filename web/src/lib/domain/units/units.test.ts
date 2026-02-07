import { describe, expect, test } from 'vitest'

import { toCanonicalMassMg, toCanonicalVolumeMl } from './canonicalize'
import { normalizeDeviceUnitLabel, parseQuantity } from './types'

describe('units.parseQuantity', () => {
  test('parses volume with no space (0.3mL)', () => {
    const q = parseQuantity('0.3mL')
    expect(q.kind).toBe('volume')
    expect(q.value).toBeCloseTo(0.3)
    expect(q.normalizedUnit).toBe('ml')
  })

  test('parses cc as volume', () => {
    const q = parseQuantity('20cc')
    expect(q.kind).toBe('volume')
    expect(q.value).toBe(20)
    expect(q.normalizedUnit).toBe('ml')
  })

  test('parses comma-grouped thousands numbers', () => {
    const q = parseQuantity('1,000 mg')
    expect(q.kind).toBe('mass')
    expect(q.value).toBe(1000)
    expect(q.normalizedUnit).toBe('mg')
    expect(toCanonicalMassMg(q.value, q.unit)).toBeCloseTo(1000)
  })

  test('parses micrograms (ASCII ug)', () => {
    const q = parseQuantity('250 ug')
    expect(q.kind).toBe('mass')
    expect(q.value).toBe(250)
    expect(q.normalizedUnit).toBe('mcg')
    expect(toCanonicalMassMg(q.value, q.unit)).toBeCloseTo(0.25)
  })

  test('parses micrograms (micro sign µg)', () => {
    const q = parseQuantity('250 µg')
    expect(q.kind).toBe('mass')
    expect(q.normalizedUnit).toBe('mcg')
    expect(toCanonicalMassMg(q.value, q.unit)).toBeCloseTo(0.25)
  })

  test('parses micrograms (Greek mu μg)', () => {
    const q = parseQuantity('250 μg')
    expect(q.kind).toBe('mass')
    expect(q.normalizedUnit).toBe('mcg')
    expect(toCanonicalMassMg(q.value, q.unit)).toBeCloseTo(0.25)
  })

  test('parses IU token', () => {
    const q = parseQuantity('200 [iU]')
    expect(q.kind).toBe('iu')
    expect(q.value).toBe(200)
    expect(q.normalizedUnit).toBe('iu')
  })

  test('parses device units (sprays)', () => {
    const q = parseQuantity('2 sprays')
    expect(q.kind).toBe('device_units')
    expect(q.value).toBe(2)
    expect(q.normalizedUnit).toBe('spray')
  })

  test('normalizes device unit labels for calibration keys', () => {
    expect(normalizeDeviceUnitLabel('Sprays')).toBe('spray')
    expect(normalizeDeviceUnitLabel('sprays,')).toBe('spray')
    expect(normalizeDeviceUnitLabel('  clicks per nostril')).toBe('click')
  })
})

describe('units.canonicalize', () => {
  test('converts volume uL to mL', () => {
    expect(toCanonicalVolumeMl(250, 'uL')).toBeCloseTo(0.25)
  })

  test('converts mass g to mg', () => {
    expect(toCanonicalMassMg(1.5, 'g')).toBeCloseTo(1500)
  })
})
