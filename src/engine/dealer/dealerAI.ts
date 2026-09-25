import type { Msg } from '../../i18n'
import type { LiquidityZone } from '../crowd'
import type { Difficulty } from '../difficulty'
import type { Position } from '../position'
import type { Rng } from '../rng'
import { pickHuntZone } from './strategies'

export type DealerState =
  | 'accumulate'
  | 'prepare'
  | 'hunt'
  | 'fakeout'
  | 'pump'
  | 'dump'
  | 'distribute'
  | 'stunned'
  | 'regulated'

export interface DealerContext {
  price: number
  rng: Rng
  player: Position | null
  zones: readonly LiquidityZone[]
  longRatio: number
}

export interface DealerOutput {
  force: number
  volMult: number
  /** headline for the news ticker, if the dealer just did something visible */
  alert: Msg | null
}

const HUNT_TIMEOUT = 300
const FAKEOUT_TICKS = 60
const REGULATED_TICKS = 150

/**
 * The market maker. A small state machine: it picks a plan (hunt a liquidity zone or the
 * player's liquidation price, pump/dump against the crowd, chop, or sit still), telegraphs
 * hunts before executing them so an attentive player can counter, and gets forced to calm
 * down when regulatory pressure builds up.
 */
export class DealerAI {
  state: DealerState = 'accumulate'
  target: number | null = null
  targetsPlayer = false
  /** whether the current hunt is visible on the chart without an intel card */
  telegraphed = false
  pressure = 20
  lastForce = 0
  private timer = 0
  private duration = 150
  private anchor = 0
  private dir: 1 | -1 = 1
  private playerCooldown = 0

  constructor(private readonly diff: Difficulty) {}

  get progress(): number {
    return this.duration > 0 ? Math.min(1, this.timer / this.duration) : 0
  }

  get direction(): 1 | -1 | 0 {
    switch (this.state) {
      case 'prepare':
      case 'hunt':
        return this.dir
      case 'fakeout':
        return this.dir === 1 ? -1 : 1
      case 'pump':
        return 1
      case 'dump':
        return -1
      default:
        return 0
    }
  }

  stun(ticks: number, pressure: number) {
    this.enter('stunned', ticks)
    this.target = null
    this.targetsPlayer = false
    this.pressure = Math.min(100, this.pressure + pressure)
  }

  update(ctx: DealerContext): DealerOutput {
    this.timer++
    if (this.playerCooldown > 0) this.playerCooldown--
    this.pressure = Math.max(0, this.pressure - 0.012)
    if (this.anchor === 0) this.anchor = ctx.price

    let alert: Msg | null = null
    if (this.pressure >= 90 && this.state !== 'regulated' && this.state !== 'stunned') {
      this.enter('regulated', REGULATED_TICKS)
      this.target = null
      this.targetsPlayer = false
      alert = { key: 'alert.regulated' }
    } else if (this.timer >= this.duration) {
      alert = this.transition(ctx)
    }

    const out = this.act(ctx)
    if (out.next) alert = this.transition(ctx) ?? alert
    this.lastForce = out.force
    this.pressure = Math.min(100, this.pressure + (Math.abs(out.force) / this.diff.maxForce) * 0.025)
    return { force: out.force, volMult: out.volMult, alert }
  }

  private act(ctx: DealerContext): { force: number; volMult: number; next?: boolean } {
    const max = this.diff.maxForce
    const lnP = Math.log(ctx.price)
    switch (this.state) {
      case 'accumulate':
        return { force: clamp((Math.log(this.anchor) - lnP) * 0.03, max * 0.5), volMult: 0.7 }
      case 'prepare':
        // Push slightly the other way first, to lure traders into the trap.
        return { force: -this.dir * max * 0.15, volMult: 0.8 }
      case 'hunt': {
        const gap = Math.log(this.target ?? ctx.price) - lnP
        if (Math.sign(gap) !== this.dir) {
          this.enter('fakeout', FAKEOUT_TICKS)
          return { force: 0, volMult: 1.2 }
        }
        return { force: this.dir * Math.min(max, Math.abs(gap) / 15 + max * 0.3), volMult: 1.1 }
      }
      case 'fakeout':
        return { force: -this.dir * max * 0.8, volMult: 1.2 }
      case 'pump':
        return { force: max * 0.55, volMult: 1 }
      case 'dump':
        return { force: -max * 0.55, volMult: 1 }
      case 'distribute':
        return { force: 0, volMult: 1.6 }
      case 'stunned':
        return { force: 0, volMult: 0.9 }
      case 'regulated':
        return { force: clamp((Math.log(this.anchor) - lnP) * 0.01, max * 0.2), volMult: 0.6 }
    }
  }

  private transition(ctx: DealerContext): Msg | null {
    if (this.state === 'prepare') {
      this.enter('hunt', HUNT_TIMEOUT)
      return null
    }
    return this.choose(ctx)
  }

  private choose(ctx: DealerContext): Msg | null {
    const { rng, price, player } = ctx
    const d = this.diff
    if (this.targetsPlayer) this.playerCooldown = d.huntCooldown
    this.target = null
    this.targetsPlayer = false

    if (player && this.playerCooldown === 0) {
      const dist = Math.abs(player.liq - price) / price
      if (dist < d.huntRange && rng.chance(d.aggression)) {
        this.dir = player.side === 'long' ? -1 : 1
        this.target = player.liq * (1 + this.dir * 0.004)
        this.targetsPlayer = true
        return this.startPrepare(rng, {
          key: player.side === 'long' ? 'alert.huntPlayerLong' : 'alert.huntPlayerShort',
          params: { price: player.liq.toFixed(5) },
        })
      }
    }

    const zone = pickHuntZone(ctx.zones, price)
    const roll = rng.next()
    if (zone && roll < 0.3) {
      this.dir = zone.price > price ? 1 : -1
      this.target = zone.price * (1 + this.dir * 0.002)
      return this.startPrepare(rng, {
        key: zone.side === 'long' ? 'alert.huntZoneLong' : 'alert.huntZoneShort',
        params: { price: zone.price.toFixed(4), amount: (zone.amount / 1e6).toFixed(1) },
      })
    }
    if (roll < 0.58) {
      const dir = ctx.longRatio > 0.52 ? -1 : ctx.longRatio < 0.48 ? 1 : rng.chance(0.5) ? 1 : -1
      this.enter(dir > 0 ? 'pump' : 'dump', rng.int(120, 220))
      return { key: dir > 0 ? 'alert.pump' : 'alert.dump' }
    }
    if (roll < 0.75) {
      this.enter('distribute', rng.int(80, 160))
      return null
    }
    this.enter('accumulate', rng.int(100, 220))
    this.anchor = price
    return null
  }

  private startPrepare(rng: Rng, msg: Msg): Msg {
    this.enter('prepare', this.diff.telegraphTicks)
    this.telegraphed = rng.chance(this.diff.telegraphVisible)
    return msg
  }

  private enter(state: DealerState, duration: number) {
    this.state = state
    this.timer = 0
    this.duration = duration
  }
}

const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v))
