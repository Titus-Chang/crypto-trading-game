import { useRef } from 'react'
import { PAIR, PLAYER_CAPITAL, TICKS_PER_SECOND } from '../../engine/match'
import { useT } from '../../i18n/useT'
import { savePref, useGame } from '../../store/gameStore'
import { actions } from '../actions'
import { fmtClock, fmtPct, fmtPrice, fmtUsd } from '../format'
import { LangToggle } from '../LangToggle'

/**
 * Top strip: one tug-of-war bar for the zero-sum fight. The split point is the
 * player's share of the combined bankroll; pushing it to either end wins.
 */
export function VersusBar() {
  const match = useGame((s) => s.match)!
  useGame((s) => s.version)
  const muted = useGame((s) => s.muted)
  const set = useGame((s) => s.set)
  const t = useT()

  const prevPrice = useRef(match.price)
  const dir = useRef<'up' | 'down'>('up')
  if (match.price !== prevPrice.current) {
    dir.current = match.price > prevPrice.current ? 'up' : 'down'
    prevPrice.current = match.price
  }

  const d = match.difficulty
  const eq = match.playerEquity
  const dEq = match.dealerEquity
  const total = PLAYER_CAPITAL + d.dealerCapital
  const share = Math.max(0, Math.min(1, eq / total))
  const startShare = PLAYER_CAPITAL / total
  const pnl = eq / PLAYER_CAPITAL - 1
  const dPnl = dEq / d.dealerCapital - 1

  const pos = match.account.position
  const dist = pos ? Math.abs(match.price - pos.liq) / match.price : 1
  const danger = !!pos && dist < 0.015
  let status = t('hud.flat')
  if (pos) {
    status = t('hud.holding', { side: t(`side.${pos.side}`), lev: pos.leverage.toFixed(0), dist: (dist * 100).toFixed(2) })
    if (match.dealer.targetsPlayer && match.intentVisible) status += t('hud.targeted')
  }
  const ds = match.dealer.state
  const dealerState = match.revealActive || ds === 'stunned' || ds === 'regulated' ? t(`dealer.state.${ds}`) : t('hud.unknown')

  const sig = match.signals
  const chg = match.change24h
  const urgent = match.ticksLeft <= 20 * TICKS_PER_SECOND && match.status === 'running'

  return (
    <header className="versus">
      <div className="vs-side vs-player" id="player-bar">
        <div className="vs-avatar">🧑‍🚀</div>
        <div className="vs-info">
          <div className="vs-name">
            {t('hud.you')} <span>{t('hud.player')}</span>
          </div>
          <div className="vs-eq num">
            {fmtUsd(eq)} <small className={pnl >= 0 ? 'up' : 'down'}>{fmtPct(pnl)}</small>
          </div>
          <div className={`vs-status ${danger ? 'danger' : ''}`}>{status}</div>
        </div>
      </div>

      <div className="vs-center">
        <div className="tug" aria-label={`${(share * 100).toFixed(0)}%`}>
          <div className="tug-player" style={{ width: `${share * 100}%` }} />
          <div className="tug-dealer" style={{ width: `${(1 - share) * 100}%` }} />
          <div className="tug-start" style={{ left: `${startShare * 100}%` }} />
          <div className="tug-knot" style={{ left: `${share * 100}%` }} />
        </div>
        <div className="vs-row">
          <button className="icon-btn" title={t('hud.pause')} onClick={actions.togglePause} disabled={match.status === 'ready' || match.status === 'ended'}>
            {match.status === 'paused' ? '▶' : 'II'}
          </button>
          <div className={`timer ${urgent ? 'urgent' : ''}`}>{fmtClock(match.ticksLeft)}</div>
          <span className="pair">{PAIR}</span>
          <span className={`price-box ${dir.current}`}>{fmtPrice(match.price)}</span>
          <span className={`num ${chg >= 0 ? 'up' : 'down'}`}>
            {chg >= 0 ? '+' : ''}
            {(chg * 100).toFixed(2)}%
          </span>
          <span className="vs-divider" />
          <span className={`chip ${sig.rsi < 30 ? 'up' : sig.rsi > 70 ? 'down' : ''}`}>
            {t('chip.rsi')} <b className="num">{sig.rsi.toFixed(0)}</b> {t(sig.rsi < 30 ? 'rsi.oversold' : sig.rsi > 70 ? 'rsi.overbought' : 'rsi.neutral')}
          </span>
          <span className={`chip ${sig.trend > 0 ? 'up' : sig.trend < 0 ? 'down' : ''}`}>
            {t('chip.trend')} {t(sig.trend > 0 ? 'trend.bull' : sig.trend < 0 ? 'trend.bear' : 'trend.range')}
          </span>
          <span className="chip">
            {t('chip.funding')} <b className="num">{(match.fundingRate * 100).toFixed(3)}%</b>
          </span>
          <span className="chip">
            {t('chip.ratio')} <b className="num">{match.crowd.longRatio.toFixed(2)}</b>
          </span>
          <button
            className="icon-btn"
            title={t(muted ? 'hud.unmute' : 'hud.mute')}
            onClick={() => {
              set('muted', !muted)
              savePref('fg.muted', !muted)
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <LangToggle compact />
        </div>
      </div>

      <div className="vs-side vs-dealer" id="dealer-bar">
        <div className="vs-info">
          <div className="vs-name">
            <span>{t(`diff.${d.key}.title`)}</span> {t(`diff.${d.key}.dealer`)}
          </div>
          <div className="vs-eq num">
            <small className={dPnl >= 0 ? 'up' : 'down'}>{fmtPct(dPnl)}</small> {fmtUsd(dEq)}
          </div>
          <div className="vs-status">{t('hud.dealerIntent', { state: dealerState })}</div>
        </div>
        <div className="vs-avatar">{d.dealerAvatar}</div>
      </div>
    </header>
  )
}
