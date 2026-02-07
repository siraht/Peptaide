import { describe, expect, test } from 'vitest'

import { shouldSuggestNewCycle } from './suggest'

describe('cycles.shouldSuggestNewCycle', () => {
  test('returns false if there is no last event', () => {
    expect(
      shouldSuggestNewCycle({
        lastEventTs: null,
        newEventTs: new Date('2026-02-07T00:00:00Z'),
        gapDaysThreshold: 7,
      }),
    ).toBe(false)
  })

  test('returns true when gap >= threshold', () => {
    expect(
      shouldSuggestNewCycle({
        lastEventTs: new Date('2026-01-30T00:00:00Z'),
        newEventTs: new Date('2026-02-07T00:00:00Z'),
        gapDaysThreshold: 7,
      }),
    ).toBe(true)
  })

  test('returns false when gap < threshold', () => {
    expect(
      shouldSuggestNewCycle({
        lastEventTs: new Date('2026-02-01T00:00:00Z'),
        newEventTs: new Date('2026-02-07T00:00:00Z'),
        gapDaysThreshold: 7,
      }),
    ).toBe(false)
  })
})

