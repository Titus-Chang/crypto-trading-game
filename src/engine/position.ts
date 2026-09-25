/** Simplified USDT-margined perpetual rules, isolated margin. */
export type Side = 'long' | 'short'

export const MMR = 0.005
export const TAKER_FEE = 0.0005
export const SLIPPAGE = 0.0002

export interface Position {
  side: Side
  entry: number
  qty: number
  margin: number
  leverage: number
  liq: number
  openedAt: number
}

export const sideSign = (s: Side): 1 | -1 => (s === 'long' ? 1 : -1)

/**
 * Price where remaining margin equals maintenance margin:
 *   margin + dir * qty * (p - entry) = mmr * qty * p
 */
export function liquidationPrice(side: Side, entry: number, qty: number, margin: number, mmr = MMR): number {
  if (side === 'long') return Math.max(0, (entry - margin / qty) / (1 - mmr))
  return (entry + margin / qty) / (1 + mmr)
}

/** Liquidation price for a fresh position at `leverage`, before fees. */
export function estimateLiq(side: Side, entry: number, leverage: number, mmr = MMR): number {
  const qty = leverage / entry
  return liquidationPrice(side, entry, qty, 1, mmr)
}

export function createPosition(side: Side, fill: number, margin: number, leverage: number, t: number): Position {
  const qty = (margin * leverage) / fill
  return { side, entry: fill, qty, margin, leverage, liq: liquidationPrice(side, fill, qty, margin), openedAt: t }
}

/** Adds to an existing same-side position (weighted average entry). */
export function mergePosition(pos: Position, fill: number, margin: number, leverage: number): Position {
  const addQty = (margin * leverage) / fill
  const qty = pos.qty + addQty
  const entry = (pos.entry * pos.qty + fill * addQty) / qty
  const totalMargin = pos.margin + margin
  return {
    ...pos,
    entry,
    qty,
    margin: totalMargin,
    leverage: (qty * entry) / totalMargin,
    liq: liquidationPrice(pos.side, entry, qty, totalMargin),
  }
}

export const unrealizedPnl = (pos: Position, price: number) => sideSign(pos.side) * pos.qty * (price - pos.entry)
export const roe = (pos: Position, price: number) => unrealizedPnl(pos, price) / pos.margin
export const notional = (pos: Position, price: number) => pos.qty * price
