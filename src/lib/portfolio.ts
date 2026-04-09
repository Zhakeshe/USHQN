export type PortfolioLink = { label: string; url: string; kind?: 'link' | 'video' }

const MAX_LINKS = 8

export function parsePortfolioLinks(raw: unknown): PortfolioLink[] {
  if (!Array.isArray(raw)) return []
  const out: PortfolioLink[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const label = typeof o.label === 'string' ? o.label.trim() : ''
    const url = typeof o.url === 'string' ? o.url.trim() : ''
    const kind = o.kind === 'video' ? 'video' : 'link'
    if (!label || !url) continue
    if (!/^https:\/\//i.test(url)) continue
    out.push({ label, url, kind })
    if (out.length >= MAX_LINKS) break
  }
  return out
}

export function serializePortfolioLinks(links: PortfolioLink[]): PortfolioLink[] {
  return parsePortfolioLinks(links)
}
