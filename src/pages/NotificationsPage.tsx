import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getDateFnsLocale } from '../lib/dateLocale'
import { AppPageMeta } from '../components/AppPageMeta'
import { QueryState } from '../components/QueryState'

type Notif = {
  id: string
  kind: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
  actor_id: string | null
}

const KIND_ICON: Record<string, string> = {
  follow: '👤',
  message: '💬',
  system: '🏆',
  achievement_like: '❤️',
  job_alert: '💼',
  mention: '🔔',
  community: '📍',
}

export function NotificationsPage() {
  const { userId } = useAuth()
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const dfLocale = getDateFnsLocale(i18n.language)

  const notifsQuery = useQuery({
    queryKey: ['notifications', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Notif[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications', userId] })
      void qc.invalidateQueries({ queryKey: ['notif-count', userId] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId!)
        .eq('is_read', false)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications', userId] })
      void qc.invalidateQueries({ queryKey: ['notif-count', userId] })
    },
  })

  const deleteNotif = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').delete().eq('id', id)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications', userId] })
      void qc.invalidateQueries({ queryKey: ['notif-count', userId] })
    },
  })

  const notifs = notifsQuery.data ?? []
  const unreadCount = notifs.filter((n) => !n.is_read).length

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <AppPageMeta title={t('nav.notifications')} />
      <div className="ushqn-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[var(--color-ushqn-text)]">{t('notifications.title')}</h1>
            <p className="mt-0.5 text-sm text-[var(--color-ushqn-muted)]">
              {unreadCount > 0 ? t('notifications.unreadLine', { count: unreadCount }) : ''}
            </p>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="shrink-0 rounded-lg border border-[var(--color-ushqn-border)] px-4 py-2 text-sm font-semibold text-[#0052CC] transition hover:bg-[#DEEBFF]/40 dark:hover:bg-blue-950/30"
            >
              {t('notifications.markAllRead')}
            </button>
          ) : null}
        </div>
      </div>

      <QueryState
        query={notifsQuery}
        skeleton={
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="ushqn-card animate-pulse h-16" />
            ))}
          </div>
        }
      >
        {notifs.length === 0 ? (
          <div className="ushqn-card flex flex-col items-center justify-center gap-3 py-14 text-center">
            <span className="text-5xl">🔕</span>
            <p className="text-base font-bold text-[var(--color-ushqn-text)]">{t('notifications.empty')}</p>
            <Link to="/people" className="ushqn-btn-primary mt-1 px-5 py-2 text-sm">
              {t('people.title')}
            </Link>
          </div>
        ) : (
          <div className="ushqn-card divide-y divide-[var(--color-ushqn-border)] overflow-hidden">
            {notifs.map((n) => {
              const icon = KIND_ICON[n.kind] ?? '📌'
              const timeAgo = (() => {
                try {
                  return formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: dfLocale })
                } catch {
                  return ''
                }
              })()
              const content = (
                <div
                  className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${
                    n.is_read
                      ? 'hover:bg-[var(--color-ushqn-surface-muted)]'
                      : 'bg-[#EFF6FF]/40 dark:bg-blue-950/20 hover:bg-[#EFF6FF]/60 dark:hover:bg-blue-950/30'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
                      n.is_read
                        ? 'bg-[var(--color-ushqn-surface-muted)]'
                        : 'bg-[#EFF6FF] dark:bg-blue-950/40'
                    }`}
                  >
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold leading-snug ${n.is_read ? 'text-[var(--color-ushqn-text)]' : 'text-[#0052CC] dark:text-[#60a5fa]'}`}>
                      {!n.is_read ? (
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#0052CC] dark:bg-[#60a5fa] align-middle" aria-hidden />
                      ) : null}
                      {n.title}
                    </p>
                    {n.body ? <p className="mt-0.5 text-xs text-[var(--color-ushqn-muted)] line-clamp-2">{n.body}</p> : null}
                    <p className="mt-1 text-[10px] text-[var(--color-ushqn-muted)]">{timeAgo}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.is_read ? (
                      <button
                        type="button"
                        title={t('notifications.markReadTitle')}
                        onClick={(e) => { e.preventDefault(); markRead.mutate(n.id) }}
                        className="rounded-lg p-1.5 text-[var(--color-ushqn-muted)] transition hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[#0052CC]"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                        </svg>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      title={t('notifications.deleteTitle')}
                      onClick={(e) => { e.preventDefault(); deleteNotif.mutate(n.id) }}
                      className="rounded-lg p-1.5 text-[var(--color-ushqn-muted)] transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
              return n.link ? (
                <Link
                  key={n.id}
                  to={n.link}
                  className="block"
                  onClick={() => {
                    if (!n.is_read) markRead.mutate(n.id)
                  }}
                >
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              )
            })}
          </div>
        )}
      </QueryState>
    </div>
  )
}
