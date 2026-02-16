import { describe, expect, test } from 'vitest'

import { buildIdempotencyRequestHash } from './idempotency'

describe('buildIdempotencyRequestHash', () => {
  test('is stable for equivalent payloads with different key order', () => {
    const a = {
      action: 'create',
      payload: {
        b: 2,
        a: 1,
      },
      tags: ['x', 'y'],
    }

    const b = {
      tags: ['x', 'y'],
      payload: {
        a: 1,
        b: 2,
      },
      action: 'create',
    }

    expect(buildIdempotencyRequestHash(a)).toBe(buildIdempotencyRequestHash(b))
  })

  test('changes when payload values change', () => {
    const a = { action: 'create', dose: 2.5 }
    const b = { action: 'create', dose: 3.0 }
    expect(buildIdempotencyRequestHash(a)).not.toBe(buildIdempotencyRequestHash(b))
  })
})
