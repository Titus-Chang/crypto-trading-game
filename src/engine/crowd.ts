import { MMR } from './position'
import type { Rng } from './rng'

/** A cluster of simulated retail liquidation orders sitting at one price bucket. */
export interface LiquidityZone {
  price: number
  amount: number
  /** whose positions get liquidated here */
  side: 'long' | 'short'
}

export interface Sweep {
  side: 'long' | 'short'
  amount: number
  price: number
}

const BUCKET = 0.0025
const LEVERAGE_MIX: [number, number][] = [
  [10, 0.3],
  [20, 0.3],
  [50, 0.25],
  [100, 0.15],
]

/** The rest of the market: trend-following retail traders and their liquidation levels. */
export class Crowd {
  longRatio = 0.55
  totalLiquidated = 0
  private readonly zoneMap = new Map<string, LiquidityZone>()

  update(tick: number, price: number, ret: number, fearGreed: number, rng: Rng) {
    this.longRatio += ret * 4 + (0.55 - this.longRatio) * 0.002 + rng.normal() * 0.003 + (fearGreed - 50) * 0.00002
    this.longRatio = Math.min(0.8, Math.max(0.2, this.longRatio))

    if (tick % 10 === 0) this.spawn(price, rng)
    if (tick % 10 === 5) this.decay(price)
  }

  private spawn(price: number, rng: Rng) {
    const base = rng.range(0.4, 1.6) * 1e6
    for (const [lev, w] of LEVERAGE_MIX) {
      this.add('long', price * (1 - 1 / lev + MMR), base * w * this.longRatio * 2 * rng.range(0.5, 1.5))
      this.add('short', price * (1 + 1 / lev - MMR), base * w * (1 - this.longRatio) * 2 * rng.range(0.5, 1.5))
    }
  }

  private add(side: 'long' | 'short', p: number, amount: number) {
    const k = Math.round(Math.log(p) / BUCKET)
    const key = side + k
    const z = this.zoneMap.get(key)
    if (z) z.amount += amount
    else this.zoneMap.set(key, { side, price: Math.exp(k * BUCKET), amount })
  }

  private decay(price: number) {
    for (const [key, z] of this.zoneMap) {
      z.amount *= 0.995
      if (z.amount < 2e5 || Math.abs(z.price / price - 1) > 0.2) this.zoneMap.delete(key)
    }
  }

  /** Removes every zone the bar traded through and returns what was liquidated. */
  sweep(high: number, low: number): Sweep[] {
    const out: Sweep[] = []
    for (const [key, z] of this.zoneMap) {
      if ((z.side === 'long' && low <= z.price) || (z.side === 'short' && high >= z.price)) {
        out.push({ side: z.side, amount: z.amount, price: z.price })
        this.totalLiquidated += z.amount
        this.zoneMap.delete(key)
      }
    }
    return out
  }

  get zones(): LiquidityZone[] {
    return [...this.zoneMap.values()]
  }

  /** Largest zone above (short liquidations) and below (long liquidations) the price. */
  biggest(price: number, maxDist = 0.08): { above: LiquidityZone | null; below: LiquidityZone | null } {
    let above: LiquidityZone | null = null
    let below: LiquidityZone | null = null
    for (const z of this.zoneMap.values()) {
      if (Math.abs(z.price / price - 1) > maxDist) continue
      if (z.price > price && (!above || z.amount > above.amount)) above = z
      if (z.price < price && (!below || z.amount > below.amount)) below = z
    }
    return { above, below }
  }
}
