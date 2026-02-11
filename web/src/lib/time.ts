export function safeTimeZone(tz: string): string {
  try {
    // Throws RangeError for invalid IANA names.
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return tz
  } catch {
    return 'UTC'
  }
}

export function formatLocalDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(d)
}

function mustGetLocalYmd(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = fmt.formatToParts(date)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`Failed to format local day parts for timezone ${JSON.stringify(timeZone)}.`)
  }

  return { year, month, day }
}

function ymdToIso(ymd: { year: number; month: number; day: number }): string {
  const mm = String(ymd.month).padStart(2, '0')
  const dd = String(ymd.day).padStart(2, '0')
  return `${ymd.year}-${mm}-${dd}`
}

export function dayLocalDaysAgo(daysAgo: number, timeZone: string): string {
  const todayLocal = mustGetLocalYmd(new Date(), timeZone)
  const d = new Date(Date.UTC(todayLocal.year, todayLocal.month - 1, todayLocal.day))
  d.setUTCDate(d.getUTCDate() - Math.max(0, Math.floor(daysAgo)))
  return ymdToIso({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() })
}

