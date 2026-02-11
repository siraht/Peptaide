import type { CycleSummaryRow } from '@/lib/repos/cycleSummaryRepo'
import type { SubstanceRow } from '@/lib/repos/substancesRepo'

export type CycleHealthTone = 'good' | 'warning' | 'danger' | 'neutral'

export type CycleInsightCard = {
  substanceId: string
  substanceName: string
  detailHref: string | null
  primaryCycle: CycleSummaryRow | null
  statusBucket: 'active' | 'completed' | 'abandoned' | 'not_started' | 'other'
  statusLabel: string
  cycleDayCount: number | null
  breakDaysToNext: number | null
  eventCount: number
  administeredMgTotal: number | null
  cycleGuidance: string
  breakGuidance: string
  cycleHealthTone: CycleHealthTone
  breakHealthTone: CycleHealthTone
  cycleProgressPercent: number | null
  breakProgressPercent: number | null
  recommendedCycleDaysMin: number | null
  recommendedCycleDaysMax: number | null
  recommendedBreakDaysMin: number | null
  recommendedBreakDaysMax: number | null
  eventTrend: number[]
}

function toFiniteOrNull(value: number | null | undefined): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isFinite(value)) return null
  return value
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function statusBucketForCycle(
  cycle: CycleSummaryRow | null,
): CycleInsightCard['statusBucket'] {
  if (!cycle) return 'not_started'
  if (cycle.status === 'active') return 'active'
  if (cycle.status === 'completed') return 'completed'
  if (cycle.status === 'abandoned') return 'abandoned'
  return 'other'
}

function statusLabelForBucket(bucket: CycleInsightCard['statusBucket']): string {
  if (bucket === 'active') return 'Active'
  if (bucket === 'completed') return 'Completed'
  if (bucket === 'abandoned') return 'Abandoned'
  if (bucket === 'not_started') return 'Not started'
  return 'Unknown'
}

function cycleToneFor(
  statusBucket: CycleInsightCard['statusBucket'],
  cycleDays: number | null,
  recMax: number | null,
): CycleHealthTone {
  if (statusBucket !== 'active') return 'neutral'
  if (cycleDays == null || recMax == null || recMax <= 0) return 'good'
  if (cycleDays > recMax) return 'danger'
  if (cycleDays >= recMax * 0.85) return 'warning'
  return 'good'
}

function breakToneFor(
  breakDays: number | null,
  recMin: number | null,
  recMax: number | null,
): CycleHealthTone {
  if (breakDays == null) return 'neutral'
  if (recMin != null && breakDays < recMin) return 'danger'
  if (recMax != null && breakDays > recMax) return 'warning'
  return 'good'
}

function describeCycleGuidance(
  statusBucket: CycleInsightCard['statusBucket'],
  cycleDays: number | null,
  recMin: number | null,
  recMax: number | null,
  tone: CycleHealthTone,
): string {
  if (statusBucket === 'not_started') return 'No cycle exists yet for this substance.'
  if (cycleDays == null) return 'Cycle day count is unavailable for this cycle.'
  if (recMin == null && recMax == null) {
    return `Cycle day ${Math.round(cycleDays)} with no recommendation range saved.`
  }

  if (tone === 'danger') {
    return `Cycle has exceeded the recommended max of ${Math.round(recMax ?? 0)} days.`
  }
  if (tone === 'warning') {
    return `Cycle is close to the recommended max of ${Math.round(recMax ?? 0)} days.`
  }

  if (recMin != null && cycleDays < recMin) {
    return `Cycle is early relative to the recommended range (${Math.round(recMin)}-${Math.round(recMax ?? recMin)} days).`
  }

  return 'Cycle length is within the saved recommendation range.'
}

function describeBreakGuidance(
  statusBucket: CycleInsightCard['statusBucket'],
  breakDays: number | null,
  recMin: number | null,
  recMax: number | null,
  tone: CycleHealthTone,
): string {
  if (statusBucket === 'active') {
    return 'Break countdown starts after this cycle is ended.'
  }
  if (breakDays == null) {
    return 'No break-to-next value yet (next cycle not started).'
  }
  if (recMin == null && recMax == null) {
    return `Break to next cycle is ${Math.round(breakDays)} days.`
  }
  if (tone === 'danger') {
    return `Break is shorter than the recommended minimum (${Math.round(recMin ?? 0)} days).`
  }
  if (tone === 'warning') {
    return `Break is longer than the recommended max (${Math.round(recMax ?? 0)} days).`
  }
  return 'Break length is inside the saved recommendation range.'
}

function compareCycles(a: CycleSummaryRow, b: CycleSummaryRow): number {
  const cycleA = a.cycle_number ?? -1
  const cycleB = b.cycle_number ?? -1
  if (cycleA !== cycleB) return cycleA - cycleB

  const tsA = a.start_ts ? Date.parse(a.start_ts) : 0
  const tsB = b.start_ts ? Date.parse(b.start_ts) : 0
  return tsA - tsB
}

function findMostRecentActive(cycles: CycleSummaryRow[]): CycleSummaryRow | null {
  for (let i = cycles.length - 1; i >= 0; i -= 1) {
    if (cycles[i].status === 'active') return cycles[i]
  }
  return null
}

