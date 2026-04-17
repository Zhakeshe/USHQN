import type { TFunction } from 'i18next'

export type ChatPeerProfile = {
  id: string
  display_name: string | null
  username: string | null
  avatar_url?: string | null
}

/** Visible name for DM / group roster when display_name may be empty. */
export function chatPeerLabel(p: ChatPeerProfile | undefined, t: TFunction): string {
  const dn = p?.display_name?.trim()
  if (dn) return dn
  const u = p?.username?.trim()
  if (u) return `@${u}`
  const id = p?.id
  if (id) {
    const short = id.replace(/-/g, '').slice(0, 8)
    if (short) return t('chat.peerShortId', { id: short })
  }
  return t('chat.peerFallback')
}

export function initialsFromChatLabel(label: string): string {
  const s = label.replace(/^@/, '').trim()
  if (!s) return '?'
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return s.slice(0, 2).toUpperCase()
}
