import type { Rng } from '../rng'
import type { CardCondition } from './cardDefs'

export const HAND_SIZE = 4

export interface HandCard {
  uid: number
  id: string
}

/** Draw pile / hand / discard. Hand slots stay in place; a used slot refills after a delay. */
export class CardDeck {
  drawPile: string[]
  discardPile: string[] = []
  readonly hand: (HandCard | null)[] = new Array(HAND_SIZE).fill(null)
  readonly refillAt: (number | null)[] = new Array(HAND_SIZE).fill(null)
  private uid = 1

  constructor(
    ids: readonly string[],
    private readonly rng: Rng,
  ) {
    this.drawPile = rng.shuffle([...ids])
    for (let i = 0; i < HAND_SIZE; i++) this.hand[i] = this.draw()
  }

  private draw(): HandCard | null {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length === 0) return null
      this.drawPile = this.rng.shuffle(this.discardPile)
      this.discardPile = []
    }
    const id = this.drawPile.pop()!
    return { uid: this.uid++, id }
  }

  /** Moves a hand card to the discard pile and schedules the slot to refill. */
  remove(index: number, tick: number, delay: number): string | null {
    const card = this.hand[index]
    if (!card) return null
    this.hand[index] = null
    this.discardPile.push(card.id)
    this.refillAt[index] = tick + delay
    return card.id
  }

  update(tick: number) {
    for (let i = 0; i < HAND_SIZE; i++) {
      const at = this.refillAt[i]
      if (this.hand[i] === null && at !== null && tick >= at) {
        this.hand[i] = this.draw()
        this.refillAt[i] = null
      }
    }
  }
}

export interface ConditionContext {
  emaCrossUp: boolean
  emaCrossDown: boolean
  bullEngulf: boolean
  bearEngulf: boolean
  rsi: number
  longRatio: number
  hasPosition: boolean
}

export function checkCondition(cond: CardCondition | undefined, c: ConditionContext): boolean {
  switch (cond) {
    case undefined:
      return true
    case 'emaCrossUp':
      return c.emaCrossUp
    case 'emaCrossDown':
      return c.emaCrossDown
    case 'bullEngulf':
      return c.bullEngulf
    case 'bearEngulf':
      return c.bearEngulf
    case 'rsiOversold':
      return c.rsi < 30
    case 'rsiOverbought':
      return c.rsi > 70
    case 'crowdShortHeavy':
      return c.longRatio < 0.45
    case 'crowdLongHeavy':
      return c.longRatio > 0.6
    case 'hasPosition':
      return c.hasPosition
  }
}
