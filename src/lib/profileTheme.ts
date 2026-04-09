/** Preset accents (Discord-inspired + brand) */
export const ACCENT_PRESETS = [
  '#5865F2',
  '#57F287',
  '#FEE75C',
  '#EB459E',
  '#ED4245',
  '#00B0F4',
  '#9B59B6',
  '#F37B68',
  '#0052CC',
] as const

const HEX = /^#([0-9A-Fa-f]{6})$/

export function isValidAccentHex(v: string | null | undefined): v is string {
  return Boolean(v && HEX.test(v))
}

export function bannerFallbackGradient(accent: string): string {
  const a = isValidAccentHex(accent) ? accent : '#0052CC'
  return `linear-gradient(135deg, ${a} 0%, ${a}99 32%, #e9eef8 88%, #f5f7fa 100%)`
}
