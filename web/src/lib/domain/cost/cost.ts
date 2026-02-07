export function allocateVialCost(opts: {
  priceTotalUsd: number | null
  expectedVials: number | null
}): number | null {
  const { priceTotalUsd, expectedVials } = opts
  if (priceTotalUsd == null || expectedVials == null) return null
  if (!Number.isFinite(priceTotalUsd) || priceTotalUsd < 0) return null
  if (!Number.isInteger(expectedVials) || expectedVials <= 0) return null
  return priceTotalUsd / expectedVials
}

export function eventCostFromVial(opts: {
  doseMassMg: number | null
  doseVolumeMl: number | null
  vialContentMassMg: number | null
  vialTotalVolumeMl: number | null
  vialCostUsd: number | null
}): number | null {
  const {
    doseMassMg,
    doseVolumeMl,
    vialContentMassMg,
    vialTotalVolumeMl,
    vialCostUsd,
  } = opts

  if (vialCostUsd == null || !Number.isFinite(vialCostUsd) || vialCostUsd < 0) return null

  let fraction: number | null = null

  // Prefer mass fraction when possible; fall back to volume fraction.
  if (
    doseMassMg != null &&
    vialContentMassMg != null &&
    Number.isFinite(doseMassMg) &&
    Number.isFinite(vialContentMassMg) &&
    doseMassMg >= 0 &&
    vialContentMassMg > 0
  ) {
    fraction = doseMassMg / vialContentMassMg
  } else if (
    doseVolumeMl != null &&
    vialTotalVolumeMl != null &&
    Number.isFinite(doseVolumeMl) &&
    Number.isFinite(vialTotalVolumeMl) &&
    doseVolumeMl >= 0 &&
    vialTotalVolumeMl > 0
  ) {
    fraction = doseVolumeMl / vialTotalVolumeMl
  }

  if (fraction == null || !Number.isFinite(fraction) || fraction < 0) return null
  return vialCostUsd * fraction
}

