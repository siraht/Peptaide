import { computeDose } from '@/lib/domain/dose/computeDose'
import { parseQuantity } from '@/lib/domain/units/types'
import { requireOk } from '@/lib/repos/errors'
import { ensureMyProfile, getMyProfile } from '@/lib/repos/profilesRepo'
import { createFormulation } from '@/lib/repos/formulationsRepo'
import { createRoute } from '@/lib/repos/routesRepo'
import { createSubstance } from '@/lib/repos/substancesRepo'
import type { DbClient } from '@/lib/repos/types'
import type { Database } from '@/lib/supabase/database.types'

import { parseCsv } from './csv'
import { deleteAllMyData } from './deleteMyData'

export type ImportMode = 'dry-run' | 'apply'

export type SimpleEventsImportResult = {
  ok: boolean
  mode: ImportMode
  summary: {
    input_rows: number
    imported_events: number
    created_substances: number
    created_routes: number
    created_formulations: number
    created_cycles: number
  }
  warnings: string[]
  errors: string[]
  row_errors: Array<{ row: number; error: string }>
}

type ParsedEvent = {
  row: number
  tsIso: string
  substanceKey: string
  substanceDisplay: string
  routeKey: string
  routeName: string
  formulationKey: string
  formulationName: string
  inputText: string
  inputKind: Database['public']['Enums']['input_kind_t']
  inputValue: number | null
  inputUnit: string | null
  concentrationMgPerMl: number | null
  doseMassMg: number | null
  doseVolumeMl: number | null
  notes: string | null
  tags: string[] | null
}

type InferredCycle = {
  substanceKey: string
  cycleNumber: number
  startTsIso: string
  endTsIso: string
  status: Database['public']['Enums']['cycle_status_t']
}

function normalizeHeaderCell(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

function normalizeKey(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function slugifyCanonicalName(s: string): string {
  const out = String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  return out
}

function hasExplicitTimezone(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  if (/[zZ]$/.test(s)) return true
  // ISO-ish offsets: +HH:MM / -HH:MM / +HHMM / -HHMM
  if (/[+-]\d{2}:?\d{2}$/.test(s)) return true
  return false
}

function parseNumberCell(raw: string): number | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}

function parseTagList(raw: string): string[] | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const parts = s
    .split(/[;,]/g)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts : null
}

type DateParts = { year: number; month: number; day: number }
type TimeParts = { hour: number; minute: number; second: number }

function parseDateCell(raw: string): DateParts | null {
  const s = String(raw || '').trim()
  if (!s) return null

  // YYYY-MM-DD
  {
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (m) {
      const year = Number(m[1])
      const month = Number(m[2])
      const day = Number(m[3])
      if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month, day }
    }
  }

  // MM/DD/YYYY (US) or MM/DD/YY
  {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
    if (m) {
      const month = Number(m[1])
      const day = Number(m[2])
      const yy = Number(m[3])
      const year = yy < 100 ? (yy >= 70 ? 1900 + yy : 2000 + yy) : yy
      if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month, day }
    }
  }

  // MM-DD-YYYY (common spreadsheet export); treat as US month-first.
  {
    const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/)
    if (m) {
      const month = Number(m[1])
      const day = Number(m[2])
      const yy = Number(m[3])
      const year = yy < 100 ? (yy >= 70 ? 1900 + yy : 2000 + yy) : yy
      if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month, day }
    }
  }

  return null
}

function parseTimeCell(raw: string): TimeParts | null {
  const s = String(raw || '').trim()
  if (!s) return null

  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  const second = m[3] != null ? Number(m[3]) : 0
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null
  if (second < 0 || second > 59) return null
  return { hour, minute, second }
}

function makeIntlFormatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function dtfPartsToObj(parts: Intl.DateTimeFormatPart[]): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} | null {
  const map = new Map<string, string>()
  for (const p of parts) {
    if (p.type === 'year' || p.type === 'month' || p.type === 'day' || p.type === 'hour' || p.type === 'minute' || p.type === 'second') {
      map.set(p.type, p.value)
    }
  }
  const year = Number(map.get('year'))
  const month = Number(map.get('month'))
  const day = Number(map.get('day'))
  const hour = Number(map.get('hour'))
  const minute = Number(map.get('minute'))
  const second = Number(map.get('second'))
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null
  return { year, month, day, hour, minute, second }
}

