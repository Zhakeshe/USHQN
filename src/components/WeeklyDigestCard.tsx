import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { getDateFnsLocale } from '../lib/dateLocale'

export function WeeklyDigestCard() {
  const { userId } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = getDateFnsLocale(i18n.language)

  const digest = useQuery({
    queryKey: ['weekly-digest', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
      const [{ count: newJobs }, { count: unreadNotif }, { data: events }] = await Promise.all([
        supabase.from('jobs').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId!).eq('is_read', false),
        supabase
          .from('events')
          .select('id,title,starts_at')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(4),
      ])
      return { newJobs: newJobs ?? 0, unreadNotif: unreadNotif ?? 0, events: events ?? [] }
    },
  })

  const d = digest.data
  if (!d) return null

  return (
    <section className="ushqn-card p-5">
      <div className="ushqn-section-header">
        <h2 className="ushqn-section-title">{t('growth.digest.title')}</h2>
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#97A0AF]">{t('growth.digest.window')}</span>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        <li className="flex items-center justify-between rounded-lg bg-[#FAFBFC] px-3 py-2">
          <span className="text-[#6B778C]">{t('growth.digest.newJobs')}</span>
          <span className="font-bold text-[#0052CC]">{d.newJobs}</span>
        </li>
        <li className="flex items-center justify-between rounded-lg bg-[#FAFBFC] px-3 py-2">
          <Link to="/notifications" className="text-[#6B778C] hover:text-[#0052CC]">
            {t('growth.digest.unreadNotifications')}
          </Link>
          <span className="font-bold text-[#FF5630]">{d.unreadNotif}</span>
        </li>
      </ul>
      {d.events.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#6B778C]">{t('growth.digest.upcomingEvents')}</p>
          <ul className="mt-2 space-y-1">
            {d.events.map((e) => (
              <li key={e.id} className="truncate text-sm text-[#172B4D]">
                <span className="font-semibold text-[#0052CC]">{format(new Date(e.starts_at), 'd MMM', { locale })}</span>
                {' · '}
                {e.title}
              </li>
            ))}
          </ul>
          <Link to="/calendar" className="mt-2 inline-block text-xs font-bold text-[#0052CC] hover:underline">
            {t('growth.digest.openCalendar')}
          </Link>
        </div>
      ) : null}
      <Link to="/chat" className="mt-3 inline-block text-xs font-bold text-[#0052CC] hover:underline">
        {t('growth.digest.openChat')}
      </Link>
    </section>
  )
}
