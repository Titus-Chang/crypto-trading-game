import type { Msg, Params } from '../i18n'
import { Account } from './account'
import { CandleSeries, type Bar } from './candles'
import { CARD_MAP, STARTER_DECK, type CardEffect } from './cards/cardDefs'
import { CardDeck, checkCondition, type ConditionContext } from './cards/cardEngine'
import { Crowd } from './crowd'
import { DealerAI } from './dealer/dealerAI'
import { DIFFICULTIES, type Difficulty, type DifficultyKey } from './difficulty'
import { EventSystem, type Tone } from './events'
import { crossedWithin, ema, isEngulfing, rsi } from './indicators'
import { Market } from './market'
import { roe, type Side } from './position'
import { createRng, type Rng } from './rng'

export type Timeframe = '15m' | '1h' | '4h'
export const TF_MINUTES: Record<Timeframe, number> = { '15m': 15, '1h': 60, '4h': 240 }

export const COIN = 'DOGGO'
export const PAIR = `${COIN}/USDT`
export const TICKS_PER_SECOND = 10
export const MATCH_SECONDS = 180
export const MATCH_TICKS = MATCH_SECONDS * TICKS_PER_SECOND
export const PLAYER_CAPITAL = 10000
export const START_PRICE = 0.18
/** Simulated minutes generated before the match so the chart has history. */
export const PREHISTORY_MINUTES = 12000
/** Simulated minute 0 corresponds to this UTC instant. */
export const SIM_EPOCH = Date.UTC(2026, 0, 1)
const DRAW_DELAY = 3 * TICKS_PER_SECOND
const FUNDING_INTERVAL = 480
const BANKRUPT_EQUITY = 100

export type MatchStatus = 'ready' | 'running' | 'paused' | 'ended'

export interface NewsItem extends Msg {
  id: number
  minute: number
  tone: Tone
}

export interface CascadeRecord {
  minute: number
  amount: number
  side: 'long' | 'short'
  price: number
}

export type FxEvent =
  | { type: 'liquidated'; loss: number; shielded: boolean }
  | { type: 'cascade'; amount: number; side: 'long' | 'short' }
  | { type: 'card'; cardId: string }
  | { type: 'open'; side: Side }
  | { type: 'close'; pnl: number; reason: 'close' | 'reverse' | 'stopguard' }
  | { type: 'dealerAlert' }
  | { type: 'news'; tone: Tone }
  | { type: 'end'; win: boolean }

export interface ActiveEffect {
  id: number
  cardId: string
  effect: CardEffect
  remaining: number
  total: number
}

export interface Signals extends ConditionContext {
  ema20: number
  ema50: number
  trend: 1 | -1 | 0
}

export interface MatchStats {
  trades: number
  wins: number
  liquidations: number
  cardsPlayed: number
  peakEquity: number
  maxDrawdown: number
  bestTrade: number
  worstTrade: number
  dealerHuntsDodged: number
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'

export interface MatchResult {
  win: boolean
  reason: Msg
  grade: Grade
  pnl: number
  pnlPct: number
  stats: MatchStats
}

interface Impulse {
  force: number
  remaining: number
}

export interface MatchOptions {
  seed: number
  difficulty: DifficultyKey
}

export class Match {
  readonly seed: number
  readonly difficulty: Difficulty
  readonly rng: Rng
  readonly market: Market
  readonly series: Record<Timeframe, CandleSeries>
  readonly crowd = new Crowd()
  readonly dealer: DealerAI
  readonly events: EventSystem
  readonly account = new Account(PLAYER_CAPITAL)
  readonly deck: CardDeck

  status: MatchStatus = 'ready'
  result: MatchResult | null = null
  tickCount = 0
  minute = 0
  fearGreed = 45
  liquidity = 50
  fundingRate = 0
  effects: ActiveEffect[] = []
  news: NewsItem[] = []
  lastCascade: CascadeRecord | null = null
  /** UI-facing event queue; the view drains it after each tick. */
  fx: FxEvent[] = []
  signals: Signals
  lastForce = 0
  lastVolMult = 1
  readonly stats: MatchStats = {
    trades: 0,
    wins: 0,
    liquidations: 0,
    cardsPlayed: 0,
    peakEquity: PLAYER_CAPITAL,
    maxDrawdown: 0,
    bestTrade: 0,
    worstTrade: 0,
    dealerHuntsDodged: 0,
  }

