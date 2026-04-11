import type { PostgrestError } from '@supabase/supabase-js'
import type { TFunction } from 'i18next'

export function isPostgrestError(e: unknown): e is PostgrestError {
  return typeof e === 'object' && e !== null && 'message' in e && typeof (e as PostgrestError).message === 'string'
}

/** Short, user-facing detail for Supabase/PostgREST errors (toast / inline). */
export function formatSupabaseError(e: unknown, t: TFunction): string {
  if (isPostgrestError(e)) {
    const msg = (e.message ?? '').trim()
    const code = e.code ?? ''
    const combined = `${code} ${msg}`.toLowerCase()

    if (msg.includes('Too many messages') || combined.includes('rate')) {
      return t('errors.rateLimit')
    }
    if (
      combined.includes('reply_to_id') ||
      combined.includes('does not exist') ||
      combined.includes('schema cache') ||
      code === '42703'
    ) {
      return t('errors.schemaOutdated')
    }
    if (msg.includes('not a community member') || combined.includes('not a community member')) {
      return t('communities.notMember')
    }
    if (combined.includes('not authenticated')) {
      return t('errors.notAuthenticated')
    }
    if (code === 'PGRST202' || combined.includes('could not find the function')) {
      return t('errors.rpcMissing')
    }
    if (msg && msg.length <= 200) return msg
    if (msg) return `${msg.slice(0, 197)}…`
  }
  if (e instanceof Error && e.message) {
    const m = e.message
    if (/fetch|network|failed to fetch|load failed/i.test(m)) return t('errors.network')
    return m.length <= 200 ? m : `${m.slice(0, 197)}…`
  }
  return t('common.error')
}
