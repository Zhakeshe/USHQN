import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AppPageMeta } from '../components/AppPageMeta'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import type { UserRole } from '../types/database'

type OnboardingStep = 'welcome' | 'role' | 'profile' | 'invite' | 'done'

const ORDER: OnboardingStep[] = ['welcome', 'role', 'profile', 'invite', 'done']

function stepIndex(step: string | null | undefined): number {
  const idx = ORDER.indexOf((step ?? 'welcome') as OnboardingStep)
  return idx >= 0 ? idx : 0
}

function trimOrNull(v: string): string | null {
  const x = v.trim()
  return x.length ? x : null
}

export function OnboardingFlowPage() {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [roleDraft, setRoleDraft] = useState<UserRole>('student')
  const [displayName, setDisplayName] = useState('')
  const [headline, setHeadline] = useState('')
  const [location, setLocation] = useState('')
  const [schoolOrOrg, setSchoolOrOrg] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const profileQuery = useQuery({
    queryKey: ['onboarding-profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name,role,headline,location,school_or_org,onboarding_step,onboarding_completed_at')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })

  const isStudent = roleDraft === 'student' || roleDraft === 'pupil'

  useEffect(() => {
    const p = profileQuery.data
    if (!p) return
    setRoleDraft((p.role as UserRole) ?? 'student')
    setDisplayName(p.display_name ?? '')
    setHeadline(p.headline ?? '')
    setLocation(p.location ?? '')
    setSchoolOrOrg(p.school_or_org ?? '')
  }, [profileQuery.data])

  const currentIdx = stepIndex(profileQuery.data?.onboarding_step)
  const currentStep: OnboardingStep = ORDER[Math.max(0, Math.min(currentIdx, ORDER.length - 1))]
  const maxVisualSteps = ORDER.length - 1

  const linkQuery = useQuery({
    queryKey: ['student-invites', userId],
    enabled: Boolean(userId && isStudent),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_links')
        .select('id,link_type,invite_code,expires_at,status')
        .eq('student_id', userId!)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data ?? []).filter((r) => r.status === 'pending')
    },
  })

  const saveRole = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: roleDraft })
        .eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['onboarding-profile', userId] })
    },
  })

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: trimOrNull(displayName) ?? 'User',
          headline: trimOrNull(headline),
          location: trimOrNull(location),
          school_or_org: trimOrNull(schoolOrOrg),
        })
        .eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['onboarding-profile', userId] })
    },
  })

  const goToStep = useMutation({
    mutationFn: async (next: OnboardingStep) => {
      const patch =
        next === 'done'
          ? { onboarding_step: 'done', onboarding_completed_at: new Date().toISOString() }
          : { onboarding_step: next }
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['onboarding-profile', userId] })
    },
  })

  const createInvite = useMutation({
    mutationFn: async (linkType: 'parent' | 'teacher') => {
      const { error } = await supabase.rpc('create_student_invite', { p_link_type: linkType })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['student-invites', userId] })
      toast(t('onboarding.inviteCreated'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const acceptInvite = useMutation({
    mutationFn: async () => {
      const code = inviteCode.trim().toLowerCase()
      if (!code) throw new Error(t('onboarding.inviteCodeRequired'))
      const { error } = await supabase.rpc('accept_student_invite', { p_invite_code: code })
      if (error) throw error
    },
    onSuccess: () => {
      setInviteCode('')
      toast(t('onboarding.inviteAccepted'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const busy = saveRole.isPending || saveProfile.isPending || goToStep.isPending

  const stepTitle = useMemo(() => {
    switch (currentStep) {
      case 'welcome':
        return t('onboarding.steps.welcome.title')
      case 'role':
        return t('onboarding.steps.role.title')
      case 'profile':
        return t('onboarding.steps.profile.title')
      case 'invite':
        return t('onboarding.steps.invite.title')
      case 'done':
      default:
        return t('onboarding.steps.done.title')
    }
  }, [currentStep, t])

  async function nextStep() {
    if (!userId) return
    if (currentStep === 'role') await saveRole.mutateAsync()
    if (currentStep === 'profile') await saveProfile.mutateAsync()
    if (currentStep === 'done') {
      await goToStep.mutateAsync('done')
      navigate('/home', { replace: true })
      return
    }
    const next = ORDER[Math.min(currentIdx + 1, ORDER.length - 1)]
    await goToStep.mutateAsync(next)
    if (next === 'done') {
      navigate('/home', { replace: true })
    }
  }

  async function prevStep() {
    if (!userId) return
    const prev = ORDER[Math.max(0, currentIdx - 1)]
    await goToStep.mutateAsync(prev)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4 py-8">
      <AppPageMeta title={t('onboarding.metaTitle')} />
      <section className="w-full rounded-3xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] p-6 shadow-[0_16px_70px_-30px_rgba(0,82,204,.4)] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0052CC]">{t('onboarding.kicker')}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-[var(--color-ushqn-text)] sm:text-3xl">{stepTitle}</h1>
        <p className="mt-2 text-sm text-[var(--color-ushqn-muted)]">{t('onboarding.subtitle')}</p>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--color-ushqn-surface-muted)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0052CC] to-[#36B37E] transition-all duration-300"
            style={{ width: `${Math.round((Math.min(currentIdx + 1, maxVisualSteps) / maxVisualSteps) * 100)}%` }}
          />
        </div>

        <div className="mt-6 space-y-4">
          {currentStep === 'welcome' ? (
            <div className="rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] p-4">
              <p className="text-sm leading-relaxed text-[var(--color-ushqn-text)]">{t('onboarding.steps.welcome.body')}</p>
            </div>
          ) : null}

          {currentStep === 'role' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['student', 'pupil', 'parent', 'teacher'] as UserRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleDraft(role)}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    roleDraft === role
                      ? 'border-[#0052CC] bg-[#E9F2FF] dark:bg-[#0f223d]'
                      : 'border-[var(--color-ushqn-border)] hover:border-[#0052CC]/50'
                  }`}
                >
                  <p className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t(`onboarding.roles.${role}.label`)}</p>
                  <p className="mt-1 text-xs text-[var(--color-ushqn-muted)]">{t(`onboarding.roles.${role}.desc`)}</p>
                </button>
              ))}
            </div>
          ) : null}

          {currentStep === 'profile' ? (
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-[var(--color-ushqn-text)]">{t('onboarding.fields.displayName')}</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="ushqn-input"
                  placeholder={t('onboarding.fields.displayNamePh')}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-[var(--color-ushqn-text)]">{t('onboarding.fields.headline')}</span>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="ushqn-input"
                  placeholder={t('onboarding.fields.headlinePh')}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[var(--color-ushqn-text)]">{t('onboarding.fields.location')}</span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="ushqn-input"
                    placeholder={t('onboarding.fields.locationPh')}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[var(--color-ushqn-text)]">{t('onboarding.fields.schoolOrg')}</span>
                  <input
                    value={schoolOrOrg}
                    onChange={(e) => setSchoolOrOrg(e.target.value)}
                    className="ushqn-input"
                    placeholder={t('onboarding.fields.schoolOrgPh')}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {currentStep === 'invite' ? (
            <div className="space-y-3">
              {isStudent ? (
                <>
                  <p className="text-sm text-[var(--color-ushqn-muted)]">{t('onboarding.steps.invite.studentBody')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => createInvite.mutate('parent')}
                      className="rounded-xl border border-[var(--color-ushqn-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ushqn-text)] hover:bg-[var(--color-ushqn-surface-muted)]"
                    >
                      {t('onboarding.inviteParent')}
                    </button>
                    <button
                      type="button"
                      onClick={() => createInvite.mutate('teacher')}
                      className="rounded-xl border border-[var(--color-ushqn-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ushqn-text)] hover:bg-[var(--color-ushqn-surface-muted)]"
                    >
                      {t('onboarding.inviteTeacher')}
                    </button>
                  </div>
                  {(linkQuery.data ?? []).length > 0 ? (
                    <ul className="space-y-2">
                      {(linkQuery.data ?? []).map((r) => (
                        <li key={r.id} className="rounded-xl border border-[var(--color-ushqn-border)] p-3 text-sm">
                          <span className="font-bold uppercase text-[var(--color-ushqn-muted)]">{r.link_type}</span>
                          <code className="ml-2 rounded bg-[var(--color-ushqn-surface-muted)] px-2 py-0.5 font-black text-[#0052CC]">{r.invite_code}</code>
                          <span className="ml-2 text-xs text-[var(--color-ushqn-muted)]">
                            {t('onboarding.expiresAt', { date: new Date(r.expires_at).toLocaleDateString() })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-sm text-[var(--color-ushqn-muted)]">{t('onboarding.steps.invite.guardianBody')}</p>
                  <div className="flex gap-2">
                    <input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="ushqn-input"
                      placeholder={t('onboarding.inviteCodePh')}
                    />
                    <button
                      type="button"
                      onClick={() => acceptInvite.mutate()}
                      className="rounded-xl bg-[#0052CC] px-4 py-2 text-sm font-bold text-white hover:bg-[#0747A6]"
                    >
                      {t('onboarding.acceptInvite')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-7 flex items-center justify-between">
          <button
            type="button"
            disabled={busy || currentIdx <= 0}
            onClick={() => void prevStep()}
            className="rounded-xl border border-[var(--color-ushqn-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ushqn-text)] disabled:opacity-50"
          >
            {t('onboarding.back')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void nextStep()}
            className="rounded-xl bg-[#0052CC] px-5 py-2 text-sm font-bold text-white shadow hover:bg-[#0747A6] disabled:opacity-60"
          >
            {currentStep === 'done' ? t('onboarding.finish') : t('onboarding.next')}
          </button>
        </div>
      </section>
    </div>
  )
}