  private impulses: Impulse[] = []
  private fgOffset = 0
  private nextId = 1
  private lastLevel: number
  private levelCooldown = 0
  private wasHuntingPlayer = false
  private huntStartMinute = 0

  constructor(opts: MatchOptions) {
    this.seed = opts.seed
    this.difficulty = DIFFICULTIES[opts.difficulty]
    this.rng = createRng(opts.seed)
    this.market = new Market(this.rng, START_PRICE)
    this.series = {
      '15m': new CandleSeries(TF_MINUTES['15m']),
      '1h': new CandleSeries(TF_MINUTES['1h']),
      '4h': new CandleSeries(TF_MINUTES['4h']),
    }
    this.dealer = new DealerAI(this.difficulty)
    this.events = new EventSystem(this.rng, COIN)
    this.deck = new CardDeck(STARTER_DECK, this.rng)

    for (let m = 0; m < PREHISTORY_MINUTES; m++) {
      const bar = this.market.step(0, 1)
      this.minute = m
      this.feedSeries(bar)
      if (m > PREHISTORY_MINUTES - 1500) {
        this.crowd.update(m, bar.c, Math.log(bar.c / bar.o), this.fearGreed, this.rng)
        this.crowd.sweep(bar.h, bar.l)
      }
    }
    this.minute = PREHISTORY_MINUTES
    this.crowd.totalLiquidated = 0
    this.lastLevel = levelOf(this.price)
    this.signals = this.computeSignals()
    this.addNews('news.open', 'alert', { dealer: this.difficulty.key, capital: this.difficulty.dealerCapital.toLocaleString('en-US') })
  }

  // ---------------------------------------------------------------- getters

  get price(): number {
    return this.market.price
  }

  get playerEquity(): number {
    return this.account.equity(this.price)
  }

  /** Zero-sum: every dollar the player makes comes out of the dealer's stack. */
  get dealerEquity(): number {
    return this.difficulty.dealerCapital - (this.playerEquity - PLAYER_CAPITAL)
  }

  get ticksLeft(): number {
    return Math.max(0, MATCH_TICKS - this.tickCount)
  }

  get revealActive(): boolean {
    return this.effects.some((e) => e.effect.type === 'reveal')
  }

  /** Dealer intent is visible if revealed by a card, or the current hunt is telegraphed. */
  get intentVisible(): boolean {
    const s = this.dealer.state
    return this.revealActive || ((s === 'prepare' || s === 'hunt') && this.dealer.telegraphed)
  }

  /** Price 24 simulated hours ago, for the headline change figure. */
  get change24h(): number {
    const c = this.series['15m'].candles
    const ref = c[Math.max(0, c.length - 97)]
    return this.price / ref.c - 1
  }

  canPlay(index: number): boolean {
    const card = this.deck.hand[index]
    if (!card) return false
    return checkCondition(CARD_MAP[card.id].condition, this.signals)
  }

  // ---------------------------------------------------------------- lifecycle

  start() {
    if (this.status === 'ready') this.status = 'running'
  }

  togglePause() {
    if (this.status === 'running') this.status = 'paused'
    else if (this.status === 'paused') this.status = 'running'
  }

