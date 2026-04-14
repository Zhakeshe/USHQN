import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { supabase } from '../lib/supabase'
import { QueryState } from '../components/QueryState'

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

export function PeoplePage() {
  const { userId } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const qUrl = searchParams.get('q') ?? ''
  const [searchText, setSearchText] = useState(qUrl)
  const debouncedQ = useDebouncedValue(searchText.trim(), 350)

  useEffect(() => {
    setSearchText(qUrl)
  }, [qUrl])

  useEffect(() => {
    const cur = searchParams.get('q') ?? ''
    if (cur === debouncedQ) return
    const next = new URLSearchParams(searchParams)
    if (debouncedQ) next.set('q', debouncedQ)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }, [debouncedQ, searchParams, setSearchParams])

  const interestsQuery = useQuery({
    queryKey: ['interests-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('interests').select('id,label_ru').order('label_ru')
      if (error) throw error
      return data ?? []
    },
  })

  const ALL_ID = '__all__'
  const [interestId, setInterestId] = useState<string>(ALL_ID)

  const isAll = interestId === ALL_ID

  const allPeopleQuery = useQuery({
    queryKey: ['people-all', userId],
    enabled: isAll,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', userId ?? '')
        .order('display_name', { ascending: true })
        .limit(200)
      if (error) throw error
      const ids = (profiles ?? []).map((p) => p.id)
      if (ids.length === 0) return []
      const { data: vis } = await supabase
        .from('user_settings')
        .select('user_id, show_in_people_search')
        .in('user_id', ids)
      const hidden = new Set((vis ?? []).filter((v) => v.show_in_people_search === false).map((v) => v.user_id))
      return (profiles ?? []).filter((p) => !hidden.has(p.id))
    },
  })

  const peopleQuery = useQuery({
    queryKey: ['people-by-interest', interestId],
    enabled: !isAll && Boolean(interestId),
    queryFn: async () => {
      const { data: links, error: e1 } = await supabase
        .from('profile_interests')
        .select('user_id')
        .eq('interest_id', interestId)
      if (e1) throw e1
      const ids = (links ?? []).map((l) => l.user_id).filter((id) => id !== userId)
      if (ids.length === 0) return []
      const { data: profiles, error: e2 } = await supabase.from('profiles').select('*').in('id', ids)
      if (e2) throw e2
      const { data: vis } = await supabase
        .from('user_settings')
        .select('user_id, show_in_people_search')
        .in('user_id', ids)
      const hidden = new Set(
        (vis ?? []).filter((v) => v.show_in_people_search === false).map((v) => v.user_id),
      )
      return (profiles ?? []).filter((p) => !hidden.has(p.id))
    },
  })

  const activeQuery = isAll ? allPeopleQuery : peopleQuery

  const allPeopleCount = allPeopleQuery.data?.length ?? null
  const [followed, setFollowed] = useState<Set<string>>(new Set())

  async function follow(targetId: string) {
    if (!userId) return
    await supabase.from('follows').insert({ follower_id: userId, following_id: targetId })
    setFollowed((prev) => new Set(prev).add(targetId))
  }

  async function openChat(targetId: string) {
    const { data, error } = await supabase.rpc('get_or_create_dm', { other_id: targetId })
    if (error) { console.error(error); return }
    void navigate(`/chat/${data}`)
  }

  const filteredPeople = useMemo(() => {
    const raw = activeQuery.data ?? []
    if (!debouncedQ) return raw
    const q = debouncedQ.toLowerCase()
    return raw.filter((p) =>
      `${p.display_name} ${p.headline ?? ''} ${p.location ?? ''}`.toLowerCase().includes(q),
    )
  }, [activeQuery.data, debouncedQ])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="ushqn-card p-6">
        <h1 className="text-2xl font-extrabold text-[#172B4D] tracking-tight">
          {t('people.title')}
        </h1>
        <p className="mt-1 text-sm text-[#6B778C]">
          {t('people.subtitle')}
        </p>
        <div className="mt-4 max-w-md">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('people.search')}
            className="ushqn-input w-full"
            autoComplete="off"
            name="people-search"
            enterKeyHint="search"
          />
        </div>

        {/* Interest chips */}
        <div className="mt-5 flex flex-wrap gap-2">
          {/* ALL chip */}
          <button
            type="button"
            onClick={() => setInterestId(ALL_ID)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 ${
              isAll
                ? 'border-[#0052CC] bg-[#0052CC] text-white shadow-md shadow-blue-200'
                : 'border-[#DFE1E6] bg-white text-[#172B4D] hover:border-[#0052CC] hover:bg-[#DEEBFF]/40'
            }`}
          >
            {t('people.all')}
            {allPeopleCount !== null ? (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isAll ? 'bg-white/20 text-white' : 'bg-[#EFF6FF] text-[#0052CC]'}`}>
                {allPeopleCount}
              </span>
            ) : null}
          </button>
          {(interestsQuery.data ?? []).map((i) => {
            const active = i.id === interestId
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => setInterestId(i.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 ${
                  active
                    ? 'border-[#0052CC] bg-[#0052CC] text-white shadow-md shadow-blue-200'
                    : 'border-[#DFE1E6] bg-white text-[#172B4D] hover:border-[#0052CC] hover:bg-[#DEEBFF]/40'
                }`}
              >
                {i.label_ru}
              </button>
            )
          })}
        </div>
      </div>

      {/* Results */}
      {<QueryState
        query={activeQuery}
        skeleton={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="ushqn-card h-36 animate-pulse p-5" />
            ))}
          </div>
        }
      >
        {filteredPeople.length === 0 ? (
          <div className="ushqn-card flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eff3f8] text-2xl">👥</div>
            <p className="text-base font-semibold text-[#172B4D]">{t('people.empty')}</p>
            {(activeQuery.data ?? []).length > 0 ? (
              <button
                type="button"
                className="ushqn-btn-primary mt-2 px-5 py-2 text-sm"
                onClick={() => {
                  setSearchText('')
                  const next = new URLSearchParams(searchParams)
                  next.delete('q')
                  setSearchParams(next, { replace: true })
                }}
              >
                {t('people.clearSearch')}
              </button>
            ) : null}
          </div>
        ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((p) => {
            const grad = colorFor(p.id)
            const isFollowed = followed.has(p.id)
            return (
              <div key={p.id} className="ushqn-card flex flex-col p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${grad} text-base font-bold text-white`}
                    >
                      {getInitials(p.display_name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/u/${p.id}`}
                      className="block truncate text-sm font-bold text-[#172B4D] hover:text-[#0052CC]"
                    >
                      {p.display_name}
                    </Link>
                    {p.headline ? (
                      <p className="mt-0.5 truncate text-xs text-[#6B778C]">{p.headline}</p>
                    ) : null}
                    {p.location ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[#97a0af]">
                        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                          <path fillRule="evenodd" d="m7.539 14.841.003.003.002.002a.755.755 0 0 0 .912 0l.002-.002.003-.003.012-.009a5.57 5.57 0 0 0 .19-.153 15.588 15.588 0 0 0 2.046-2.082c1.101-1.382 2.291-3.535 2.291-5.597A5 5 0 0 0 3 8c0 2.062 1.19 4.215 2.291 5.597a15.591 15.591 0 0 0 2.046 2.082 8.916 8.916 0 0 0 .189.153l.013.01ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clipRule="evenodd" />
                        </svg>
                        {p.location}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 rounded-full border py-1.5 text-xs font-semibold transition ${
                      isFollowed
                        ? 'border-[#0052CC] bg-[#DEEBFF] text-[#0052CC]'
                        : 'border-[#DFE1E6] text-[#172B4D] hover:border-[#0052CC] hover:bg-[#DEEBFF]/40'
                    }`}
                    onClick={() => void follow(p.id)}
                  >
                    {isFollowed ? `✓ ${t('people.unfollow')}` : `+ ${t('people.follow')}`}
                  </button>
                  <button
                    type="button"
                    className="ushqn-btn-primary flex-1 py-1.5 text-xs"
                    onClick={() => void openChat(p.id)}
                  >
                    💬 {t('people.message')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        )}
      </QueryState>
      }
    </div>
  )
}
