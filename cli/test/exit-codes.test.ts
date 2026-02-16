import { describe, expect, test } from 'vitest'

import { exitCodeForEnvelope } from '../src/exit-codes.js'

describe('exitCodeForEnvelope', () => {
  test('returns zero when ok', () => {
    expect(exitCodeForEnvelope({ ok: true, code: 'ok' })).toBe(0)
  })

  test('maps known machine codes', () => {
    expect(exitCodeForEnvelope({ ok: false, code: 'validation_error' })).toBe(2)
    expect(exitCodeForEnvelope({ ok: false, code: 'auth_failed' })).toBe(3)
    expect(exitCodeForEnvelope({ ok: false, code: 'not_found' })).toBe(4)
    expect(exitCodeForEnvelope({ ok: false, code: 'conflict' })).toBe(5)
    expect(exitCodeForEnvelope({ ok: false, code: 'network_timeout' })).toBe(6)
  })

  test('falls back to runtime failure', () => {
    expect(exitCodeForEnvelope({ ok: false, code: 'unknown' })).toBe(1)
  })
})
