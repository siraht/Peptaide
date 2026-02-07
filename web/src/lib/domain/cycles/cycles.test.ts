import { describe, expect, test } from 'vitest'

import { shouldSuggestNewCycle, suggestCycleAction } from './suggest'

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

describe('cycles.suggestCycleAction', () => {
  test('auto-starts the first cycle when configured', () => {
    expect(
      suggestCycleAction({
        lastEventTs: null,
        newEventTs: new Date('2026-02-07T00:00:00Z'),
        gapDaysThreshold: 7,
        autoStartFirstCycle: true,
      }),
    ).toBe('start_first_cycle')
  })

  test('does not auto-start the first cycle when disabled', () => {
    expect(
      suggestCycleAction({
        lastEventTs: null,
        newEventTs: new Date('2026-02-07T00:00:00Z'),
        gapDaysThreshold: 7,
        autoStartFirstCycle: false,
      }),
    ).toBe('none')
  })

  test('suggests a new cycle when the gap exceeds the threshold', () => {
    expect(
      suggestCycleAction({
        lastEventTs: new Date('2026-01-30T00:00:00Z'),
        newEventTs: new Date('2026-02-07T00:00:00Z'),
        gapDaysThreshold: 7,
        autoStartFirstCycle: true,
      }),
    ).toBe('suggest_new_cycle')
  })

  test('returns none when gap is below the threshold', () => {
    expect(
      suggestCycleAction({
        lastEventTs: new Date('2026-02-01T00:00:00Z'),
        newEventTs: new Date('2026-02-07T00:00:00Z'),
        gapDaysThreshold: 7,
        autoStartFirstCycle: true,
      }),
    ).toBe('none')
  })
})
