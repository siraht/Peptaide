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
