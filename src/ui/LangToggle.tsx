import { LANGS, type Lang } from '../i18n'
import { useGame } from '../store/gameStore'
import { sfx } from './audio'

/** EN / 中文 switch. */
export function LangToggle({ compact }: { compact?: boolean }) {
  const lang = useGame((s) => s.lang)
  const setLang = useGame((s) => s.setLang)
  if (compact) {
    const next: Lang = lang === 'en' ? 'zh' : 'en'
    return (
      <button
        className="icon-btn lang-btn"
        title={LANGS[next].label}
        onClick={() => {
          setLang(next)
          sfx.click()
        }}
      >
        {LANGS[next].label}
      </button>
    )
  }
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {(Object.keys(LANGS) as Lang[]).map((l) => (
        <button
          key={l}
          className={`btn ${lang === l ? 'active' : ''}`}
          onClick={() => {
            setLang(l)
            sfx.click()
          }}
        >
          {LANGS[l].label}
        </button>
      ))}
    </div>
  )
}
