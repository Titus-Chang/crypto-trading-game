import { describe, expect, it } from 'vitest'
import type { Candle } from '../candles'
import { bollinger, crossedWithin, ema, findFvgs, findStructure, isEngulfing, rsi } from '../indicators'

const candle = (o: number, h: number, l: number, c: number, t = 0): Candle => ({ t, o, h, l, c, v: 1 })

describe('ema', () => {
  it('seeds with SMA and then smooths', () => {
    const out = ema([1, 2, 3, 4, 5], 3)
    expect(out[0]).toBeNaN()
    expect(out[2]).toBeCloseTo(2, 9)
    expect(out[3]).toBeCloseTo(3, 9) // 4*0.5 + 2*0.5
    expect(out[4]).toBeCloseTo(4, 9)
  })
})

describe('rsi', () => {
  it('is 100 on a strictly rising series and 0 on a strictly falling one', () => {
    const up = Array.from({ length: 30 }, (_, i) => i + 1)
    expect(rsi(up, 14)[29]).toBe(100)
    const down = up.slice().reverse()
    expect(rsi(down, 14)[29]).toBeCloseTo(0, 9)
  })

  it('hovers around 50 when gains and losses balance', () => {
    // Alternating +1/-1 moves: Wilder smoothing oscillates just above/below 50.
    const vals = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 10 : 11))
    const out = rsi(vals, 14)
    expect(out[39]).toBeGreaterThan(50) // last move was up
    expect(out[38]).toBeLessThan(50) // last move was down
    expect(Math.abs(out[39] - 50)).toBeLessThan(4)
  })
})

describe('bollinger', () => {
  it('collapses to the mean on a flat series', () => {
    const b = bollinger(new Array(25).fill(5), 20, 2)
    expect(b.mid[24]).toBe(5)
    expect(b.upper[24]).toBe(5)
    expect(b.lower[24]).toBe(5)
  })
})

describe('crossover', () => {
  it('detects a recent cross up', () => {
    const fast = [1, 1, 1, 3, 3]
    const slow = [2, 2, 2, 2, 2]
    expect(crossedWithin(fast, slow, 3, 1)).toBe(true)
    expect(crossedWithin(fast, slow, 3, -1)).toBe(false)
    expect(crossedWithin(fast, slow, 1, 1)).toBe(false)
  })
})

describe('patterns', () => {
  it('recognises engulfing candles', () => {
    expect(isEngulfing([candle(10, 10.5, 9, 9.5), candle(9.4, 10.6, 9.3, 10.2)], 1)).toBe(true)
    expect(isEngulfing([candle(9.5, 10.5, 9, 10), candle(10.1, 10.2, 9.2, 9.4)], -1)).toBe(true)
    expect(isEngulfing([candle(10, 10.5, 9, 9.5), candle(9.6, 9.8, 9.5, 9.7)], 1)).toBe(false)
  })

  it('finds a bullish fair value gap and notices when it is filled', () => {
    const c = [candle(1, 1.01, 0.99, 1), candle(1, 1.05, 1, 1.05), candle(1.05, 1.08, 1.03, 1.07), candle(1.07, 1.07, 1.0, 1.0)]
    const gaps = findFvgs(c)
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ dir: 1, bottom: 1.01, top: 1.03, filledAt: 3 })
  })

  it('marks a break of structure above a swing high', () => {
    const highs = [1, 1.1, 1.2, 1.5, 1.2, 1.1, 1, 1.1, 1.2, 1.3, 1.6]
    const c = highs.map((h, i) => candle(h - 0.05, h, h - 0.1, h - 0.02, i))
    const marks = findStructure(c, 3)
    const up = marks.find((m) => m.dir === 1)
    expect(up).toBeDefined()
    expect(up!.price).toBe(1.5)
    expect(up!.index).toBe(10)
  })
})
