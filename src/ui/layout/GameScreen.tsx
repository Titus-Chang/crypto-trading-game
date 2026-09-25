import { useEffect, useRef } from 'react'
import { PLAYER_CAPITAL, TICKS_PER_SECOND } from '../../engine/match'
import { useGame } from '../../store/gameStore'
import { actions, handleFx } from '../actions'
import { CardHand, DeckPanel } from '../cards/CardHand'
import { ChartPanel } from '../chart/ChartPanel'
import { Dashboard } from '../dashboard/Dashboard'
import { DebugPanel } from '../DebugPanel'
import { fmtSignedUsd } from '../format'
import { FxLayer } from '../fx/FxLayer'
import { TickerBar } from '../hud/TickerBar'
import { VersusBar } from '../hud/VersusBar'
import { PausedOverlay, ReadyOverlay, ResultOverlay } from '../screens/Overlays'
import { PositionPanel } from '../trade/PositionPanel'
import { OrderPanel } from '../trade/OrderPanel'

/** Drives the engine at a fixed tick rate from requestAnimationFrame. */
function useGameLoop() {
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    let eqMark = PLAYER_CAPITAL
    let markTick = 0
    const frame = (now: number) => {
      const s = useGame.getState()
      const m = s.match
      const dt = Math.min(250, now - last)
      last = now
      if (m && m.status === 'running') {
        acc += dt
        const step = 1000 / (TICKS_PER_SECOND * s.speed)
        let ticked = false
        while (acc >= step && m.status === 'running') {
          acc -= step
          m.tick()
          ticked = true
        }
        if (ticked) {
          if (m.fx.length) handleFx(m.fx.splice(0))
          // Damage numbers: summarise equity swings every half second.
          if (m.tickCount - markTick >= 5) {
            const eq = m.playerEquity
            const delta = eq - eqMark
            if (Math.abs(delta) >= 40) {
              s.float(fmtSignedUsd(delta), delta > 0, 'player')
              s.float(fmtSignedUsd(-delta), delta < 0, 'dealer')
            }
            eqMark = eq
            markTick = m.tickCount
          }
          s.bump()
        }
      } else {
        acc = 0
        if (m) {
          eqMark = m.playerEquity
          markTick = m.tickCount
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])
}

/** Pause automatically when the tab is hidden so the dealer can't farm an absent player. */
function useAutoPause() {
  useEffect(() => {
    const onVis = () => {
      const m = useGame.getState().match
      if (document.hidden && m?.status === 'running') actions.togglePause()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
}

function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const { match, set, debug } = useGame.getState()
      if (!match) return
      const k = e.key.toLowerCase()
      if (k === '`') return set('debug', !debug)
      if (k === ' ') {
        e.preventDefault()
        if (match.status === 'ready') return actions.start()
        return actions.togglePause()
      }
      if (match.status !== 'running') return
      if (k === 'q') actions.long()
      else if (k === 'e') actions.short()
      else if (k === 'w') actions.close()
      else if (k === 'r') actions.reverse()
      else if (['1', '2', '3', '4'].includes(k)) actions.play(Number(k) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function GameScreen() {
  const match = useGame((s) => s.match)!
  const status = useGame((s) => s.match?.status)
  useGame((s) => s.version)
  const shake = useGame((s) => s.shake)
  const debug = useGame((s) => s.debug)
  const tutorial = useGame((s) => s.tutorial)
  const rootRef = useRef<HTMLDivElement>(null)

  useGameLoop()
  useHotkeys()
  useAutoPause()

  // Restart the shake animation on every new shake timestamp.
  useEffect(() => {
    const el = rootRef.current
    if (!el || !shake) return
    el.classList.remove('shake')
    void el.offsetWidth
    el.classList.add('shake')
  }, [shake])

  return (
    <div className="game" ref={rootRef}>
      <VersusBar />
      <div className="main">
        <Dashboard />
        <ChartPanel />
        <div className="trade-col">
          <OrderPanel />
          <PositionPanel />
        </div>
      </div>
      <div className="bottom">
        <TickerBar />
        <div className="hand-area">
          <CardHand />
          <DeckPanel />
        </div>
      </div>
      <FxLayer />
      {debug && <DebugPanel />}
      {status === 'ready' && !tutorial && <ReadyOverlay />}
      {status === 'paused' && <PausedOverlay />}
      {status === 'ended' && match.result && <ResultOverlay />}
    </div>
  )
}
