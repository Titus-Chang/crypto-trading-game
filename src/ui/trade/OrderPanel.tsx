import { useT } from '../../i18n/useT'
import { useGame } from '../../store/gameStore'
import { actions } from '../actions'
import { sfx } from '../audio'
import { fmtUsd } from '../format'

const LEVERAGES = [5, 10, 20, 50, 100]
const SIZES = [0.25, 0.5, 1]

export function OrderPanel() {
  const match = useGame((s) => s.match)!
  useGame((s) => s.version)
  const leverage = useGame((s) => s.leverage)
  const sizePct = useGame((s) => s.sizePct)
  const set = useGame((s) => s.set)
  const t = useT()
  const running = match.status === 'running'
  const pos = match.account.position
  const balance = match.account.balance

  return (
    <div className="panel order-panel">
      <div className="trade-btns">
        <button className="trade-btn long" onClick={actions.long} disabled={!running}>
          {t('order.long')} <span className="kbd">Q</span>
        </button>
        <button className="trade-btn short" onClick={actions.short} disabled={!running}>
          {t('order.short')} <span className="kbd">E</span>
        </button>
      </div>
      <div className="sub-btns">
        <button className="btn" onClick={actions.close} disabled={!running || !pos}>
          {t('order.close')} <span className="kbd">W</span>
        </button>
        <button className="btn" onClick={actions.reverse} disabled={!running || !pos}>
          {t('order.reverse')} <span className="kbd">R</span>
        </button>
      </div>
      <div className="opt-row">
        <span>{t('order.leverage')}</span>
        <div className="opt-btns">
          {LEVERAGES.map((l) => (
            <button
              key={l}
              className={`btn ${l >= 50 ? 'hot' : ''} ${leverage === l ? 'active' : ''}`}
              onClick={() => {
                set('leverage', l)
                sfx.click()
              }}
            >
              {l}×
            </button>
          ))}
        </div>
      </div>
      <div className="opt-row">
        <span>{t('order.size')}</span>
        <div className="opt-btns">
          {SIZES.map((sz) => (
            <button
              key={sz}
              className={`btn ${sizePct === sz ? 'active' : ''}`}
              onClick={() => {
                set('sizePct', sz)
                sfx.click()
              }}
            >
              {sz * 100}%
            </button>
          ))}
        </div>
      </div>
      <div className="avail num">
        <span>{t('order.avail', { v: fmtUsd(balance) })}</span>
        <span>{t('order.margin', { v: fmtUsd(balance * sizePct) })}</span>
      </div>
    </div>
  )
}
