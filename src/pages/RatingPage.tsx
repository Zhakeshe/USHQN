import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { AppPageMeta } from '../components/AppPageMeta'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { QueryState } from '../components/QueryState'
import { fetchLeaderboardTotals, type LeaderboardRow } from '../lib/leaderboard'
import { supabase } from '../lib/supabase'

const AVATAR_COLORS = [
  'from-[#0052CC] to-[#2684FF]',
  'from-[#00875A] to-[#36B37E]',
  'from-[#6554C0] to-[#8777D9]',
  'from-[#FF5630] to-[#FF8B00]',
  'from-[#00B8D9] to-[#79E2F2]',
]

function colorFor(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function PodiumCard({
  u,
  userId,
  slot,
  delayMs,
  t,
}: {
  u: LeaderboardRow
  userId: string | null
  slot: 1 | 2 | 3
  delayMs: number
  t: TFunction
}) {
  const isSelf = u.user_id === userId
  const grad = colorFor(u.user_id)
  const podiumConfig = {
    1: {
      emoji: '🥇',
      h: 'min-h-[220px] sm:min-h-[260px]',
      pad: 'pb-8 pt-10',
      scale: 'sm:scale-[1.06] z-10',
      bar: 'h-24 sm:h-28',
      barBg: 'from-amber-400/90 via-amber-300 to-amber-500/80',
      ring: 'shadow-[0_20px_50px_-12px_rgba(245,158,11,0.45)]',
    },
    2: {
      emoji: '🥈',
      h: 'min-h-[180px] sm:min-h-[210px]',
      pad: 'pb-6 pt-8',
      scale: '',
      bar: 'h-16 sm:h-20',
      barBg: 'from-slate-300/95 via-slate-200 to-slate-400/90',
      ring: 'shadow-lg shadow-slate-400/25',
    },
    3: {
      emoji: '🥉',
      h: 'min-h-[160px] sm:min-h-[190px]',
      pad: 'pb-5 pt-7',
      scale: '',
      bar: 'h-12 sm:h-16',
      barBg: 'from-orange-300/95 via-orange-200 to-amber-700/40',
      ring: 'shadow-lg shadow-orange-400/20',
    },
  }[slot]

  return (
    <div
      className={`ushqn-rating-rise flex flex-col items-center ${podiumConfig.h} ${podiumConfig.pad} ${podiumConfig.scale} ${
        isSelf ? 'ring-2 ring-[#0052CC] ring-offset-2 ring-offset-[var(--color-ushqn-bg)] dark:ring-offset-[#0f172a]' : ''
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="ushqn-rating-hero-float flex flex-col items-center gap-2">
        <span className="text-3xl sm:text-4xl drop-shadow-sm">{podiumConfig.emoji}</span>
        {u.avatar_url ? (
          <img
            src={u.avatar_url}
            alt=""
            loading="lazy"
            className="h-14 w-14 rounded-full border-4 border-white/90 object-cover shadow-xl dark:border-white/20"
          />
        ) : (
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full border-4 border-white/90 bg-gradient-to-br ${grad} text-lg font-bold text-white shadow-xl dark:border-white/20`}
          >
            {getInitials(u.display_name)}
          </div>
        )}
        <div className="text-center">
          <Link
            to={`/u/${u.user_id}`}
            className="block max-w-[9rem] truncate text-sm font-extrabold text-[var(--color-ushqn-text)] underline-offset-2 hover:underline"
          >
            {u.display_name}
          </Link>
          {isSelf ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#0052CC]">{t('rating.you')} ✨</span>
          ) : null}
        </div>
        <div className="text-2xl font-black tabular-nums text-[var(--color-ushqn-text)]">{u.points}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ushqn-muted)]">{t('common.points')}</div>
      </div>
      <div
        className={`mt-auto w-full rounded-t-2xl bg-gradient-to-t ${podiumConfig.barBg} ${podiumConfig.bar} ${podiumConfig.ring}`}
        aria-hidden
      />
    </div>
  )
}

