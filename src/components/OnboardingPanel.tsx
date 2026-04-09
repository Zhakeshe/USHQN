import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { parsePortfolioLinks } from '../lib/portfolio'
import { useToast } from '../lib/toast'

function profileStrengthPct(p: {
  headline: string | null
  location: string | null
  school_or_org: string | null
  bio: string | null
  avatar_url: string | null
  skillCount: number
  portfolioRaw: unknown
}): number {
  const pts =
    (p.headline?.trim() ? 1 : 0) +
    (p.location?.trim() ? 1 : 0) +
    (p.school_or_org?.trim() ? 1 : 0) +
    ((p.bio?.trim().length ?? 0) >= 20 ? 1 : 0) +
    (p.avatar_url ? 1 : 0) +
    (p.skillCount > 0 ? 1 : 0) +
    (parsePortfolioLinks(p.portfolioRaw).length > 0 ? 1 : 0)
  const max = 7
  return Math.min(100, Math.round((pts / max) * 100))
}

export function OnboardingPanel() {
  const { userId } = useAuth()
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()

  const profileQ = useQuery({
    queryKey: ['profile', userId, 'onboarding'],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'headline, location, school_or_org, bio, avatar_url, onboarding_bonus_claimed, onboarding_dismissed_at, onboarding_snoozed_until, portfolio_links',
        )
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })

  const skillCountQ = useQuery({
    queryKey: ['onboarding-skill-count', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count } = await supabase
        .from('profile_skills')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
      return count ?? 0
    },
  })

  const achQ = useQuery({
    queryKey: ['onboarding-ach-count', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count } = await supabase
        .from('achievements')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
      return count ?? 0
    },
  })

  const intQ = useQuery({
    queryKey: ['onboarding-int-count', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count } = await supabase
        .from('profile_interests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
      return count ?? 0
    },
  })

  const actionQ = useQuery({
    queryKey: ['onboarding-first-action', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [{ count: msg }, { count: apps }] = await Promise.all([
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', userId!),
        supabase.from('job_applications').select('*', { count: 'exact', head: true }).eq('applicant_id', userId!),
      ])
      return (msg ?? 0) > 0 || (apps ?? 0) > 0
    },
  })

  const snooze = useMutation({
    mutationFn: async () => {
      const until = new Date(Date.now() + 3 * 86400_000).toISOString()
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_snoozed_until: until, onboarding_dismissed_at: null })
        .eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', userId] })
      toast(t('growth.onboarding.snoozed'), 'info')
    },
    onError: () => toast(t('common.error'), 'error'),
  })

  const dismissForever = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_dismissed_at: new Date().toISOString(), onboarding_snoozed_until: null })
        .eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', userId] })
      toast(t('growth.onboarding.dismissedForever'), 'info')
    },
    onError: () => toast(t('common.error'), 'error'),
  })

  const claim = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('claim_onboarding_bonus')
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', userId] })
      void qc.invalidateQueries({ queryKey: ['leaderboard'] })
      void qc.invalidateQueries({ queryKey: ['total-points', userId] })
      void qc.invalidateQueries({ queryKey: ['scores', userId] })
      toast(t('growth.onboarding.bonusSuccess'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const p = profileQ.data
  const skillN = skillCountQ.data ?? 0
  const strength = useMemo(
    () =>
      p
        ? profileStrengthPct({
            headline: p.headline,
            location: p.location,
            school_or_org: p.school_or_org,
            bio: p.bio,
            avatar_url: p.avatar_url,
            skillCount: skillN,
            portfolioRaw: p.portfolio_links,
          })
        : 0,
    [p, skillN],
  )

  if (!userId || !p) return null
  if (p.onboarding_bonus_claimed) return null
  if (p.onboarding_dismissed_at) return null
  if (p.onboarding_snoozed_until && new Date(p.onboarding_snoozed_until) > new Date()) return null

  const profileOk = strength >= 86
  const hasAchievement = (achQ.data ?? 0) >= 1
  const hasInterests = (intQ.data ?? 0) >= 1
  const hasFirstAction = actionQ.data === true
  const steps = [profileOk, hasAchievement, hasInterests, hasFirstAction]
  const doneCount = steps.filter(Boolean).length
  const barPct = Math.round((doneCount / steps.length) * 100)
  const allDone = doneCount === steps.length

  return (
    <section className="ushqn-card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D]">{t('growth.onboarding.title')}</h2>
          <p className="mt-1 text-sm text-[#6B778C]">{t('growth.onboarding.subtitleRiver')}</p>
          <p className="mt-1 text-xs font-semibold text-[#0052CC]">{t('growth.onboarding.profileMeter', { pct: strength })}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            className="text-xs font-semibold text-[#6B778C] underline"
            onClick={() => snooze.mutate()}
          >
            {t('growth.onboarding.remindLater')}
          </button>
          <button
            type="button"
            className="text-[10px] font-medium text-[#97A0AF] underline"
            onClick={() => {
              if (window.confirm(t('growth.onboarding.confirmHideForever'))) dismissForever.mutate()
            }}
          >
            {t('growth.onboarding.hideForever')}
          </button>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#eef1f4]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0052CC] to-[#36B37E] transition-all"
          style={{ width: `${barPct}%` }}
        />
      </div>
      <ul className="space-y-2 text-sm">
        <li className={`flex items-center gap-2 ${profileOk ? 'text-green-700' : 'text-[#172B4D]'}`}>
          <span>{profileOk ? '✓' : '○'}</span>
          <Link className="font-semibold text-[#0052CC] hover:underline" to="/profile">
            {t('growth.onboarding.stepProfile80')}
          </Link>
        </li>
        <li className={`flex items-center gap-2 ${hasAchievement ? 'text-green-700' : 'text-[#172B4D]'}`}>
          <span>{hasAchievement ? '✓' : '○'}</span>
          <Link className="font-semibold text-[#0052CC] hover:underline" to="/achievements">
            {t('growth.onboarding.stepAchievement')}
          </Link>
        </li>
        <li className={`flex items-center gap-2 ${hasInterests ? 'text-green-700' : 'text-[#172B4D]'}`}>
          <span>{hasInterests ? '✓' : '○'}</span>
          <Link className="font-semibold text-[#0052CC] hover:underline" to="/people">
            {t('growth.onboarding.stepInterests')}
          </Link>
        </li>
        <li className={`flex items-center gap-2 ${hasFirstAction ? 'text-green-700' : 'text-[#172B4D]'}`}>
          <span>{hasFirstAction ? '✓' : '○'}</span>
          <span className="font-medium text-[#172B4D]">{t('growth.onboarding.stepFirstAction')}</span>
          <span className="text-xs text-[#6B778C]">—</span>
          <Link className="font-semibold text-[#0052CC] hover:underline" to="/jobs">
            {t('growth.onboarding.stepFirstActionJobs')}
          </Link>
          <span className="text-xs text-[#6B778C]">{t('common.or')}</span>
          <Link className="font-semibold text-[#0052CC] hover:underline" to="/chat">
            {t('growth.onboarding.stepFirstActionChat')}
          </Link>
        </li>
      </ul>
      {allDone ? (
        <button
          type="button"
          disabled={claim.isPending}
          className="ushqn-btn-primary w-full py-2.5 text-sm"
          onClick={() => claim.mutate()}
        >
          {claim.isPending ? t('growth.onboarding.claiming') : t('growth.onboarding.claimBonus')}
        </button>
      ) : null}
    </section>
  )
}
