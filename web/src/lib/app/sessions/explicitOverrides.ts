export type SessionCompartment = 'systemic' | 'cns'

const MISSING_BASE_BIOAVAILABILITY_SPEC = 'missing_base_bioavailability_spec'

function clearMissingBaseMarker(missing: string[]): string[] {
  return missing.filter((item) => item !== MISSING_BASE_BIOAVAILABILITY_SPEC)
}

export function applyExplicitCompartmentOverrides(opts: {
  compartments: SessionCompartment[]
  baseFractionDistIdByCompartment: Map<SessionCompartment, string | null>
  multipliersByCompartment: Map<SessionCompartment, string[]>
  missingByCompartment: Map<SessionCompartment, string[]>
  explicitGlobalBase: string | null
  explicitGlobalMultipliers: string[]
  explicitSystemicBase: string | null
  explicitCnsBase: string | null
  explicitSystemicMultipliers: string[]
  explicitCnsMultipliers: string[]
}): void {
  const setExplicitBase = (compartment: SessionCompartment, base: string | null): void => {
    if (!base || !opts.compartments.includes(compartment)) return
    opts.baseFractionDistIdByCompartment.set(compartment, base)
    const existing = opts.missingByCompartment.get(compartment) ?? []
    opts.missingByCompartment.set(compartment, clearMissingBaseMarker(existing))
  }

  if (opts.explicitGlobalBase) {
    for (const compartment of opts.compartments) {
      setExplicitBase(compartment, opts.explicitGlobalBase)
    }
  }

  if (opts.explicitGlobalMultipliers.length > 0) {
    for (const compartment of opts.compartments) {
      opts.multipliersByCompartment.set(compartment, opts.explicitGlobalMultipliers)
    }
  }

  setExplicitBase('systemic', opts.explicitSystemicBase)
  setExplicitBase('cns', opts.explicitCnsBase)

  if (opts.explicitSystemicMultipliers.length > 0 && opts.compartments.includes('systemic')) {
    opts.multipliersByCompartment.set('systemic', opts.explicitSystemicMultipliers)
  }
  if (opts.explicitCnsMultipliers.length > 0 && opts.compartments.includes('cns')) {
    opts.multipliersByCompartment.set('cns', opts.explicitCnsMultipliers)
  }
}
