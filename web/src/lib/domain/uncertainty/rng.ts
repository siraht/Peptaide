export type Rng = { next: () => number }

const MASK_64 = (1n << 64n) - 1n
const TWO_POW_53 = 9007199254740992 // 2^53

// splitmix64: fast, deterministic 64-bit generator suitable for seeding other algorithms.
// Reference implementation: public domain / widely used; this is a direct translation to BigInt.
function splitmix64(state: bigint): { state: bigint; output: bigint } {
  const nextState = (state + 0x9e3779b97f4a7c15n) & MASK_64
  let z = nextState
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK_64
  z = z ^ (z >> 31n)
  return { state: nextState, output: z & MASK_64 }
}

export function rngFromSeed(seed: bigint): Rng {
  let state = seed & MASK_64

  return {
    next() {
      const res = splitmix64(state)
      state = res.state
      // Convert top 53 bits to a JS float in [0, 1).
      const u53 = res.output >> 11n
      return Number(u53) / TWO_POW_53
    },
  }
}
