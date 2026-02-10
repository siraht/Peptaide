import { describe, expect, it } from 'vitest'

import { parseTimeHHMM, safeTimeZone, utcIsoFromTodayLocalTime } from './timeZone'

describe('timeZone helpers', () => {
  it('safeTimeZone falls back to UTC for invalid zones', () => {
    expect(safeTimeZone('Not/AZone')).toBe('UTC')
  })

  it('parseTimeHHMM accepts HH:MM and rejects invalid inputs', () => {
    expect(parseTimeHHMM('09:30')).toEqual({ hour: 9, minute: 30, second: 0 })
    expect(() => parseTimeHHMM('')).toThrow(/invalid time/i)
    expect(() => parseTimeHHMM('25:00')).toThrow(/invalid hour/i)
    expect(() => parseTimeHHMM('10:99')).toThrow(/invalid minute/i)
  })

  it('utcIsoFromTodayLocalTime matches UTC wall time when timeZone=UTC', () => {
    const now = new Date('2026-02-10T12:34:00.000Z')
    expect(utcIsoFromTodayLocalTime({ timeZone: 'UTC', timeHHMM: '10:15', now })).toBe(
      '2026-02-10T10:15:00.000Z',
    )
  })

  it('utcIsoFromTodayLocalTime converts America/New_York wall time to UTC (standard time)', () => {
    const now = new Date('2026-02-10T12:34:00.000Z')
    expect(utcIsoFromTodayLocalTime({ timeZone: 'America/New_York', timeHHMM: '10:00', now })).toBe(
      '2026-02-10T15:00:00.000Z',
    )
  })

  it('utcIsoFromTodayLocalTime handles DST offset changes (America/New_York spring forward)', () => {
    const now = new Date('2026-03-08T12:00:00.000Z')
    expect(utcIsoFromTodayLocalTime({ timeZone: 'America/New_York', timeHHMM: '03:30', now })).toBe(
      '2026-03-08T07:30:00.000Z',
    )
  })
})
