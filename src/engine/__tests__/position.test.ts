import { describe, expect, it } from 'vitest'
import { Account } from '../account'
import { MMR, createPosition, estimateLiq, liquidationPrice, mergePosition, roe, unrealizedPnl } from '../position'

describe('liquidation price', () => {
  it('long at 20x liquidates about 4.5% below entry', () => {
    const liq = estimateLiq('long', 0.175, 20)
    expect(liq).toBeCloseTo((0.175 * (1 - 1 / 20)) / (1 - MMR), 8)
    expect(liq / 0.175 - 1).toBeCloseTo(-0.0452, 3)
  })

  it('short at 20x liquidates about 4.5% above entry', () => {
    const liq = estimateLiq('short', 0.175, 20)
    expect(liq / 0.175 - 1).toBeCloseTo(0.0448, 3)
  })

  it('remaining margin equals maintenance margin at the liquidation price', () => {
    const pos = createPosition('long', 0.2, 1000, 50, 0)
    const pnl = unrealizedPnl(pos, pos.liq)
    expect(pos.margin + pnl).toBeCloseTo(MMR * pos.qty * pos.liq, 6)

    const short = createPosition('short', 0.2, 1000, 50, 0)
    expect(short.margin + unrealizedPnl(short, short.liq)).toBeCloseTo(MMR * short.qty * short.liq, 6)
  })

  it('higher leverage puts liquidation closer', () => {
    const d = (lev: number) => 1 - estimateLiq('long', 1, lev)
    expect(d(100)).toBeLessThan(d(50))
    expect(d(50)).toBeLessThan(d(10))
  })
})

describe('position math', () => {
  it('computes pnl and roe', () => {
    const pos = createPosition('long', 0.1, 100, 10, 0)
    expect(pos.qty).toBeCloseTo(10000, 6)
    expect(unrealizedPnl(pos, 0.11)).toBeCloseTo(100, 6)
    expect(roe(pos, 0.11)).toBeCloseTo(1, 6)
    const short = createPosition('short', 0.1, 100, 10, 0)
    expect(unrealizedPnl(short, 0.11)).toBeCloseTo(-100, 6)
  })

  it('merges with a weighted average entry', () => {
    const a = createPosition('long', 0.1, 100, 10, 0)
    const b = mergePosition(a, 0.12, 100, 10)
    const addQty = 1000 / 0.12
    expect(b.qty).toBeCloseTo(10000 + addQty, 6)
    expect(b.entry).toBeCloseTo((0.1 * 10000 + 0.12 * addQty) / (10000 + addQty), 9)
    expect(b.margin).toBe(200)
    expect(b.liq).toBeCloseTo(liquidationPrice('long', b.entry, b.qty, 200), 9)
  })
})

describe('account', () => {
  it('open then close at the same price loses only fees and slippage', () => {
    const acc = new Account(10000)
    expect(acc.open('long', 0.2, 0.5, 20, 0)).toBeNull()
    expect(acc.balance).toBeCloseTo(5000, 6)
    const pnl = acc.close(0.2, 1, 'close')
    expect(pnl).toBeLessThan(0)
    expect(pnl).toBeGreaterThan(-5000 * 20 * 0.0015)
    expect(acc.position).toBeNull()
  })

  it('liquidation wipes the margin; insurance refunds part of it', () => {
    const acc = new Account(10000)
    acc.open('long', 0.2, 0.5, 20, 0)
    const margin = acc.position!.margin
    expect(acc.liquidate(1, 0)).toBeCloseTo(margin, 6)
    expect(acc.balance).toBeCloseTo(5000, 6)

    const acc2 = new Account(10000)
    acc2.open('short', 0.2, 1, 10, 0)
    const m2 = acc2.position!.margin
    const loss = acc2.liquidate(1, 0.7)
    expect(loss).toBeCloseTo(m2 * 0.3, 6)
  })

  it('refuses an opposite-side order without closing first', () => {
    const acc = new Account(10000)
    acc.open('long', 0.2, 0.25, 5, 0)
    expect(acc.open('short', 0.2, 0.25, 5, 0)).not.toBeNull()
  })
})
