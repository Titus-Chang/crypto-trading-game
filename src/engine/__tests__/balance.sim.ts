import { it } from 'vitest'
import { MATCH_TICKS, Match } from '../match'

// Not a real test: prints balance numbers. Run with `npm run sim`.
type Bot = 'naive' | 'reader'

function play(seed: number, diff: 'easy' | 'normal' | 'hard', lev: number, bot: Bot) {
  const m = new Match({ seed, difficulty: diff })
  m.start()
  const start = m.price
  let hi = start, lo = start
  const states: Record<string, number> = {}
  for (let t = 0; t < MATCH_TICKS + 1 && m.status === 'running'; t++) {
    const huntedVisible = m.dealer.targetsPlayer && m.intentVisible
    if (bot === 'reader' && m.account.position && huntedVisible) m.closePosition()
    if (!m.account.position && t % 50 === 0 && m.account.balance > 200 && !(bot === 'reader' && huntedVisible)) {
      const last = m.series['15m'].candles.at(-2)!
      m.openPosition(last.c > last.o ? 'long' : 'short', lev, 0.5)
    }
    m.tick()
    hi = Math.max(hi, m.price); lo = Math.min(lo, m.price)
    states[m.dealer.state] = (states[m.dealer.state] ?? 0) + 1
  }
  return { m, range: (hi - lo) / start, states }
}

it('balance report', () => {
  const N = 60
  for (const diff of ['easy', 'normal', 'hard'] as const) {
    const totalStates: Record<string, number> = {}
    for (const lev of [5, 20, 50]) {
      for (const bot of ['naive', 'reader'] as Bot[]) {
        let liq = 0, pnl = 0, wins = 0, range = 0
        for (let seed = 0; seed < N; seed++) {
          const r = play(seed * 7919 + 13, diff, lev, bot)
          liq += r.m.stats.liquidations; pnl += r.m.result!.pnlPct; range += r.range
          if (r.m.result!.win) wins++
          if (lev === 20 && bot === 'naive') for (const [k, v] of Object.entries(r.states)) totalStates[k] = (totalStates[k] ?? 0) + v
        }
        console.log(`${diff.padEnd(6)} ${String(lev).padStart(3)}x ${bot.padEnd(6)} win=${(wins / N * 100).toFixed(0).padStart(3)}%  avgPnl=${(pnl / N * 100).toFixed(1).padStart(6)}%  liq=${(liq / N).toFixed(2)}  range=${(range / N * 100).toFixed(1)}%`)
      }
    }
    console.log('   states', JSON.stringify(Object.fromEntries(Object.entries(totalStates).map(([k, v]) => [k, (v / N / MATCH_TICKS * 100).toFixed(0) + '%']))))
  }
}, 300000)
