import type { Candle } from './candles'

export function ema(values: readonly number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN)
  if (values.length < period) return out
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  let prev = sum / period
  out[period - 1] = prev
  const k = 2 / (period + 1)
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

export interface Bands {
  mid: number[]
  upper: number[]
  lower: number[]
}

export function bollinger(values: readonly number[], period = 20, mult = 2): Bands {
  const n = values.length
  const mid = new Array<number>(n).fill(NaN)
  const upper = new Array<number>(n).fill(NaN)
  const lower = new Array<number>(n).fill(NaN)
  let sum = 0
  let sumSq = 0
  for (let i = 0; i < n; i++) {
    sum += values[i]
    sumSq += values[i] * values[i]
    if (i >= period) {
      sum -= values[i - period]
      sumSq -= values[i - period] * values[i - period]
    }
    if (i >= period - 1) {
      const m = sum / period
      const sd = Math.sqrt(Math.max(0, sumSq / period - m * m))
      mid[i] = m
      upper[i] = m + mult * sd
      lower[i] = m - mult * sd
    }
  }
  return { mid, upper, lower }
}

/** Wilder's RSI. */
export function rsi(values: readonly number[], period = 14): number[] {
  const out = new Array<number>(values.length).fill(NaN)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1]
    if (d >= 0) gain += d
    else loss -= d
  }
  gain /= period
  loss /= period
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]
    gain = (gain * (period - 1) + Math.max(d, 0)) / period
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  }
  return out
}

/** Fair value gap: a three-candle imbalance that price has not traded back through. */
export interface Fvg {
  index: number
  top: number
  bottom: number
  dir: 1 | -1
  filledAt: number | null
}

export function findFvgs(c: readonly Candle[], minGapPct = 0.0015): Fvg[] {
  const out: Fvg[] = []
  for (let i = 2; i < c.length; i++) {
    const a = c[i - 2]
    const b = c[i]
    if (b.l > a.h && (b.l - a.h) / a.h >= minGapPct) {
      out.push({ index: i - 1, top: b.l, bottom: a.h, dir: 1, filledAt: null })
    } else if (b.h < a.l && (a.l - b.h) / a.l >= minGapPct) {
      out.push({ index: i - 1, top: a.l, bottom: b.h, dir: -1, filledAt: null })
    }
  }
  for (const g of out) {
    for (let j = g.index + 2; j < c.length; j++) {
      if ((g.dir === 1 && c[j].l <= g.bottom) || (g.dir === -1 && c[j].h >= g.top)) {
        g.filledAt = j
        break
      }
    }
  }
  return out
}

/** Break of structure (trend continuation) / market structure shift (reversal). */
export interface StructureMark {
  index: number
  price: number
  dir: 1 | -1
  kind: 'BOS' | 'MSS'
}

export function findStructure(c: readonly Candle[], pivot = 3): StructureMark[] {
  const out: StructureMark[] = []
  let swingHigh: { price: number; broken: boolean } | null = null
  let swingLow: { price: number; broken: boolean } | null = null
  let trend: 1 | -1 | 0 = 0

  for (let i = 0; i < c.length; i++) {
    // Confirm the pivot that is `pivot` candles behind us.
    const p = i - pivot
    if (p >= pivot) {
      let isHigh = true
      let isLow = true
      for (let k = p - pivot; k <= p + pivot; k++) {
        if (k === p) continue
        if (c[k].h >= c[p].h) isHigh = false
        if (c[k].l <= c[p].l) isLow = false
      }
      if (isHigh) swingHigh = { price: c[p].h, broken: false }
      if (isLow) swingLow = { price: c[p].l, broken: false }
    }

    if (swingHigh && !swingHigh.broken && c[i].c > swingHigh.price) {
      swingHigh.broken = true
      out.push({ index: i, price: swingHigh.price, dir: 1, kind: trend === -1 ? 'MSS' : 'BOS' })
      trend = 1
    }
    if (swingLow && !swingLow.broken && c[i].c < swingLow.price) {
      swingLow.broken = true
      out.push({ index: i, price: swingLow.price, dir: -1, kind: trend === 1 ? 'MSS' : 'BOS' })
      trend = -1
    }
  }
  return out
}

/** True if `fast` crossed `slow` in direction `dir` within the last `lookback` values. */
export function crossedWithin(fast: readonly number[], slow: readonly number[], lookback: number, dir: 1 | -1): boolean {
  const n = fast.length
  for (let i = Math.max(1, n - lookback); i < n; i++) {
    const prev = fast[i - 1] - slow[i - 1]
    const cur = fast[i] - slow[i]
    if (Number.isNaN(prev) || Number.isNaN(cur)) continue
    if (dir === 1 && prev <= 0 && cur > 0) return true
    if (dir === -1 && prev >= 0 && cur < 0) return true
  }
  return false
}

/** Engulfing pattern on the last two candles passed in. */
export function isEngulfing(c: readonly Candle[], dir: 1 | -1): boolean {
  if (c.length < 2) return false
  const a = c[c.length - 2]
  const b = c[c.length - 1]
  if (dir === 1) return a.c < a.o && b.c > b.o && b.c >= a.o && b.o <= a.c
  return a.c > a.o && b.c < b.o && b.c <= a.o && b.o >= a.c
}
