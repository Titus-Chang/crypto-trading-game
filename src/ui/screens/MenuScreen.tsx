import { useState } from 'react'
import { DIFFICULTIES, type DifficultyKey } from '../../engine/difficulty'
import { useT } from '../../i18n/useT'
import { useGame } from '../../store/gameStore'
import { sfx } from '../audio'
import { fmtPct } from '../format'
import { LangToggle } from '../LangToggle'

const STARS: Record<DifficultyKey, string> = { easy: '★☆☆', normal: '★★☆', hard: '★★★' }

export function MenuScreen() {
  const difficulty = useGame((s) => s.difficulty)
  const startMatch = useGame((s) => s.startMatch)
  const set = useGame((s) => s.set)
  const best = useGame((s) => s.best)
  const lang = useGame((s) => s.lang)
  const t = useT()
  const [pick, setPick] = useState<DifficultyKey>(difficulty)
  const [seed, setSeed] = useState('')

  const start = () => {
    sfx.open()
    const n = Number.parseInt(seed, 10)
    startMatch(pick, Number.isFinite(n) ? n : undefined)
  }

  return (
    <div className="menu">
      <div className="menu-lang">
        <LangToggle />
      </div>
      <div className="menu-inner">
        <div>
          <h1 className="title">LEEK STRIKES BACK</h1>
          {lang === 'zh' && <h2 className="title-cn">{t('app.title')}</h2>}
          <div className="vs">{t('app.subtitle')}</div>
        </div>

        <div className="diff-grid">
          {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((k) => {
            const d = DIFFICULTIES[k]
            const rec = best[k]
            return (
              <div
                key={k}
                role="button"
                tabIndex={0}
                className={`panel diff-card ${pick === k ? 'active' : ''}`}
                onClick={() => {
                  setPick(k)
                  sfx.click()
                }}
                onKeyDown={(e) => e.key === 'Enter' && start()}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="avatar">{d.dealerAvatar}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{t(`diff.${k}.label`)}</div>
                    <div className="stars">{STARS[k]}</div>
                  </div>
                  {rec && (
                    <div className="best-badge" title={t('menu.best', { grade: rec.grade, pnl: fmtPct(rec.pnlPct) })}>
                      {rec.grade}
                    </div>
                  )}
                </div>
                <div>
                  {t('menu.opponent')} <b>{t(`diff.${k}.dealer`)}</b>
                  <span className="muted"> · {t(`diff.${k}.title`)}</span>
                </div>
                <div className="muted">{t(`diff.${k}.desc`)}</div>
                <div className="num muted" style={{ fontSize: 11 }}>
                  {t('menu.capital', { capital: d.dealerCapital.toLocaleString('en-US') })}
                </div>
                {rec && (
                  <div className="num" style={{ fontSize: 11, color: 'var(--gold)' }}>
                    {t('menu.best', { grade: rec.grade, pnl: fmtPct(rec.pnlPct) })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="menu-actions">
          <button className="btn primary" onClick={start}>
            {t('menu.start')}
          </button>
          <button className="btn" onClick={() => set('tutorial', true)}>
            {t('menu.howto')}
          </button>
          <input
            className="btn num"
            style={{ width: 180, textAlign: 'center' }}
            placeholder={t('menu.seed')}
            value={seed}
            onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))}
            aria-label={t('menu.seed')}
          />
        </div>

        <p className="disclaimer">{t('menu.disclaimer')}</p>
      </div>
    </div>
  )
}