  tick() {
    if (this.status !== 'running') return
    this.tickCount++
    this.minute++
    const rng = this.rng

    // Dealer
    const d = this.dealer.update({
      price: this.price,
      rng,
      player: this.account.position,
      zones: this.crowd.zones,
      longRatio: this.crowd.longRatio,
    })
    if (d.alert) this.onDealerAlert(d.alert)
    let force = d.force
    let volMult = d.volMult * (1 + (50 - this.liquidity) / 120)

    // Card effects
    for (const e of this.effects) {
      if (e.effect.type === 'impulse') force += e.effect.dir * e.effect.strength
      if (e.effect.type === 'calm') volMult *= e.effect.volMult
      e.remaining--
    }
    this.effects = this.effects.filter((e) => e.remaining > 0)

    // News and cascade impulses
    const news = this.events.update(this.tickCount, rng)
    if (news) {
      this.addNews(news.msg.key, news.tone, news.msg.params)
      this.impulses.push({ force: news.force, remaining: news.ticks })
      this.fgOffset += news.fearGreed
      this.liquidity = clamp(this.liquidity + news.liquidity, 5, 95)
      this.dealer.pressure = clamp(this.dealer.pressure + news.pressure, 0, 100)
      this.fx.push({ type: 'news', tone: news.tone })
    }
    for (const imp of this.impulses) {
      force += imp.force
      imp.remaining--
    }
    this.impulses = this.impulses.filter((i) => i.remaining > 0)

    // Market
    this.lastForce = force
    this.lastVolMult = volMult
    const bar = this.market.step(force, volMult)
    this.feedSeries(bar)

    // Crowd and cascading liquidations
    this.crowd.update(this.minute, bar.c, Math.log(bar.c / bar.o), this.fearGreed, rng)
    this.handleSweeps(bar)

    this.checkPlayerRisk(bar)
    if (this.minute % FUNDING_INTERVAL === 0) this.settleFunding()
    this.fundingRate = clamp((this.crowd.longRatio - 0.5) * 0.004, -0.0075, 0.0075)

    this.updateSentiment()
    this.signals = this.computeSignals()
    this.deck.update(this.tickCount)
    this.levelNews()
    this.trackHunts()
    this.updateStats()
    this.checkEnd()
  }

  // ---------------------------------------------------------------- player actions

  openPosition(side: Side, leverage: number, sizePct: number): Msg | null {
    if (this.status !== 'running') return { key: 'err.notRunning' }
    const pos = this.account.position
    if (pos && pos.side !== side) this.closePosition('reverse')
    const err = this.account.open(side, this.price, sizePct, leverage, this.minute)
    if (err) return { key: err }
    this.fx.push({ type: 'open', side })
    return null
  }

  closePosition(reason: 'close' | 'reverse' = 'close'): Msg | null {
    if (this.status !== 'running') return { key: 'err.notRunning' }
    if (!this.account.position) return { key: 'err.noPosition' }
    const pnl = this.account.close(this.price, this.minute, reason)
    this.recordTrade(pnl)
    this.fx.push({ type: 'close', pnl, reason })
    return null
  }

  /** Close and open the opposite side with the same leverage, using all freed margin. */
  reversePosition(): Msg | null {
    const pos = this.account.position
    if (!pos) return { key: 'err.noPosition' }
    const lev = Math.round(pos.leverage)
    this.closePosition('reverse')
    return this.openPosition(pos.side === 'long' ? 'short' : 'long', lev, 1)
  }

  playCard(index: number): Msg | null {
    if (this.status !== 'running') return { key: 'err.notRunning' }
    const card = this.deck.hand[index]
    if (!card) return { key: 'err.refilling' }
    const def = CARD_MAP[card.id]
    if (!checkCondition(def.condition, this.signals)) return { key: 'err.condition', params: { cond: def.id } }

    this.deck.remove(index, this.tickCount, DRAW_DELAY)
    for (const effect of def.effects) this.applyEffect(def.id, effect)
    this.stats.cardsPlayed++
    this.fx.push({ type: 'card', cardId: def.id })
    this.addNews('news.cardPlayed', 'alert', { card: def.id })
    return null
  }

  discardCard(index: number): Msg | null {
    if (this.status !== 'running') return { key: 'err.notRunning' }
    return this.deck.remove(index, this.tickCount, DRAW_DELAY) ? null : { key: 'err.refilling' }
  }

  // ---------------------------------------------------------------- internals

  private applyEffect(cardId: string, effect: CardEffect) {
    switch (effect.type) {
      case 'stun':
        this.dealer.stun(effect.ticks, effect.pressure)
        this.addNews('news.stunned', 'bull', { sec: effect.ticks / TICKS_PER_SECOND })
        return
      case 'sentiment':
        this.fgOffset += effect.fearGreed
        return
      case 'impulse':
        this.effects.push({ id: this.nextId++, cardId, effect, remaining: effect.ticks, total: effect.ticks })
        return
      default:
        // Non-stacking buffs: replace an existing one of the same type.
        this.effects = this.effects.filter((e) => e.effect.type !== effect.type)
        this.effects.push({ id: this.nextId++, cardId, effect, remaining: effect.ticks, total: effect.ticks })
    }
  }

  private feedSeries(bar: Bar) {
    for (const s of Object.values(this.series)) s.push(this.minute, bar)
  }

