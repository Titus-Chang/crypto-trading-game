import { useGame } from '../store/gameStore'

/** Toggle with the backtick key. Shows hidden engine state for balance tuning. */
export function DebugPanel() {
  const match = useGame((s) => s.match)!
  useGame((s) => s.version)
  const speed = useGame((s) => s.speed)
  const set = useGame((s) => s.set)
  const d = match.dealer
  const rows: [string, string][] = [
    ['seed', String(match.seed)],
    ['tick', `${match.tickCount}`],
    ['dealer', d.state],
    ['progress', `${(d.progress * 100).toFixed(0)}%`],
    ['target', d.target ? d.target.toFixed(5) : '-'],
    ['targetsPlayer', String(d.targetsPlayer)],
    ['telegraphed', String(d.telegraphed)],
    ['pressure', d.pressure.toFixed(1)],
    ['dealerForce', (d.lastForce * 1e4).toFixed(2) + ' bp/min'],
    ['totalForce', (match.lastForce * 1e4).toFixed(2) + ' bp/min'],
    ['volMult', match.lastVolMult.toFixed(2)],
    ['regime', match.market.regime],
    ['zones', String(match.crowd.zones.length)],
    ['fearGreed', match.fearGreed.toFixed(1)],
  ]
  return (
    <div className="panel debug">
      <b>DEBUG (` to close)</b>
      {rows.map(([k, v]) => (
        <div key={k} className="row">
          <span className="muted">{k}</span>
          <span>{v}</span>
        </div>
      ))}
      <div className="row" style={{ marginTop: 6, gap: 4 }}>
        {[0.5, 1, 2, 4].map((s) => (
          <button key={s} className={`btn ${speed === s ? 'active' : ''}`} style={{ padding: '2px 6px' }} onClick={() => set('speed', s)}>
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
