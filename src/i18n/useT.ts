import { useCallback } from 'react'
import { useGame } from '../store/gameStore'
import { translate, translateMsg, type Msg, type Params } from '.'

export type T = (key: string, params?: Params) => string

/** Translator bound to the current language; components re-render when it changes. */
export function useT(): T {
  const lang = useGame((s) => s.lang)
  return useCallback((key: string, params?: Params) => translate(lang, key, params), [lang])
}

/** Non-hook variants for event handlers and canvas code. */
export const tNow: T = (key, params) => translate(useGame.getState().lang, key, params)
export const tMsg = (m: Msg) => translateMsg(useGame.getState().lang, m)