function utcMsFromParts(p: { year: number; month: number; day: number; hour: number; minute: number; second: number }): number {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

function zonedLocalToUtcIso(
  p: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  timezone: string,
  warnings: string[],
): string {
  const dtf = makeIntlFormatter(timezone)
  const targetUtcMs = utcMsFromParts(p)

  // Start with "treat local as UTC" guess and iteratively adjust until the timezone-formatted
  // wall time matches the requested wall time. This avoids adding a heavy tz dependency.
  let guess = targetUtcMs
  for (let i = 0; i < 3; i++) {
    const parts = dtfPartsToObj(dtf.formatToParts(new Date(guess)))
    if (!parts) break
    const gotUtcMs = utcMsFromParts(parts)
    const diff = targetUtcMs - gotUtcMs
    if (diff === 0) return new Date(guess).toISOString()
    guess += diff
  }

  warnings.push(
    `Some timestamps could not be matched exactly in timezone ${timezone} (DST ambiguity/gap). Imported times may be shifted slightly.`,
  )
  return new Date(guess).toISOString()
}

function parseTimestampToIso(opts: {
  tsRaw: string | null
  dateRaw: string | null
  timeRaw: string | null
  timezone: string
  warnings: string[]
}): string | null {
  const { tsRaw, dateRaw, timeRaw, timezone, warnings } = opts

  const ts = String(tsRaw || '').trim()
  if (ts) {
    if (hasExplicitTimezone(ts)) {
      const d = new Date(ts)
      if (!Number.isNaN(d.getTime())) return d.toISOString()
      return null
    }

    // Treat naive timestamps as local-time in the user's profile timezone.
    const normalized = ts.replace('T', ' ')
    const [datePartRaw, timePartRaw] = normalized.split(/\s+/, 2)
    const dateParts = parseDateCell(datePartRaw || '')
    const timeParts = parseTimeCell(timePartRaw || '') ?? { hour: 12, minute: 0, second: 0 }
    if (!dateParts) return null
    return zonedLocalToUtcIso(
      { ...dateParts, ...timeParts },
      timezone,
      warnings,
    )
  }

  const dateParts = parseDateCell(String(dateRaw || ''))
  if (!dateParts) return null
  const timeParts = parseTimeCell(String(timeRaw || '')) ?? { hour: 12, minute: 0, second: 0 }
  return zonedLocalToUtcIso(
    { ...dateParts, ...timeParts },
    timezone,
    warnings,
  )
}

type HeaderIndex = {
  ts: number | null
  date: number | null
  time: number | null
  substance: number | null
  route: number | null
  formulation: number | null
  input_text: number | null
  dose_mg: number | null
  dose_ml: number | null
  dose_iu: number | null
  concentration_mg_per_ml: number | null
  notes: number | null
  tags: number | null
}

const SIMPLE_HEADER_ALIASES: Record<keyof HeaderIndex, readonly string[]> = {
  ts: ['ts', 'timestamp', 'datetime', 'date_time', 'date_time_utc', 'admin_ts'],
  date: ['date', 'day'],
  time: ['time'],
  substance: ['substance', 'compound', 'drug', 'peptide', 'medication'],
  route: ['route', 'roa'],
  formulation: ['formulation', 'prep', 'mixture'],
  input_text: ['input_text', 'dose', 'dose_text', 'dose_str'],
  dose_mg: ['dose_mg', 'mg', 'dose_mass_mg'],
  dose_ml: ['dose_ml', 'ml', 'dose_volume_ml'],
  dose_iu: ['dose_iu', 'iu'],
  concentration_mg_per_ml: ['concentration_mg_per_ml', 'mg_per_ml', 'mg_ml', 'mgperml', 'conc_mg_per_ml', 'conc_mg_ml'],
  notes: ['notes', 'note', 'comment', 'comments', 'memo'],
  tags: ['tags', 'tag'],
}

function buildHeaderIndex(header: string[], warnings: string[]): HeaderIndex {
  const normalized = header.map(normalizeHeaderCell)
  const out: HeaderIndex = {
    ts: null,
    date: null,
    time: null,
    substance: null,
    route: null,
    formulation: null,
    input_text: null,
    dose_mg: null,
    dose_ml: null,
    dose_iu: null,
    concentration_mg_per_ml: null,
    notes: null,
    tags: null,
  }

  const usedBy = new Map<number, string>()
  for (const [field, aliases] of Object.entries(SIMPLE_HEADER_ALIASES) as Array<
    [keyof HeaderIndex, readonly string[]]
  >) {
    for (let i = 0; i < normalized.length; i++) {
      if (!aliases.includes(normalized[i] || '')) continue
      if (out[field] != null) continue
      out[field] = i
      if (usedBy.has(i)) {
        warnings.push(`Header column "${header[i] ?? ''}" matched multiple fields; using it for ${field}.`)
      }
      usedBy.set(i, String(field))
      break
    }
  }

  return out
}

function cell(row: string[], idx: number | null): string {
  if (idx == null) return ''
  return row[idx] ?? ''
}

function defaultFormulationName(substanceDisplay: string, routeName: string): string {
  const s = substanceDisplay.trim()
  const r = routeName.trim()
  if (!r || r.toLowerCase() === 'unspecified') return s
  return `${s} - ${r}`
}

function inferCyclesFromEvents(events: ParsedEvent[], gapDays: number): { cycles: InferredCycle[]; eventToCycleKey: Map<number, string> } {
  const bySubstance = new Map<string, ParsedEvent[]>()
  for (const e of events) {
    const arr = bySubstance.get(e.substanceKey) ?? []
    arr.push(e)
    bySubstance.set(e.substanceKey, arr)
  }

  const cycles: InferredCycle[] = []
  const eventToCycleKey = new Map<number, string>()
  const gapMs = Math.max(1, gapDays) * 24 * 60 * 60 * 1000

  for (const [subKey, list] of bySubstance.entries()) {
    list.sort((a, b) => a.tsIso.localeCompare(b.tsIso))

    let cycleNumber = 0
    let cycleStartIdx = 0
    for (let i = 0; i < list.length; i++) {
      if (i === 0) {
        cycleNumber = 1
        cycleStartIdx = 0
        continue
      }
      const prev = new Date(list[i - 1]!.tsIso).getTime()
      const cur = new Date(list[i]!.tsIso).getTime()
      if (Number.isFinite(prev) && Number.isFinite(cur) && cur - prev >= gapMs) {
        // close previous cycle
        const startTsIso = list[cycleStartIdx]!.tsIso
        const endTsIso = list[i - 1]!.tsIso
        const key = `${subKey}#${cycleNumber}`
        cycles.push({ substanceKey: subKey, cycleNumber, startTsIso, endTsIso, status: 'completed' })
        for (let j = cycleStartIdx; j <= i - 1; j++) eventToCycleKey.set(list[j]!.row, key)

        cycleNumber += 1
        cycleStartIdx = i
      }
    }

    // final cycle
    const startTsIso = list[cycleStartIdx]!.tsIso
    const endTsIso = list[list.length - 1]!.tsIso
    const lastEventMs = new Date(endTsIso).getTime()
    const shouldBeActive = Number.isFinite(lastEventMs) ? Date.now() - lastEventMs < gapMs : true
    const status: Database['public']['Enums']['cycle_status_t'] = shouldBeActive ? 'active' : 'completed'
    const key = `${subKey}#${cycleNumber}`
    cycles.push({ substanceKey: subKey, cycleNumber, startTsIso, endTsIso, status })
    for (let j = cycleStartIdx; j < list.length; j++) eventToCycleKey.set(list[j]!.row, key)
  }

  // Deterministic order for DB inserts.
  cycles.sort((a, b) =>
    a.substanceKey === b.substanceKey ? a.cycleNumber - b.cycleNumber : a.substanceKey.localeCompare(b.substanceKey),
  )

  return { cycles, eventToCycleKey }
}

export function parseSimpleEventsCsvText(opts: {
  csvText: string
  timezone: string
  gapDays: number
  inferCycles: boolean
}): {
  ok: boolean
  parsedRowCount: number
  events: ParsedEvent[]
  inferredCycles: InferredCycle[]
  eventToCycleKey: Map<number, string>
  warnings: string[]
  errors: string[]
  rowErrors: Array<{ row: number; error: string }>
} {
  const warnings: string[] = []
  const errors: string[] = []
  const rowErrors: Array<{ row: number; error: string }> = []

  let parsed: ReturnType<typeof parseCsv>
  try {
    parsed = parseCsv(opts.csvText)
  } catch (e) {
    return {
      ok: false,
      parsedRowCount: 0,
      events: [],
      inferredCycles: [],
      eventToCycleKey: new Map(),
      warnings: [],
      errors: [e instanceof Error ? e.message : String(e)],
      rowErrors: [],
    }
  }

  const headerIndex = buildHeaderIndex(parsed.header, warnings)
  const hasDoseText =
    headerIndex.input_text != null ||
    headerIndex.dose_mg != null ||
    headerIndex.dose_ml != null ||
    headerIndex.dose_iu != null

  if (headerIndex.substance == null) errors.push('Missing required column: substance (e.g. "substance").')
  if (!hasDoseText) errors.push('Missing required dose column: provide "dose" (input_text) or one of dose_mg/dose_ml/dose_iu.')
  if (headerIndex.ts == null && headerIndex.date == null) {
    errors.push(
      'Missing required timestamp column: provide "ts" (timestamp/datetime) or a "date" column (optionally with "time").',
    )
  }

  const events: ParsedEvent[] = []

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i] ?? []
    const rowNum = i + 2

    const substanceDisplay = cell(row, headerIndex.substance).trim()
    if (!substanceDisplay) {
      rowErrors.push({ row: rowNum, error: 'Missing substance.' })
      continue
    }

    const routeNameRaw = cell(row, headerIndex.route).trim()
    const routeName = routeNameRaw || 'Unspecified'

    const tsIso = parseTimestampToIso({
      tsRaw: headerIndex.ts != null ? cell(row, headerIndex.ts) : null,
      dateRaw: headerIndex.date != null ? cell(row, headerIndex.date) : null,
      timeRaw: headerIndex.time != null ? cell(row, headerIndex.time) : null,
      timezone: opts.timezone,
      warnings,
    })
    if (!tsIso) {
      rowErrors.push({ row: rowNum, error: 'Invalid timestamp/date.' })
      continue
    }

    const explicitDoseMg = parseNumberCell(cell(row, headerIndex.dose_mg))
    const explicitDoseMl = parseNumberCell(cell(row, headerIndex.dose_ml))
    const explicitDoseIu = parseNumberCell(cell(row, headerIndex.dose_iu))
    const inputTextRaw = cell(row, headerIndex.input_text).trim()

    let inputText = inputTextRaw
    if (!inputText) {
      if (explicitDoseMg != null) inputText = `${explicitDoseMg} mg`
      else if (explicitDoseMl != null) inputText = `${explicitDoseMl} mL`
      else if (explicitDoseIu != null) inputText = `${explicitDoseIu} IU`
    }

    if (!inputText) {
      rowErrors.push({ row: rowNum, error: 'Missing dose. Provide dose text or dose_mg/dose_ml/dose_iu.' })
      continue
    }

    const concentrationMgPerMl = (() => {
      const n = parseNumberCell(cell(row, headerIndex.concentration_mg_per_ml))
      if (n == null) return null
      if (!(n > 0)) return null
      return n
    })()

    let inputKind: ParsedEvent['inputKind'] = 'other'
    let inputValue: number | null = null
    let inputUnit: string | null = null
    let doseMassMg: number | null = null
    let doseVolumeMl: number | null = null

    try {
      const q = parseQuantity(inputText)
      inputKind = q.kind
      inputValue = q.value
      inputUnit = q.unit

      const doseRes = computeDose({
        inputText,
        inputKind: q.kind,
        inputValue: q.value,
        inputUnit: q.unit,
        vial: concentrationMgPerMl != null ? { contentMassMg: null, totalVolumeMl: null, concentrationMgPerMl } : null,
        volumeMlPerDeviceUnit: null,
      })
      doseMassMg = doseRes.doseMassMg
      doseVolumeMl = doseRes.doseVolumeMl
    } catch {
      // Keep input_text but treat it as non-canonicalizable.
      warnings.push(`Row ${rowNum}: could not parse dose text "${inputText}". It will be imported as input_kind=other.`)
    }

    // If the spreadsheet provided explicit mg/ml, trust it as an override (and fill in the other side when possible).
    if (explicitDoseMg != null) doseMassMg = explicitDoseMg
    if (explicitDoseMl != null) doseVolumeMl = explicitDoseMl
    if (doseMassMg == null && doseVolumeMl != null && concentrationMgPerMl != null) {
      doseMassMg = doseVolumeMl * concentrationMgPerMl
    }
    if (doseVolumeMl == null && doseMassMg != null && concentrationMgPerMl != null && concentrationMgPerMl > 0) {
      doseVolumeMl = doseMassMg / concentrationMgPerMl
    }

    const formulationNameRaw = cell(row, headerIndex.formulation).trim()
    const formulationName = formulationNameRaw || defaultFormulationName(substanceDisplay, routeName)

    const substanceKey = normalizeKey(substanceDisplay)
    const routeKey = normalizeKey(routeName)
    const formulationKey = `${substanceKey}||${routeKey}||${normalizeKey(formulationName)}`

    const notes = (() => {
      const n = cell(row, headerIndex.notes).trim()
      return n ? n : null
    })()

    const tags = parseTagList(cell(row, headerIndex.tags))

    events.push({
      row: rowNum,
      tsIso,
      substanceKey,
      substanceDisplay,
      routeKey,
      routeName,
      formulationKey,
      formulationName,
      inputText,
      inputKind,
      inputValue,
      inputUnit,
      concentrationMgPerMl,
      doseMassMg,
      doseVolumeMl,
      notes,
      tags,
    })
  }

  const ok = errors.length === 0 && rowErrors.length === 0
  const inferred = opts.inferCycles ? inferCyclesFromEvents(events, opts.gapDays) : { cycles: [], eventToCycleKey: new Map<number, string>() }

  return {
    ok,
    parsedRowCount: parsed.rows.length,
    events,
    inferredCycles: inferred.cycles,
    eventToCycleKey: inferred.eventToCycleKey,
    warnings,
    errors,
    rowErrors,
  }
}

