import { useGame } from '../store/gameStore'

/** Tiny synthesized sound effects, so the game ships without audio assets. */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (useGame.getState().muted) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.06, slideTo?: number, delay = 0) {
  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function noise(dur: number, gain = 0.12) {
  const ac = audio()
  if (!ac) return
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const src = ac.createBufferSource()
  const g = ac.createGain()
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  src.buffer = buf
  g.gain.value = gain
  src.connect(filter).connect(g).connect(ac.destination)
  src.start()
}

export const sfx = {
  click: () => tone(900, 0.05, 'square', 0.025),
  open: () => {
    tone(520, 0.08, 'triangle', 0.06)
    tone(780, 0.12, 'triangle', 0.05, undefined, 0.06)
  },
  profit: () => {
    tone(660, 0.1, 'sine', 0.06)
    tone(990, 0.18, 'sine', 0.06, undefined, 0.08)
  },
  loss: () => tone(300, 0.25, 'sawtooth', 0.04, 160),
  liquidated: () => {
    noise(0.7, 0.3)
    tone(180, 0.6, 'sawtooth', 0.08, 40)
  },
  card: () => {
    tone(400, 0.25, 'sine', 0.05, 1400)
    tone(1200, 0.2, 'triangle', 0.03, undefined, 0.15)
  },
  alert: () => {
    tone(880, 0.1, 'square', 0.03)
    tone(880, 0.1, 'square', 0.03, undefined, 0.16)
  },
  cascade: () => noise(0.25, 0.08),
  error: () => tone(200, 0.12, 'square', 0.03),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, undefined, i * 0.12)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.04, undefined, i * 0.15)),
}
