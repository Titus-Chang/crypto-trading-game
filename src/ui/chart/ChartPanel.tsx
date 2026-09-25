import { useEffect, useRef, useState } from 'react'
import { PAIR, type Timeframe } from '../../engine/match'
import { tNow, useT } from '../../i18n/useT'
import { useGame, type ChartToggles } from '../../store/gameStore'
import { fmtCompact, fmtPrice, fmtSimDate } from '../format'
import { chartBadges, createCache, drawChart, type ChartView, type DealerMarker } from './chartRenderer'

const TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h']
const TF_LABEL: Record<Timeframe, string> = { '15m': '15m', '1h': '1H', '4h': '4H' }
const TOGGLES: (keyof ChartToggles)[] = ['ema', 'boll', 'volume', 'rsi', 'fvg', 'structure', 'liquidity']
const DEFAULT_VIEW: ChartView = { visible: 96, offset: 0 }

export function ChartPanel() {
  const match = useGame((s) => s.match)!
  useGame((s) => s.version)
  const timeframe = useGame((s) => s.timeframe)
  const toggles = useGame((s) => s.toggles)
  const setKey = useGame((s) => s.set)
  const toggleChart = useGame((s) => s.toggleChart)
  const t = useT()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<ChartView>({ ...DEFAULT_VIEW })
  const hoverRef = useRef<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ x: number; offset: number } | null>(null)
  const cacheRef = useRef(createCache())
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    cacheRef.current = createCache()
  }, [timeframe, match])

  // Render loop: reads the live match every frame, independent of React renders,
  // but only repaints when something visible changed (or the dealer marker is pulsing).
  useEffect(() => {
    const canvas = canvasRef.current!
    const body = bodyRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let size = { w: 0, h: 0 }
    let lastKey = ''
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      size = { w: body.clientWidth, h: body.clientHeight }
      canvas.width = Math.round(size.w * dpr)
      canvas.height = Math.round(size.h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lastKey = ''
    })
    ro.observe(body)

    let lastHover: number | null = null
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const s = useGame.getState()
      const m = s.match
      if (!m || size.w === 0) return
      const d = m.dealer
      let target: DealerMarker | null = null
      if (m.intentVisible && d.target !== null) {
        target = {
          price: d.target,
          label: tNow('chart.target', { price: d.target.toFixed(5), state: tNow(`dealer.state.${d.state}`) }) + (d.targetsPlayer ? tNow('chart.targetYou') : ''),
        }
      }
      const v = viewRef.current
      const hv = hoverRef.current
      const key = `${s.version}|${s.timeframe}|${JSON.stringify(s.toggles)}|${s.lang}|${v.visible}|${v.offset}|${hv?.x},${hv?.y}|${size.w}x${size.h}`
      if (key === lastKey && !target) return
      lastKey = key

      const info = drawChart(
        ctx,
        size.w,
        size.h,
        {
          candles: m.series[s.timeframe].candles,
          toggles: s.toggles,
          price: m.price,
          position: m.account.position,
          shielded: m.effects.some((e) => e.effect.type === 'shield'),
          zones: m.crowd.zones,
          dealerTarget: target,
          now: performance.now(),
          t: tNow,
        },
        v,
        hv,
        cacheRef.current,
      )
      if (info.index !== lastHover) {
        lastHover = info.index
        setHoverIndex(info.index)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const candles = match.series[timeframe].candles
  const c = candles[hoverIndex ?? candles.length - 1]
  const prev = candles[(hoverIndex ?? candles.length - 1) - 1] ?? c
  const chg = c.c - prev.c
  const cls = c.c >= c.o ? 'up' : 'down'
  const badges = chartBadges(cacheRef.current, match.price)
  const cascade = match.lastCascade && match.minute - match.lastCascade.minute < 90 ? match.lastCascade : null
  const hunting = match.dealer.state === 'prepare' && (match.dealer.telegraphed || match.revealActive)

  const onWheel = (e: React.WheelEvent) => {
    const v = viewRef.current
    v.visible = Math.max(30, Math.min(300, Math.round(v.visible * (e.deltaY > 0 ? 1.12 : 0.89))))
  }
  const onMove = (e: React.PointerEvent) => {
    const r = bodyRef.current!.getBoundingClientRect()
    hoverRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    const drag = dragRef.current
    if (drag) {
      const v = viewRef.current
      const slotW = (r.width - 72) / v.visible
      v.offset = Math.max(0, Math.min(candles.length - 20, Math.round(drag.offset + (e.clientX - drag.x) / slotW)))
    }
  }
  const resetView = () => {
    viewRef.current = { ...DEFAULT_VIEW }
  }

  return (
    <div className="panel chart-panel">
      <div className="chart-toolbar">
        {TIMEFRAMES.map((tf) => (
          <button key={tf} className={`btn ${timeframe === tf ? 'active' : ''}`} onClick={() => setKey('timeframe', tf)}>
            {TF_LABEL[tf]}
          </button>
        ))}
        <span className="sep" />
        {TOGGLES.map((key) => (
          <button key={key} className={`btn toggle ${toggles[key] ? 'active' : ''}`} onClick={() => toggleChart(key)}>
            {t(`chart.${key}`)}
          </button>
        ))}
        <div className="tb-right">
          {match.signals.trend !== 0 && (
            <span className={`chip ${match.signals.trend > 0 ? 'up' : 'down'}`}>{t(match.signals.trend > 0 ? 'chart.bullStack' : 'chart.bearStack')}</span>
          )}
          <button className="btn" title={t('chart.reset')} onClick={resetView}>
            ⟲
          </button>
        </div>
      </div>
      <div
        className="chart-body"
        ref={bodyRef}
        onWheel={onWheel}
        onPointerMove={onMove}
        onPointerLeave={() => {
          hoverRef.current = null
          dragRef.current = null
        }}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, offset: viewRef.current.offset }
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
        }}
        onPointerUp={() => {
          dragRef.current = null
        }}
        onDoubleClick={resetView}
      >
        <canvas ref={canvasRef} />
        <div className="chart-header">
          <div className="ohlc num">
            <b>{PAIR}</b>
            <span className="muted">
              {TF_LABEL[timeframe]} · {t('chart.meta')}
            </span>
            <span className="muted">{fmtSimDate(c.t)}</span>
            {(['o', 'h', 'l', 'c'] as const).map((k) => (
              <span key={k}>
                {t(`ohlc.${k}`)} <span className={cls}>{fmtPrice(c[k])}</span>
              </span>
            ))}
            <span className={chg >= 0 ? 'up' : 'down'}>
              {chg >= 0 ? '+' : ''}
              {chg.toFixed(5)} ({((chg / prev.c) * 100).toFixed(2)}%)
            </span>
            <span className="muted">
              {t('ohlc.v')} {fmtCompact(c.v)}
            </span>
          </div>
          {toggles.ema && (
            <div className="ohlc num" style={{ fontSize: 11 }}>
              <span style={{ color: '#ffd84d' }}>EMA20 {fmtPrice(match.signals.ema20)}</span>
              <span style={{ color: '#b36bff' }}>EMA50 {fmtPrice(match.signals.ema50)}</span>
            </div>
          )}
          <div className="chart-badges">
            {toggles.structure && badges.mark && (
              <span className={`badge ${badges.mark.dir > 0 ? 'bull' : 'bear'}`}>
                {t(badges.mark.kind === 'BOS' ? 'badge.bos' : 'badge.mss', { arrow: badges.mark.dir > 0 ? '▲' : '▼' })}
              </span>
            )}
            {toggles.fvg && badges.openFvg && (
              <span className={`badge ${badges.openFvg.dir > 0 ? 'bull' : 'bear'}`}>
                {t('badge.fvg', { lo: fmtPrice(badges.openFvg.bottom), hi: fmtPrice(badges.openFvg.top) })}
              </span>
            )}
            {cascade && <span className="badge warn">{t('badge.cascade', { amount: (cascade.amount / 1e6).toFixed(2) })}</span>}
          </div>
        </div>
        {hunting && <div className="dealer-alert">{t(match.dealer.targetsPlayer ? 'chart.alertYou' : 'chart.alertZone')}</div>}
      </div>
    </div>
  )
}
