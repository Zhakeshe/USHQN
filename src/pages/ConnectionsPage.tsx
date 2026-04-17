import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppPageMeta } from '../components/AppPageMeta'
import { QueryState } from '../components/QueryState'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import type { UserRole } from '../types/database'

type LinkRow = {
  id: string
  student_id: string
  guardian_id: string | null
  link_type: 'parent' | 'teacher'
  status: 'pending' | 'accepted' | 'revoked'
  invite_code: string
  expires_at: string
  created_at: string
  accepted_at: string | null
}

export function ConnectionsPage() {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [inviteCode, setInviteCode] = useState('')

  const roleQuery = useQuery({
    queryKey: ['connections-role', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('role').eq('id', userId!).single()
      if (error) throw error
      return (data?.role as UserRole) ?? 'student'
    },
  })

  const role = roleQuery.data ?? 'student'
  const isStudent = role === 'student' || role === 'pupil'
  const isParent = role === 'parent'
  const isTeacher = role === 'teacher'

  const studentLinksQuery = useQuery({
    queryKey: ['connections-student-links', userId],
    enabled: Boolean(userId && isStudent),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_links')
        .select('id,student_id,guardian_id,link_type,status,invite_code,expires_at,created_at,accepted_at')
        .eq('student_id', userId!)
        .order('created_at', { ascending: false })
        .limit(24)
      if (error) throw error
      return (data ?? []) as LinkRow[]
    },
  })

  const guardianLinksQuery = useQuery({
    queryKey: ['connections-guardian-links', userId, role],
    enabled: Boolean(userId && (isParent || isTeacher)),
    queryFn: async () => {
      const wantType = isParent ? 'parent' : 'teacher'
      const { data, error } = await supabase
        .from('student_links')
        .select('id,student_id,guardian_id,link_type,status,invite_code,expires_at,created_at,accepted_at')
        .eq('guardian_id', userId!)
        .eq('link_type', wantType)
        .order('created_at', { ascending: false })
        .limit(24)
      if (error) throw error
      return (data ?? []) as LinkRow[]
    },
  })

  const studentIds = useMemo(() => {
    const rows = guardianLinksQuery.data ?? []
    const ids = [...new Set(rows.map((r) => r.student_id).filter(Boolean))]
    return ids
  }, [guardianLinksQuery.data])

  const guardianIds = useMemo(() => {
    const rows = studentLinksQuery.data ?? []
    const ids = [...new Set(rows.map((r) => r.guardian_id).filter(Boolean) as string[])]
    return ids
  }, [studentLinksQuery.data])

  const studentProfilesQuery = useQuery({
    queryKey: ['connections-student-profiles', studentIds.join(',')],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id,display_name').in('id', studentIds)
      if (error) throw error
      return new Map((data ?? []).map((p) => [p.id as string, p.display_name as string]))
    },
  })

  const guardianProfilesQuery = useQuery({
    queryKey: ['connections-guardian-profiles', guardianIds.join(',')],
    enabled: guardianIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id,display_name').in('id', guardianIds)
      if (error) throw error
      return new Map((data ?? []).map((p) => [p.id as string, p.display_name as string]))
    },
  })

  const createInvite = useMutation({
    mutationFn: async (linkType: 'parent' | 'teacher') => {
      const { error } = await supabase.rpc('create_student_invite', { p_link_type: linkType })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['connections-student-links', userId] })
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
      void qc.invalidateQueries({ queryKey: ['connections-guardian-links', userId, role] })
      toast(t('onboarding.inviteAccepted'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const deletePendingInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('student_links').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['connections-student-links', userId] })
      void qc.invalidateQueries({ queryKey: ['student-invites', userId] })
      toast(t('connections.inviteRevoked'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const titleKey = isParent
    ? 'connections.titleParent'
    : isTeacher
      ? 'connections.titleTeacher'
      : 'connections.titleStudent'

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast(t('connections.copied'))
    } catch {
      toast(t('connections.copyFailed'), 'error')
    }
  }

  if (!isStudent && !isParent && !isTeacher) {
    return (
      <div className="space-y-4">
        <AppPageMeta title={t('connections.metaTitle')} />
        <div className="ushqn-card p-6">
          <h1 className="text-xl font-bold text-[var(--color-ushqn-text)]">{t('connections.unavailableTitle')}</h1>
          <p className="mt-2 text-sm text-[var(--color-ushqn-muted)]">{t('connections.unavailableBody')}</p>
          <Link to="/settings" className="mt-4 inline-block text-sm font-bold text-[#0052CC] hover:underline">
            {t('nav.settings')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AppPageMeta title={t('connections.metaTitle')} />
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--color-ushqn-text)]">{t(titleKey)}</h1>
        <p className="mt-1 text-sm text-[var(--color-ushqn-muted)]">{t('connections.subtitle')}</p>
      </div>

      <QueryState query={roleQuery} skeleton={<div className="ushqn-card h-24 animate-pulse" />}>
        {isParent || isTeacher ? (
          <section className="ushqn-card space-y-4 p-5">
            <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('connections.acceptSection')}</h2>
            <p className="text-xs text-[var(--color-ushqn-muted)]">{t('connections.acceptHint')}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="ushqn-input flex-1"
                placeholder={t('onboarding.inviteCodePh')}
                autoComplete="off"
              />
              <button
                type="button"
                disabled={acceptInvite.isPending}
                className="rounded-xl bg-[var(--color-ushqn-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                onClick={() => acceptInvite.mutate()}
              >
                {t('onboarding.acceptInvite')}
              </button>
            </div>
          </section>
        ) : null}

        {isStudent ? (
          <>
            <section className="ushqn-card space-y-4 p-5">
              <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('connections.createInvites')}</h2>
              <p className="text-xs text-[var(--color-ushqn-muted)]">{t('connections.createInvitesHint')}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={createInvite.isPending}
                  className="rounded-xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] px-4 py-2 text-xs font-bold text-[var(--color-ushqn-text)] hover:border-[#0052CC]/40 disabled:opacity-50"
                  onClick={() => createInvite.mutate('parent')}
                >
                  {t('onboarding.inviteParent')}
                </button>
                <button
                  type="button"
                  disabled={createInvite.isPending}
                  className="rounded-xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] px-4 py-2 text-xs font-bold text-[var(--color-ushqn-text)] hover:border-[#0052CC]/40 disabled:opacity-50"
                  onClick={() => createInvite.mutate('teacher')}
                >
                  {t('onboarding.inviteTeacher')}
                </button>
              </div>
            </section>

            <QueryState query={studentLinksQuery} skeleton={<div className="ushqn-card h-32 animate-pulse" />}>
              <section className="ushqn-card p-0">
                <div className="border-b border-[var(--color-ushqn-border)] px-5 py-4">
                  <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('connections.myInvites')}</h2>
                </div>
                {(studentLinksQuery.data ?? []).length === 0 ? (
                  <p className="p-5 text-sm text-[var(--color-ushqn-muted)]">{t('connections.emptyStudent')}</p>
                ) : (
                  <ul className="divide-y divide-[var(--color-ushqn-border)]">
                    {(studentLinksQuery.data ?? []).map((row) => (
                      <li key={row.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ushqn-muted)]">
                            {row.link_type === 'parent' ? t('profile.roles.parent') : t('profile.roles.teacher')} ·{' '}
                            <span className="text-[var(--color-ushqn-text)]">{row.status}</span>
                          </p>
                          <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-ushqn-text)]">{row.invite_code}</p>
                          <p className="text-xs text-[var(--color-ushqn-muted)]">
                            {t('onboarding.expiresAt', { date: new Date(row.expires_at).toLocaleString() })}
                          </p>
                          {row.status === 'accepted' && row.guardian_id ? (
                            <p className="mt-1 text-xs text-[var(--color-ushqn-text)]">
                              {t('connections.linkedTo')}:{' '}
                              <span className="font-semibold">
                                {guardianProfilesQuery.data?.get(row.guardian_id) ?? row.guardian_id.slice(0, 8) + '…'}
                              </span>
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                className="rounded-lg border border-[var(--color-ushqn-border)] px-3 py-1.5 text-xs font-bold"
                                onClick={() => void copyText(row.invite_code)}
                              >
                                {t('connections.copyCode')}
                              </button>
                              <button
                                type="button"
                                disabled={deletePendingInvite.isPending}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 dark:border-red-900/50 dark:text-red-400"
                                onClick={() => deletePendingInvite.mutate(row.id)}
                              >
                                {t('connections.revokeInvite')}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </QueryState>
          </>
        ) : (
          <QueryState query={guardianLinksQuery} skeleton={<div className="ushqn-card h-32 animate-pulse" />}>
            <section className="ushqn-card p-0">
              <div className="border-b border-[var(--color-ushqn-border)] px-5 py-4">
                <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('connections.linkedStudents')}</h2>
              </div>
              {(guardianLinksQuery.data ?? []).length === 0 ? (
                <p className="p-5 text-sm text-[var(--color-ushqn-muted)]">{t('connections.emptyGuardian')}</p>
              ) : (
                <ul className="divide-y divide-[var(--color-ushqn-border)]">
                  {(guardianLinksQuery.data ?? []).map((row) => {
                    const name = studentProfilesQuery.data?.get(row.student_id) ?? t('connections.unknownStudent')
                    return (
                      <li key={row.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold text-[var(--color-ushqn-text)]">{name}</p>
                          <p className="text-xs text-[var(--color-ushqn-muted)]">
                            {t('connections.statusLabel')}: <span className="font-semibold text-[var(--color-ushqn-text)]">{row.status}</span>
                            {row.accepted_at ? ` · ${new Date(row.accepted_at).toLocaleString()}` : null}
                          </p>
                        </div>
                        <Link
                          to={`/u/${row.student_id}`}
                          className="text-xs font-bold text-[#0052CC] hover:underline dark:text-sky-300"
                        >
                          {t('connections.openProfile')}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </QueryState>
        )}
      </QueryState>
    </div>
  )
}
