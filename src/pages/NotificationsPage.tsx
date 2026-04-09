import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getDateFnsLocale } from '../lib/dateLocale'
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
      <div className="ushqn-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#172B4D]">{t('notifications.title')}</h1>
            <p className="mt-0.5 text-sm text-[#6B778C]">
              {unreadCount > 0 ? t('notifications.unreadLine', { count: unreadCount }) : ''}
            </p>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="shrink-0 rounded-lg border border-[#DFE1E6] px-4 py-2 text-sm font-semibold text-[#0052CC] transition hover:bg-[#DEEBFF]"
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
            <p className="text-base font-bold text-[#172B4D]">{t('notifications.empty')}</p>
            <Link to="/people" className="ushqn-btn-primary mt-1 px-5 py-2 text-sm">
              {t('people.title')}
            </Link>
          </div>
        ) : (
          <div className="ushqn-card divide-y divide-[#f4f5f7] overflow-hidden">
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
                  className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                    n.is_read ? '' : 'bg-[#DEEBFF]/30'
                  } hover:bg-[#f8f9fc]`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                      n.is_read ? 'bg-[#F4F5F7]' : 'bg-[#DEEBFF]'
                    }`}
                  >
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${n.is_read ? 'text-[#172B4D]' : 'text-[#0052CC]'}`}>
                      {n.title}
                      {!n.is_read ? (
                        <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#0052CC] align-middle" aria-hidden />
                      ) : null}
                    </p>
                    {n.body ? <p className="mt-0.5 truncate text-xs text-[#6B778C]">{n.body}</p> : null}
                    <p className="mt-1 text-[10px] text-[#97A0AF]">{timeAgo}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.is_read ? (
                      <button
                        type="button"
                        title={t('notifications.markReadTitle')}
                        onClick={(e) => {
                          e.preventDefault()
                          markRead.mutate(n.id)
                        }}
                        className="rounded-md p-1.5 text-[#6B778C] hover:bg-gray-100"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                        </svg>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      title={t('notifications.deleteTitle')}
                      onClick={(e) => {
                        e.preventDefault()
                        deleteNotif.mutate(n.id)
                      }}
                      className="rounded-md p-1.5 text-[#97A0AF] hover:bg-red-50 hover:text-red-400"
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
