export type ThemeMode = 'light' | 'dark' | 'system'

export function resolveTheme(mode: ThemeMode | string | null | undefined): 'light' | 'dark' {
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'light'
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Apply html.dark and reduce-motion class; call when settings load or OS theme changes. */
export function applyDocumentTheme(theme: ThemeMode | string | null | undefined, reduceMotion: boolean) {
  if (typeof document === 'undefined') return
  const dark = resolveTheme(theme) === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.classList.toggle('reduce-motion', reduceMotion)
}

export function subscribeSystemTheme(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
