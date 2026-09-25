import type { Candle } from '../../engine/candles'
import type { LiquidityZone } from '../../engine/crowd'
import { bollinger, ema, findFvgs, findStructure, rsi, type Bands, type Fvg, type StructureMark } from '../../engine/indicators'
import type { Position } from '../../engine/position'
import type { T } from '../../i18n/useT'
import type { ChartToggles } from '../../store/gameStore'
import { fmtAxisTime, fmtSimDate } from '../format'

export interface ChartView {
  /** number of candle slots across the plot */
  visible: number
  /** candles scrolled back from the live edge */
  offset: number
}

export interface DealerMarker {
  price: number
  label: string
}

export interface ChartModel {
  candles: readonly Candle[]
  toggles: ChartToggles
  price: number
  position: Position | null
  shielded: boolean
  zones: readonly LiquidityZone[]
  dealerTarget: DealerMarker | null
  now: number
  t: T
}

interface Indicators {
  key: string
  ema20: number[]
  ema50: number[]
  bands: Bands
  rsi: number[]
  fvgs: Fvg[]
  marks: StructureMark[]
  fvgBase: number
}

export interface ChartCache {
  ind: Indicators | null
}

export const createCache = (): ChartCache => ({ ind: null })

const C = {
  up: '#a3e635',
  down: '#ff5a4e',
  grid: 'rgba(242, 232, 213, 0.06)',
  axis: '#8a8272',
  ema20: '#ffb000',
  ema50: '#7aa2c8',
  boll: 'rgba(242, 232, 213, 0.28)',
  bollFill: 'rgba(242, 232, 213, 0.035)',
  cyan: '#7aa2c8',
  pink: '#ffd166',
  gold: '#ffb000',
  rsi: '#e9c46a',
}

const AXIS_W = 72
const TIME_H = 22
const FVG_LOOKBACK = 260

function indicators(candles: readonly Candle[], cache: ChartCache): Indicators {
  const last = candles[candles.length - 1]
  const key = `${candles.length}:${candles[0]?.t}:${last?.c}:${last?.h}:${last?.l}`
  if (cache.ind?.key === key) return cache.ind
  const closes = candles.map((c) => c.c)
  const fvgBase = Math.max(0, candles.length - FVG_LOOKBACK)
  const recent = candles.slice(fvgBase)
  cache.ind = {
    key,
    ema20: ema(closes, 20),
    ema50: ema(closes, 50),
    bands: bollinger(closes, 20, 2),
    rsi: rsi(closes, 14),
    fvgs: findFvgs(recent),
    marks: findStructure(recent, 3),
    fvgBase,
  }
  return cache.ind
}

function niceStep(range: number, target: number): number {
  const raw = range / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg = '#000', align: 'left' | 'right' = 'left') {
  ctx.font = '600 11px "IBM Plex Mono", monospace'
  const w = ctx.measureText(text).width + 10
  const lx = align === 'left' ? x : x - w
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(lx, y - 9, w, 18, 3)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(text, lx + 5, y + 0.5)
}

function hline(ctx: CanvasRenderingContext2D, y: number, x0: number, x1: number, color: string, width = 1, dash: number[] = []) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(x0, Math.round(y) + 0.5)
  ctx.lineTo(x1, Math.round(y) + 0.5)
  ctx.stroke()
  ctx.setLineDash([])
}

export interface HoverInfo {
  index: number | null
}

