export type DifficultyKey = 'easy' | 'normal' | 'hard'

/** Display text lives in the i18n dictionaries under diff.<key>.*. */
export interface Difficulty {
  key: DifficultyKey
  dealerAvatar: string
  dealerCapital: number
  /** strongest per-minute log-return push the dealer can apply */
  maxForce: number
  /** chance the dealer goes after the player's liquidation price when in range */
  aggression: number
  /** ticks of warning between "gathering" and the actual hunt */
  telegraphTicks: number
  /** chance a hunt is visibly telegraphed on the chart */
  telegraphVisible: number
  /** how close (fraction of price) the player's liquidation must be to get hunted */
  huntRange: number
  /** ticks after a hunt on the player before the dealer may target the player again */
  huntCooldown: number
}

export const DIFFICULTIES: Record<DifficultyKey, Difficulty> = {
  easy: {
    key: 'easy',
    dealerAvatar: '👴',
    dealerCapital: 15000,
    maxForce: 0.00016,
    aggression: 0.3,
    telegraphTicks: 50,
    telegraphVisible: 1,
    huntRange: 0.05,
    huntCooldown: 400,
  },
  normal: {
    key: 'normal',
    dealerAvatar: '😼',
    dealerCapital: 15000,
    maxForce: 0.00026,
    aggression: 0.5,
    telegraphTicks: 35,
    telegraphVisible: 0.7,
    huntRange: 0.07,
    huntCooldown: 250,
  },
  hard: {
    key: 'hard',
    dealerAvatar: '🐺',
    dealerCapital: 20000,
    maxForce: 0.00038,
    aggression: 0.75,
    telegraphTicks: 22,
    telegraphVisible: 0.4,
    huntRange: 0.09,
    huntCooldown: 150,
  },
}
