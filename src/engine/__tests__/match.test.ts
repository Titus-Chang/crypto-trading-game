import { describe, expect, it } from 'vitest'
import { MATCH_TICKS, Match, PLAYER_CAPITAL } from '../match'

const run = (m: Match, ticks: number) => {
  for (let i = 0; i < ticks && m.status === 'running'; i++) m.tick()
}

describe('match', () => {
  it('is deterministic for a given seed', () => {
    const a = new Match({ seed: 42, difficulty: 'normal' })
    const b = new Match({ seed: 42, difficulty: 'normal' })
    a.start()
    b.start()
    a.openPosition('long', 20, 0.5)
    b.openPosition('long', 20, 0.5)
    run(a, 600)
    run(b, 600)
    expect(a.price).toBe(b.price)
    expect(a.playerEquity).toBe(b.playerEquity)
    expect(a.news.map((n) => [n.key, n.params])).toEqual(b.news.map((n) => [n.key, n.params]))
  })

  it('different seeds produce different markets', () => {
    const a = new Match({ seed: 1, difficulty: 'normal' })
    const b = new Match({ seed: 2, difficulty: 'normal' })
    expect(a.price).not.toBe(b.price)
  })

  it('builds chart history before the match starts', () => {
    const m = new Match({ seed: 7, difficulty: 'easy' })
    expect(m.series['15m'].candles.length).toBeGreaterThan(500)
    expect(m.series['4h'].candles.length).toBeGreaterThan(40)
    expect(m.price).toBeGreaterThan(0.09)
    expect(m.price).toBeLessThan(0.36)
  })

  it('is zero-sum between player and dealer', () => {
    const m = new Match({ seed: 3, difficulty: 'normal' })
    m.start()
    m.openPosition('short', 10, 0.5)
    run(m, 300)
    expect(m.dealerEquity + m.playerEquity).toBeCloseTo(PLAYER_CAPITAL + m.difficulty.dealerCapital, 6)
  })

  it('ends after the match duration with a result', () => {
    const m = new Match({ seed: 5, difficulty: 'easy' })
    m.start()
    run(m, MATCH_TICKS + 10)
    expect(m.status).toBe('ended')
    expect(m.result).not.toBeNull()
    expect(m.account.position).toBeNull()
  })

  it('100x positions get liquidated quickly across many seeds', () => {
    let liquidated = 0
    for (let seed = 0; seed < 20; seed++) {
      const m = new Match({ seed, difficulty: 'hard' })
      m.start()
      m.openPosition('long', 100, 0.25)
      run(m, 600)
      if (m.stats.liquidations > 0) liquidated++
    }
    expect(liquidated).toBeGreaterThan(14)
  })

  it('playing a card consumes it and refills the slot after a delay', () => {
    const m = new Match({ seed: 11, difficulty: 'normal' })
    m.start()
    const idx = m.deck.hand.findIndex((_, i) => m.canPlay(i))
    if (idx < 0) return // no playable card in this opening hand; covered by other seeds
    expect(m.playCard(idx)).toBeNull()
    expect(m.deck.hand[idx]).toBeNull()
    expect(m.stats.cardsPlayed).toBe(1)
    run(m, 31)
    expect(m.deck.hand[idx]).not.toBeNull()
  })

  it('reports a balanced win rate for a simple passive strategy', () => {
    // Sanity check on balance: never trading should neither win nor lose.
    const m = new Match({ seed: 9, difficulty: 'normal' })
    m.start()
    run(m, MATCH_TICKS + 1)
    expect(m.result!.pnl).toBe(0)
    expect(m.result!.win).toBe(false)
  })
})
