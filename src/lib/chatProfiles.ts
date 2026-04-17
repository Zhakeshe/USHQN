import { supabase } from './supabase'
import type { ChatPeerProfile } from './chatPeerLabel'

function isMissingColumnError(err: unknown): boolean {
  const msg = `${(err as { message?: string; code?: string })?.message ?? ''} ${(err as { code?: string })?.code ?? ''}`.toLowerCase()
  return (
    msg.includes('schema cache') ||
    msg.includes('pgrst204') ||
    (msg.includes('could not find') && msg.includes('column'))
  )
}

/** Loads peer rows for chat; falls back if optional columns are absent on the remote DB. */
export async function fetchChatProfilesByIds(ids: string[]): Promise<Map<string, ChatPeerProfile>> {
  if (ids.length === 0) return new Map()
  const uniq = [...new Set(ids)]
  const full = await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', uniq)
  if (!full.error && full.data) {
    return new Map(full.data.map((p) => [p.id, p as ChatPeerProfile]))
  }
  if (!isMissingColumnError(full.error)) throw full.error
  const basic = await supabase.from('profiles').select('id,display_name,avatar_url').in('id', uniq)
  if (basic.error) throw basic.error
  return new Map(
    (basic.data ?? []).map((p) => [
      p.id,
      { id: p.id, display_name: p.display_name, username: null, avatar_url: p.avatar_url } satisfies ChatPeerProfile,
    ]),
  )
}

export async function searchProfilesForChat(opts: { q: string; excludeId: string; limit?: number }) {
  const { q, excludeId, limit = 10 } = opts
  const full = await supabase
    .from('profiles')
    .select('id,display_name,username,avatar_url')
    .neq('id', excludeId)
    .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
    .limit(limit)
  if (!full.error && full.data) {
    return full.data as ChatPeerProfile[]
  }
  if (!full.error || !isMissingColumnError(full.error)) {
    if (full.error) throw full.error
    return []
  }
  const basic = await supabase
    .from('profiles')
    .select('id,display_name,avatar_url')
    .neq('id', excludeId)
    .ilike('display_name', `%${q}%`)
    .limit(limit)
  if (basic.error) throw basic.error
  return (basic.data ?? []).map((p) => ({
    ...p,
    username: null as string | null,
  })) as ChatPeerProfile[]
}

export async function searchProfilesForGroupPicker(opts: { q: string; excludeId: string; limit?: number }) {
  const { q, excludeId, limit = 16 } = opts
  const full = await supabase
    .from('profiles')
    .select('id,display_name,username')
    .neq('id', excludeId)
    .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
    .limit(limit)
  if (!full.error && full.data) {
    return full.data as { id: string; display_name: string | null; username?: string | null }[]
  }
  if (!full.error || !isMissingColumnError(full.error)) {
    if (full.error) throw full.error
    return []
  }
  const basic = await supabase
    .from('profiles')
    .select('id,display_name')
    .neq('id', excludeId)
    .ilike('display_name', `%${q}%`)
    .limit(limit)
  if (basic.error) throw basic.error
  return (basic.data ?? []) as { id: string; display_name: string | null; username?: string | null }[]
}
