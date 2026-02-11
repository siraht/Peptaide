import { describe, expect, test } from 'vitest'

import { buildCycleInsightCards } from './substanceCycleInsight'

import type { CycleSummaryRow } from '@/lib/repos/cycleSummaryRepo'

function cycle(overrides: Partial<CycleSummaryRow>): CycleSummaryRow {
  return {
    administered_mg_total: 10,
    break_to_next_cycle_days: null,
    cycle_instance_id: 'cycle-1',
    cycle_length_days: 4,
    cycle_number: 1,
    eff_cns_p05_mg_total: null,
    eff_cns_p50_mg_total: null,
    eff_cns_p95_mg_total: null,
    eff_systemic_p05_mg_total: null,
    eff_systemic_p50_mg_total: null,
    eff_systemic_p95_mg_total: null,
    end_ts: null,
    event_count: 2,
    goal: null,
    notes: null,
    recommended_break_days_max: 7,
    recommended_break_days_min: 3,
    recommended_cycle_days_max: 10,
    recommended_cycle_days_min: 5,
    start_ts: '2026-01-01T00:00:00Z',
    status: 'active',
    substance_id: 'substance-a',
    substance_name: 'Substance A',
    user_id: 'user-1',
    ...overrides,
  }
}

describe('buildCycleInsightCards', () => {
  test('prefers active cycle as the primary card cycle', () => {
    const cards = buildCycleInsightCards({
      substances: [{ id: 'substance-a', display_name: 'Substance A' }],
      cycles: [
        cycle({ cycle_instance_id: 'cycle-old', cycle_number: 1, status: 'completed', cycle_length_days: 8 }),
        cycle({ cycle_instance_id: 'cycle-active', cycle_number: 2, status: 'active', cycle_length_days: 6 }),
      ],
    })

    expect(cards).toHaveLength(1)
    expect(cards[0].detailHref).toBe('/cycles/cycle-active')
    expect(cards[0].statusBucket).toBe('active')
    expect(cards[0].cycleDayCount).toBe(6)
  })

  test('falls back to the most recent cycle when none are active', () => {
    const cards = buildCycleInsightCards({
      substances: [{ id: 'substance-a', display_name: 'Substance A' }],
      cycles: [
        cycle({ cycle_instance_id: 'cycle-1', cycle_number: 1, status: 'completed', cycle_length_days: 7 }),
        cycle({ cycle_instance_id: 'cycle-2', cycle_number: 2, status: 'abandoned', cycle_length_days: 9 }),
      ],
    })

    expect(cards[0].detailHref).toBe('/cycles/cycle-2')
    expect(cards[0].statusBucket).toBe('abandoned')
    expect(cards[0].statusLabel).toBe('Abandoned')
  })

  test('creates cards for substances with no cycles', () => {
    const cards = buildCycleInsightCards({
      substances: [
        { id: 'substance-a', display_name: 'Substance A' },
        { id: 'substance-b', display_name: 'Substance B' },
      ],
      cycles: [cycle({ substance_id: 'substance-a', substance_name: 'Substance A' })],
    })

    const idleCard = cards.find((card) => card.substanceId === 'substance-b')
    expect(idleCard).toBeDefined()
    expect(idleCard?.statusBucket).toBe('not_started')
    expect(idleCard?.detailHref).toBeNull()
    expect(idleCard?.cycleGuidance).toContain('No cycle exists yet')
  })

  test('derives warning/danger tones from cycle and break recommendations', () => {
    const cards = buildCycleInsightCards({
      substances: [{ id: 'substance-a', display_name: 'Substance A' }],
      cycles: [
        cycle({
          status: 'active',
          cycle_length_days: 12,
          recommended_cycle_days_max: 10,
          break_to_next_cycle_days: 2,
          recommended_break_days_min: 3,
        }),
      ],
    })

    expect(cards[0].cycleHealthTone).toBe('danger')
    expect(cards[0].cycleProgressPercent).toBe(100)
    expect(cards[0].breakHealthTone).toBe('danger')
  })

  test('sorts active cards first, then completed, then not-started', () => {
    const cards = buildCycleInsightCards({
      substances: [
        { id: 'substance-b', display_name: 'Substance B' },
        { id: 'substance-a', display_name: 'Substance A' },
        { id: 'substance-c', display_name: 'Substance C' },
      ],
      cycles: [
        cycle({ substance_id: 'substance-a', substance_name: 'Substance A', status: 'completed' }),
        cycle({ substance_id: 'substance-c', substance_name: 'Substance C', status: 'active' }),
      ],
    })

    expect(cards.map((card) => card.substanceId)).toEqual(['substance-c', 'substance-a', 'substance-b'])
  })
})
