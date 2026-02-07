import type { Rng } from './rng'
import type { Distribution } from './types'

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x))
}

function normal01(rng: Rng): number {
  // Box-Muller transform with a safety clamp away from 0 for log().
  let u1 = rng.next()
  if (u1 <= 0) u1 = 1e-12
  const u2 = rng.next()
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
}

function gammaKge1(shape: number, rng: Rng): number {
  if (!(shape >= 1)) {
    throw new Error(`Gamma shape must be >= 1 for this sampler (got ${shape}).`)
  }

  // Marsaglia-Tsang for k >= 1.
  const d = shape - 1.0 / 3.0
  const c = 1.0 / Math.sqrt(9.0 * d)

  for (;;) {
    const z = normal01(rng)
    const v = Math.pow(1 + c * z, 3)
    if (!(v > 0)) continue

    let u = rng.next()
    if (u <= 0) u = 1e-12

    // Acceptance test in log space.
    if (Math.log(u) < 0.5 * z * z + d - d * v + d * Math.log(v)) {
      return d * v
    }
  }
}

function betaAlphaBetaGe1(alpha: number, beta: number, rng: Rng): number {
  const x = gammaKge1(alpha, rng)
  const y = gammaKge1(beta, rng)
  return x / (x + y)
}

export function distributionMean(dist: Distribution): number {
  switch (dist.distType) {
    case 'point':
      if (dist.p1 == null) throw new Error('point mean requires p1')
      return dist.p1
    case 'uniform':
      if (dist.minValue == null || dist.maxValue == null) {
        throw new Error('uniform mean requires minValue and maxValue')
      }
      return (dist.minValue + dist.maxValue) / 2.0
    case 'triangular': {
      if (dist.p1 == null || dist.p2 == null || dist.p3 == null) {
        throw new Error('triangular mean requires p1,p2,p3')
      }
      return (dist.p1 + dist.p2 + dist.p3) / 3.0
    }
    case 'beta_pert': {
      if (dist.p1 == null || dist.p2 == null || dist.p3 == null) {
        throw new Error('beta_pert mean requires p1,p2,p3')
      }
      // lambda = 4
      return (dist.p1 + 4.0 * dist.p2 + dist.p3) / 6.0
    }
    case 'lognormal': {
      if (dist.p1 == null || dist.p2 == null) {
        throw new Error('lognormal mean requires p1 (median) and p2 (log_sigma)')
      }
      const median = dist.p1
      const logSigma = dist.p2
      return median * Math.exp(0.5 * logSigma * logSigma)
    }
  }
}

export function sample(dist: Distribution, rng: Rng): number {
  switch (dist.distType) {
    case 'point': {
      if (dist.p1 == null) throw new Error('point sample requires p1')
      return dist.p1
    }

    case 'uniform': {
      if (dist.minValue == null || dist.maxValue == null) {
        throw new Error('uniform sample requires minValue and maxValue')
      }
      const u = rng.next()
      return dist.minValue + u * (dist.maxValue - dist.minValue)
    }

    case 'triangular': {
      const min = dist.p1
      const mode = dist.p2
      const max = dist.p3
      if (min == null || mode == null || max == null) {
        throw new Error('triangular sample requires p1=min, p2=mode, p3=max')
      }
      if (!(min <= mode && mode <= max)) {
        throw new Error('triangular parameters must satisfy min <= mode <= max')
      }
      const u = rng.next()
      const c = (mode - min) / (max - min)
      if (u < c) {
        return min + Math.sqrt(u * (max - min) * (mode - min))
      }
      return max - Math.sqrt((1 - u) * (max - min) * (max - mode))
    }

    case 'beta_pert': {
      const min = dist.p1
      const mode = dist.p2
      const max = dist.p3
      if (min == null || mode == null || max == null) {
        throw new Error('beta_pert sample requires p1=min, p2=mode, p3=max')
      }
      if (!(min <= mode && mode <= max)) {
        throw new Error('beta_pert parameters must satisfy min <= mode <= max')
      }
      if (max === min) return min

      const lambda = 4.0
      const alpha = 1.0 + (lambda * (mode - min)) / (max - min)
      const beta = 1.0 + (lambda * (max - mode)) / (max - min)

      // For lambda=4 and min<=mode<=max, alpha and beta are >= 1.
      const u = betaAlphaBetaGe1(alpha, beta, rng)
      return min + u * (max - min)
    }

    case 'lognormal': {
      const median = dist.p1
      const logSigma = dist.p2
      if (median == null || logSigma == null) {
        throw new Error('lognormal sample requires p1=median, p2=log_sigma')
      }
      const z = normal01(rng)
      const sample = Math.exp(Math.log(median) + logSigma * z)
      if (dist.minValue != null || dist.maxValue != null) {
        const min = dist.minValue ?? -Infinity
        const max = dist.maxValue ?? Infinity
        return clamp(sample, min, max)
      }
      return sample
    }
  }
}

