import type { LiquidityZone } from '../crowd'

/**
 * Picks the most attractive liquidation cluster to run price into: big and close,
 * but not so close that it will get swept by noise anyway.
 */
export function pickHuntZone(zones: readonly LiquidityZone[], price: number, maxDist = 0.06): LiquidityZone | null {
  let best: LiquidityZone | null = null
  let bestScore = 0
  for (const z of zones) {
    const dist = Math.abs(z.price / price - 1)
    if (dist < 0.004 || dist > maxDist) continue
    const score = z.amount / (dist + 0.01)
    if (score > bestScore) {
      bestScore = score
      best = z
    }
  }
  return best
}
