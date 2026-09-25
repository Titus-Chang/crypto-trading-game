import type { Msg } from '../i18n'
import type { Rng } from './rng'

export type Tone = 'bull' | 'bear' | 'neutral' | 'alert'

export interface NewsFire {
  msg: Msg
  tone: Tone
  /** per-minute log-return push */
  force: number
  ticks: number
  fearGreed: number
  liquidity: number
  pressure: number
}

interface Template extends Omit<NewsFire, 'msg'> {
  key: string
  weight: number
}

const TEMPLATES: Template[] = [
  { key: 'ev.tweet', tone: 'bull', force: 0.0007, ticks: 40, fearGreed: 15, liquidity: 5, pressure: 0, weight: 1 },
  { key: 'ev.listing', tone: 'bull', force: 0.0004, ticks: 60, fearGreed: 8, liquidity: 6, pressure: 0, weight: 1.2 },
  { key: 'ev.rateCut', tone: 'bull', force: 0.00025, ticks: 90, fearGreed: 8, liquidity: 12, pressure: 0, weight: 1 },
  { key: 'ev.etf', tone: 'bull', force: 0.0005, ticks: 50, fearGreed: 10, liquidity: 4, pressure: 0, weight: 0.8 },
  { key: 'ev.whale', tone: 'bear', force: -0.0005, ticks: 50, fearGreed: -10, liquidity: 0, pressure: 0, weight: 1.2 },
  { key: 'ev.regulation', tone: 'bear', force: -0.0004, ticks: 60, fearGreed: -10, liquidity: -10, pressure: 10, weight: 1 },
  { key: 'ev.hack', tone: 'bear', force: -0.0006, ticks: 40, fearGreed: -15, liquidity: -6, pressure: 0, weight: 0.9 },
  { key: 'ev.cpi', tone: 'bear', force: -0.0003, ticks: 80, fearGreed: -8, liquidity: -10, pressure: 0, weight: 1 },
  { key: 'ev.coldWallet', tone: 'bear', force: -0.00025, ticks: 40, fearGreed: -6, liquidity: -3, pressure: 0, weight: 0.8 },
  { key: 'ev.retail', tone: 'neutral', force: 0.0001, ticks: 30, fearGreed: 12, liquidity: 3, pressure: 0, weight: 1 },
  { key: 'ev.openInterest', tone: 'neutral', force: 0, ticks: 1, fearGreed: 4, liquidity: 0, pressure: 5, weight: 1 },
  { key: 'ev.analyst', tone: 'neutral', force: 0, ticks: 1, fearGreed: 0, liquidity: 0, pressure: 0, weight: 0.8 },
]

/** Random macro and crypto headlines that nudge price, sentiment and liquidity. */
export class EventSystem {
  private nextAt: number

  constructor(
    rng: Rng,
    private readonly coin: string,
  ) {
    this.nextAt = rng.int(120, 220)
  }

  update(tick: number, rng: Rng): NewsFire | null {
    if (tick < this.nextAt) return null
    this.nextAt = tick + rng.int(150, 280)

    const total = TEMPLATES.reduce((s, t) => s + t.weight, 0)
    let r = rng.next() * total
    let tpl = TEMPLATES[0]
    for (const t of TEMPLATES) {
      r -= t.weight
      if (r <= 0) {
        tpl = t
        break
      }
    }
    const k = rng.range(0.7, 1.3)
    return {
      msg: { key: tpl.key, params: { coin: this.coin } },
      tone: tpl.tone,
      force: tpl.force * k,
      ticks: tpl.ticks,
      fearGreed: tpl.fearGreed,
      liquidity: tpl.liquidity,
      pressure: tpl.pressure,
    }
  }
}
