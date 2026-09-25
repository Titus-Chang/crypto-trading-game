import { CARD_MAP } from '../../engine/cards/cardDefs'
import { TICKS_PER_SECOND } from '../../engine/match'
import { estimateLiq, notional, roe, unrealizedPnl } from '../../engine/position'
import { useT } from '../../i18n/useT'
import { useGame } from '../../store/gameStore'
import { fmtCompact, fmtPct, fmtPrice, fmtSignedUsd } from '../format'

function ActiveEffects() {
  const match = useGame((s) => s.match)!
  const t = useT()
  if (match.effects.length === 0) return null
  return (
    <div className="effects">
      {match.effects.map((e) => (
        <span key={e.id} className="chip cyan" title={t(`card.${e.cardId}.desc`)}>
          {CARD_MAP[e.cardId].icon} {t(`card.${e.cardId}.name`)} {(e.remaining / TICKS_PER_SECOND).toFixed(0)}s
        </span>
      ))}
    </div>
  )
}

export function PositionPanel() {
  const match = useGame((s) => s.match)!
  useGame((s) => s.version)
  const leverage = useGame((s) => s.leverage)
  const sizePct = useGame((s) => s.sizePct)
  const t = useT()
  const pos = match.account.position
  const price = match.price

  if (!pos) {
    const longLiq = estimateLiq('long', price, leverage)
    const shortLiq = estimateLiq('short', price, leverage)
    return (
      <div className="panel pos-panel">
        <div className="pos-title">{t('pos.none')}</div>
        <div className="pos-row">
          <span className="up">{t('pos.longLiq')}</span>
          <span className="num">
            {fmtPrice(longLiq)} <span className="muted">{fmtPct(longLiq / price - 1)}</span>
          </span>
        </div>
        <div className="pos-row">
          <span className="down">{t('pos.shortLiq')}</span>
          <span className="num">
            {fmtPrice(shortLiq)} <span className="muted">{fmtPct(shortLiq / price - 1)}</span>
          </span>
        </div>
        <div className="pos-row">
          <span className="muted">{t('pos.notional')}</span>
          <span className="num">
            ${fmtCompact(match.account.balance * sizePct * leverage)} ({leverage}×)
          </span>
        </div>
        <ActiveEffects />
        <div className={`pos-warn ${leverage >= 50 ? 'danger' : ''}`}>{t('pos.warn')}</div>
      </div>
    )
  }

  const pnl = unrealizedPnl(pos, price)
  const r = roe(pos, price)
  const dist = Math.abs(price - pos.liq) / price

  return (
    <div className="panel pos-panel">
      <div className="pos-row">
        <span className={`chip ${pos.side === 'long' ? 'up' : 'down'}`}>
          {t(pos.side === 'long' ? 'pos.long' : 'pos.short')} {pos.leverage.toFixed(0)}×
        </span>
        <span className="muted num">${fmtCompact(notional(pos, price))}</span>
      </div>
      <div className={`pos-big ${pnl >= 0 ? 'up' : 'down'}`}>
        {fmtSignedUsd(pnl, 2)} <span style={{ fontSize: 14 }}>{fmtPct(r)}</span>
      </div>
      <div className="pos-row">
        <span className="muted">{t('pos.entry')}</span>
        <span className="num">{fmtPrice(pos.entry)}</span>
      </div>
      <div className="pos-row">
        <span className="muted">{t('pos.liq')}</span>
        <span className="num down">
          {fmtPrice(pos.liq)} <span className="muted">({(dist * 100).toFixed(2)}%)</span>
        </span>
      </div>
      <ActiveEffects />
      <div className={`pos-warn ${dist < 0.015 ? 'danger' : ''}`}>{t(dist < 0.015 ? 'pos.danger' : 'pos.warn')}</div>
    </div>
  )
}
