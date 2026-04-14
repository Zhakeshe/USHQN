import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CategoryScores } from '../components/CategoryScores'
import { ContentReportDialog } from '../components/ContentReportDialog'
import { ProfileCard } from '../components/ProfileCard'
import { SkillsCard } from '../components/SkillsCard'
import { TrustSignals } from '../components/TrustSignals'
import { QueryState } from '../components/QueryState'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../lib/toast'
import { isValidAccentHex } from '../lib/profileTheme'
import { parsePortfolioLinks } from '../lib/portfolio'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types/database'

function profileErrorIsNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string }
  return e.code === 'PGRST116' || Boolean(e.message?.toLowerCase().includes('0 rows'))
}

export function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const isSelf = id === userId
  const [reportOpen, setReportOpen] = useState(false)
  const [recText, setRecText] = useState('')
  const [recPublic, setRecPublic] = useState(true)
  const [mentorNote, setMentorNote] = useState('')

  const followersQuery = useQuery({
    queryKey: ['followers-count', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id!),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id!),
      ])
      return { followers: followersCount ?? 0, following: followingCount ?? 0 }
    },
  })

  const isFollowingQuery = useQuery({
    queryKey: ['is-following', userId, id],
    enabled: Boolean(userId && id && !isSelf),
    queryFn: async () => {
      const { data } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId!).eq('following_id', id!)
      return (data as unknown as { count: number } | null)?.count !== undefined
        ? false
        : Boolean(data)
    },
  })

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !id) return
      const isFollowing = isFollowingQuery.data
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', id)
      } else {
        await supabase.from('follows').insert({ follower_id: userId, following_id: id })
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['is-following', userId, id] })
      void qc.invalidateQueries({ queryKey: ['followers-count', id] })
      void qc.invalidateQueries({ queryKey: ['people-all', userId] })
    },
  })

  // Proper check using count
  const [isFollowing, setIsFollowing] = useState(false)
  useEffect(() => {
    if (!userId || !id || isSelf) return
    void supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId).eq('following_id', id).then(({ count }) => {
      setIsFollowing((count ?? 0) > 0)
    })
  }, [userId, id, isSelf, followMutation.isSuccess])

  const profileQuery = useQuery({
    queryKey: ['profile', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })

  const skillsQuery = useQuery({
    queryKey: ['skills', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_skills')
        .select('skill')
        .eq('user_id', id!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data.map((r) => r.skill)
    },
  })

  const recommendationsQuery = useQuery({
    queryKey: ['profile-recommendations', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_recommendations')
        .select('id, body, is_public, created_at, author_id')
        .eq('subject_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      const authorIds = [...new Set((data ?? []).map((r) => r.author_id))]
      if (!authorIds.length) return []
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', authorIds)
      const names = new Map((profs ?? []).map((p) => [p.id, p.display_name]))
      return (data ?? []).map((r) => ({ ...r, author_name: names.get(r.author_id) ?? '—' }))
    },
  })

  const mentorshipRequest = useMutation({
    mutationFn: async () => {
      if (!userId || !id || userId === id) return
      const { error } = await supabase.from('mentorship_requests').insert({
        mentee_id: userId,
        mentor_id: id,
        note: mentorNote.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setMentorNote('')
      toast(t('mentorship.requestSent'), 'info')
    },
    onError: (e: unknown) => {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code?: string }).code : ''
      if (code === '23505') toast(t('mentorship.duplicate'), 'error')
      else toast(t('common.error'), 'error')
    },
  })

  const addRec = useMutation({
    mutationFn: async () => {
      if (!userId || !id || userId === id) return
      const body = recText.trim()
      if (body.length < 2) throw new Error(t('trust.recommendation.tooShort'))
      const { error } = await supabase.from('profile_recommendations').upsert(
        { author_id: userId, subject_id: id, body, is_public: recPublic },
        { onConflict: 'author_id,subject_id' },
      )
      if (error) throw error
    },
    onSuccess: () => {
      setRecText('')
      void qc.invalidateQueries({ queryKey: ['profile-recommendations', id] })
      toast(t('trust.recommendation.saved'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const scoresQuery = useQuery({
    queryKey: ['scores', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [{ data: scores, error: e1 }, { data: cats, error: e2 }] = await Promise.all([
        supabase.from('user_category_scores').select('category_id, points').eq('user_id', id!),
        supabase.from('achievement_categories').select('id, label_ru'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      const labels = new Map((cats ?? []).map((c) => [c.id, c.label_ru]))
      return (scores ?? []).map((s) => ({
        category_label: labels.get(s.category_id) ?? '—',
        points: s.points,
      }))
    },
  })

  if (!id) {
    return <Navigate to="/people" replace />
  }

  if (profileQuery.isError && profileErrorIsNotFound(profileQuery.error)) {
    return (
      <div className="ushqn-card flex flex-col items-center gap-3 py-14 text-center">
        <span className="text-4xl">🔍</span>
        <p className="text-lg font-bold text-[#172B4D]">{t('publicProfile.notFound')}</p>
        <p className="max-w-sm text-sm text-[#6B778C]">{t('publicProfile.notFoundDesc')}</p>
        <Link to="/people" className="ushqn-btn-primary mt-2 px-5 py-2 text-sm">
          {t('people.title')}
        </Link>
      </div>
    )
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const profileUrl = `${origin}/u/${id}`

  async function dm() {
    const { data, error } = await supabase.rpc('get_or_create_dm', { other_id: id })
    if (error) {
      toast(t('jobs.chatOpenErr'), 'error')
      return
    }
    void navigate(`/chat/${data}`)
  }

  return (
    <QueryState
      query={profileQuery}
      skeleton={
        <div className="space-y-4">
          <div className="ushqn-card animate-pulse h-48" />
          <div className="ushqn-card animate-pulse h-32" />
        </div>
      }
    >
      {profileQuery.data ? (
        <div>
          <Helmet>
            <title>
              {profileQuery.data.display_name} — USHQN
            </title>
            <meta name="description" content={profileQuery.data.headline ?? profileQuery.data.display_name} />
            <link rel="canonical" href={profileUrl} />
            <meta property="og:type" content="profile" />
            <meta property="og:title" content={profileQuery.data.display_name} />
            <meta property="og:description" content={profileQuery.data.headline ?? ''} />
            <meta property="og:url" content={profileUrl} />
            {profileQuery.data.avatar_url ? (
              <meta property="og:image" content={profileQuery.data.avatar_url} />
            ) : (
              <meta property="og:image" content={`${origin}/favicon.svg`} />
            )}
            <meta name="twitter:card" content="summary" />
          </Helmet>

          <ProfileCard
            profile={{
              display_name: profileQuery.data.display_name,
              location: profileQuery.data.location,
              headline: profileQuery.data.headline,
              school_or_org: profileQuery.data.school_or_org,
              role: profileQuery.data.role as UserRole,
              avatar_url: profileQuery.data.avatar_url,
              banner_url: profileQuery.data.banner_url,
              accent_color: profileQuery.data.accent_color,
              org_verified: profileQuery.data.org_verified,
              bio: profileQuery.data.bio,
              github_url: profileQuery.data.github_url,
              telegram_url: profileQuery.data.telegram_url,
              linkedin_url: profileQuery.data.linkedin_url,
              website_url: profileQuery.data.website_url,
              profile_views: profileQuery.data.profile_views,
            }}
          />

          <div className="mt-4">
            <TrustSignals
              createdAt={profileQuery.data.created_at}
              orgVerified={profileQuery.data.org_verified}
              headline={profileQuery.data.headline}
              location={profileQuery.data.location}
              schoolOrOrg={profileQuery.data.school_or_org}
              bio={profileQuery.data.bio}
              avatarUrl={profileQuery.data.avatar_url}
              skillsCount={skillsQuery.data?.length ?? 0}
              portfolioRaw={(profileQuery.data as { portfolio_links?: unknown }).portfolio_links}
            />
          </div>

          {parsePortfolioLinks((profileQuery.data as { portfolio_links?: unknown }).portfolio_links).length > 0 ? (
            <section className="ushqn-card mt-4 p-5">
              <h2 className="text-base font-bold text-[#172B4D]">{t('profile.edit.portfolioTitle')}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {parsePortfolioLinks((profileQuery.data as { portfolio_links?: unknown }).portfolio_links).map((l) => (
                  <li key={l.url + l.label}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="font-semibold text-[#0052CC] hover:underline">
                      {l.label}
                    </a>
                    <span className="ml-2 text-[10px] font-bold uppercase text-[#97A0AF]">{l.kind ?? 'link'}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Followers / Following stats */}
          {followersQuery.data ? (
            <div className="mt-4 flex gap-4 px-1">
              <div className="text-center">
                <span className="block text-lg font-black text-[#172B4D]">{followersQuery.data.followers}</span>
                <span className="text-[11px] font-semibold text-[#6B778C]">{t('profile.followersCount')}</span>
              </div>
              <div className="text-center">
                <span className="block text-lg font-black text-[#172B4D]">{followersQuery.data.following}</span>
                <span className="text-[11px] font-semibold text-[#6B778C]">{t('publicProfile.following')}</span>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!isSelf && userId ? (
              <>
                {/* Follow button */}
                <button
                  type="button"
                  disabled={followMutation.isPending}
                  onClick={() => {
                    setIsFollowing((v) => !v)
                    followMutation.mutate()
                  }}
                  className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
                    isFollowing
                      ? 'border-[#0052CC] bg-[#EFF6FF] text-[#0052CC] hover:bg-[#DEEBFF]'
                      : 'border-[#DFE1E6] bg-white text-[#172B4D] hover:border-[#0052CC] hover:bg-[#DEEBFF]/40'
                  }`}
                >
                  {isFollowing ? `✓ ${t('publicProfile.follow')}` : `+ ${t('publicProfile.follow')}`}
                </button>
                <button
                  type="button"
                  className="rounded-full px-5 py-2 text-sm font-semibold text-white"
                  style={{
                    backgroundColor: isValidAccentHex(profileQuery.data.accent_color)
                      ? profileQuery.data.accent_color
                      : '#0052CC',
                  }}
                  onClick={() => void dm()}
                >
                  {t('publicProfile.message')}
                </button>
                <div className="flex w-full min-w-[14rem] max-w-sm flex-col gap-1 rounded-xl border border-[#eef1f4] bg-[#FAFBFC] p-3 sm:w-auto">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-[#6B778C]" htmlFor="mentor-note">
                    {t('mentorship.label')}
                  </label>
                  <textarea
                    id="mentor-note"
                    className="ushqn-input min-h-[56px] resize-none text-xs"
                    value={mentorNote}
                    onChange={(e) => setMentorNote(e.target.value)}
                    placeholder={t('mentorship.placeholder')}
                  />
                  <button
                    type="button"
                    disabled={mentorshipRequest.isPending}
                    className="rounded-lg border border-[#DFE1E6] bg-white px-4 py-2 text-xs font-bold text-[#172B4D] hover:bg-[#F4F5F7]"
                    onClick={() => mentorshipRequest.mutate()}
                  >
                    {mentorshipRequest.isPending ? t('mentorship.sending') : t('mentorship.cta')}
                  </button>
                </div>
              </>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-[#DFE1E6] px-4 py-2 text-sm font-semibold text-[#172B4D] hover:bg-[#F4F5F7]"
              onClick={() => {
                void navigator.clipboard.writeText(profileUrl).then(() => {
                  toast(t('common.copied'))
                })
              }}
            >
              {t('publicProfile.shareLink')}
            </button>
            {!isSelf && userId ? (
              <button
                type="button"
                className="rounded-full border border-red-100 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                onClick={() => setReportOpen(true)}
              >
                {t('trust.report.open')}
              </button>
            ) : null}
          </div>

          <ContentReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="profile" targetId={id!} />

          {(recommendationsQuery.data ?? []).length > 0 || (!isSelf && userId) ? (
            <section className="ushqn-card mt-4 space-y-3 p-5">
              <h2 className="text-base font-bold text-[#172B4D]">{t('trust.recommendation.title')}</h2>
              <p className="text-xs leading-relaxed text-[#6B778C]">{t('trust.recommendation.visibilityHelp')}</p>
              {!isSelf && userId ? (
                <div className="space-y-2 rounded-xl border border-[#eef1f4] bg-[#FAFBFC] p-3">
                  <textarea
                    className="ushqn-input min-h-[72px] resize-none text-sm"
                    placeholder={t('trust.recommendation.placeholder')}
                    value={recText}
                    onChange={(e) => setRecText(e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-xs font-medium text-[#6B778C]">
                    <input type="checkbox" checked={recPublic} onChange={(e) => setRecPublic(e.target.checked)} />
                    {t('trust.recommendation.public')}
                  </label>
                  <button
                    type="button"
                    disabled={addRec.isPending}
                    className="ushqn-btn-primary px-4 py-1.5 text-xs"
                    onClick={() => addRec.mutate()}
                  >
                    {addRec.isPending ? t('trust.recommendation.sending') : t('trust.recommendation.submit')}
                  </button>
                </div>
              ) : null}
              <ul className="space-y-2">
                {(recommendationsQuery.data ?? []).map((r) => (
                  <li key={r.id} className="rounded-lg border border-[#eef1f4] bg-white px-3 py-2 text-sm">
                    <p className="font-semibold text-[#172B4D]">{r.author_name}</p>
                    <p className="text-[#6B778C]">{r.body}</p>
                    {!r.is_public ? (
                      <p className="mt-1 text-[10px] text-[#97A0AF]">{t('trust.recommendation.privateNote')}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <SkillsCard
            skills={skillsQuery.data ?? []}
            newSkill=""
            onNewSkillChange={() => {}}
            onAdd={() => {}}
            onRemove={() => {}}
            readOnly
          />

          <CategoryScores rows={scoresQuery.data ?? []} />
        </div>
      ) : null}
    </QueryState>
  )
}
