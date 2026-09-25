import type { FxEvent } from '../engine/match'
import type { Msg } from '../i18n'
import { tMsg, tNow } from '../i18n/useT'
import { useGame } from '../store/gameStore'
import { sfx } from './audio'
import { fmtSignedUsd, fmtUsd } from './format'

/** Runs a match command and reports its error, if any, as a toast. */
function run(fn: () => Msg | null) {
  const { match, toast, bump } = useGame.getState()
  if (!match) return
  const err = fn()
  if (err) {
    toast(tMsg(err), 'error')
    sfx.error()
  }
  bump()
}

const state = () => useGame.getState()

export const actions = {
  long: () => run(() => state().match!.openPosition('long', state().leverage, state().sizePct)),
  short: () => run(() => state().match!.openPosition('short', state().leverage, state().sizePct)),
  close: () => run(() => state().match!.closePosition()),
  reverse: () => run(() => state().match!.reversePosition()),
  play: (i: number) => run(() => state().match!.playCard(i)),
  discard: (i: number) => run(() => state().match!.discardCard(i)),
  start: () => {
    const { match, bump } = state()
    match?.start()
    sfx.open()
    bump()
  },
  togglePause: () => {
    const { match, bump } = state()
    match?.togglePause()
    sfx.click()
    bump()
  },
}

/** Turns engine events into sound, banners, shakes and toasts. */
export function handleFx(events: FxEvent[]) {
  const s = state()
  for (const e of events) {
    switch (e.type) {
      case 'liquidated':
        sfx.liquidated()
        useGame.setState({ shake: Date.now(), flash: Date.now() })
        s.showBanner(tNow(e.shielded ? 'banner.shielded' : 'banner.liquidated'), 'liquidated', `-${fmtUsd(e.loss)}`)
        break
      case 'cascade':
        sfx.cascade()
        break
      case 'card':
        sfx.card()
        s.showBanner(tNow('banner.card', { card: e.cardId }), 'skill')
        break
      case 'open':
        sfx.open()
        break
      case 'close':
        if (e.pnl >= 0) sfx.profit()
        else sfx.loss()
        s.toast(tNow(e.reason === 'stopguard' ? 'toast.stopguard' : 'toast.closed', { pnl: fmtSignedUsd(e.pnl) }), e.pnl >= 0 ? 'good' : 'bad')
        break
      case 'dealerAlert':
        sfx.alert()
        break
      case 'end':
        s.recordResult()
        if (e.win) sfx.win()
        else sfx.lose()
        break
      case 'news':
        break
    }
  }
}
