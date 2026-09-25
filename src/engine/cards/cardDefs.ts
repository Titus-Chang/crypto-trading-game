export type CardKind = 'ta' | 'strategy' | 'defense' | 'intel' | 'attack'
export type Rarity = 'common' | 'rare' | 'epic'

export type CardCondition =
  | 'emaCrossUp'
  | 'emaCrossDown'
  | 'bullEngulf'
  | 'bearEngulf'
  | 'rsiOversold'
  | 'rsiOverbought'
  | 'crowdShortHeavy'
  | 'crowdLongHeavy'
  | 'hasPosition'

/** Impulse strength is a per-minute log return; 0.0004 for 50 ticks ≈ 2%. */
export type CardEffect =
  | { type: 'impulse'; dir: 1 | -1; strength: number; ticks: number }
  | { type: 'shield'; ticks: number; refund: number }
  | { type: 'stopguard'; ticks: number; maxLoss: number }
  | { type: 'reveal'; ticks: number }
  | { type: 'stun'; ticks: number; pressure: number }
  | { type: 'calm'; ticks: number; volMult: number }
  | { type: 'sentiment'; fearGreed: number }

/** Display text (name, description, condition) lives in the i18n dictionaries under card.<id>.*. */
export interface CardDef {
  id: string
  kind: CardKind
  rarity: Rarity
  icon: string
  condition?: CardCondition
  effects: CardEffect[]
}

export const CARDS: CardDef[] = [
  {
    id: 'golden_cross',
    kind: 'ta',
    rarity: 'rare',
    icon: '✨',
    condition: 'emaCrossUp',
    effects: [{ type: 'impulse', dir: 1, strength: 0.0004, ticks: 50 }],
  },
  {
    id: 'death_cross',
    kind: 'ta',
    rarity: 'rare',
    icon: '💀',
    condition: 'emaCrossDown',
    effects: [{ type: 'impulse', dir: -1, strength: 0.0004, ticks: 50 }],
  },
  {
    id: 'bull_engulf',
    kind: 'ta',
    rarity: 'common',
    icon: '🐂',
    condition: 'bullEngulf',
    effects: [{ type: 'impulse', dir: 1, strength: 0.0006, ticks: 30 }],
  },
  {
    id: 'bear_engulf',
    kind: 'ta',
    rarity: 'common',
    icon: '🐻',
    condition: 'bearEngulf',
    effects: [{ type: 'impulse', dir: -1, strength: 0.0006, ticks: 30 }],
  },
  {
    id: 'rsi_oversold',
    kind: 'ta',
    rarity: 'rare',
    icon: '📈',
    condition: 'rsiOversold',
    effects: [{ type: 'impulse', dir: 1, strength: 0.0006, ticks: 40 }],
  },
  {
    id: 'rsi_overbought',
    kind: 'ta',
    rarity: 'rare',
    icon: '📉',
    condition: 'rsiOverbought',
    effects: [{ type: 'impulse', dir: -1, strength: 0.0006, ticks: 40 }],
  },
  {
    id: 'double_top',
    kind: 'strategy',
    rarity: 'common',
    icon: 'Ⓜ️',
    effects: [{ type: 'impulse', dir: -1, strength: 0.00035, ticks: 40 }],
  },
  {
    id: 'double_bottom',
    kind: 'strategy',
    rarity: 'common',
    icon: '🇼',
    effects: [{ type: 'impulse', dir: 1, strength: 0.00035, ticks: 40 }],
  },
  {
    id: 'stop_insurance',
    kind: 'defense',
    rarity: 'common',
    icon: '🛡️',
    effects: [{ type: 'shield', ticks: 450, refund: 0.7 }],
  },
  {
    id: 'stop_guard',
    kind: 'defense',
    rarity: 'common',
    icon: '🧷',
    condition: 'hasPosition',
    effects: [{ type: 'stopguard', ticks: 300, maxLoss: 0.4 }],
  },
  {
    id: 'cool_down',
    kind: 'defense',
    rarity: 'rare',
    icon: '🧊',
    effects: [{ type: 'calm', ticks: 80, volMult: 0.5 }],
  },
  {
    id: 'chain_trace',
    kind: 'intel',
    rarity: 'common',
    icon: '🔍',
    effects: [{ type: 'reveal', ticks: 150 }],
  },
  {
    id: 'whistle',
    kind: 'attack',
    rarity: 'rare',
    icon: '📣',
    effects: [{ type: 'stun', ticks: 60, pressure: 20 }],
  },
  {
    id: 'short_squeeze',
    kind: 'attack',
    rarity: 'epic',
    icon: '🚀',
    condition: 'crowdShortHeavy',
    effects: [{ type: 'impulse', dir: 1, strength: 0.001, ticks: 30 }],
  },
  {
    id: 'long_squeeze',
    kind: 'attack',
    rarity: 'epic',
    icon: '🩸',
    condition: 'crowdLongHeavy',
    effects: [{ type: 'impulse', dir: -1, strength: 0.001, ticks: 30 }],
  },
  {
    id: 'fomo',
    kind: 'strategy',
    rarity: 'common',
    icon: '🤑',
    effects: [
      { type: 'sentiment', fearGreed: 20 },
      { type: 'impulse', dir: 1, strength: 0.00033, ticks: 30 },
    ],
  },
  {
    id: 'panic',
    kind: 'strategy',
    rarity: 'common',
    icon: '😱',
    effects: [
      { type: 'sentiment', fearGreed: -20 },
      { type: 'impulse', dir: -1, strength: 0.00033, ticks: 30 },
    ],
  },
]

export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]))

/** Starter deck: 20 cards. */
export const STARTER_DECK: string[] = [
  'golden_cross',
  'death_cross',
  'bull_engulf',
  'bear_engulf',
  'rsi_oversold',
  'rsi_overbought',
  'double_top',
  'double_bottom',
  'stop_insurance',
  'stop_insurance',
  'stop_guard',
  'cool_down',
  'chain_trace',
  'chain_trace',
  'whistle',
  'whistle',
  'short_squeeze',
  'long_squeeze',
  'fomo',
  'panic',
]