export function drawChart(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  m: ChartModel,
  view: ChartView,
  hover: { x: number; y: number } | null,
  cache: ChartCache,
): HoverInfo {
  const { candles, toggles } = m
  ctx.clearRect(0, 0, w, h)
  const n = candles.length
  if (n < 2) return { index: null }
  const ind = indicators(candles, cache)

  // ---- layout
  const rsiH = toggles.rsi ? Math.max(60, Math.round(h * 0.2)) : 0
  const plotR = w - AXIS_W
  const mainTop = 8
  const mainBot = h - TIME_H - rsiH - (toggles.rsi ? 8 : 0)
  const rsiTop = mainBot + 8
  const rsiBot = rsiTop + rsiH

  const future = Math.round(view.visible * 0.22)
  const rightSlot = n - 1 + future - view.offset
  const leftSlot = rightSlot - view.visible + 1
  const slotW = plotR / view.visible
  const xOf = (i: number) => (i - leftSlot + 0.5) * slotW
  const i0 = Math.max(0, leftSlot)
  const i1 = Math.min(n - 1, rightSlot)

  // ---- price range
  let hi = -Infinity
  let lo = Infinity
  for (let i = i0; i <= i1; i++) {
    hi = Math.max(hi, candles[i].h)
    lo = Math.min(lo, candles[i].l)
    if (toggles.boll && !Number.isNaN(ind.bands.upper[i])) {
      hi = Math.max(hi, ind.bands.upper[i])
      lo = Math.min(lo, ind.bands.lower[i])
    }
  }
  if (view.offset === 0) {
    hi = Math.max(hi, m.price)
    lo = Math.min(lo, m.price)
  }
  if (m.position) {
    // Keep the liquidation line on screen when it is reasonably close.
    const liq = m.position.liq
    if (liq < hi * 1.06 && liq > lo * 0.94) {
      hi = Math.max(hi, liq)
      lo = Math.min(lo, liq)
    }
  }
  const padP = (hi - lo) * 0.08 || hi * 0.01
  hi += padP
  lo -= padP
  const yOf = (p: number) => mainTop + ((hi - p) / (hi - lo)) * (mainBot - mainTop)
  const pOf = (y: number) => hi - ((y - mainTop) / (mainBot - mainTop)) * (hi - lo)

  // Biggest liquidity clusters on each side get a line + axis tag.
  const inRange = toggles.liquidity ? m.zones.filter((z) => z.price < hi && z.price > lo) : []
  let topAbove: LiquidityZone | null = null
  let topBelow: LiquidityZone | null = null
  for (const z of inRange) {
    if (z.price > m.price && (!topAbove || z.amount > topAbove.amount)) topAbove = z
    if (z.price < m.price && (!topBelow || z.amount > topBelow.amount)) topBelow = z
  }
  const tagged = [topAbove, topBelow].filter((z): z is LiquidityZone => !!z && z.amount >= 1e6)

  // ---- grid + price axis (skip tick labels that would sit under a price tag)
  const reserved = [m.price, ...tagged.map((z) => z.price)].map(yOf)
  const step = niceStep(hi - lo, 7)
  ctx.font = '11px "IBM Plex Mono", monospace'
  ctx.textBaseline = 'middle'
  for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) {
    const y = yOf(p)
    hline(ctx, y, 0, plotR, C.grid)
    if (reserved.some((r) => Math.abs(r - y) < 17)) continue
    ctx.fillStyle = C.axis
    ctx.textAlign = 'left'
    ctx.fillText(p.toFixed(5), plotR + 6, y)
  }

  // ---- time axis
  const minLabelPx = 70
  const every = Math.max(1, Math.ceil(minLabelPx / slotW))
  const tfMin = n > 1 ? candles[1].t - candles[0].t : 15
  const bucket = every * tfMin
  ctx.textAlign = 'center'
  for (let i = i0; i <= i1; i++) {
    if (candles[i].t % bucket !== 0) continue
    const x = xOf(i)
    ctx.strokeStyle = C.grid
    ctx.beginPath()
    ctx.moveTo(Math.round(x) + 0.5, mainTop)
    ctx.lineTo(Math.round(x) + 0.5, toggles.rsi ? rsiBot : mainBot)
    ctx.stroke()
    ctx.fillStyle = C.axis
    ctx.fillText(fmtAxisTime(candles[i].t), x, h - TIME_H / 2)
  }

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, plotR, mainBot)
  ctx.clip()

  // ---- bollinger
  if (toggles.boll) {
    ctx.fillStyle = C.bollFill
    ctx.beginPath()
    let started = false
    for (let i = i0; i <= i1; i++) {
      const u = ind.bands.upper[i]
      if (Number.isNaN(u)) continue
      if (!started) {
        ctx.moveTo(xOf(i), yOf(u))
        started = true
      } else ctx.lineTo(xOf(i), yOf(u))
    }
    for (let i = i1; i >= i0; i--) {
      const l = ind.bands.lower[i]
      if (!Number.isNaN(l)) ctx.lineTo(xOf(i), yOf(l))
    }
    ctx.closePath()
    ctx.fill()
    for (const series of [ind.bands.upper, ind.bands.lower]) drawLine(ctx, series, i0, i1, xOf, yOf, C.boll, 1)
    drawLine(ctx, ind.bands.mid, i0, i1, xOf, yOf, 'rgba(242,232,213,0.18)', 1, [3, 3])
  }

  // ---- volume
  if (toggles.volume) {
    let maxV = 0
    for (let i = i0; i <= i1; i++) maxV = Math.max(maxV, candles[i].v)
    const volH = (mainBot - mainTop) * 0.16
    for (let i = i0; i <= i1; i++) {
      const c = candles[i]
      const vh = (c.v / maxV) * volH
      ctx.fillStyle = c.c >= c.o ? 'rgba(163,230,53,0.22)' : 'rgba(255,90,78,0.22)'
      ctx.fillRect(xOf(i) - slotW * 0.35, mainBot - vh, Math.max(1, slotW * 0.7), vh)
    }
  }

  // ---- fair value gaps
  if (toggles.fvg) {
    for (const g of ind.fvgs) {
      const gi = g.index + ind.fvgBase
      const end = g.filledAt === null ? rightSlot : g.filledAt + ind.fvgBase
      if (end < i0 || gi > i1) continue
      if (g.filledAt !== null && end - gi < 3) continue
      const x0 = xOf(gi) - slotW / 2
      const x1 = g.filledAt === null ? plotR : xOf(end)
      const y0 = yOf(g.top)
      const y1 = yOf(g.bottom)
      const open = g.filledAt === null
      ctx.fillStyle = g.dir === 1 ? `rgba(163,230,53,${open ? 0.13 : 0.05})` : `rgba(255,90,78,${open ? 0.13 : 0.05})`
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      if (open) {
        ctx.strokeStyle = g.dir === 1 ? 'rgba(163,230,53,0.5)' : 'rgba(255,90,78,0.5)'
        ctx.setLineDash([4, 3])
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
        ctx.setLineDash([])
        ctx.font = '600 9px "IBM Plex Mono", monospace'
        ctx.fillStyle = g.dir === 1 ? C.up : C.down
        ctx.textAlign = 'left'
        ctx.fillText('FVG', x0 + 3, (y0 + y1) / 2)
      }
    }
  }

  // ---- liquidity heat
  if (toggles.liquidity) {
    // Right-anchored histogram: bar length ∝ liquidation amount at that price.
    const maxA = Math.max(1, ...inRange.map((z) => z.amount))
    const maxLen = plotR * 0.22
    for (const z of inRange) {
      const k = z.amount / maxA
      const y = yOf(z.price)
      const len = Math.max(2, k * maxLen)
      const rgb = z.side === 'long' ? '255,90,78' : '255,176,0'
      const grad = ctx.createLinearGradient(plotR - len, 0, plotR, 0)
      grad.addColorStop(0, `rgba(${rgb},0)`)
      grad.addColorStop(1, `rgba(${rgb},${0.15 + k * 0.55})`)
      ctx.fillStyle = grad
      ctx.fillRect(plotR - len, y - 1 - k * 1.5, len, 2 + k * 3)
    }
    for (const z of tagged) {
      const y = yOf(z.price)
      hline(ctx, y, 0, plotR, z.side === 'long' ? 'rgba(255,90,78,0.8)' : 'rgba(255,176,0,0.85)', 1, [6, 4])
      label(ctx, m.t('chart.zone', { amount: (z.amount / 1e6).toFixed(0) }), plotR - 4, y, z.side === 'long' ? 'rgba(255,90,78,0.9)' : 'rgba(255,176,0,0.9)', '#000', 'right')
    }
  }

  // ---- candles
  const bodyW = Math.max(1, slotW * 0.62)
  for (let i = i0; i <= i1; i++) {
    const c = candles[i]
    const x = xOf(i)
    const color = c.c >= c.o ? C.up : C.down
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(Math.round(x) + 0.5, yOf(c.h))
    ctx.lineTo(Math.round(x) + 0.5, yOf(c.l))
    ctx.stroke()
    const yo = yOf(c.o)
    const yc = yOf(c.c)
    ctx.fillStyle = color
    ctx.fillRect(x - bodyW / 2, Math.min(yo, yc), bodyW, Math.max(1, Math.abs(yc - yo)))
  }
  // glow on the live candle
  if (i1 === n - 1) {
    const c = candles[n - 1]
    ctx.shadowColor = c.c >= c.o ? C.up : C.down
    ctx.shadowBlur = 12
    ctx.fillStyle = c.c >= c.o ? C.up : C.down
    ctx.fillRect(xOf(n - 1) - bodyW / 2, Math.min(yOf(c.o), yOf(c.c)), bodyW, Math.max(1, Math.abs(yOf(c.c) - yOf(c.o))))
    ctx.shadowBlur = 0
  }

  // ---- EMAs
  if (toggles.ema) {
    drawLine(ctx, ind.ema20, i0, i1, xOf, yOf, C.ema20, 1.4)
    drawLine(ctx, ind.ema50, i0, i1, xOf, yOf, C.ema50, 1.4)
  }

  // ---- structure
  if (toggles.structure) {
    for (const mk of ind.marks.slice(-8)) {
      const i = mk.index + ind.fvgBase
      if (i < i0 || i > i1) continue
      const x = xOf(i)
      const y = yOf(mk.price)
      const color = mk.dir === 1 ? C.up : C.down
      hline(ctx, y, x - slotW * 8, x, color, 1, [2, 3])
      ctx.font = '700 10px "IBM Plex Mono", monospace'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(mk.kind, x - slotW * 4, y + (mk.dir === 1 ? -8 : 10))
    }
  }

  // ---- position lines
  if (m.position) {
    const p = m.position
    const ye = yOf(p.entry)
    hline(ctx, ye, 0, plotR, C.cyan, 1, [5, 4])
    label(ctx, m.t('chart.entry', { side: m.t(`side.${p.side}`), price: p.entry.toFixed(5) }), 8, ye, 'rgba(122,162,200,0.95)')
    const yl = yOf(p.liq)
    if (yl > mainTop && yl < mainBot) {
      const col = m.shielded ? '#a3e635' : C.down
      ctx.shadowColor = col
      ctx.shadowBlur = 10
      hline(ctx, yl, 0, plotR, col, 2)
      ctx.shadowBlur = 0
      label(ctx, `${m.shielded ? '🛡 ' : ''}${m.t('chart.liqLine', { price: p.liq.toFixed(5) })}`, 8, yl, col, '#000')
    }
  }

  // ---- dealer target
  if (m.dealerTarget) {
    const pulse = 0.55 + 0.45 * Math.sin(m.now / 160)
    const yt = yOf(Math.min(hi, Math.max(lo, m.dealerTarget.price)))
    const x0 = xOf(n - 1)
    const y0 = yOf(m.price)
    ctx.globalAlpha = pulse
    hline(ctx, yt, x0, plotR, C.pink, 2, [8, 5])
    ctx.strokeStyle = C.pink
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x0 + 6, y0)
    ctx.lineTo(x0 + 26, yt)
    ctx.stroke()
    const dir = yt > y0 ? 1 : -1
    ctx.fillStyle = C.pink
    ctx.beginPath()
    ctx.moveTo(x0 + 26, yt)
    ctx.lineTo(x0 + 20, yt - dir * 9)
    ctx.lineTo(x0 + 31, yt - dir * 7)
    ctx.fill()
    ctx.globalAlpha = 1
    // Keep the label inside the plot: flip to right-aligned when it would run into the axis.
    ctx.font = '600 11px "IBM Plex Mono", monospace'
    const lw = ctx.measureText(m.dealerTarget.label).width + 10
    const fits = x0 + 36 + lw < plotR - 4
    const ly = Math.max(mainTop + 12, Math.min(mainBot - 12, yt + (dir > 0 ? 14 : -14)))
    label(ctx, m.dealerTarget.label, fits ? x0 + 36 : plotR - 4, ly, `rgba(255,209,102,${0.6 + pulse * 0.35})`, '#1a1408', fits ? 'left' : 'right')
  }
  ctx.restore()

  // ---- last price
  if (view.offset < future) {
    const last = candles[n - 1]
    const y = yOf(m.price)
    const col = last.c >= last.o ? C.up : C.down
    hline(ctx, y, 0, plotR, col, 1, [2, 2])
    label(ctx, m.price.toFixed(5), plotR + 1, y, col, '#000')
  }
  for (const z of tagged) {
    label(ctx, z.price.toFixed(5), plotR + 1, yOf(z.price), z.side === 'long' ? 'rgba(255,90,78,0.7)' : 'rgba(255,176,0,0.7)')
  }

  // ---- RSI pane
  if (toggles.rsi) {
    const yR = (v: number) => rsiTop + ((100 - v) / 100) * rsiH
    ctx.fillStyle = 'rgba(255,176,0,0.04)'
    ctx.fillRect(0, yR(70), plotR, yR(30) - yR(70))
    hline(ctx, rsiTop, 0, w, 'rgba(242,232,213,0.12)')
    hline(ctx, yR(70), 0, plotR, 'rgba(255,90,78,0.4)', 1, [4, 4])
    hline(ctx, yR(30), 0, plotR, 'rgba(163,230,53,0.4)', 1, [4, 4])
    hline(ctx, yR(50), 0, plotR, 'rgba(242,232,213,0.1)', 1, [2, 4])
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, rsiTop, plotR, rsiH)
    ctx.clip()
    drawLine(ctx, ind.rsi, i0, i1, xOf, yR, C.rsi, 1.4)
    ctx.restore()
    ctx.font = '11px "IBM Plex Mono", monospace'
    ctx.fillStyle = C.axis
    ctx.textAlign = 'left'
    for (const v of [70, 30]) ctx.fillText(String(v), plotR + 6, yR(v))
    const cur = ind.rsi[i1]
    ctx.fillStyle = C.rsi
    ctx.fillText(`RSI 14  ${Number.isNaN(cur) ? '--' : cur.toFixed(1)}`, 8, rsiTop + 10)
    if (!Number.isNaN(cur)) label(ctx, cur.toFixed(1), plotR + 1, yR(cur), cur < 30 ? C.up : cur > 70 ? C.down : C.rsi)
  }

  // ---- crosshair
  let hoverIndex: number | null = null
  if (hover && hover.x < plotR && hover.y < (toggles.rsi ? rsiBot : mainBot)) {
    const slot = Math.floor(hover.x / slotW) + leftSlot
    hoverIndex = slot >= 0 && slot < n ? slot : null
    const x = xOf(slot)
    ctx.strokeStyle = 'rgba(242,232,213,0.35)'
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(Math.round(x) + 0.5, 0)
    ctx.lineTo(Math.round(x) + 0.5, toggles.rsi ? rsiBot : mainBot)
    if (hover.y < mainBot) {
      ctx.moveTo(0, Math.round(hover.y) + 0.5)
      ctx.lineTo(plotR, Math.round(hover.y) + 0.5)
    }
    ctx.stroke()
    ctx.setLineDash([])
    if (hover.y < mainBot) label(ctx, pOf(hover.y).toFixed(5), plotR + 1, hover.y, '#3a342a', '#fff')
    if (hoverIndex !== null) {
      const text = fmtSimDate(candles[hoverIndex].t)
      ctx.font = '600 11px "IBM Plex Mono", monospace'
      const tw = ctx.measureText(text).width + 10
      ctx.fillStyle = '#3a342a'
      ctx.fillRect(x - tw / 2, h - TIME_H + 2, tw, TIME_H - 4)
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.fillText(text, x, h - TIME_H / 2)
    }
  }

  return { index: hoverIndex }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  values: readonly number[],
  i0: number,
  i1: number,
  xOf: (i: number) => number,
  yOf: (v: number) => number,
  color: string,
  width: number,
  dash: number[] = [],
) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(dash)
  ctx.beginPath()
  let started = false
  for (let i = i0; i <= i1; i++) {
    const v = values[i]
    if (Number.isNaN(v)) continue
    if (!started) {
      ctx.moveTo(xOf(i), yOf(v))
      started = true
    } else ctx.lineTo(xOf(i), yOf(v))
  }
  ctx.stroke()
  ctx.setLineDash([])
}

/** Latest structure / FVG facts for the header badges. */
export function chartBadges(cache: ChartCache, price: number) {
  const ind = cache.ind
  if (!ind) return { mark: null as StructureMark | null, openFvg: null as Fvg | null }
  const n = ind.ema20.length
  const mark = ind.marks.filter((mk) => mk.index + ind.fvgBase >= n - 12).pop() ?? null
  const openFvg =
    ind.fvgs
      .filter((g) => g.filledAt === null)
      .sort((a, b) => Math.abs((a.top + a.bottom) / 2 - price) - Math.abs((b.top + b.bottom) / 2 - price))[0] ?? null
  return { mark, openFvg }
}
