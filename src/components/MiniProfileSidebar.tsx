import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { findRankForUser, fetchLeaderboardTotals } from '../lib/leaderboard'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types/database'

function calcCompletion(p: {
  headline?: string | null
  location?: string | null
  school_or_org?: string | null
  avatar_url?: string | null
  banner_url?: string | null
}) {
  const checks = [
    Boolean(p.headline),
    Boolean(p.location),
    Boolean(p.school_or_org),
    Boolean(p.avatar_url),
    Boolean(p.banner_url),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function CompletionBar({ pct }: { pct: number }) {
  const { t } = useTranslation()
  const color = pct >= 80 ? 'from-[#00875A] to-[#36B37E]' : pct >= 40 ? 'from-[#FF8B00] to-[#FFAB00]' : 'from-[#FF5630] to-[#FF7452]'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#6B778C]">{t('profile.completion.label')}</span>
        <span className="text-xs font-bold text-[#172B4D]">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#F4F5F7]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct < 100 ? (
        <p className="mt-1 text-[10px] text-[#97A0AF]">
          {pct < 40 ? t('profile.completion.low') : pct < 80 ? t('profile.completion.mid') : t('profile.completion.high')}
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-[#36B37E] font-semibold">{t('profile.completion.full')}</p>
      )}
    </div>
  )
}

export function MiniProfileSidebar() {
  const { userId } = useAuth()
  const { t } = useTranslation()

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single()
      if (error) throw error
      return data
    },
  })

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => fetchLeaderboardTotals(supabase),
  })

  const scoresQuery = useQuery({
    queryKey: ['total-points', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_category_scores')
        .select('points')
        .eq('user_id', userId!)
      if (error) throw error
      return (data ?? []).reduce((s, r) => s + (r.points as number), 0)
    },
  })

  const notifQuery = useQuery({
    queryKey: ['notif-count', userId],
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .eq('is_read', false)
      if (error) return 0
      return count ?? 0
    },
  })

  const p = profileQuery.data
  if (!p) {
    return (
      <div className="ushqn-card animate-pulse p-6">
        <div className="h-20 rounded-lg bg-[#EEF1F4]" />
        <div className="mx-auto mt-4 h-16 w-16 rounded-full bg-[#EEF1F4]" />
        <div className="mx-auto mt-3 h-4 w-40 max-w-[85%] rounded bg-[#EEF1F4]" />
        <div className="mt-3 h-2 rounded-full bg-[#EEF1F4]" />
      </div>
    )
  }

  const roleKey = p.role as UserRole
  const rank = findRankForUser(leaderboardQuery.data ?? [], userId)
  const totalPoints = scoresQuery.data ?? 0
  const completion = calcCompletion(p)
  const unread = notifQuery.data ?? 0

  return (
    <div className="ushqn-card overflow-hidden">
      {/* Banner */}
      <div className="relative h-[4.5rem] bg-gradient-to-br from-[#0052CC] via-[#2066DD] to-[#64A0F0]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(255,255,255,0.5),transparent_55%)] opacity-90 mix-blend-overlay" />
      </div>

      {/* Avatar + name */}
      <div className="relative flex flex-col items-center px-4 pb-2 pt-0">
        <div className="-mt-9 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-[4px] border-white bg-[#EEF1F4] text-2xl shadow-lg ring-1 ring-black/[0.06]">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span aria-hidden>🧑‍🎓</span>
          )}
        </div>
        <h2 className="mt-3 text-center text-lg font-extrabold text-[#172B4D] leading-tight">{p.display_name}</h2>
        <p className="mt-0.5 text-xs font-semibold text-[#6B778C]">{t(`profile.roles.${roleKey}`)}</p>
        {p.headline ? (
          <p className="mt-1 text-center text-xs text-[#97A0AF] line-clamp-2 px-2">{p.headline}</p>
        ) : null}
      </div>

      {/* Stats */}
      <div className="mx-3 mb-3 overflow-hidden rounded-xl bg-[#FAFBFC] ring-1 ring-[#EEF1F4]">
        <div className="grid grid-cols-2 divide-x divide-[#EEF1F4]">
          <div className="flex flex-col items-center py-3">
            <span className="text-xl font-extrabold text-[#0052CC]">{totalPoints}</span>
            <span className="text-[10px] font-semibold text-[#6B778C]">{t('profile.stats.points')}</span>
          </div>
          <div className="flex flex-col items-center py-3">
            <span className="text-xl font-extrabold text-[#172B4D]">
              {rank != null ? `#${rank}` : leaderboardQuery.isLoading ? '…' : '—'}
            </span>
            <span className="text-[10px] font-semibold text-[#6B778C]">{t('profile.stats.rank')}</span>
          </div>
        </div>

        {/* Profile completion */}
        <div className="border-t border-[#EEF1F4] px-3 py-2.5">
          <CompletionBar pct={completion} />
        </div>

        {/* Notifications hint */}
        {unread > 0 ? (
          <Link
            to="/notifications"
            className="flex items-center justify-between border-t border-[#EEF1F4] px-3 py-2 hover:bg-[#f4f5f7] transition"
          >
            <span className="text-xs font-semibold text-[#172B4D]">🔔 {t('nav.notifications')}</span>
            <span className="rounded-full bg-[#FF5630] px-2 py-0.5 text-[9px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          </Link>
        ) : null}
      </div>

      {/* CTA */}
      <div className="px-3 pb-4">
        <Link
          to="/profile"
          className="block w-full rounded-lg bg-[#0052CC] py-2.5 text-center text-sm font-bold text-white shadow-[0_1px_2px_rgba(0,82,204,0.25)] transition hover:bg-[#0747A6]"
        >
          {t('profile.openProfile')}
        </Link>
      </div>
    </div>
  )
}
