import { describe, expect, it, vi } from 'vitest'

import { parseSimpleEventsCsvText } from './simpleEvents'

describe('parseSimpleEventsCsvText', () => {
  it('imports a minimal mg-based event', () => {
    const csv = ['substance,ts,dose_mg', 'Tirzepatide,2026-02-08T10:00:00Z,5'].join('\n') + '\n'
    const res = parseSimpleEventsCsvText({ csvText: csv, timezone: 'UTC', gapDays: 7, inferCycles: true })

    expect(res.ok).toBe(true)
    expect(res.events).toHaveLength(1)
    expect(res.events[0]?.inputText).toBe('5 mg')
    expect(res.events[0]?.doseMassMg).toBe(5)
  })

  it('computes mg from mL * concentration when provided', () => {
    const csv =
      ['substance,ts,dose_ml,concentration_mg_per_ml', 'Semaglutide,2026-02-08T10:00:00Z,0.25,10'].join('\n') + '\n'
    const res = parseSimpleEventsCsvText({ csvText: csv, timezone: 'UTC', gapDays: 7, inferCycles: false })

    expect(res.ok).toBe(true)
    expect(res.events).toHaveLength(1)
    expect(res.events[0]?.doseVolumeMl).toBe(0.25)
    expect(res.events[0]?.doseMassMg).toBeCloseTo(2.5, 6)
  })

  it('accepts comma-grouped thousands in numeric cells (quoted)', () => {
    const csv = ['substance,ts,dose_mg', 'Test,2026-02-08T10:00:00Z,"1,000"'].join('\n') + '\n'
    const res = parseSimpleEventsCsvText({ csvText: csv, timezone: 'UTC', gapDays: 7, inferCycles: false })

    expect(res.ok).toBe(true)
    expect(res.events).toHaveLength(1)
    expect(res.events[0]?.doseMassMg).toBe(1000)
    expect(res.events[0]?.inputText).toBe('1000 mg')
  })

  it('rejects negative doses', () => {
    const csv = ['substance,ts,dose_mg', 'Test,2026-02-08T10:00:00Z,-5'].join('\n') + '\n'
    const res = parseSimpleEventsCsvText({ csvText: csv, timezone: 'UTC', gapDays: 7, inferCycles: false })

    expect(res.ok).toBe(false)
    expect(res.rowErrors).toHaveLength(1)
    expect(res.events).toHaveLength(0)
  })

  it('accepts common header synonyms', () => {
    const csv =
      ['compound,timestamp,ml,mg/ml', 'BPC-157,2026-02-08T10:00:00Z,0.2,5'].join('\n') + '\n'
    const res = parseSimpleEventsCsvText({ csvText: csv, timezone: 'UTC', gapDays: 7, inferCycles: false })

    expect(res.ok).toBe(true)
    expect(res.events).toHaveLength(1)
    expect(res.events[0]?.substanceDisplay).toBe('BPC-157')
    expect(res.events[0]?.doseMassMg).toBeCloseTo(1.0, 6)
  })

  it('parses date+time columns in the provided timezone', () => {
    const csv = ['substance,date,time,dose_mg', 'TestSub,2026-02-08,10:30,1'].join('\n') + '\n'
    const res = parseSimpleEventsCsvText({ csvText: csv, timezone: 'UTC', gapDays: 7, inferCycles: false })

    expect(res.ok).toBe(true)
    expect(res.events[0]?.tsIso).toBe('2026-02-08T10:30:00.000Z')
  })

  it('infers cycles based on gapDays', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'))

    const csv =
      [
        'substance,ts,dose_mg',
        'X,2026-01-01T10:00:00Z,1',
        'X,2026-01-02T10:00:00Z,1',
        'X,2026-01-20T10:00:00Z,1',
      ].join('\n') + '\n'

    const res = parseSimpleEventsCsvText({ csvText: csv, timezone: 'UTC', gapDays: 7, inferCycles: true })
    expect(res.ok).toBe(true)
    expect(res.inferredCycles).toHaveLength(2)

    const keys = Array.from(res.eventToCycleKey.values()).sort()
    expect(keys[0]).toBe('x#1')
    expect(keys[keys.length - 1]).toBe('x#2')

    vi.useRealTimers()
  })
})
