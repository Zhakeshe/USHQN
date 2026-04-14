import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MiniProfileSidebar } from '../components/MiniProfileSidebar'
import { OnboardingPanel } from '../components/OnboardingPanel'
import { WeeklyDigestCard } from '../components/WeeklyDigestCard'
import { MissionsTeaserCard } from '../components/MissionsTeaserCard'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { clearReferralFromStorage } from '../lib/referral'

const CATEGORY_EMOJI: Record<string, string> = {
  robotics: '🤖', programming: '💻', sports: '⚽', debates: '🎤',
  science: '🔬', arts: '🎨', other: '🏅', music: '🎵', math: '📐',
}

export function HomePage() {
  const { userId } = useAuth()
  const { t } = useTranslation()
  const qc = useQueryClient()

  useEffect(() => {
    if (!userId) return
    void supabase.auth.getUser().then(({ data }) => {
      const c = data.user?.created_at
      if (!c) return
      if (Date.now() - new Date(c).getTime() < 5 * 60_000) clearReferralFromStorage()
    })
  }, [userId])

  const QUICK_ACTIONS = [
    { to: '/achievements', emoji: '🏆', label: t('home.quickActions.addAchievement'), color: 'from-[#0052CC] to-[#2684FF]' },
    { to: '/jobs', emoji: '💼', label: t('home.quickActions.findJob'), color: 'from-[#00875A] to-[#36B37E]' },
    { to: '/people', emoji: '👥', label: t('home.quickActions.findPeople'), color: 'from-[#6554C0] to-[#8777D9]' },
    { to: '/calendar', emoji: '📅', label: t('home.quickActions.events'), color: 'from-[#FF8B00] to-[#FFAB00]' },
    { to: '/communities', emoji: '📍', label: t('home.quickActions.communities'), color: 'from-[#00B8D9] to-[#79E2F2]' },
  ]

  const SECTION_CARDS = [
    { to: '/achievements', title: t('home.cards.achievements.title'), desc: t('home.cards.achievements.desc'), emoji: '🏅' },
    { to: '/showcase', title: t('home.cards.showcase.title'), desc: t('home.cards.showcase.desc'), emoji: '🛍️' },
    { to: '/jobs', title: t('home.cards.jobs.title'), desc: t('home.cards.jobs.desc'), emoji: '💼' },
    { to: '/people', title: t('home.cards.people.title'), desc: t('home.cards.people.desc'), emoji: '👥' },
    { to: '/calendar', title: t('home.cards.calendar.title'), desc: t('home.cards.calendar.desc'), emoji: '📅' },
    { to: '/communities', title: t('home.cards.communities.title'), desc: t('home.cards.communities.desc'), emoji: '📍' },
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

  const streakQuery = useQuery({
    queryKey: ['profile-streak', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('activity_streak_count, activity_streak_last_utc')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (!userId) return
    void supabase.rpc('touch_activity_streak').then(({ error }) => {
      if (!error) void qc.invalidateQueries({ queryKey: ['profile-streak', userId] })
    })
  }, [userId, qc])

  const upcomingEvents = useQuery({
    queryKey: ['upcoming-events', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase.from('events').select('id,title,starts_at,is_online').gte('starts_at', new Date().toISOString()).order('starts_at').limit(3)
      return data ?? []
    },
  })

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr] lg:gap-6">
      {/* LinkedIn-style left profile sidebar */}
      <aside className="hidden lg:block">
        <MiniProfileSidebar />
      </aside>

      <div className="space-y-4">
      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className="ushqn-card flex items-center gap-3 p-3.5 transition hover:shadow-md cursor-pointer"
          onClick={() => window.location.href = '/achievements'}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0052CC]/10 to-[#2684FF]/5 text-xl">🏆</span>
          <div>
            <p className="text-lg font-extrabold text-[var(--color-ushqn-text)]">{statsQuery.data?.achCount ?? '—'}</p>
            <p className="text-[11px] text-[var(--color-ushqn-muted)]">{t('home.achievements')}</p>
          </div>
        </div>
        <div
          className="ushqn-card flex items-center gap-3 p-3.5 transition hover:shadow-md cursor-pointer"
          onClick={() => window.location.href = '/people'}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#36B37E]/10 to-[#00875A]/5 text-xl">👥</span>
          <div>
            <p className="text-lg font-extrabold text-[var(--color-ushqn-text)]">{statsQuery.data?.followersCount ?? '—'}</p>
            <p className="text-[11px] text-[var(--color-ushqn-muted)]">{t('home.followers')}</p>
          </div>
        </div>
        <div
          className="ushqn-card flex items-center gap-3 p-3.5 transition hover:shadow-md cursor-pointer"
          onClick={() => window.location.href = '/chat'}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6554C0]/10 to-[#8777D9]/5 text-xl">💬</span>
          <div>
            <p className="text-sm font-bold text-[var(--color-ushqn-text)]">{t('home.cards.chat.title')}</p>
            <p className="text-[11px] text-[var(--color-ushqn-muted)]">{t('home.cards.chat.desc')}</p>
          </div>
        </div>
        {streakQuery.data && (streakQuery.data.activity_streak_count ?? 0) > 0 ? (
          <div className="ushqn-card flex items-center gap-3 p-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF8B00]/15 to-[#FFAB00]/5 text-xl">🔥</span>
            <div>
              <p className="text-lg font-extrabold text-[var(--color-ushqn-text)]">{streakQuery.data.activity_streak_count}</p>
              <p className="text-[11px] text-[var(--color-ushqn-muted)]">{t('home.streakDays')}</p>
            </div>
          </div>
        ) : (
          <div
            className="ushqn-card flex items-center gap-3 p-3.5 transition hover:shadow-md cursor-pointer"
            onClick={() => window.location.href = '/jobs'}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF5630]/10 to-[#FF8B00]/5 text-xl">💼</span>
            <div>
              <p className="text-sm font-bold text-[var(--color-ushqn-text)]">{t('home.cards.jobs.title')}</p>
              <p className="text-[11px] text-[var(--color-ushqn-muted)]">{t('home.cards.jobs.desc')}</p>
            </div>
          </div>
        )}
      </div>

      <OnboardingPanel />

      {/* Quick actions */}
      <div>
        <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-ushqn-muted)]">{t('home.quickActionsLabel')}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.to} to={a.to}
              className={`flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br ${a.color} p-3.5 text-center text-white shadow-md transition hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]`}
            >
              <span className="text-2xl">{a.emoji}</span>
              <span className="text-[11px] font-bold leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <WeeklyDigestCard />
      <MissionsTeaserCard />

      {/* Recent achievements + events in 2-col on wider screens */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent achievements */}
        {(recentAchievements.data ?? []).length > 0 ? (
          <section className="ushqn-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('home.recentAchievements')}</h2>
              <Link to="/achievements" className="text-xs font-bold text-[#0052CC] hover:underline">{t('common.viewAll')}</Link>
            </div>
            <ul className="space-y-2">
              {(recentAchievements.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] p-3 transition hover:border-[#B3D4FF]">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#DEEBFF] to-[#B3D4FF] text-base">
                    {CATEGORY_EMOJI[a.slug] ?? '🏅'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--color-ushqn-text)]">{a.title}</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">+{a.points_awarded} {t('common.points')}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Upcoming events */}
        {(upcomingEvents.data ?? []).length > 0 ? (
          <section className="ushqn-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('home.upcomingEvents')}</h2>
              <Link to="/calendar" className="text-xs font-bold text-[#0052CC] hover:underline">{t('common.viewAll')}</Link>
            </div>
            <ul className="space-y-2">
              {(upcomingEvents.data ?? []).map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] p-3 transition hover:border-[#ABF5D1]">
                  <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#E3FCEF] to-[#ABF5D1]">
                    <span className="text-xs font-black text-[#00875A]">{new Date(e.starts_at).getDate()}</span>
                    <span className="text-[9px] font-bold uppercase text-[#36B37E]">{new Date(e.starts_at).toLocaleString(undefined, { month: 'short' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--color-ushqn-text)]">{e.title}</p>
                    <p className="text-[11px] text-[var(--color-ushqn-muted)]">
                      {new Date(e.starts_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {e.is_online ? ` · ${t('calendar.online')}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {/* 4 key section shortcuts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SECTION_CARDS.slice(0, 4).map((c) => (
          <Link key={c.to} to={c.to}
            className="group ushqn-card flex items-center gap-3 p-3.5 transition hover:-translate-y-0.5 hover:border-[#B3D4FF] hover:shadow-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-ushqn-surface-muted)] text-xl transition group-hover:bg-[#EFF6FF]">
              {c.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--color-ushqn-text)] group-hover:text-[#0052CC]">{c.title}</p>
              <p className="line-clamp-1 text-[11px] text-[var(--color-ushqn-muted)]">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
      </div>{/* end main col */}
    </div>
  )
}
