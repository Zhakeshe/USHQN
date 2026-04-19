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

type GroupKind = 'class' | 'club' | 'debate' | 'sports' | 'other'

type TeacherGroupRow = {
  id: string
  owner_id: string
  title: string
  kind: GroupKind
  join_code: string
  description: string | null
  is_archived: boolean
  join_code_expires_at: string | null
  invite_rotated_at: string | null
  created_at: string
}

type TeacherGroupMemberRow = {
  id: string
  group_id: string
  student_id: string
  joined_at: string
  left_at: string | null
  is_active: boolean
  is_guest: boolean
}

export function ConnectionsPage() {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [inviteCode, setInviteCode] = useState('')
  const [groupTitle, setGroupTitle] = useState('')
  const [groupKind, setGroupKind] = useState<GroupKind>('club')
  const [groupStudentId, setGroupStudentId] = useState('')
  const [groupJoinCode, setGroupJoinCode] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [addAsGuest, setAddAsGuest] = useState(false)

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

  const teacherGroupsQuery = useQuery({
    queryKey: ['teacher-groups', userId],
    enabled: Boolean(userId && isTeacher),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_groups')
        .select('id,owner_id,title,kind,join_code,description,is_archived,created_at,join_code_expires_at,invite_rotated_at')
        .eq('owner_id', userId!)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as TeacherGroupRow[]
    },
  })

  const teacherGroupMembersQuery = useQuery({
    queryKey: ['teacher-group-members', userId],
    enabled: Boolean(userId && isTeacher),
    queryFn: async () => {
      const groups = teacherGroupsQuery.data ?? []
      if (!groups.length) return [] as TeacherGroupMemberRow[]
      const ids = groups.map((g) => g.id)
      const { data, error } = await supabase
        .from('teacher_group_members')
        .select('id,group_id,student_id,joined_at,left_at,is_active,is_guest')
        .in('group_id', ids)
        .eq('is_active', true)
      if (error) throw error
      return (data ?? []) as TeacherGroupMemberRow[]
    },
  })

  const studentGroupMembersQuery = useQuery({
    queryKey: ['student-group-memberships', userId],
    enabled: Boolean(userId && isStudent),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_group_members')
        .select('id,group_id,student_id,joined_at,left_at,is_active,is_guest')
        .eq('student_id', userId!)
        .eq('is_active', true)
      if (error) throw error
      return (data ?? []) as TeacherGroupMemberRow[]
    },
  })

  const studentGroupCardsQuery = useQuery({
    queryKey: ['student-group-cards', (studentGroupMembersQuery.data ?? []).map((r) => r.group_id).join(',')],
    enabled: Boolean((studentGroupMembersQuery.data ?? []).length),
    queryFn: async () => {
      const ids = [...new Set((studentGroupMembersQuery.data ?? []).map((x) => x.group_id))]
      const { data, error } = await supabase
        .from('teacher_groups')
        .select('id,owner_id,title,kind,join_code,description,is_archived,created_at,join_code_expires_at,invite_rotated_at')
        .in('id', ids)
      if (error) throw error
      return (data ?? []) as TeacherGroupRow[]
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

  const inviteExpiresIso = () => new Date(Date.now() + 30 * 86400000).toISOString()

  const createTeacherGroup = useMutation({
    mutationFn: async () => {
      const title = groupTitle.trim()
      if (!title) throw new Error(t('connections.groups.titleRequired'))
      const { error } = await supabase.from('teacher_groups').insert({
        owner_id: userId!,
        title,
        kind: groupKind,
        join_code_expires_at: inviteExpiresIso(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setGroupTitle('')
      setGroupKind('club')
      void qc.invalidateQueries({ queryKey: ['teacher-groups', userId] })
      toast(t('connections.groups.groupCreated'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const addStudentToGroup = useMutation({
    mutationFn: async (p: { groupId: string; studentId: string; isGuest: boolean }) => {
      if (!p.studentId) throw new Error(t('connections.groups.pickStudent'))
      const { error } = await supabase.from('teacher_group_members').insert({
        group_id: p.groupId,
        student_id: p.studentId,
        is_active: true,
        is_guest: p.isGuest,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher-group-members', userId] })
      void qc.invalidateQueries({ queryKey: ['student-group-memberships'] })
      toast(t('connections.groups.studentAdded'))
      setAddAsGuest(false)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const regenerateJoin = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.rpc('regenerate_teacher_group_join_code', { p_group_id: groupId })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher-groups', userId] })
      toast(t('connections.groups.codeRegenerated'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const removeMember = useMutation({
    mutationFn: async (p: { groupId: string; studentId: string }) => {
      const { error } = await supabase.rpc('remove_teacher_group_member', {
        p_group_id: p.groupId,
        p_student_id: p.studentId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher-group-members', userId] })
      toast(t('connections.groups.memberRemoved'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const leaveTeacherGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.rpc('leave_teacher_group', { p_group_id: groupId })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['student-group-memberships', userId] })
      void qc.invalidateQueries({ queryKey: ['student-group-cards'] })
      toast(t('connections.groups.leftGroup'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const joinGroupByCode = useMutation({
    mutationFn: async () => {
      const code = groupJoinCode.trim().toLowerCase()
      if (!code) throw new Error(t('connections.groups.joinCodeRequired'))
      const { error } = await supabase.rpc('join_teacher_group', { p_join_code: code })
      if (error) throw error
    },
    onSuccess: () => {
      setGroupJoinCode('')
      void qc.invalidateQueries({ queryKey: ['student-group-memberships', userId] })
      void qc.invalidateQueries({ queryKey: ['student-group-cards'] })
      toast(t('connections.groups.joinedByCode'))
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

  const switchTeacher = useMutation({
    mutationFn: async (p: { studentId: string; teacherId: string }) => {
      const { error } = await supabase.rpc('switch_student_teacher', {
        p_student_id: p.studentId,
        p_new_teacher_id: p.teacherId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['connections-student-links', userId] })
      void qc.invalidateQueries({ queryKey: ['connections-guardian-links', userId, role] })
      toast(t('connections.teacherSwitched'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const titleKey = isParent
    ? 'connections.titleParent'
    : isTeacher
      ? 'connections.titleTeacher'
      : 'connections.titleStudent'

  const teacherAcceptedLinks = (guardianLinksQuery.data ?? []).filter(
    (r) => r.link_type === 'teacher' && r.status === 'accepted',
  )

  const studentTeacherLinks = (studentLinksQuery.data ?? []).filter(
    (r) => r.link_type === 'teacher' && r.guardian_id,
  )

  const currentStudentTeacher = studentTeacherLinks.find((r) => r.status === 'accepted')

  const membersByGroup = useMemo(() => {
    const m = new Map<string, TeacherGroupMemberRow[]>()
    for (const row of teacherGroupMembersQuery.data ?? []) {
      const bucket = m.get(row.group_id) ?? []
      bucket.push(row)
      m.set(row.group_id, bucket)
    }
    return m
  }, [teacherGroupMembersQuery.data])

  const teacherNameMap = useMemo(() => {
    return studentProfilesQuery.data ?? new Map<string, string>()
  }, [studentProfilesQuery.data])

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

            {studentTeacherLinks.length > 0 ? (
              <section className="ushqn-card space-y-3 p-5">
                <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('connections.currentTeacher')}</h2>
                <p className="text-xs text-[var(--color-ushqn-muted)]">
                  {currentStudentTeacher?.guardian_id
                    ? `${t('connections.currentTeacherNow')}: ${
                        guardianProfilesQuery.data?.get(currentStudentTeacher.guardian_id) ??
                        currentStudentTeacher.guardian_id.slice(0, 8)
                      }`
                    : t('connections.currentTeacherEmpty')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="ushqn-input min-w-[220px]"
                  >
                    <option value="">{t('connections.selectTeacher')}</option>
                    {studentTeacherLinks.map((l) => (
                      <option key={l.id} value={String(l.guardian_id)}>
                        {guardianProfilesQuery.data?.get(String(l.guardian_id)) ?? String(l.guardian_id).slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={switchTeacher.isPending}
                    className="rounded-lg border border-[var(--color-ushqn-border)] px-3 py-1.5 text-xs font-bold"
                    onClick={() =>
                      switchTeacher.mutate({
                        studentId: userId!,
                        teacherId: selectedTeacherId || String(currentStudentTeacher?.guardian_id ?? ''),
                      })
                    }
                  >
                    {t('connections.switchTeacher')}
                  </button>
                </div>
              </section>
            ) : null}

            <section className="ushqn-card space-y-3 p-5">
              <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('connections.groups.joinByCode')}</h2>
              <p className="text-xs text-[var(--color-ushqn-muted)]">{t('connections.groups.joinByCodeHint')}</p>
              <div className="flex flex-wrap gap-2">
                <input
                  value={groupJoinCode}
                  onChange={(e) => setGroupJoinCode(e.target.value)}
                  className="ushqn-input min-w-[220px] flex-1"
                  placeholder={t('connections.groups.joinCodePh')}
                  autoComplete="off"
                />
                <button
                  type="button"
                  disabled={joinGroupByCode.isPending}
                  className="rounded-xl bg-[var(--color-ushqn-primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  onClick={() => joinGroupByCode.mutate()}
                >
                  {t('connections.groups.joinByCodeBtn')}
                </button>
              </div>
            </section>

            <QueryState query={studentGroupCardsQuery} skeleton={<div className="ushqn-card h-24 animate-pulse" />}>
              <section className="ushqn-card p-0">
                <div className="border-b border-[var(--color-ushqn-border)] px-5 py-4">
                  <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">
                    {t('connections.groups.joinedGroups')}
                  </h2>
                </div>
                {(studentGroupCardsQuery.data ?? []).length === 0 ? (
                  <p className="p-5 text-sm text-[var(--color-ushqn-muted)]">{t('connections.groups.emptyStudentGroups')}</p>
                ) : (
                  <ul className="divide-y divide-[var(--color-ushqn-border)]">
                    {(studentGroupCardsQuery.data ?? []).map((g) => (
                      <li key={g.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-[var(--color-ushqn-text)]">{g.title}</p>
                          <p className="text-xs text-[var(--color-ushqn-muted)]">
                            {t(`connections.groups.kind.${g.kind}`)} · {t('connections.groups.teacherLabel')}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={leaveTeacherGroup.isPending}
                          className="self-start rounded-lg border border-[var(--color-ushqn-border)] px-3 py-1.5 text-xs font-bold text-red-600"
                          onClick={() => leaveTeacherGroup.mutate(g.id)}
                        >
                          {t('connections.groups.leaveGroup')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </QueryState>
          </>
        ) : (
          <QueryState query={guardianLinksQuery} skeleton={<div className="ushqn-card h-32 animate-pulse" />}>
            <div className="space-y-4">
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
                              {t('connections.statusLabel')}:{' '}
                              <span className="font-semibold text-[var(--color-ushqn-text)]">{row.status}</span>
                              {row.accepted_at ? ` · ${new Date(row.accepted_at).toLocaleString()}` : null}
                            </p>
                          </div>
                          <Link
                            to={`/u/${row.student_id}`}
                            className="text-xs font-bold text-[#0052CC] hover:underline dark:text-sky-300"
                          >
                            {t('connections.openProfile')}
                          </Link>
                          {isTeacher ? (
                            <button
                              type="button"
                              disabled={switchTeacher.isPending}
                              className="text-xs font-bold text-[var(--color-ushqn-primary)] hover:underline"
                              onClick={() =>
                                switchTeacher.mutate({
                                  studentId: row.student_id,
                                  teacherId: userId!,
                                })
                              }
                            >
                              {t('connections.makeCurrentTeacher')}
                            </button>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {isTeacher ? (
                <>
                  <section className="ushqn-card space-y-3 p-5">
                    <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('connections.groups.teacherGroups')}</h2>
                    <p className="text-xs text-[var(--color-ushqn-muted)]">{t('connections.groups.teacherGroupsHint')}</p>
                    <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
                      <input
                        value={groupTitle}
                        onChange={(e) => setGroupTitle(e.target.value)}
                        className="ushqn-input"
                        placeholder={t('connections.groups.groupTitlePh')}
                      />
                      <select
                        value={groupKind}
                        onChange={(e) => setGroupKind(e.target.value as GroupKind)}
                        className="ushqn-input"
                      >
                        <option value="class">{t('connections.groups.kind.class')}</option>
                        <option value="club">{t('connections.groups.kind.club')}</option>
                        <option value="debate">{t('connections.groups.kind.debate')}</option>
                        <option value="sports">{t('connections.groups.kind.sports')}</option>
                        <option value="other">{t('connections.groups.kind.other')}</option>
                      </select>
                      <button
                        type="button"
                        disabled={createTeacherGroup.isPending}
                        className="rounded-xl bg-[var(--color-ushqn-primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                        onClick={() => createTeacherGroup.mutate()}
                      >
                        {t('connections.groups.createGroup')}
                      </button>
                    </div>
                  </section>

                  <QueryState query={teacherGroupsQuery} skeleton={<div className="ushqn-card h-24 animate-pulse" />}>
                    <section className="ushqn-card p-0">
                      <div className="border-b border-[var(--color-ushqn-border)] px-5 py-4">
                        <h2 className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('connections.groups.groupList')}</h2>
                      </div>
                      {(teacherGroupsQuery.data ?? []).length === 0 ? (
                        <p className="p-5 text-sm text-[var(--color-ushqn-muted)]">{t('connections.groups.emptyTeacherGroups')}</p>
                      ) : (
                        <ul className="divide-y divide-[var(--color-ushqn-border)]">
                          {(teacherGroupsQuery.data ?? []).map((g) => {
                            const rows = membersByGroup.get(g.id) ?? []
                            return (
                              <li key={g.id} className="space-y-3 px-5 py-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="font-bold text-[var(--color-ushqn-text)]">{g.title}</p>
                                    <p className="text-xs text-[var(--color-ushqn-muted)]">
                                      {t(`connections.groups.kind.${g.kind}`)} · {rows.length} {t('connections.groups.studentsCount')}
                                    </p>
                                    <p className="mt-1 text-xs text-[var(--color-ushqn-muted)]">
                                      {t('connections.groups.joinCodeLabel')}: <span className="font-mono">{g.join_code}</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <select
                                    value={groupStudentId}
                                    onChange={(e) => setGroupStudentId(e.target.value)}
                                    className="ushqn-input min-w-[220px]"
                                  >
                                    <option value="">{t('connections.groups.selectStudent')}</option>
                                    {teacherAcceptedLinks.map((l) => (
                                      <option key={l.id} value={l.student_id}>
                                        {teacherNameMap.get(l.student_id) ?? l.student_id.slice(0, 8)}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={addStudentToGroup.isPending}
                                    className="rounded-lg border border-[var(--color-ushqn-border)] px-3 py-1.5 text-xs font-bold"
                                    onClick={() =>
                                      addStudentToGroup.mutate({
                                        groupId: g.id,
                                        studentId: groupStudentId,
                                        isGuest: addAsGuest,
                                      })
                                    }
                                  >
                                    {t('connections.groups.addStudent')}
                                  </button>
                                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ushqn-text)]">
                                    <input
                                      type="checkbox"
                                      checked={addAsGuest}
                                      onChange={(e) => setAddAsGuest(e.target.checked)}
                                      className="h-4 w-4 accent-[#0052CC]"
                                    />
                                    {t('connections.groups.guestMember')}
                                  </label>
                                </div>
                                <p className="text-[11px] text-[var(--color-ushqn-muted)]">
                                  {g.join_code_expires_at
                                    ? t('connections.groups.inviteExpires', {
                                        date: new Date(g.join_code_expires_at).toLocaleString(),
                                      })
                                    : t('connections.groups.inviteNoExpiry')}
                                </p>
                                <button
                                  type="button"
                                  disabled={regenerateJoin.isPending}
                                  className="text-xs font-bold text-[#0052CC] hover:underline"
                                  onClick={() => regenerateJoin.mutate(g.id)}
                                >
                                  {t('connections.groups.regenerateCode')}
                                </button>
                                {rows.length > 0 ? (
                                  <ul className="flex flex-wrap gap-2">
                                    {rows.map((m) => (
                                      <li
                                        key={m.id}
                                        className="flex items-center gap-1 rounded-full border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--color-ushqn-text)]"
                                      >
                                        <span>
                                          {teacherNameMap.get(m.student_id) ?? m.student_id.slice(0, 8)}
                                          {m.is_guest ? (
                                            <span className="ml-1 text-[10px] font-bold uppercase text-[var(--color-ushqn-muted)]">
                                              ({t('connections.groups.guestBadge')})
                                            </span>
                                          ) : null}
                                        </span>
                                        <button
                                          type="button"
                                          className="rounded-full px-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                          title={t('connections.groups.removeMember')}
                                          onClick={() =>
                                            removeMember.mutate({ groupId: g.id, studentId: m.student_id })
                                          }
                                        >
                                          ×
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-[var(--color-ushqn-muted)]">{t('connections.groups.noStudentsYet')}</p>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </section>
                  </QueryState>
                </>
              ) : null}
            </div>
          </QueryState>
        )}
      </QueryState>
    </div>
  )
}