function eventTrendFor(cycles: CycleSummaryRow[]): number[] {
  return cycles
    .slice(-6)
    .map((cycle) => toFiniteOrNull(cycle.event_count) ?? 0)
    .map((n) => Math.max(0, n))
}

function buildCard(
  substanceId: string,
  substanceName: string,
  cycles: CycleSummaryRow[],
): CycleInsightCard {
  const ordered = [...cycles].sort(compareCycles)
  const activeCycle = findMostRecentActive(ordered)
  const latestCycle = ordered.at(-1) ?? null
  const primaryCycle = activeCycle ?? latestCycle

  const statusBucket = statusBucketForCycle(primaryCycle)
  const statusLabel = statusLabelForBucket(statusBucket)

  const cycleDayCount = toFiniteOrNull(primaryCycle?.cycle_length_days)
  const breakDaysToNext = toFiniteOrNull(primaryCycle?.break_to_next_cycle_days)

  const recCycleMin = toFiniteOrNull(primaryCycle?.recommended_cycle_days_min)
  const recCycleMax = toFiniteOrNull(primaryCycle?.recommended_cycle_days_max)
  const recBreakMin = toFiniteOrNull(primaryCycle?.recommended_break_days_min)
  const recBreakMax = toFiniteOrNull(primaryCycle?.recommended_break_days_max)

  const cycleProgressPercent =
    cycleDayCount != null && recCycleMax != null && recCycleMax > 0
      ? clampPercent((cycleDayCount / recCycleMax) * 100)
      : null

  const breakProgressPercent =
    breakDaysToNext != null && recBreakMax != null && recBreakMax > 0
      ? clampPercent((breakDaysToNext / recBreakMax) * 100)
      : null

  const cycleHealthTone = cycleToneFor(statusBucket, cycleDayCount, recCycleMax)
  const breakHealthTone = breakToneFor(breakDaysToNext, recBreakMin, recBreakMax)

  const cycleGuidance = describeCycleGuidance(
    statusBucket,
    cycleDayCount,
    recCycleMin,
    recCycleMax,
    cycleHealthTone,
  )
  const breakGuidance = describeBreakGuidance(
    statusBucket,
    breakDaysToNext,
    recBreakMin,
    recBreakMax,
    breakHealthTone,
  )

  return {
    substanceId,
    substanceName,
    detailHref: primaryCycle?.cycle_instance_id ? `/cycles/${primaryCycle.cycle_instance_id}` : null,
    primaryCycle,
    statusBucket,
    statusLabel,
    cycleDayCount,
    breakDaysToNext,
    eventCount: toFiniteOrNull(primaryCycle?.event_count) ?? 0,
    administeredMgTotal: toFiniteOrNull(primaryCycle?.administered_mg_total),
    cycleGuidance,
    breakGuidance,
    cycleHealthTone,
    breakHealthTone,
    cycleProgressPercent,
    breakProgressPercent,
    recommendedCycleDaysMin: recCycleMin,
    recommendedCycleDaysMax: recCycleMax,
    recommendedBreakDaysMin: recBreakMin,
    recommendedBreakDaysMax: recBreakMax,
    eventTrend: eventTrendFor(ordered),
  }
}

function statusSortRank(card: CycleInsightCard): number {
  if (card.statusBucket === 'active') return 0
  if (card.statusBucket === 'completed' || card.statusBucket === 'abandoned' || card.statusBucket === 'other') {
    return 1
  }
  return 2
}

export function buildCycleInsightCards(opts: {
  cycles: CycleSummaryRow[]
  substances: Pick<SubstanceRow, 'id' | 'display_name'>[]
}): CycleInsightCard[] {
  const { cycles, substances } = opts

  const cyclesBySubstance = new Map<string, CycleSummaryRow[]>()
  for (const cycle of cycles) {
    if (!cycle.substance_id) continue
    const list = cyclesBySubstance.get(cycle.substance_id)
    if (list) {
      list.push(cycle)
    } else {
      cyclesBySubstance.set(cycle.substance_id, [cycle])
    }
  }

  const cards: CycleInsightCard[] = []
  const knownSubstances = new Set<string>()

  for (const substance of substances) {
    knownSubstances.add(substance.id)
    cards.push(
      buildCard(
        substance.id,
        substance.display_name ?? 'Unnamed substance',
        cyclesBySubstance.get(substance.id) ?? [],
      ),
    )
  }

  // Defensive fallback: if a cycle references a substance absent from `listSubstances`, still show it.
  for (const [substanceId, substanceCycles] of cyclesBySubstance.entries()) {
    if (knownSubstances.has(substanceId)) continue
    cards.push(
      buildCard(
        substanceId,
        substanceCycles.at(-1)?.substance_name ?? 'Unknown substance',
        substanceCycles,
      ),
    )
  }

  cards.sort((a, b) => {
    const rankDiff = statusSortRank(a) - statusSortRank(b)
    if (rankDiff !== 0) return rankDiff
    return a.substanceName.localeCompare(b.substanceName)
  })

  return cards
}
