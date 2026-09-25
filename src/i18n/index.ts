import { en } from './en'
import { zh } from './zh'

export type Lang = 'en' | 'zh'
export type Params = Record<string, string | number>
export type Dict = Record<string, string>

/** A translatable message produced by the engine: a key plus plain parameters. */
export interface Msg {
  key: string
  params?: Params
}

export const LANGS: Record<Lang, { label: string; dict: Dict }> = {
  en: { label: 'EN', dict: en },
  zh: { label: '中文', dict: zh },
}

/**
 * Parameters with these names hold ids and are themselves translated before
 * interpolation, e.g. { card: 'golden_cross' } → "Golden Cross".
 */
const ID_PARAMS: Record<string, (v: string) => string> = {
  card: (v) => `card.${v}.name`,
  dealer: (v) => `diff.${v}.dealer`,
  cond: (v) => `card.${v}.cond`,
}

export function translate(lang: Lang, key: string, params?: Params): string {
  const dict = LANGS[lang].dict
  let s = dict[key] ?? en[key] ?? key
  if (!params) return s
  for (const [k, raw] of Object.entries(params)) {
    const idKey = ID_PARAMS[k]
    const v = idKey ? translate(lang, idKey(String(raw))) : String(raw)
    s = s.split(`{${k}}`).join(v)
  }
  return s
}

export const translateMsg = (lang: Lang, m: Msg) => translate(lang, m.key, m.params)
