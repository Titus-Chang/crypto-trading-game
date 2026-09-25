import {
  SLIPPAGE,
  TAKER_FEE,
  createPosition,
  liquidationPrice,
  mergePosition,
  sideSign,
  unrealizedPnl,
  type Position,
  type Side,
} from './position'

export type CloseReason = 'close' | 'reverse' | 'liquidation' | 'stopguard' | 'end'

export interface TradeRecord {
  side: Side
  entry: number
  exit: number
  pnl: number
  reason: CloseReason
  openedAt: number
  closedAt: number
}

export class Account {
  balance: number
  position: Position | null = null
  readonly trades: TradeRecord[] = []
  fees = 0

  constructor(readonly initial: number) {
    this.balance = initial
  }

  equity(price: number): number {
    const p = this.position
    return this.balance + (p ? Math.max(0, p.margin + unrealizedPnl(p, price)) : 0)
  }

  /** Opens or adds to a position. Returns an error message key, or null on success. */
  open(side: Side, price: number, sizePct: number, leverage: number, t: number): string | null {
    if (this.position && this.position.side !== side) return 'err.closeFirst'
    let margin = this.balance * sizePct
    if (margin < 5) return 'err.noFunds'
    const fill = price * (1 + sideSign(side) * SLIPPAGE)
    const fee = margin * leverage * TAKER_FEE
    this.balance -= margin
    margin -= fee
    this.fees += fee
    this.position = this.position
      ? mergePosition(this.position, fill, margin, leverage)
      : createPosition(side, fill, margin, leverage, t)
    return null
  }

  /** Closes at market. Returns net realized PnL. */
  close(price: number, t: number, reason: CloseReason): number {
    const pos = this.position
    if (!pos) return 0
    const fill = price * (1 - sideSign(pos.side) * SLIPPAGE)
    const gross = unrealizedPnl(pos, fill)
    const fee = pos.qty * fill * TAKER_FEE
    const returned = Math.max(0, pos.margin + gross - fee)
    this.balance += returned
    this.fees += fee
    const pnl = returned - pos.margin
    this.trades.push({ side: pos.side, entry: pos.entry, exit: fill, pnl, reason, openedAt: pos.openedAt, closedAt: t })
    this.position = null
    return pnl
  }

  /** Forced liquidation. `refundRatio` > 0 when protected by insurance. Returns the loss (positive). */
  liquidate(t: number, refundRatio: number): number {
    const pos = this.position
    if (!pos) return 0
    const refund = pos.margin * refundRatio
    this.balance += refund
    const pnl = refund - pos.margin
    this.trades.push({ side: pos.side, entry: pos.entry, exit: pos.liq, pnl, reason: 'liquidation', openedAt: pos.openedAt, closedAt: t })
    this.position = null
    return -pnl
  }

  /** Funding payment; positive rate means longs pay shorts. Taken out of position margin. */
  applyFunding(rate: number, price: number): number {
    const pos = this.position
    if (!pos) return 0
    const payment = pos.qty * price * rate * sideSign(pos.side)
    pos.margin = Math.max(0.01, pos.margin - payment)
    pos.liq = liquidationPrice(pos.side, pos.entry, pos.qty, pos.margin)
    return payment
  }
}