function Podium({ top3, userId, t }: { top3: LeaderboardRow[]; userId: string | null; t: TFunction }) {
  const second = top3.find((r) => r.rank === 2)
  const first = top3.find((r) => r.rank === 1)
  const third = top3.find((r) => r.rank === 3)

  if (top3.length === 1 && first) {
    return (
      <div className="flex justify-center px-2">
        <div className="w-full max-w-xs rounded-3xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)]/80 p-2 shadow-xl backdrop-blur-sm">
          <PodiumCard u={first} userId={userId} slot={1} delayMs={0} t={t} />
        </div>
      </div>
    )
  }

  return (
    <div className="relative px-1 sm:px-2">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-[var(--color-ushqn-border)] to-transparent opacity-60"
      />
      <div className="mx-auto flex max-w-3xl flex-row items-end justify-center gap-1.5 sm:gap-4">
        <div className="flex min-w-0 flex-1 justify-end">
          {second ? <PodiumCard u={second} userId={userId} slot={2} delayMs={80} t={t} /> : <div className="flex-1" />}
        </div>
        <div className="flex min-w-0 flex-1 justify-center">
          {first ? <PodiumCard u={first} userId={userId} slot={1} delayMs={0} t={t} /> : null}
        </div>
        <div className="flex min-w-0 flex-1 justify-start">
          {third ? <PodiumCard u={third} userId={userId} slot={3} delayMs={160} t={t} /> : <div className="flex-1" />}
        </div>
      </div>
    </div>
  )
}

export function RatingPage() {
  const { userId } = useAuth()
  const { t } = useTranslation()
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => fetchLeaderboardTotals(supabase),
  })

  const rows = leaderboardQuery.data ?? []
  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)

  return (
    <div className="space-y-6">
      <AppPageMeta title={`${t('nav.rating')} · USHQN`} />
      <div className="ushqn-card overflow-hidden p-0 shadow-xl">
        <div className="ushqn-rating-hero-mesh relative px-6 py-10 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 animate-pulse rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{t('rating.title')}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90">{t('rating.subtitle')}</p>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/80">{t('rating.leaderboardKicker')}</p>
          </div>
        </div>
      </div>

      <QueryState
        query={leaderboardQuery}
        skeleton={
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="ushqn-card h-16 animate-pulse" />
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="ushqn-card flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="ushqn-rating-hero-float text-5xl">🏅</span>
            <p className="text-lg font-bold text-[var(--color-ushqn-text)]">{t('rating.noData')}</p>
            <p className="max-w-sm text-sm text-[var(--color-ushqn-muted)]">{t('rating.emptyHint')}</p>
            <Link to="/achievements" className="ushqn-btn-primary mt-2 px-5 py-2 text-sm">
              {t('achievements.add')}
            </Link>
          </div>
        ) : (
          <>
            {top3.length > 0 ? <Podium top3={top3} userId={userId} t={t} /> : null}

            {rest.length > 0 ? (
              <div className="ushqn-card overflow-hidden border-[var(--color-ushqn-border)] p-0">
                <div className="border-b border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)]/80 px-5 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-ushqn-muted)]">
                    {t('rating.fullBoard')}
                  </p>
                </div>
                <div className="divide-y divide-[var(--color-ushqn-border)]">
                  {rest.map((u, i) => {
                    const isSelf = u.user_id === userId
                    const grad = colorFor(u.user_id)
                    return (
                      <div
                        key={u.user_id}
                        className={`ushqn-rating-rise flex items-center gap-4 px-4 py-3.5 sm:px-5 ${
                          isSelf ? 'bg-[#DEEBFF]/40 dark:bg-[#1e3a5f]/35' : 'hover:bg-[var(--color-ushqn-surface-muted)]/60'
                        }`}
                        style={{ animationDelay: `${Math.min(i, 12) * 45 + 200}ms` }}
                      >
                        <span className="w-8 shrink-0 text-center text-sm font-black tabular-nums text-[var(--color-ushqn-muted)]">
                          {u.rank}
                        </span>
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt=""
                            loading="lazy"
                            className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-2 ring-[var(--color-ushqn-border)]"
                          />
                        ) : (
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-sm font-bold text-white ring-2 ring-[var(--color-ushqn-border)]`}
                          >
                            {getInitials(u.display_name)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/u/${u.user_id}`}
                            className="block truncate text-sm font-bold text-[var(--color-ushqn-text)] hover:text-[#0052CC] hover:underline"
                          >
                            {u.display_name}
                          </Link>
                          {isSelf ? (
                            <span className="text-xs font-semibold text-[#0052CC]">{t('rating.you')}</span>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-lg font-black tabular-nums text-[#0052CC]">{u.points}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </QueryState>
    </div>
  )
}
