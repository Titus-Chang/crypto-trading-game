import { describe, expect, it } from 'vitest'
import { LANGS, translate } from '../../i18n'
import { en } from '../../i18n/en'
import { zh } from '../../i18n/zh'
import { CARDS } from '../cards/cardDefs'
import { DIFFICULTIES } from '../difficulty'
import { MATCH_TICKS, Match } from '../match'

describe('i18n', () => {
  it('English and Chinese define exactly the same keys', () => {
    const e = Object.keys(en).sort()
    const z = Object.keys(zh).sort()
    expect(e.filter((k) => !zh[k])).toEqual([])
    expect(z.filter((k) => !en[k])).toEqual([])
  })

  it('every card and difficulty has text', () => {
    for (const lang of Object.keys(LANGS) as (keyof typeof LANGS)[]) {
      const dict = LANGS[lang].dict
      for (const c of CARDS) {
        expect(dict[`card.${c.id}.name`], `${lang} ${c.id}.name`).toBeTruthy()
        expect(dict[`card.${c.id}.desc`], `${lang} ${c.id}.desc`).toBeTruthy()
        if (c.condition) expect(dict[`card.${c.id}.cond`], `${lang} ${c.id}.cond`).toBeTruthy()
      }
      for (const k of Object.keys(DIFFICULTIES)) {
        for (const f of ['label', 'desc', 'dealer', 'title']) expect(dict[`diff.${k}.${f}`], `${lang} diff.${k}.${f}`).toBeTruthy()
      }
    }
  })

  it('translates id parameters and interpolates values', () => {
    expect(translate('en', 'news.cardPlayed', { card: 'golden_cross' })).toBe('🃏 You played [Golden Cross]')
    expect(translate('zh', 'news.cardPlayed', { card: 'golden_cross' })).toBe('🃏 你打出【黃金交叉】')
    expect(translate('en', 'err.condition', { cond: 'rsi_oversold' })).toBe('Condition not met: RSI(14) below 30')
  })

  it('every message the engine emits during real matches has a translation', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 12; seed++) {
      const m = new Match({ seed, difficulty: seed % 3 === 0 ? 'easy' : seed % 3 === 1 ? 'normal' : 'hard' })
      m.start()
      for (let t = 0; t < MATCH_TICKS && m.status === 'running'; t++) {
        if (t % 120 === 0 && !m.account.position) m.openPosition(t % 240 === 0 ? 'long' : 'short', 50, 0.5)
        if (t % 90 === 0) for (let i = 0; i < 4; i++) m.playCard(i)
        m.tick()
      }
      for (const n of m.news) seen.add(n.key)
      if (m.result) seen.add(m.result.reason.key)
    }
    const missing = [...seen].filter((k) => !en[k] || !zh[k])
    expect(missing).toEqual([])
    expect(seen.size).toBeGreaterThan(15)
  })
})