export async function importSimpleEventsCsv(
  supabase: DbClient,
  opts: {
    userId: string
    csvText: string
    mode: ImportMode
    replaceExisting?: boolean
    inferCycles?: boolean
  },
): Promise<SimpleEventsImportResult> {
  const replaceExisting = opts.replaceExisting ?? false
  const inferCycles = opts.inferCycles ?? true

  const profile = (await getMyProfile(supabase)) ?? (await ensureMyProfile(supabase))
  const timezone = profile.timezone || 'UTC'
  const gapDays = profile.cycle_gap_default_days || 7
  const parsed = parseSimpleEventsCsvText({
    csvText: opts.csvText,
    timezone,
    gapDays,
    inferCycles,
  })

  const substances = new Set(parsed.events.map((e) => e.substanceKey))
  const routes = new Set(parsed.events.map((e) => e.routeKey))
  const formulations = new Set(parsed.events.map((e) => e.formulationKey))

  if (!parsed.ok || opts.mode === 'dry-run') {
    return {
      ok: parsed.ok,
      mode: opts.mode,
      summary: {
        input_rows: parsed.parsedRowCount,
        imported_events: parsed.ok ? parsed.events.length : 0,
        created_substances: substances.size,
        created_routes: routes.size,
        created_formulations: formulations.size,
        created_cycles: parsed.inferredCycles.length,
      },
      warnings: parsed.warnings,
      errors: parsed.errors,
      row_errors: parsed.rowErrors,
    }
  }

  // Apply import.
  let existingProfile: Database['public']['Tables']['profiles']['Row'] | null = null

  try {
    if (replaceExisting) {
      await deleteAllMyData(supabase, { userId: opts.userId })
    } else {
      // Preserve profile in case we need to roll back.
      const profileRes = await supabase.from('profiles').select('*').eq('user_id', opts.userId).maybeSingle()
      requireOk(profileRes.error, 'profiles.select_before_simple_import')
      existingProfile = profileRes.data ?? null

      // Refuse to import into a non-empty dataset (except profiles) to avoid duplicates.
      const existing = await supabase.from('administration_events').select('id').limit(1)
      requireOk(existing.error, 'administration_events.empty_check')
      if ((existing.data ?? []).length > 0) {
        return {
          ok: false,
          mode: opts.mode,
          summary: {
            input_rows: parsed.parsedRowCount,
            imported_events: 0,
            created_substances: 0,
            created_routes: 0,
            created_formulations: 0,
            created_cycles: 0,
          },
          warnings: parsed.warnings,
          errors: ['Refusing to import: events table is not empty. Use "replace existing data" to import.'],
          row_errors: [],
        }
      }
    }

    // Create reference rows.
    const seenCanon = new Set<string>()

    const substancesByKey = new Map<string, Database['public']['Tables']['substances']['Row']>()
    for (const key of [...new Set(parsed.events.map((e) => e.substanceKey))].sort()) {
      const display = parsed.events.find((e) => e.substanceKey === key)!.substanceDisplay.trim()
      let canonical = slugifyCanonicalName(display)
      if (!canonical) canonical = 'substance'
      if (seenCanon.has(canonical)) {
        let n = 2
        while (seenCanon.has(`${canonical}_${n}`)) n++
        canonical = `${canonical}_${n}`
      }
      seenCanon.add(canonical)

      const row = await createSubstance(supabase, {
        canonicalName: canonical,
        displayName: display,
        family: null,
        targetCompartmentDefault: 'systemic',
        notes: null,
      })
      substancesByKey.set(key, row)
    }

    const routesByKey = new Map<string, Database['public']['Tables']['routes']['Row']>()
    for (const key of [...new Set(parsed.events.map((e) => e.routeKey))].sort()) {
      const routeName = parsed.events.find((e) => e.routeKey === key)!.routeName.trim()

      // Choose a reasonable default input kind/unit based on observed imported dose kinds.
      const kinds = parsed.events.filter((e) => e.routeKey === key).map((e) => e.inputKind)
      const volumeCount = kinds.filter((k) => k === 'volume').length
      const iuCount = kinds.filter((k) => k === 'iu').length
      const kind: Database['public']['Enums']['route_input_kind_t'] =
        iuCount > 0 && iuCount >= volumeCount ? 'iu' : volumeCount > 0 ? 'volume' : 'mass'
      const unit = kind === 'volume' ? 'mL' : kind === 'iu' ? 'IU' : 'mg'

      const row = await createRoute(supabase, {
        name: routeName,
        defaultInputKind: kind,
        defaultInputUnit: unit,
        supportsDeviceCalibration: false,
        notes: null,
      })
      routesByKey.set(key, row)
    }

    const formulationsByKey = new Map<string, Database['public']['Tables']['formulations']['Row']>()
    const defaultTaken = new Set<string>() // substanceKey||routeKey
    for (const key of [...new Set(parsed.events.map((e) => e.formulationKey))].sort()) {
      const ev = parsed.events.find((e) => e.formulationKey === key)!
      const sub = substancesByKey.get(ev.substanceKey)!
      const route = routesByKey.get(ev.routeKey)!
      const pairKey = `${ev.substanceKey}||${ev.routeKey}`
      const isDefaultForRoute = !defaultTaken.has(pairKey)
      defaultTaken.add(pairKey)

      const row = await createFormulation(supabase, {
        substanceId: sub.id,
        routeId: route.id,
        deviceId: null,
        name: ev.formulationName,
        isDefaultForRoute,
        notes: null,
      })
      formulationsByKey.set(key, row)
    }

    // Infer cycles, then insert.
    const cycles = parsed.inferredCycles
    const eventToCycleKey = parsed.eventToCycleKey
    const cycleIdByKey = new Map<string, string>()

    if (cycles.length > 0) {
      // Insert cycles, then set end_ts for completed cycles.
      for (const c of cycles) {
        const sub = substancesByKey.get(c.substanceKey)!
        const ins = await supabase
          .from('cycle_instances')
          .insert({
            substance_id: sub.id,
            cycle_number: c.cycleNumber,
            start_ts: c.startTsIso,
            status: c.status,
            goal: null,
            notes: 'Imported (inferred from event timestamps)',
          })
          .select('id')
          .single()
        requireOk(ins.error, 'cycle_instances.insert_simple_import')
        const id = ins.data?.id
        if (!id) throw new Error('cycle_instances.insert did not return an id')
        const cycleKey = `${c.substanceKey}#${c.cycleNumber}`
        cycleIdByKey.set(cycleKey, id)

        if (c.status === 'completed') {
          const up = await supabase.from('cycle_instances').update({ end_ts: c.endTsIso }).eq('id', id)
          requireOk(up.error, 'cycle_instances.set_end_ts_simple_import')
        }
      }
    }

    // Insert events.
    const inserts: Database['public']['Tables']['administration_events']['Insert'][] = parsed.events.map((e) => {
      const formulation = formulationsByKey.get(e.formulationKey)!
      const cycleKey = eventToCycleKey.get(e.row) ?? null
      const cycleInstanceId = cycleKey ? cycleIdByKey.get(cycleKey) ?? null : null

      return {
        ts: e.tsIso,
        formulation_id: formulation.id,
        cycle_instance_id: cycleInstanceId,
        input_text: e.inputText,
        input_kind: e.inputKind,
        input_value: e.inputValue,
        input_unit: e.inputUnit,
        dose_mass_mg: e.doseMassMg,
        dose_volume_ml: e.doseVolumeMl,
        notes: e.notes,
        // `tags` is NOT NULL (default is []), but supabase-js can still serialize `undefined`
        // in surprising ways on bulk inserts; always send [] to avoid null constraint issues.
        tags: e.tags ?? [],
        // Leave vials and MC fields empty; they can be modeled later.
      }
    })

    const batchSize = 500
    for (let i = 0; i < inserts.length; i += batchSize) {
      const batch = inserts.slice(i, i + batchSize)
      const res = await supabase.from('administration_events').insert(batch)
      requireOk(res.error, 'administration_events.insert_simple_import')
    }

    return {
      ok: true,
      mode: opts.mode,
      summary: {
        input_rows: parsed.parsedRowCount,
        imported_events: parsed.events.length,
        created_substances: substancesByKey.size,
        created_routes: routesByKey.size,
        created_formulations: formulationsByKey.size,
        created_cycles: cycles.length,
      },
      warnings: parsed.warnings,
      errors: [],
      row_errors: [],
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const outErrors = [`Import apply failed: ${msg}`]

    // Best-effort rollback.
    try {
      if (replaceExisting) {
        await deleteAllMyData(supabase, { userId: opts.userId })
      } else {
        await deleteAllMyData(supabase, { userId: opts.userId, preserveProfile: true })
        if (existingProfile) {
          const restoreRes = await supabase.from('profiles').upsert(existingProfile, { onConflict: 'user_id' })
          requireOk(restoreRes.error, 'profiles.restore_after_failed_simple_import')
        }
      }
    } catch (rollbackErr) {
      const rollbackMsg = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)
      outErrors.push(`Rollback failed: ${rollbackMsg}`)
    }

    return {
      ok: false,
      mode: opts.mode,
      summary: {
        input_rows: parsed.parsedRowCount,
        imported_events: 0,
        created_substances: 0,
        created_routes: 0,
        created_formulations: 0,
        created_cycles: 0,
      },
      warnings: parsed.warnings,
      errors: outErrors,
      row_errors: [],
    }
  }
}
