import { CARD_MAP, type CardKind } from '../../engine/cards/cardDefs'
import { checkCondition } from '../../engine/cards/cardEngine'
import { TICKS_PER_SECOND } from '../../engine/match'
import { translate } from '../../i18n'
import { useT } from '../../i18n/useT'
import { useGame } from '../../store/gameStore'
import { actions } from '../actions'

const KIND_COLOR: Record<CardKind, string> = {
  ta: '#ffb000',
  strategy: '#d9a36a',
  defense: '#a3e635',
  intel: '#7aa2c8',
  attack: '#ff5a4e',
}

/** Fanned hand: rotation (deg) and drop (px) per slot. */
const FAN = [
  [-6, 8],
  [-2, 1],
  [2, 1],
  [6, 8],
]

const RARITY_LABEL = { common: 'COMMON', rare: '★ RARE', epic: '★★ EPIC' }

const fan = (i: number) => ({ ['--rot' as string]: `${FAN[i][0]}deg`, ['--drop' as string]: `${FAN[i][1]}px` })

export function CardHand() {
  const match = useGame((s) => s.match)!
  useGame((s) => s.version)
  const lang = useGame((s) => s.lang)
  const t = useT()
  const deck = match.deck
  const running = match.status === 'running'

  return (
    <div className="hand">
      {deck.hand.map((card, i) => {
        if (!card) {
          const at = deck.refillAt[i]
          const left = at === null ? 0 : Math.max(0, (at - match.tickCount) / TICKS_PER_SECOND)
          return (
            <div key={`empty-${i}`} className="card-slot" style={fan(i)}>
              <div className="card-empty">{at === null ? t('card.empty') : t('card.refilling', { sec: left.toFixed(1) })}</div>
            </div>
          )
        }
        const def = CARD_MAP[card.id]
        const ok = checkCondition(def.condition, match.signals)
        const name = t(`card.${def.id}.name`)
        const desc = t(`card.${def.id}.desc`)
        return (
          <div key={card.uid} className="card-slot" style={fan(i)}>
            <button
              className={`card ${ok && running ? '' : 'locked'}`}
              style={{ ['--kind' as string]: KIND_COLOR[def.kind] }}
              onClick={() => actions.play(i)}
              title={`${name}: ${desc}`}
            >
              <div className="card-top">
                <span className="card-idx">{i + 1}</span>
                <span className={`card-rarity ${def.rarity}`}>{RARITY_LABEL[def.rarity]}</span>
                <span className="card-kind">{t(`kind.${def.kind}`)}</span>
              </div>
              <div className="card-art">{def.icon}</div>
              <div>
                <div className="card-name">{name}</div>
                {lang === 'zh' && <div className="card-en">{translate('en', `card.${def.id}.name`).toUpperCase()}</div>}
              </div>
              <div className="card-desc">{desc}</div>
              <div className={`card-cond ${def.condition ? (ok ? 'ok' : 'no') : 'ok'}`}>
                {def.condition ? `${ok ? '✓' : '✗'} ${t(`card.${def.id}.cond`)}` : t('card.anytime')}
              </div>
            </button>
            <button className="card-discard" title={t('card.discard')} onClick={() => actions.discard(i)} disabled={!running}>
              🗑
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function DeckPanel() {
  const match = useGame((s) => s.match)!
  useGame((s) => s.version)
  const t = useT()
  return (
    <div className="deck-panel">
      <div className="deck-stack">🂠</div>
      <div>
        {t('deck.draw')} <b className="num">{match.deck.drawPile.length}</b>
        <br />
        {t('deck.discard')} <b className="num">{match.deck.discardPile.length}</b>
      </div>
      <div style={{ fontSize: 10 }}>{t('deck.hint')}</div>
    </div>
  )
}
