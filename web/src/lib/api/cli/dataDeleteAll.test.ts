import { describe, expect, test } from 'vitest'

import { shouldStoreDeleteAllIdempotency } from './dataDeleteAll'

describe('shouldStoreDeleteAllIdempotency', () => {
  test('returns false for dry-run even with idempotency key', () => {
    expect(shouldStoreDeleteAllIdempotency({ dryRun: true, idempotencyKey: 'abc' })).toBe(false)
  })

  test('returns true for apply mode with idempotency key', () => {
    expect(shouldStoreDeleteAllIdempotency({ dryRun: false, idempotencyKey: 'abc' })).toBe(true)
  })

  test('returns false without idempotency key', () => {
    expect(shouldStoreDeleteAllIdempotency({ dryRun: false })).toBe(false)
  })
})
