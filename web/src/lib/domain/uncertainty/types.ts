export type DistributionValueType =
  | 'fraction'
  | 'multiplier'
  | 'volume_ml_per_unit'
  | 'other'

export type DistributionDistType =
  | 'point'
  | 'uniform'
  | 'triangular'
  | 'lognormal'
  | 'beta_pert'

export type Distribution = {
  id: string
  valueType: DistributionValueType
  distType: DistributionDistType
  p1: number | null
  p2: number | null
  p3: number | null
  minValue: number | null
  maxValue: number | null
}

