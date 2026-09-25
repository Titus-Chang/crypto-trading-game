import { useT } from '../../i18n/useT'
import { useGame } from '../../store/gameStore'
import { fmtSimTime } from '../format'

/** Terminal-style market wire: newest line on top. */
export function TickerBar() {
  const match = useGame((s) => s.match)!
  useGame((s) => s.version)
  const t = useT()
  return (
    <section className="wire">
      <div className="wire-head">
        <span className="wire-live">● {t('ticker.live')}</span>
      </div>
      <div className="wire-list">
        {match.news.slice(0, 6).map((n) => (
          <div key={n.id} className={`wire-item ${n.tone}`}>
            <span className="num">{fmtSimTime(n.minute)}</span>
            <span className="wire-caret">›</span>
            <span className="wire-text">{t(n.key, n.params)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
