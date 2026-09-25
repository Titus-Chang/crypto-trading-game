import { SIM_EPOCH, TICKS_PER_SECOND } from '../engine/match'

export const fmtPrice = (p: number) => p.toFixed(5)

export const fmtUsd = (v: number, digits = 0) =>
  `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`

export const fmtSignedUsd = (v: number, digits = 0) => `${v >= 0 ? '+' : ''}${fmtUsd(v, digits)}`

export const fmtPct = (v: number, digits = 1) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`

export const fmtM = (v: number) => `$${(v / 1e6).toFixed(2)}M`

export const fmtCompact = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : v.toFixed(0)

const simDate = (minute: number) => new Date(SIM_EPOCH + minute * 60000)
const pad = (n: number) => String(n).padStart(2, '0')

export const fmtSimTime = (minute: number) => {
  const d = simDate(minute)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export const fmtSimDate = (minute: number) => {
  const d = simDate(minute)
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** Short axis label: date at midnight, otherwise time of day. */
export const fmtAxisTime = (minute: number) => {
  const d = simDate(minute)
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export const fmtClock = (ticks: number) => {
  const s = Math.ceil(ticks / TICKS_PER_SECOND)
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}