  private handleSweeps(bar: Bar) {
    const swept = this.crowd.sweep(bar.h, bar.l)
    if (swept.length === 0) return
    for (const side of ['long', 'short'] as const) {
      const hit = swept.filter((s) => s.side === side)
      const amount = hit.reduce((a, s) => a + s.amount, 0)
      if (amount <= 0) continue
      // Forced selling (longs) or buying (shorts) pushes price further: a cascade.
      const dir = side === 'long' ? -1 : 1
      this.impulses.push({ force: dir * Math.min(amount * 1e-11, 0.0004), remaining: 12 })
      if (amount >= 3e6) {
        const at = hit[0].price
        this.lastCascade = { minute: this.minute, amount, side, price: at }
        this.addNews(side === 'long' ? 'news.cascadeLong' : 'news.cascadeShort', side === 'long' ? 'bear' : 'bull', {
          amount: (amount / 1e6).toFixed(2),
          price: at.toFixed(4),
        })
        this.fx.push({ type: 'cascade', amount, side })
      }
    }
  }

  private checkPlayerRisk(bar: Bar) {
    const pos = this.account.position
    if (!pos) return
    const hit = pos.side === 'long' ? bar.l <= pos.liq : bar.h >= pos.liq
    if (hit) {
      const shield = this.effects.find((e) => e.effect.type === 'shield')
      const refund = shield && shield.effect.type === 'shield' ? shield.effect.refund : 0
      const loss = this.account.liquidate(this.minute, refund)
      if (shield) this.effects = this.effects.filter((e) => e !== shield)
      this.stats.liquidations++
      this.recordTrade(-loss)
      this.fx.push({ type: 'liquidated', loss, shielded: !!shield })
      this.addNews(`news.${shield ? 'shielded' : 'liquidated'}${pos.side === 'long' ? 'Long' : 'Short'}`, 'alert', {
        price: pos.liq.toFixed(5),
        loss: loss.toFixed(0),
      })
      if (this.dealer.targetsPlayer) this.addNews('news.dealerTaunt', 'bear', { dealer: this.difficulty.key })
      return
    }

    const guard = this.effects.find((e) => e.effect.type === 'stopguard')
    if (guard && guard.effect.type === 'stopguard' && roe(pos, bar.c) <= -guard.effect.maxLoss) {
      const pnl = this.account.close(bar.c, this.minute, 'stopguard')
      this.effects = this.effects.filter((e) => e !== guard)
      this.recordTrade(pnl)
      this.fx.push({ type: 'close', pnl, reason: 'stopguard' })
      this.addNews('news.stopguard', 'alert', { pnl: `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(0)}` })
    }
  }

  private settleFunding() {
    const paid = this.account.applyFunding(this.fundingRate, this.price)
    if (paid !== 0) {
      this.addNews(paid > 0 ? 'news.fundingPaid' : 'news.fundingReceived', 'neutral', {
        rate: (this.fundingRate * 100).toFixed(3),
        amount: Math.abs(paid).toFixed(2),
      })
    }
  }

  private updateSentiment() {
    const c = this.series['15m'].candles
    const ret = Math.log(c[c.length - 1].c / c[Math.max(0, c.length - 9)].c)
    const target = clamp(50 + clamp(ret * 1500, -35, 35) + this.fgOffset, 0, 100)
    this.fgOffset *= 0.998
    this.fearGreed += (target - this.fearGreed) * 0.02
    this.liquidity = clamp(this.liquidity + this.rng.normal() * 0.15 + (50 - this.liquidity) * 0.001, 5, 95)
  }

  private computeSignals(): Signals {
    const candles = this.series['15m'].candles.slice(-150)
    const closes = candles.map((c) => c.c)
    const e20 = ema(closes, 20)
    const e50 = ema(closes, 50)
    const r = rsi(closes, 14)
    const closed = candles.slice(0, -1)
    const ema20 = e20[e20.length - 1]
    const ema50 = e50[e50.length - 1]
    const spread = (ema20 - ema50) / ema50
    return {
      ema20,
      ema50,
      trend: spread > 0.002 ? 1 : spread < -0.002 ? -1 : 0,
      rsi: r[r.length - 1],
      emaCrossUp: crossedWithin(e20, e50, 10, 1),
      emaCrossDown: crossedWithin(e20, e50, 10, -1),
      bullEngulf: isEngulfing(closed, 1),
      bearEngulf: isEngulfing(closed, -1),
      longRatio: this.crowd.longRatio,
      hasPosition: this.account.position !== null,
    }
  }

