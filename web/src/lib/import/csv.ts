export type ParsedCsv = {
  header: string[]
  rows: string[][]
}

/**
 * Minimal CSV parser that supports:
 * - Comma delimiter
 * - RFC 4180-style quoted fields with `""` escaping
 * - Newlines inside quoted fields
 * - LF or CRLF line endings
 *
 * This is intentionally small and designed to parse bundles exported by this app.
 */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1]
        if (next === '"') {
          cell += '"'
          i++
          continue
        }
        inQuotes = false
        continue
      }

      cell += ch
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }

    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }

    if (ch === '\n') {
      row.push(cell)
      cell = ''
      rows.push(row)
      row = []
      continue
    }

    if (ch === '\r') {
      // Ignore; we'll treat CRLF as LF when the subsequent `\n` is processed.
      continue
    }

    cell += ch
  }

  if (inQuotes) {
    throw new Error('Invalid CSV: unterminated quoted field')
  }

  // Support files without a trailing newline.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  if (rows.length === 0) {
    return { header: [], rows: [] }
  }

  const header = rows[0]
  // Ignore fully blank lines (common when CSVs are edited manually or round-tripped through tools).
  // We only drop "truly blank" lines, which parse as a single empty cell.
  const dataRows = rows.slice(1).filter((r) => !(r.length === 1 && (r[0] ?? '') === ''))

  // Tolerate a UTF-8 BOM (common when CSVs are round-tripped through Excel/other tools).
  const normalizedHeader = header.map((cell, idx) => (idx === 0 ? cell.replace(/^\uFEFF/, '') : cell))

  return { header: normalizedHeader, rows: dataRows }
}
