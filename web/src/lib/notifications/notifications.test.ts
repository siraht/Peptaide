import { describe, expect, test } from 'vitest'

import {
  computeSpendAvgUsdPerDay,
  evaluateLowStockNotifications,
  evaluateSpendNotifications,
  groupInventorySummaryBySubstance,
} from './notifications'

import type { InventorySummaryRow } from '@/lib/repos/inventorySummaryRepo'
import type { SpendRow } from '@/lib/repos/spendRepo'

function invRow(x: Partial<InventorySummaryRow>): InventorySummaryRow {
  return x as InventorySummaryRow
}

function spendRow(x: Partial<SpendRow>): SpendRow {
  return x as SpendRow
}

describe('notifications', () => {
  test('groupInventorySummaryBySubstance sums per-substance totals and computes runway', () => {
    const groups = groupInventorySummaryBySubstance([
      invRow({
        substance_id: 's1',
        substance_name: 'TestSub',
        total_remaining_mass_mg: 10,
        total_content_mass_mg: 10,
        avg_daily_administered_mg_14d: 2,
      }),
      invRow({
        substance_id: 's1',
        substance_name: 'TestSub',
        total_remaining_mass_mg: 20,
        total_content_mass_mg: 30,
        avg_daily_administered_mg_14d: 3,
      }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.remainingTotalMg).toBe(30)
    expect(groups[0]?.avgDailyAdminMg14d).toBe(5)
    expect(groups[0]?.runwayDays).toBeCloseTo(6, 6)
  })

  test('evaluateLowStockNotifications emits when runway <= threshold', () => {
    const items = evaluateLowStockNotifications(
      [
        {
          substanceId: 's1',
          substanceName: 'TestSub',
          remainingTotalMg: 30,
          contentTotalMg: 40,
          avgDailyAdminMg14d: 5,
          runwayDays: 6,
        },
      ],
      { enabled: true, runwayDaysThreshold: 7 },
    )

    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('low-stock-s1')
    expect(items[0]?.severity).toBe('warning')
  })

  test('computeSpendAvgUsdPerDay treats missing days as zero by dividing by windowDays', () => {
    const spend = computeSpendAvgUsdPerDay(
      [
        spendRow({ spend_usd: 10 }),
        spendRow({ spend_usd: null }),
      ],
      { windowDays: 7 },
    )

    expect(spend.sumUsd).toBe(10)
    expect(spend.avgUsdPerDay).toBeCloseTo(10 / 7, 8)
  })

  test('evaluateSpendNotifications emits when avg/day > threshold', () => {
    const items = evaluateSpendNotifications(
      { avgUsdPerDay: 11, sumUsd: 77 },
      { enabled: true, usdPerDayThreshold: 10, windowDays: 7 },
    )

    expect(items).toHaveLength(1)
    expect(items[0]?.severity).toBe('warning')
  })
})

