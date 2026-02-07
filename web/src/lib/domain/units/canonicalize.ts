function normalizeAsciiMicro(raw: string): string {
  return raw.replaceAll('µ', 'u').replaceAll('μ', 'u')
}

function normalizeUnit(rawUnit: string): string {
  return normalizeAsciiMicro(rawUnit.trim())
    .replaceAll('[', '')
    .replaceAll(']', '')
    .toLowerCase()
}

export function toCanonicalMassMg(value: number, unit: string): number {
  if (!Number.isFinite(value)) {
    throw new Error('Mass value must be a finite number.')
  }

  const u = normalizeUnit(unit)
  switch (u) {
    case 'mg':
      return value
    case 'mcg':
    case 'ug':
      return value / 1000.0
    case 'g':
      return value * 1000.0
    default:
      throw new Error(`Unsupported mass unit: "${unit}"`)
  }
}

export function toCanonicalVolumeMl(value: number, unit: string): number {
  if (!Number.isFinite(value)) {
    throw new Error('Volume value must be a finite number.')
  }

  const u = normalizeUnit(unit)
  switch (u) {
    case 'ml':
    case 'cc':
      return value
    case 'ul':
      return value / 1000.0
    default:
      throw new Error(`Unsupported volume unit: "${unit}"`)
  }
}

