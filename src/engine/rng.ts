/** Seedable PRNG (mulberry32) so a match can be replayed exactly from its seed. */
export interface Rng {
  next(): number
  normal(): number
  range(min: number, max: number): number
  int(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(arr: readonly T[]): T
  shuffle<T>(arr: T[]): T[]
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  let spare: number | null = null
  const normal = () => {
    if (spare !== null) {
      const v = spare
      spare = null
      return v
    }
    let u = 0
    while (u === 0) u = next()
    const v = next()
    const r = Math.sqrt(-2 * Math.log(u))
    spare = r * Math.sin(2 * Math.PI * v)
    return r * Math.cos(2 * Math.PI * v)
  }

  return {
    next,
    normal,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    },
  }
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31)
