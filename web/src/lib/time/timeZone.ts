export function safeTimeZone(tz: string | null | undefined): string {
  const candidate = String(tz ?? '').trim()
  if (!candidate) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return 'UTC'
  }
}

export function mustGetLocalYmd(date: Date, timeZone: string): { year: number; month: number; day: number } {
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

export function parseTimeHHMM(timeHHMM: string): { hour: number; minute: number; second: number } {
  const raw = String(timeHHMM || '').trim()
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) {
    throw new Error('Invalid time (expected HH:MM).')
  }

  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = match[3] == null ? 0 : Number(match[3])

  if (!Number.isFinite(hour) || hour < 0 || hour > 23) throw new Error('Invalid hour (expected 00-23).')
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) throw new Error('Invalid minute (expected 00-59).')
  if (!Number.isFinite(second) || second < 0 || second > 59) throw new Error('Invalid second (expected 00-59).')

  return { hour, minute, second }
}

function tzOffsetMs(timeZone: string, date: Date): number {
  // Compute the timezone offset at `date` for `timeZone`.
  // Technique: format the date in the target timezone, then treat the formatted wall time
  // as if it were UTC. The difference is the offset.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const parts = fmt.formatToParts(date)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value)
  const second = Number(parts.find((p) => p.type === 'second')?.value)

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    throw new Error(`Failed to format timezone offset parts for timezone ${JSON.stringify(timeZone)}.`)
  }

  const asUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, 0)
  return asUtcMs - date.getTime()
}

export function zonedDateTimeToUtcIso(opts: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second?: number
  timeZone: string
}): string {
  const { year, month, day, hour, minute, second = 0, timeZone } = opts

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0))

  // DST boundaries can change offsets; do a small fixed-point iteration.
  const offset1 = tzOffsetMs(timeZone, utcGuess)
  const adjusted1 = new Date(utcGuess.getTime() - offset1)
  const offset2 = tzOffsetMs(timeZone, adjusted1)
  const adjusted2 = new Date(utcGuess.getTime() - offset2)

  return adjusted2.toISOString()
}

export function utcIsoFromTodayLocalTime(opts: {
  timeZone: string
  timeHHMM: string
  now?: Date
}): string {
  const tz = safeTimeZone(opts.timeZone)
  const now = opts.now ?? new Date()
  const { year, month, day } = mustGetLocalYmd(now, tz)
  const { hour, minute, second } = parseTimeHHMM(opts.timeHHMM)
  return zonedDateTimeToUtcIso({ year, month, day, hour, minute, second, timeZone: tz })
}
