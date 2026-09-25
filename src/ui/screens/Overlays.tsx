import { useT } from '../../i18n/useT'
import { useGame } from '../../store/gameStore'
import { actions } from '../actions'
import { fmtPct, fmtSignedUsd } from '../format'

export function ReadyOverlay() {
  const match = useGame((s) => s.match)!
  const set = useGame((s) => s.set)
  const t = useT()
  const d = match.difficulty
  return (
    <div className="overlay ready-overlay">
      <div className="panel modal">
        <div className="avatar" style={{ width: 72, height: 72, fontSize: 40, borderColor: 'var(--pink)' }}>
          {d.dealerAvatar}
        </div>
        <h2 style={{ margin: 0 }}>
          {t(`diff.${d.key}.dealer`)} <span className="muted" style={{ fontSize: 14 }}>{t(`diff.${d.key}.title`)}</span>
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {t('ready.taunt')}
        </p>
        <p style={{ margin: 0 }}>{t('ready.stakes', { capital: d.dealerCapital.toLocaleString('en-US') })}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => set('tutorial', true)}>
            {t('ready.howto')}
          </button>
          <button className="btn primary" style={{ padding: '10px 32px', fontSize: 16 }} onClick={actions.start} autoFocus>
            {t('ready.fight')}
          </button>
        </div>
        <div className="muted num" style={{ fontSize: 11 }}>
          {t('ready.seed', { seed: match.seed })}
        </div>
      </div>
    </div>
  )
}

export function PausedOverlay() {
  const toMenu = useGame((s) => s.toMenu)
  const t = useT()
  return (
    <div className="overlay">
      <div className="panel modal" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h2 style={{ margin: 0 }}>{t('paused.title')}</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={toMenu}>
            {t('paused.quit')}
          </button>
          <button className="btn primary" onClick={actions.togglePause} autoFocus>
            {t('paused.resume')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ResultOverlay() {
  const match = useGame((s) => s.match)!
  const startMatch = useGame((s) => s.startMatch)
  const toMenu = useGame((s) => s.toMenu)
  const newBest = useGame((s) => s.newBest)
  const t = useT()
  const r = match.result!
  const s = r.stats
  const winRate = s.trades > 0 ? s.wins / s.trades : 0

  const stats: [string, React.ReactNode, string?][] = [
    ['stat.trades', s.trades],
    ['stat.winRate', `${(winRate * 100).toFixed(0)}%`],
    ['stat.liquidations', s.liquidations, s.liquidations > 0 ? 'down' : ''],
    ['stat.best', s.bestTrade > 0 ? fmtSignedUsd(s.bestTrade) : '—', s.bestTrade > 0 ? 'up' : 'muted'],
    ['stat.worst', s.worstTrade < 0 ? fmtSignedUsd(s.worstTrade) : '—', s.worstTrade < 0 ? 'down' : 'muted'],
    ['stat.drawdown', `${(s.maxDrawdown * 100).toFixed(0)}%`],
    ['stat.cards', s.cardsPlayed],
    ['stat.dodged', s.dealerHuntsDodged],
    ['stat.seed', `#${match.seed}`],
  ]

  return (
    <div className="overlay">
      <div className="panel modal result">
        <h1 className={`result-title ${r.win ? 'win' : 'lose'}`}>{t(r.win ? 'result.victory' : 'result.defeat')}</h1>
        <div>{t(r.reason.key, r.reason.params)}</div>
        <div className="grade">{r.grade}</div>
        {newBest && <div style={{ color: 'var(--gold)', fontWeight: 700 }}>{t('result.newBest')}</div>}
        <div className={`num ${r.pnl >= 0 ? 'up' : 'down'}`} style={{ fontSize: 26, fontWeight: 800 }}>
          {fmtSignedUsd(r.pnl)} ({fmtPct(r.pnlPct)})
        </div>
        <div className="stat-grid">
          {stats.map(([key, value, cls]) => (
            <div key={key} className="stat">
              <b className={`num ${cls ?? ''}`}>{value}</b>
              <span>{t(key)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn" onClick={toMenu}>
            {t('result.menu')}
          </button>
          <button className="btn" onClick={() => startMatch(match.difficulty.key, match.seed)}>
            {t('result.rematch')}
          </button>
          <button className="btn primary" onClick={() => startMatch(match.difficulty.key)} autoFocus>
            {t('result.again')}
          </button>
        </div>
      </div>
    </div>
  )
}
