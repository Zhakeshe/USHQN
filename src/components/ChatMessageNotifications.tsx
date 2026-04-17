import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const MAX_CONV_SUBS = 36

/**
 * Browser notifications for new chat messages (when tab is in background or another route).
 * Respects user_settings: notify_messages and push_notify_opt_in; requires Notification permission.
 */
export function ChatMessageNotifications() {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([])

  const sidebarQuery = useQuery({
    queryKey: ['chat-sidebar', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_chat_sidebar')
      if (error) throw error
      return (data ?? []) as { conversation_id: string }[]
    },
  })

  const settingsQuery = useQuery({
    queryKey: ['user-settings', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('user_settings').select('notify_messages,push_notify_opt_in').eq('user_id', userId!).maybeSingle()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (!userId || typeof window === 'undefined' || !('Notification' in window)) return
    /* In-tab browser Notification API — only needs notify_messages + permission (not web-push opt-in). */
    const notifyOn = settingsQuery.data?.notify_messages !== false
    if (!notifyOn) {
      for (const ch of channelsRef.current) void supabase.removeChannel(ch)
      channelsRef.current = []
      return
    }
    if (Notification.permission !== 'granted') {
      for (const ch of channelsRef.current) void supabase.removeChannel(ch)
      channelsRef.current = []
      return
    }

    const rows = sidebarQuery.data ?? []
    const convIds = rows.map((r) => r.conversation_id).filter(Boolean).slice(0, MAX_CONV_SUBS)

    for (const ch of channelsRef.current) void supabase.removeChannel(ch)
    channelsRef.current = []

    for (const convId of convIds) {
      const ch = supabase
        .channel(`msg-desktop-notif:${userId}:${convId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
          (payload) => {
            const row = payload.new as { sender_id?: string; body?: string | null; conversation_id?: string }
            if (!row?.sender_id || row.sender_id === userId) return

            const path = window.location.pathname
            const viewingThis =
              path.startsWith('/chat/') && path.includes(row.conversation_id ?? '')
            if (document.visibilityState === 'visible' && viewingThis) return

            const body = (row.body ?? '').replace(/\s+/g, ' ').trim()
            const snippet = body.length > 140 ? `${body.slice(0, 137)}…` : body || t('chat.lastMessagePreview')
            try {
              new Notification(t('chat.browserNotifyTitle'), {
                body: snippet,
                icon: '/favicon.svg',
                tag: `ushqn-chat-${row.conversation_id}`,
              })
            } catch {
              /* ignore */
            }
          },
        )
        .subscribe()
      channelsRef.current.push(ch)
    }

    return () => {
      for (const ch of channelsRef.current) void supabase.removeChannel(ch)
      channelsRef.current = []
    }
  }, [userId, sidebarQuery.data, settingsQuery.data, t])

  return null
}