  private onDealerAlert(msg: Msg) {
    const s = this.dealer.state
    if (s === 'prepare' && !this.dealer.telegraphed && !this.revealActive) {
      this.addNews('alert.hidden', 'alert')
    } else {
      this.addNews(msg.key, 'alert', msg.params)
    }
    this.fx.push({ type: 'dealerAlert' })
  }

  /** Headlines when price crosses round numbers. */
  private levelNews() {
    if (this.levelCooldown > 0) this.levelCooldown--
    const lvl = levelOf(this.price)
    if (lvl === this.lastLevel) return
    const up = lvl > this.lastLevel
    this.lastLevel = lvl
    if (this.levelCooldown > 0) return
    this.levelCooldown = 60
    const p = (up ? lvl : lvl + 1) * LEVEL_STEP
    this.addNews(up ? 'news.levelUp' : 'news.levelDown', up ? 'bull' : 'bear', { coin: COIN, price: p.toFixed(4) })
  }

  /** Counts hunts on the player that ended without liquidating them. */
  private trackHunts() {
    const s = this.dealer.state
    const hunting = this.dealer.targetsPlayer && (s === 'prepare' || s === 'hunt' || s === 'fakeout')
    if (hunting && !this.wasHuntingPlayer) this.huntStartMinute = this.minute
    if (this.wasHuntingPlayer && !hunting) {
      const caught = this.account.trades.some((t) => t.reason === 'liquidation' && t.closedAt >= this.huntStartMinute)
      if (!caught) {
        this.stats.dealerHuntsDodged++
        this.addNews('news.huntDodged', 'bull')
      }
    }
    this.wasHuntingPlayer = hunting
  }

  private recordTrade(pnl: number) {
    this.stats.trades++
    if (pnl > 0) this.stats.wins++
    this.stats.bestTrade = Math.max(this.stats.bestTrade, pnl)
    this.stats.worstTrade = Math.min(this.stats.worstTrade, pnl)
  }

  private updateStats() {
    const eq = this.playerEquity
    this.stats.peakEquity = Math.max(this.stats.peakEquity, eq)
    this.stats.maxDrawdown = Math.max(this.stats.maxDrawdown, 1 - eq / this.stats.peakEquity)
  }

  private checkEnd() {
    if (this.dealerEquity <= 0) {
      if (this.account.position) this.closePosition()
      return this.finish(true, { key: 'result.dealerBroke', params: { dealer: this.difficulty.key } })
    }
    if (!this.account.position && this.account.balance < BANKRUPT_EQUITY) {
      return this.finish(false, { key: 'result.bankrupt' })
    }
    if (this.tickCount >= MATCH_TICKS) {
      if (this.account.position) {
        const pnl = this.account.close(this.price, this.minute, 'end')
        this.recordTrade(pnl)
      }
      const pnl = this.playerEquity - PLAYER_CAPITAL
      return this.finish(pnl > 0, { key: pnl > 0 ? 'result.timeWin' : 'result.timeLose' })
    }
  }

  private finish(win: boolean, reason: Msg) {
    const pnl = this.playerEquity - PLAYER_CAPITAL
    const pnlPct = pnl / PLAYER_CAPITAL
    this.status = 'ended'
    this.result = { win, reason, grade: gradeFor(pnlPct, win), pnl, pnlPct, stats: { ...this.stats } }
    this.fx.push({ type: 'end', win })
  }

  private addNews(key: string, tone: Tone, params?: Params) {
    this.news.unshift({ id: this.nextId++, minute: this.minute, key, params, tone })
    if (this.news.length > 40) this.news.pop()
  }
}

const LEVEL_STEP = 0.005
const levelOf = (p: number) => Math.floor(p / LEVEL_STEP)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function gradeFor(pnlPct: number, win: boolean): Grade {
  if (win && pnlPct >= 1) return 'S'
  if (pnlPct >= 0.4) return 'A'
  if (pnlPct >= 0.15) return 'B'
  if (pnlPct > 0) return 'C'
  if (pnlPct > -0.5) return 'D'
  return 'F'
}
