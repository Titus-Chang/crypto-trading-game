import { useT } from '../../i18n/useT'
import { useGame } from '../../store/gameStore'
import { fmtM, fmtPrice, fmtSimTime } from '../format'

const fgBucket = (v: number) => Math.min(4, Math.floor(v / 20))

/** Segmented horizontal fear & greed meter. */
function FearGreed({ value, label }: { value: number; label: string }) {
  const segs = 20
  const lit = Math.round((value / 100) * segs)
  return (
    <div className="fg">
      <div className="fg-head">
        <span className="fg-value num">{value.toFixed(0)}</span>
        <span className="fg-label">{label}</span>
      </div>
      <div className="fg-segs">
        {Array.from({ length: segs }, (_, i) => (
          <span key={i} className={i < lit ? `on s${Math.min(4, Math.floor((i / segs) * 5))}` : ''} />
        ))}
      </div>
    </div>
  )
}

function Meter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="meter" title={hint}>
      <div className="meter-head">
        <span>{label}</span>
        <b className="num">{value.toFixed(0)}</b>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export function Dashboard() {
  const match = useGame((s) => s.match)!
  useGame((s) => s.version)
  const t = useT()
  const d = match.dealer
  const revealed = match.revealActive
  const long = match.crowd.longRatio
  const feed = match.news.filter((n) => n.key.startsWith('news.cascade') || n.key.startsWith('news.liquidated') || n.key.startsWith('news.shielded')).slice(0, 6)

  return (
    <aside className="sidebar">
      <section className="side-block">
        <div className="side-title">{t('dash.fg')}</div>
        <FearGreed value={match.fearGreed} label={t(`fg.${fgBucket(match.fearGreed)}`)} />
      </section>

      <section className="side-block">
        <Meter label={t('dash.pressure')} value={d.pressure} hint={t('dash.pressureHint')} />
        <Meter label={t('dash.liquidity')} value={match.liquidity} hint={t('dash.liquidityHint')} />
        <div className="meter">
          <div className="meter-head">
            <span>{t('dash.ratio')}</span>
            <span className="num">
              <span className="up">{(long * 100).toFixed(0)}</span> / <span className="down">{((1 - long) * 100).toFixed(0)}</span>
            </span>
          </div>
          <div className="ratio-bar">
            <div className="ratio-long" style={{ width: `${long * 100}%` }} />
            <div className="ratio-short" />
          </div>
        </div>
      </section>

      <section className={`side-block intel ${revealed ? 'revealed' : ''}`}>
        <div className="side-title">{t(revealed ? 'dash.tracing' : 'dash.intel')}</div>
        {revealed ? (
          <>
            <div>
              {t('dash.state')} <b className="accent">{t(`dealer.state.${d.state}`)}</b>
              <span className="muted"> {(d.progress * 100).toFixed(0)}%</span>
            </div>
            <div>
              {t('dash.direction')}{' '}
              {d.direction > 0 ? <b className="up">{t('dash.up')}</b> : d.direction < 0 ? <b className="down">{t('dash.down')}</b> : <b className="muted">—</b>}
              {d.target !== null && (
                <>
                  {' '}
                  {t('dash.target')} <b className="num">{fmtPrice(d.target)}</b>
                </>
              )}
            </div>
          </>
        ) : match.intentVisible ? (
          <div>
            {t('dash.detected')} <b className="num">{d.target !== null ? fmtPrice(d.target) : '?'}</b>
          </div>
        ) : (
          <div className="muted">{t('dash.intelHint')}</div>
        )}
        <div className="muted small">{t('dash.regime', { regime: t(`regime.${match.market.regime}`) })}</div>
      </section>

      <section className="side-block side-feed">
        <div className="side-title">{t('feed.title')}</div>
        <div className="feed-list">
          {feed.length === 0 && <div className="muted small">{t('feed.empty')}</div>}
          {feed.map((n) => (
            <div key={n.id} className={`feed-item ${n.tone}`}>
              <span className="num muted">{fmtSimTime(n.minute)}</span> {t(n.key, n.params)}
            </div>
          ))}
        </div>
        <div className="liq-total">
          <span>{t('dash.totalLiq')}</span>
          <b className="num">{fmtM(match.crowd.totalLiquidated)}</b>
        </div>
      </section>
    </aside>
  )
}
