import { rngFromSeed } from './rng'
import { sample } from './sample'
import type { Distribution } from './types'

export type Percentiles = { p05: number; p50: number; p95: number }

function percentileNearestRankSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    throw new Error('Cannot compute percentiles of an empty sample set.')
  }
  if (!(p >= 0 && p <= 1)) {
    throw new Error(`Percentile must be in [0,1] (got ${p}).`)
  }
  const i = Math.floor(p * (sorted.length - 1))
  return sorted[i]!
}

export function composeBioavailability(baseFraction: number, multipliers: number[]): number {
  if (!Number.isFinite(baseFraction)) {
    throw new Error('baseFraction must be a finite number.')
  }

  let v = baseFraction
  for (const m of multipliers) {
    if (!Number.isFinite(m)) {
      throw new Error('multiplier must be a finite number.')
    }
    v *= m
  }

  // Probability safety: effective BA is always within [0,1].
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

export function simulateEffectiveDose(opts: {
  doseMg: number
  baseFractionDist: Distribution
  multiplierDists: Distribution[]
  n: number
  seed: bigint
}): Percentiles {
  const { doseMg, baseFractionDist, multiplierDists, n, seed } = opts

  if (!(Number.isFinite(doseMg) && doseMg >= 0)) {
    throw new Error(`doseMg must be a finite non-negative number (got ${doseMg}).`)
  }
  if (!(Number.isInteger(n) && n > 0)) {
    throw new Error(`n must be a positive integer (got ${n}).`)
  }

  const rng = rngFromSeed(seed)
  const samples = new Array<number>(n)

  for (let i = 0; i < n; i++) {
    const base = sample(baseFractionDist, rng)
    const multipliers = multiplierDists.map((d) => sample(d, rng))
    const ba = composeBioavailability(base, multipliers)
    samples[i] = doseMg * ba
  }

  samples.sort((a, b) => a - b)

  return {
    p05: percentileNearestRankSorted(samples, 0.05),
    p50: percentileNearestRankSorted(samples, 0.5),
    p95: percentileNearestRankSorted(samples, 0.95),
  }
}

