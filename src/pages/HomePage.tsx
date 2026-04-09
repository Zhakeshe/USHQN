import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MiniProfileSidebar } from '../components/MiniProfileSidebar'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const CATEGORY_EMOJI: Record<string, string> = {
  robotics: '🤖', programming: '💻', sports: '⚽', debates: '🎤',
  science: '🔬', arts: '🎨', other: '🏅', music: '🎵', math: '📐',
}

export function HomePage() {
  const { userId } = useAuth()
  const { t } = useTranslation()

  const QUICK_ACTIONS = [
    { to: '/achievements', emoji: '🏆', label: t('home.quickActions.addAchievement'), color: 'from-[#0052CC] to-[#2684FF]' },
    { to: '/jobs', emoji: '💼', label: t('home.quickActions.findJob'), color: 'from-[#00875A] to-[#36B37E]' },
    { to: '/people', emoji: '👥', label: t('home.quickActions.findPeople'), color: 'from-[#6554C0] to-[#8777D9]' },
    { to: '/calendar', emoji: '📅', label: t('home.quickActions.events'), color: 'from-[#FF8B00] to-[#FFAB00]' },
  ]

  const SECTION_CARDS = [
    { to: '/achievements', title: t('home.cards.achievements.title'), desc: t('home.cards.achievements.desc'), emoji: '🏅' },
    { to: '/showcase', title: t('home.cards.showcase.title'), desc: t('home.cards.showcase.desc'), emoji: '🛍️' },
    { to: '/jobs', title: t('home.cards.jobs.title'), desc: t('home.cards.jobs.desc'), emoji: '💼' },
    { to: '/people', title: t('home.cards.people.title'), desc: t('home.cards.people.desc'), emoji: '👥' },
    { to: '/calendar', title: t('home.cards.calendar.title'), desc: t('home.cards.calendar.desc'), emoji: '📅' },
    { to: '/chat', title: t('home.cards.chat.title'), desc: t('home.cards.chat.desc'), emoji: '💬' },
    { to: '/rating', title: t('home.cards.rating.title'), desc: t('home.cards.rating.desc'), emoji: '🏆' },
    { to: '/settings', title: t('home.cards.settings.title'), desc: t('home.cards.settings.desc'), emoji: '⚙️' },
  ]

  const recentAchievements = useQuery({
    queryKey: ['achievements-preview', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [{ data: rows }, { data: cats }] = await Promise.all([
        supabase.from('achievements').select('id,title,points_awarded,created_at,category_id').eq('user_id', userId!).order('created_at', { ascending: false }).limit(4),
        supabase.from('achievement_categories').select('id,slug'),
      ])
      const slugMap = new Map((cats ?? []).map((c) => [c.id, c.slug as string]))
      return (rows ?? []).map((a) => ({ ...a, slug: slugMap.get(a.category_id) ?? 'other' }))
    },
  })

  const statsQuery = useQuery({
    queryKey: ['home-stats', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [{ count: achCount }, { count: followersCount }] = await Promise.all([
        supabase.from('achievements').select('*', { count: 'exact', head: true }).eq('user_id', userId!),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId!),
      ])
      return { achCount: achCount ?? 0, followersCount: followersCount ?? 0 }
    },
  })

  const upcomingEvents = useQuery({
    queryKey: ['upcoming-events', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase.from('events').select('id,title,starts_at,is_online').gte('starts_at', new Date().toISOString()).order('starts_at').limit(3)
      return data ?? []
    },
  })

  return (
    <div className="grid gap-5 md:grid-cols-4 md:gap-6">
      <aside className="md:col-span-1">
        <MiniProfileSidebar />
      </aside>

      <div className="space-y-5 md:col-span-3">
        {/* Welcome banner */}
        <section className="ushqn-card relative overflow-hidden p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0052CC]/5 to-transparent" aria-hidden />
          <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-[#0052CC] to-[#79B8FF]" aria-hidden />
          <div className="relative pl-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#0052CC]">{t('home.breadcrumb')}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#172B4D] sm:text-3xl">{t('home.welcome')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#6B778C]">{t('home.subtitle')}</p>
            {statsQuery.data ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full bg-[#DEEBFF] px-3 py-1 text-xs font-bold text-[#0052CC]">
                  🏆 {statsQuery.data.achCount} {t('home.achievements')}
                </span>
                <span className="rounded-full bg-[#E3FCEF] px-3 py-1 text-xs font-bold text-[#006644]">
                  👥 {statsQuery.data.followersCount} {t('home.followers')}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.to} to={a.to}
              className={`flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br ${a.color} p-4 text-center text-white shadow-md transition hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]`}>
              <span className="text-2xl">{a.emoji}</span>
              <span className="text-xs font-bold leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>

        {/* Recent achievements */}
        {(recentAchievements.data ?? []).length > 0 ? (
          <section className="ushqn-card p-5">
            <div className="ushqn-section-header">
              <h2 className="ushqn-section-title">{t('home.recentAchievements')}</h2>
              <Link to="/achievements" className="text-sm font-bold text-[#0052CC] hover:underline">{t('common.viewAll')}</Link>
            </div>
            <ul className="space-y-2">
              {(recentAchievements.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl border border-[#eef1f4] bg-[#FAFBFC] p-3 transition hover:border-[#DEEBFF]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#DEEBFF] to-[#B3D4FF] text-lg">
                    {CATEGORY_EMOJI[a.slug] ?? '🏅'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-[#172B4D]">{a.title}</p>
                    <p className="text-xs text-[#36B37E] font-semibold">+{a.points_awarded} {t('common.points')} · {new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Upcoming events */}
        {(upcomingEvents.data ?? []).length > 0 ? (
          <section className="ushqn-card p-5">
            <div className="ushqn-section-header">
              <h2 className="ushqn-section-title">{t('home.upcomingEvents')}</h2>
              <Link to="/calendar" className="text-sm font-bold text-[#0052CC] hover:underline">{t('common.viewAll')}</Link>
            </div>
            <ul className="space-y-2">
              {(upcomingEvents.data ?? []).map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border border-[#eef1f4] p-3 transition hover:border-[#E3FCEF]">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#E3FCEF] to-[#ABF5D1] text-center">
                    <span className="text-xs font-black text-[#00875A]">
                      {new Date(e.starts_at).getDate()}
                    </span>
                    <span className="text-[9px] font-bold uppercase text-[#36B37E]">
                      {new Date(e.starts_at).toLocaleString(undefined, { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-[#172B4D]">{e.title}</p>
                    <p className="text-xs text-[#6B778C]">
                      {new Date(e.starts_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {e.is_online ? ` · ${t('calendar.online')}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Section cards */}
        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#6B778C]">{t('home.sections')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECTION_CARDS.map((c) => (
              <Link key={c.to} to={c.to}
                className="group ushqn-card flex flex-col p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#B3D4FF] hover:shadow-[0_8px_24px_rgba(0,82,204,0.1)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4F5F7] text-xl transition group-hover:bg-[#EFF6FF]">
                  {c.emoji}
                </span>
                <h3 className="mt-3 text-sm font-bold text-[#172B4D] group-hover:text-[#0052CC]">{c.title}</h3>
                <p className="mt-0.5 text-xs leading-snug text-[#6B778C]">{c.desc}</p>
                <span className="mt-2 text-xs font-bold text-[#0052CC] opacity-0 transition group-hover:opacity-100">{t('common.goTo')}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
