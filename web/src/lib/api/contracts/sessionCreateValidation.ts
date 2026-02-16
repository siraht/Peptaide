export function hasEffectiveModelContext(opts: {
  formulationId?: string | null
  formulationName?: string | null
  substanceId?: string | null
  routeId?: string | null
}): boolean {
  const hasFormulationId = typeof opts.formulationId === 'string' && opts.formulationId.trim().length > 0
  const hasFormulationName =
    typeof opts.formulationName === 'string' && opts.formulationName.trim().length > 0
  const hasSubstanceRoute =
    typeof opts.substanceId === 'string' &&
    opts.substanceId.trim().length > 0 &&
    typeof opts.routeId === 'string' &&
    opts.routeId.trim().length > 0

  return hasFormulationId || hasFormulationName || hasSubstanceRoute
}

export function hasScopedBaseOverride(opts: {
  compartment?: string | null
  systemicBaseFractionDistId?: string | null
  cnsBaseFractionDistId?: string | null
}): boolean {
  if (opts.compartment !== 'both') return false

  const hasSystemic =
    typeof opts.systemicBaseFractionDistId === 'string' &&
    opts.systemicBaseFractionDistId.trim().length > 0
  const hasCns =
    typeof opts.cnsBaseFractionDistId === 'string' && opts.cnsBaseFractionDistId.trim().length > 0

  return hasSystemic || hasCns
}
