import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CategoryScores } from '../components/CategoryScores'
import { ProfileCard } from '../components/ProfileCard'
import { SkillsCard } from '../components/SkillsCard'
import { QueryState } from '../components/QueryState'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../lib/toast'
import { isValidAccentHex } from '../lib/profileTheme'
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
  const isSelf = id === userId

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
              bio: profileQuery.data.bio,
              github_url: profileQuery.data.github_url,
              telegram_url: profileQuery.data.telegram_url,
              linkedin_url: profileQuery.data.linkedin_url,
              website_url: profileQuery.data.website_url,
              profile_views: profileQuery.data.profile_views,
            }}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!isSelf && userId ? (
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
          </div>

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
