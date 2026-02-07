function escapeCsvCell(raw: string): string {
  // RFC 4180-ish: quote if the cell contains a quote, comma, or newline. Escape quotes by doubling.
  if (raw.includes('"')) {
    raw = raw.replaceAll('"', '""')
  }
  if (raw.includes(',') || raw.includes('\n') || raw.includes('\r') || raw.includes('"')) {
    return `"${raw}"`
  }
  return raw
}

function stringifyCell(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  // Arrays/objects: preserve structure using JSON.
  return JSON.stringify(value)
}

export function rowsToCsv(rows: Record<string, unknown>[], columns: readonly string[]): string {
  const header = columns.map(escapeCsvCell).join(',')
  const lines = [header]

  for (const row of rows) {
    const line = columns
      .map((col) => escapeCsvCell(stringifyCell(row[col])))
      .join(',')
    lines.push(line)
  }

  // Use LF; Excel and other tools tolerate it, and it's standard on Unix.
  return `${lines.join('\n')}\n`
}

