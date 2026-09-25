import { useGame } from '../../store/gameStore'

function anchor(target: 'player' | 'dealer') {
  const el = document.getElementById(target === 'player' ? 'player-bar' : 'dealer-bar')
  if (!el) return { left: 0, top: 0 }
  const r = el.getBoundingClientRect()
  return { left: target === 'player' ? r.left + r.width * 0.55 : r.left + r.width * 0.3, top: r.top + r.height * 0.55 }
}

export function FxLayer() {
  const toasts = useGame((s) => s.toasts)
  const floats = useGame((s) => s.floats)
  const banner = useGame((s) => s.banner)
  const flash = useGame((s) => s.flash)

  return (
    <>
      {banner && (
        <div key={banner.id} className={`banner ${banner.tone}`}>
          {banner.text}
          {banner.sub && <small>{banner.sub}</small>}
        </div>
      )}
      {flash > 0 && Date.now() - flash < 800 && <div key={flash} className="flash" />}
      {floats.map((f) => (
        <div key={f.id} className={`float ${f.up ? 'up' : 'down'}`} style={anchor(f.target)}>
          {f.text}
        </div>
      ))}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  )
}
