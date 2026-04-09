import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { QueryState } from '../components/QueryState'
import { fetchLeaderboardTotals } from '../lib/leaderboard'
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
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
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
    <div className="space-y-5">
      {/* Header */}
      <div className="ushqn-card overflow-hidden p-0">
        <div
          className="px-6 py-8 text-white"
          style={{ background: 'linear-gradient(135deg, #0052CC 0%, #2684FF 100%)' }}
        >
          <h1 className="text-2xl font-extrabold tracking-tight">{t('rating.title')}</h1>
          <p className="mt-1 text-sm text-blue-100">{t('rating.subtitle')}</p>
        </div>
      </div>

      <QueryState
        query={leaderboardQuery}
        skeleton={
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="ushqn-card animate-pulse h-16" />
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="ushqn-card flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="text-5xl">🏅</span>
            <p className="text-lg font-bold text-[#172B4D]">{t('rating.noData')}</p>
            <p className="max-w-sm text-sm text-[#6B778C]">{t('rating.emptyHint')}</p>
            <Link to="/achievements" className="ushqn-btn-primary mt-2 px-5 py-2 text-sm">
              {t('achievements.add')}
            </Link>
          </div>
        ) : (
        <>
          {/* Top 3 podium */}
          {top3.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {top3.map((u) => {
                const isSelf = u.user_id === userId
                const grad = colorFor(u.user_id)
                const podiumConfig = {
                  1: { emoji: '🥇', bg: 'from-[#FFF3B0] to-[#FFE066]', border: 'border-[#FFD700]', textColor: 'text-[#7A4F00]', size: 'text-4xl' },
                  2: { emoji: '🥈', bg: 'from-[#E8E8E8] to-[#C8C8C8]', border: 'border-[#BDBDBD]', textColor: 'text-[#424242]', size: 'text-3xl' },
                  3: { emoji: '🥉', bg: 'from-[#FFD9B0] to-[#FFAB6B]', border: 'border-[#FF8C42]', textColor: 'text-[#6D2600]', size: 'text-3xl' },
                }[u.rank as 1|2|3] ?? { emoji: '🏅', bg: 'from-white to-[#f4f5f7]', border: 'border-[#DFE1E6]', textColor: 'text-[#172B4D]', size: 'text-2xl' }
                return (
                  <div
                    key={u.user_id}
                    className={`ushqn-card flex flex-col items-center gap-3 bg-gradient-to-b ${podiumConfig.bg} border-2 ${podiumConfig.border} p-5 text-center transition-all hover:scale-[1.02] ${isSelf ? 'ring-2 ring-[#0052CC] ring-offset-2' : ''}`}
                  >
                    <span className={podiumConfig.size}>{podiumConfig.emoji}</span>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover shadow-md" />
                    ) : (
                      <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${grad} text-lg font-bold text-white shadow-md`}>
                        {getInitials(u.display_name)}
                      </div>
                    )}
                    <div>
                      <Link to={`/u/${u.user_id}`} className={`block text-sm font-bold hover:underline ${podiumConfig.textColor}`}>
                        {u.display_name}
                      </Link>
                      {isSelf ? <span className="text-xs font-semibold text-[#0052CC]">{t('rating.you')} ✨</span> : null}
                    </div>
                    <div className={`text-2xl font-extrabold ${podiumConfig.textColor}`}>
                      {u.points}
                    </div>
                    <div className={`text-xs font-medium ${podiumConfig.textColor}/60`}>{t('common.points')}</div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {/* Rest of leaderboard */}
          {rest.length > 0 ? (
            <div className="ushqn-card divide-y divide-[#f4f5f7]">
              {rest.map((u) => {
                const isSelf = u.user_id === userId
                const grad = colorFor(u.user_id)
                return (
                  <div
                    key={u.user_id}
                    className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                      isSelf ? 'bg-[#DEEBFF]/50' : 'hover:bg-[#f8f9fc]'
                    }`}
                  >
                    <span className="w-7 shrink-0 text-center text-sm font-bold text-[#6B778C]">
                      {u.rank}
                    </span>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${grad} text-sm font-bold text-white`}>
                        {getInitials(u.display_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link to={`/u/${u.user_id}`} className="block truncate text-sm font-semibold text-[#172B4D] hover:text-[#0052CC] hover:underline">
                        {u.display_name}
                      </Link>
                      {isSelf ? <span className="text-xs text-[#0052CC] font-medium">{t('rating.you')}</span> : null}
                    </div>
                    <span className="shrink-0 text-base font-extrabold text-[#0052CC]">{u.points}</span>
                  </div>
                )
              })}
            </div>
          ) : null}
        </>
        )}
      </QueryState>
    </div>
  )
}
