export type ThemeMode = 'light' | 'dark' | 'system'

export function resolveTheme(mode: ThemeMode | string | null | undefined): 'light' | 'dark' {
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'light'
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const THEME_COLOR_LIGHT = '#0052CC'
const THEME_COLOR_DARK = '#0f172a'

/** Apply html.dark and reduce-motion class; call when settings load or OS theme changes. */
export function applyDocumentTheme(theme: ThemeMode | string | null | undefined, reduceMotion: boolean) {
  if (typeof document === 'undefined') return
  const dark = resolveTheme(theme) === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.classList.toggle('reduce-motion', reduceMotion)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
}

export function subscribeSystemTheme(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
