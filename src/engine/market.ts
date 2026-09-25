import type { Bar } from './candles'
import type { Rng } from './rng'

export type Regime = 'calm' | 'normal' | 'wild'

/** Per-minute log-return volatility for each regime. */
const REGIME_SIGMA: Record<Regime, number> = { calm: 0.0006, normal: 0.001, wild: 0.0017 }
const SUB_STEPS = 4
const BASE_VOLUME = 2.2e6
const ANCHOR_PULL = 0.0003

/**
 * Geometric Brownian motion with regime switching, rare jumps and a weak pull toward
 * the long-run anchor. External `force` (dealer, cards, news, cascades) is added to the
 * drift as a per-minute log return.
 */
export class Market {
  price: number
  regime: Regime = 'normal'
  private regimeLeft = 0

  constructor(
    private readonly rng: Rng,
    private readonly anchor: number,
  ) {
    this.price = anchor
  }

  step(force: number, volMult: number): Bar {
    const rng = this.rng
    if (--this.regimeLeft <= 0) {
      const r = rng.next()
      this.regime = r < 0.35 ? 'calm' : r < 0.8 ? 'normal' : 'wild'
      this.regimeLeft = rng.int(120, 480)
    }

    const sigma = REGIME_SIGMA[this.regime] * volMult
    const drift = force + ANCHOR_PULL * Math.log(this.anchor / this.price)
    const o = this.price
    let p = o
    let h = o
    let l = o
    for (let i = 0; i < SUB_STEPS; i++) {
      const jump = rng.chance(0.002) ? rng.normal() * sigma * 6 : 0
      p *= Math.exp(drift / SUB_STEPS + (sigma / Math.sqrt(SUB_STEPS)) * rng.normal() + jump)
      if (p > h) h = p
      if (p < l) l = p
    }
    this.price = p

    const move = Math.abs(Math.log(p / o)) / Math.max(sigma, 1e-6)
    const v = BASE_VOLUME * rng.range(0.6, 1.4) * (1 + move * 0.5) * volMult
    return { o, h, l, c: p, v }
  }
}
