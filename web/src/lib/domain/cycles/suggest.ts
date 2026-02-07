const MS_PER_DAY = 24 * 60 * 60 * 1000

export function shouldSuggestNewCycle(opts: {
  lastEventTs: Date | null
  newEventTs: Date
  gapDaysThreshold: number
}): boolean {
  const { lastEventTs, newEventTs, gapDaysThreshold } = opts

  if (lastEventTs == null) return false
  if (!Number.isFinite(gapDaysThreshold) || gapDaysThreshold < 0) {
    throw new Error('gapDaysThreshold must be a finite non-negative number.')
  }

  const gapMs = newEventTs.getTime() - lastEventTs.getTime()
  return gapMs >= gapDaysThreshold * MS_PER_DAY
}

