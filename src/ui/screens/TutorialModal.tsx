import { useState } from 'react'
import { useT } from '../../i18n/useT'
import { savePref, useGame } from '../../store/gameStore'

const PAGE_COUNT = 5

/** Renders a tutorial body: lines starting with "- " become list items, others paragraphs. */
function Body({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let items: string[] = []
  const flush = () => {
    if (items.length) out.push(<ul key={`ul-${out.length}`}>{items.map((l, i) => <li key={i}>{l}</li>)}</ul>)
    items = []
  }
  for (const line of lines) {
    if (line.startsWith('- ')) items.push(line.slice(2))
    else {
      flush()
      out.push(<p key={`p-${out.length}`}>{line}</p>)
    }
  }
  flush()
  return <div>{out}</div>
}

export function TutorialModal() {
  const set = useGame((s) => s.set)
  const t = useT()
  const [page, setPage] = useState(0)
  const close = () => {
    savePref('fg.tutorialSeen', true)
    set('tutorial', false)
  }
  const last = page === PAGE_COUNT - 1

  return (
    <div className="overlay" onClick={close}>
      <div className="panel modal tutorial" onClick={(e) => e.stopPropagation()}>
        <h3>{t(`tut.${page}.title`)}</h3>
        <Body text={t(`tut.${page}.body`)} />
        <div className="dots">
          {Array.from({ length: PAGE_COUNT }, (_, i) => (
            <span key={i} className={i === page ? 'on' : ''} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={close}>
            {t('tut.skip')}
          </button>
          {page > 0 && (
            <button className="btn" onClick={() => setPage(page - 1)}>
              {t('tut.prev')}
            </button>
          )}
          <button className="btn primary" onClick={() => (last ? close() : setPage(page + 1))}>
            {t(last ? 'tut.done' : 'tut.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
