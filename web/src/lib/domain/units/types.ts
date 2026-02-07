export type QuantityKind = 'mass' | 'volume' | 'device_units' | 'iu' | 'other'

export type ParsedQuantity = {
  kind: QuantityKind
  value: number
  unit: string
  normalizedUnit: string
}

function normalizeIuToken(raw: string): string {
  const trimmed = raw.trim()
  const withoutBrackets = trimmed.replaceAll('[', '').replaceAll(']', '')
  return withoutBrackets.toLowerCase()
}

function normalizeAsciiMicro(raw: string): string {
  // Normalize common micro characters to a plain ASCII 'u' so comparisons can be ASCII-based.
  // - micro sign: U+00B5 (µ)
  // - greek small letter mu: U+03BC (μ)
  return raw.replaceAll('µ', 'u').replaceAll('μ', 'u')
}

function normalizeUnitToken(rawUnit: string): string {
  const token = normalizeAsciiMicro(rawUnit.trim())
    .replaceAll('.', '')
    .replaceAll(',', '')

  const iuCandidate = normalizeIuToken(token)
  if (iuCandidate === 'iu') {
    return 'iu'
  }
  if (iuCandidate === 'iU'.toLowerCase()) {
    return 'iu'
  }

  return token.toLowerCase()
}

function normalizeDeviceUnit(rawUnit: string): string {
  const token = normalizeUnitToken(rawUnit)
  // Very small heuristic singularization for nicer display/keys.
  if (token.length > 2 && token.endsWith('s')) {
    return token.slice(0, -1)
  }
  return token
}

export function normalizeDeviceUnitLabel(raw: string): string {
  // Keep this normalization consistent with `parseQuantity(...).normalizedUnit` so that:
  // - calibration keys match what users type during logging
  // - comparisons can remain ASCII-based (micro symbols normalized to 'u')
  // - unit tokens are stable (lowercased, punctuation stripped, small plural heuristic)
  const firstToken = raw.trim().split(/\s+/)[0] ?? ''
  return normalizeDeviceUnit(firstToken)
}

function parseNumber(raw: string): number {
  const cleaned = raw.replaceAll(',', '')
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number: "${raw}"`)
  }
  return value
}

export function parseQuantity(inputText: string): ParsedQuantity {
  const raw = inputText.trim()
  if (!raw) {
    throw new Error('Quantity is required.')
  }

  // Support either plain decimals (`1000`, `0.5`, `.5`) or comma-grouped thousands (`1,000`, `12,345.67`).
  // We intentionally do not accept European-style decimal commas.
  const match = raw.match(
    /^([+-]?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+))\s*(.*)$/,
  )
  if (!match) {
    throw new Error(`Could not parse quantity: "${inputText}"`)
  }

  const value = parseNumber(match[1] ?? '')
  const unitPart = (match[2] ?? '').trim()
  if (!unitPart) {
    throw new Error('Missing unit (for example: "mg", "mL", "IU", "sprays").')
  }

  // Unit is treated as the first token for now ("2 sprays" -> "sprays").
  const unit = unitPart.split(/\s+/)[0] ?? ''
  const normalized = normalizeUnitToken(unit)

  const volumeUnits = new Set(['ml', 'cc', 'ul'])
  const massUnits = new Set(['mg', 'mcg', 'ug', 'g'])

  if (volumeUnits.has(normalized)) {
    // Canonical volume unit is mL; uL is a supported input synonym.
    return {
      kind: 'volume',
      value,
      unit,
      normalizedUnit: normalized === 'cc' ? 'ml' : normalized,
    }
  }

  if (massUnits.has(normalized)) {
    // Canonical mass unit is mg; ug/mcg/g are supported input synonyms.
    return {
      kind: 'mass',
      value,
      unit,
      normalizedUnit: normalized === 'ug' ? 'mcg' : normalized,
    }
  }

  if (normalized === 'iu') {
    return {
      kind: 'iu',
      value,
      unit,
      normalizedUnit: 'iu',
    }
  }

  return {
    kind: 'device_units',
    value,
    unit,
    normalizedUnit: normalizeDeviceUnit(unit),
  }
}
