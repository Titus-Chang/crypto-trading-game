import { create } from 'zustand'
import type { DifficultyKey } from '../engine/difficulty'
import { Match, type Grade, type Timeframe } from '../engine/match'
import { randomSeed } from '../engine/rng'
import type { Lang } from '../i18n'

export interface BestRecord {
  grade: Grade
  pnlPct: number
}

export interface ChartToggles {
  ema: boolean
  boll: boolean
  volume: boolean
  rsi: boolean
  fvg: boolean
  structure: boolean
  liquidity: boolean
}

export type ToastTone = 'info' | 'error' | 'good' | 'bad'
export interface Toast {
  id: number
  text: string
  tone: ToastTone
}
export interface FloatText {
  id: number
  text: string
  up: boolean
  target: 'player' | 'dealer'
}
export interface Banner {
  id: number
  text: string
  sub?: string
  tone: 'liquidated' | 'skill' | 'good'
}

interface GameState {
  screen: 'menu' | 'game'
  match: Match | null
  /** Bumped after every engine tick so subscribers re-render; the match itself is mutable. */
  version: number
  difficulty: DifficultyKey
  leverage: number
  sizePct: number
  timeframe: Timeframe
  toggles: ChartToggles
  muted: boolean
  speed: number
  debug: boolean
  tutorial: boolean
  toasts: Toast[]
  floats: FloatText[]
  banner: Banner | null
  flash: number
  shake: number
  lang: Lang
  best: Partial<Record<DifficultyKey, BestRecord>>
  /** true when the match that just ended set a new personal best */
  newBest: boolean

  setLang(lang: Lang): void
  recordResult(): void
  startMatch(difficulty: DifficultyKey, seed?: number): void
  toMenu(): void
  bump(): void
  set<K extends keyof GameState>(key: K, value: GameState[K]): void
  toggleChart(key: keyof ChartToggles): void
  toast(text: string, tone?: ToastTone): void
  float(text: string, up: boolean, target: 'player' | 'dealer'): void
  showBanner(text: string, tone: Banner['tone'], sub?: string): void
}

let uid = 1

const loadPref = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
export const savePref = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: preferences just won't persist */
  }
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu',
  match: null,
  version: 0,
  difficulty: loadPref<DifficultyKey>('fg.difficulty', 'normal'),
  leverage: 20,
  sizePct: 0.5,
  timeframe: '15m',
  toggles: loadPref<ChartToggles>('fg.toggles', {
    ema: true,
    boll: true,
    volume: true,
    rsi: true,
    fvg: true,
    structure: true,
    liquidity: true,
  }),
  muted: loadPref('fg.muted', false),
  speed: 1,
  debug: false,
  tutorial: !loadPref('fg.tutorialSeen', false),
  toasts: [],
  floats: [],
  banner: null,
  flash: 0,
  shake: 0,
  lang: loadPref<Lang>('fg.lang', 'en'),
  best: loadPref('fg.best', {}),
  newBest: false,

  setLang(lang) {
    savePref('fg.lang', lang)
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'
    set({ lang })
  },
  recordResult() {
    const { match, best } = get()
    const r = match?.result
    if (!match || !r) return
    const prev = best[match.difficulty.key]
    if (prev && prev.pnlPct >= r.pnlPct) return set({ newBest: false })
    const next = { ...best, [match.difficulty.key]: { grade: r.grade, pnlPct: r.pnlPct } }
    savePref('fg.best', next)
    set({ best: next, newBest: true })
  },
  startMatch(difficulty, seed) {
    savePref('fg.difficulty', difficulty)
    set({
      screen: 'game',
      difficulty,
      match: new Match({ seed: seed ?? randomSeed(), difficulty }),
      version: get().version + 1,
      toasts: [],
      floats: [],
      banner: null,
    })
  },
  toMenu() {
    set({ screen: 'menu', match: null })
  },
  bump() {
    set({ version: get().version + 1 })
  },
  set(key, value) {
    set({ [key]: value } as Partial<GameState>)
  },
  toggleChart(key) {
    const toggles = { ...get().toggles, [key]: !get().toggles[key] }
    savePref('fg.toggles', toggles)
    set({ toggles })
  },
  toast(text, tone = 'info') {
    const t = { id: uid++, text, tone }
    set({ toasts: [...get().toasts.slice(-3), t] })
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== t.id) }), 2200)
  },
  float(text, up, target) {
    const f = { id: uid++, text, up, target }
    set({ floats: [...get().floats.slice(-8), f] })
    setTimeout(() => set({ floats: get().floats.filter((x) => x.id !== f.id) }), 1300)
  },
  showBanner(text, tone, sub) {
    const b = { id: uid++, text, tone, sub }
    set({ banner: b })
    setTimeout(() => {
      if (get().banner?.id === b.id) set({ banner: null })
    }, 1600)
  },
}))
