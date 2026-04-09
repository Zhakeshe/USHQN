import type { Locale } from 'date-fns'
import { enUS, kk, ru } from 'date-fns/locale'

export function getDateFnsLocale(lang: string | undefined): Locale {
  const l = (lang ?? 'ru').toLowerCase()
  if (l.startsWith('en')) return enUS
  if (l.startsWith('kk')) return kk
  return ru
}
