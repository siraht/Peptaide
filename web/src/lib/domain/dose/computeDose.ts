import { toCanonicalMassMg, toCanonicalVolumeMl } from '../units/canonicalize'
import type { QuantityKind } from '../units/types'

export type DoseComputationInput = {
  inputText: string
  inputKind: QuantityKind
  inputValue: number
  inputUnit: string
  vial: {
    contentMassMg: number | null
    totalVolumeMl: number | null
    concentrationMgPerMl: number | null
  } | null
  volumeMlPerDeviceUnit: number | null
}

function computeEffectiveConcentrationMgPerMl(vial: DoseComputationInput['vial']): number | null {
  if (!vial) return null
  if (vial.concentrationMgPerMl != null) return vial.concentrationMgPerMl
  if (vial.contentMassMg == null || vial.totalVolumeMl == null) return null
  if (vial.totalVolumeMl <= 0) return null
  return vial.contentMassMg / vial.totalVolumeMl
}

export function computeDose(input: DoseComputationInput): {
  doseMassMg: number | null
  doseVolumeMl: number | null
} {
  const { inputKind, inputValue, inputUnit, vial, volumeMlPerDeviceUnit } = input
  if (!Number.isFinite(inputValue) || inputValue < 0) {
    throw new Error('inputValue must be a finite non-negative number.')
  }

  const concentration = computeEffectiveConcentrationMgPerMl(vial)

  if (inputKind === 'mass') {
    const doseMassMg = toCanonicalMassMg(inputValue, inputUnit)
    const doseVolumeMl =
      concentration != null && concentration > 0 ? doseMassMg / concentration : null
    return { doseMassMg, doseVolumeMl }
  }

  if (inputKind === 'volume') {
    const doseVolumeMl = toCanonicalVolumeMl(inputValue, inputUnit)
    const doseMassMg =
      concentration != null && concentration > 0 ? doseVolumeMl * concentration : null
    return { doseMassMg, doseVolumeMl }
  }

  if (inputKind === 'device_units') {
    if (volumeMlPerDeviceUnit == null || !(volumeMlPerDeviceUnit > 0)) {
      return { doseMassMg: null, doseVolumeMl: null }
    }
    const doseVolumeMl = inputValue * volumeMlPerDeviceUnit
    const doseMassMg =
      concentration != null && concentration > 0 ? doseVolumeMl * concentration : null
    return { doseMassMg, doseVolumeMl }
  }

  // IU and other inputs are stored but are intentionally not converted to mg/mL in MVP.
  return { doseMassMg: null, doseVolumeMl: null }
}

