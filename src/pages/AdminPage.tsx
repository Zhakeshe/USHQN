import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { QueryState } from '../components/QueryState'
import { trackEvent } from '../lib/analytics'
import { useAuth } from '../hooks/useAuth'

async function countRows(table: string) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

function featuredUntilIso(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 86400_000).toISOString()
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvEscape(c: string | number) {
  return `"${String(c).replace(/"/g, '""')}"`
}

type AdminTab = 'overview' | 'reports' | 'audit' | 'featured'

export function AdminPage() {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const staffQuery = useQuery({
    queryKey: ['profile-staff-flags', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('is_admin,is_moderator').eq('id', userId!).single()
      if (error) throw error
      return { isAdmin: Boolean(data?.is_admin), isModerator: Boolean(data?.is_moderator) }
    },
  })
  const isAdmin = staffQuery.data?.isAdmin ?? false
  const isModeratorOnly = Boolean(staffQuery.data?.isModerator && !staffQuery.data?.isAdmin)

  const statsQuery = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [profiles, jobs, listings, events, achievements, messages] = await Promise.all([
        countRows('profiles'),
        countRows('jobs'),
        countRows('listings'),
        countRows('events'),
        countRows('achievements'),
        countRows('messages'),
      ])
      return { profiles, jobs, listings, events, achievements, messages }
    },
  })

  const recentQuery = useQuery({
    queryKey: ['admin-recent-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role, created_at, is_admin, is_moderator, org_verified, is_banned, referred_by')
        .order('created_at', { ascending: false })
        .limit(80)
      if (error) throw error
      return data ?? []
    },
  })

  const reportsQuery = useQuery({
    queryKey: ['admin-content-reports'],
    enabled: tab === 'reports',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  const auditQuery = useQuery({
    queryKey: ['admin-audit-log'],
    enabled: tab === 'audit',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80)
      if (error) throw error
      return data ?? []
    },
  })

  const jobsModQuery = useQuery({
    queryKey: ['admin-jobs-mod'],
    enabled: tab === 'featured',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, owner_id, is_featured, featured_until, created_at')
        .order('created_at', { ascending: false })
        .limit(40)
      if (error) throw error
      return data ?? []
    },
  })

  const patchProfile = useMutation({
    mutationFn: async (p: { id: string; patch: Record<string, boolean> }) => {
      const { error } = await supabase.from('profiles').update(p.patch).eq('id', p.id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-recent-profiles'] })
      void qc.invalidateQueries({ queryKey: ['admin-audit-log'] })
    },
  })

  const patchReport = useMutation({
    mutationFn: async (p: { id: string; status: 'resolved' | 'dismissed' }) => {
      const { error } = await supabase
        .from('content_reports')
        .update({
          status: p.status,
          resolved_at: new Date().toISOString(),
          resolved_by: userId ?? null,
        })
        .eq('id', p.id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-content-reports'] }),
  })

  const patchJob = useMutation({
    mutationFn: async (p: { id: string; is_featured: boolean; featured_until: string | null }) => {
      const { error } = await supabase
        .from('jobs')
        .update({ is_featured: p.is_featured, featured_until: p.featured_until })
        .eq('id', p.id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-jobs-mod'] })
      void qc.invalidateQueries({ queryKey: ['admin-audit-log'] })
      void qc.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const recentFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return recentQuery.data ?? []
    return (recentQuery.data ?? []).filter(
      (r) => r.display_name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q),
    )
  }, [recentQuery.data, search])

  const totalPages = Math.max(1, Math.ceil(recentFiltered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = recentFiltered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const stats = statsQuery.data

  const tabs: { id: AdminTab; label: string }[] = useMemo(() => {
    const all: { id: AdminTab; label: string }[] = [
      { id: 'overview', label: t('admin.tab.overview') },
      { id: 'reports', label: t('admin.tab.reports') },
      { id: 'audit', label: t('admin.tab.audit') },
      { id: 'featured', label: t('admin.tab.featured') },
    ]
    if (isModeratorOnly) return all.filter((x) => x.id === 'reports' || x.id === 'audit')
    return all
  }, [t, isModeratorOnly])

  useEffect(() => {
    if (isModeratorOnly && (tab === 'overview' || tab === 'featured')) setTab('reports')
  }, [isModeratorOnly, tab])

  function featureDays(jobId: string, days: number) {
    patchJob.mutate({ id: jobId, is_featured: true, featured_until: featuredUntilIso(days) })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-ushqn-text)]">{t('admin.title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-ushqn-muted)]">{t('admin.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              tab === x.id
                ? 'border-[var(--color-ushqn-primary)] bg-[var(--color-ushqn-primary)] text-white'
                : 'border-[var(--color-ushqn-border)] text-[var(--color-ushqn-text)] hover:border-[var(--color-ushqn-primary)]'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-semibold">{t('admin.grantHintTitle')}</p>
        <p className="mt-1 opacity-90">{t('admin.grantHintBody')}</p>
        <p className="mt-2 opacity-90">{t('admin.grantHintModerator')}</p>
      </div>

      {tab === 'overview' ? (
        <>
          <QueryState
            query={statsQuery}
            skeleton={
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="ushqn-card h-24 animate-pulse" />
                ))}
              </div>
            }
          >
            {stats ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ['profiles', stats.profiles],
                    ['jobs', stats.jobs],
                    ['listings', stats.listings],
                    ['events', stats.events],
                    ['achievements', stats.achievements],
                    ['messages', stats.messages],
                  ] as const
                ).map(([key, n]) => (
                  <div key={key} className="ushqn-card p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ushqn-muted)]">
                      {t(`admin.stat.${key}`)}
                    </p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-[var(--color-ushqn-text)]">{n}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </QueryState>

          <div className="ushqn-card overflow-hidden p-0">
            <div className="border-b border-[var(--color-ushqn-border)] px-5 py-4">
              <h2 className="text-lg font-bold text-[var(--color-ushqn-text)]">{t('admin.recentUsers')}</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder={t('admin.searchUsersPh')}
                  className="ushqn-input w-full sm:max-w-xs"
                />
                <p className="text-xs text-[var(--color-ushqn-muted)]">{recentFiltered.length} users</p>
              </div>
            </div>
            <QueryState
              query={recentQuery}
              skeleton={
                <div className="p-5">
                  <div className="h-32 animate-pulse rounded bg-[var(--color-ushqn-surface-muted)]" />
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)]">
                      <th className="px-3 py-2 font-semibold text-[var(--color-ushqn-text)]">{t('admin.col.name')}</th>
                      <th className="px-3 py-2 font-semibold text-[var(--color-ushqn-text)]">{t('admin.col.verify')}</th>
                      <th className="px-3 py-2 font-semibold text-[var(--color-ushqn-text)]">{t('admin.col.ban')}</th>
                      <th className="px-3 py-2 font-semibold text-[var(--color-ushqn-text)]">{t('admin.col.link')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row) => (
                      <tr key={row.id} className="border-b border-[var(--color-ushqn-border)]">
                        <td className="px-3 py-2">
                          <span className="font-medium text-[var(--color-ushqn-text)]">{row.display_name}</span>
                          {row.is_admin ? (
                            <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                              {t('admin.badgeStaff')}
                            </span>
                          ) : null}
                          {(row as { is_moderator?: boolean }).is_moderator ? (
                            <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">
                              {t('admin.badgeModerator')}
                            </span>
                          ) : null}
                          {row.org_verified ? (
                            <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">
                              ✓
                            </span>
                          ) : null}
                          {row.is_banned ? (
                            <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                              {t('admin.badgeBanned')}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            disabled={!isAdmin}
                            className="text-xs font-semibold text-[var(--color-ushqn-primary)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => patchProfile.mutate({ id: row.id, patch: { org_verified: !row.org_verified } })}
                          >
                            {row.org_verified ? t('admin.action.unverify') : t('admin.action.verify')}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            disabled={!isAdmin}
                            className="text-xs font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => patchProfile.mutate({ id: row.id, patch: { is_banned: !row.is_banned } })}
                          >
                            {row.is_banned ? t('admin.action.unban') : t('admin.action.ban')}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            to={`/u/${row.id}`}
                            className="font-semibold text-[var(--color-ushqn-primary)] hover:underline"
                            onClick={() => trackEvent('admin_open_profile')}
                          >
                            {t('admin.openProfile')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--color-ushqn-border)] px-4 py-3 text-xs">
                <span className="text-[var(--color-ushqn-muted)]">
                  {t('admin.pageOf', { page: safePage, total: totalPages })}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    className="rounded border border-[var(--color-ushqn-border)] px-2 py-1 disabled:opacity-50"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t('admin.prev')}
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    className="rounded border border-[var(--color-ushqn-border)] px-2 py-1 disabled:opacity-50"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {t('admin.next')}
                  </button>
                </div>
              </div>
            </QueryState>
          </div>
        </>
      ) : null}

      {tab === 'reports' ? (
        <QueryState query={reportsQuery} skeleton={<div className="ushqn-card h-40 animate-pulse" />}>
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-[var(--color-ushqn-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-ushqn-text)] hover:border-[var(--color-ushqn-primary)]"
              onClick={() => {
                const rows = reportsQuery.data ?? []
                const head = [
                  'id',
                  'created_at',
                  'status',
                  'hours_open',
                  'target_type',
                  'target_id',
                  'reporter_id',
                  'reason',
                ]
                const lines = [
                  head.map(csvEscape).join(','),
                  ...rows.map((r) => {
                    const hoursOpen =
                      r.status === 'open'
                        ? ((Date.now() - new Date(r.created_at).getTime()) / 3_600_000).toFixed(2)
                        : ''
                    return [
                      r.id,
                      r.created_at,
                      r.status,
                      hoursOpen,
                      r.target_type,
                      r.target_id,
                      r.reporter_id,
                      r.reason ?? '',
                    ]
                      .map(csvEscape)
                      .join(',')
                  }),
                ]
                downloadTextFile(`content-reports-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'))
                trackEvent('admin_export_reports_csv')
              }}
            >
              {t('admin.reports.exportCsv')}
            </button>
          </div>
          <div className="ushqn-card overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)]">
                  <th className="px-3 py-2">{t('admin.reports.when')}</th>
                  <th className="px-3 py-2">{t('admin.reports.sla')}</th>
                  <th className="px-3 py-2">{t('admin.reports.target')}</th>
                  <th className="px-3 py-2">{t('admin.reports.reason')}</th>
                  <th className="px-3 py-2">{t('admin.reports.status')}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(reportsQuery.data ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-ushqn-border)]">
                    <td className="px-3 py-2 text-xs text-[var(--color-ushqn-muted)]">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums text-[var(--color-ushqn-muted)]">
                      {r.status === 'open'
                        ? `${((Date.now() - new Date(r.created_at).getTime()) / 3_600_000).toFixed(1)} ${t('admin.reports.hours')}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.target_type} · {r.target_id.slice(0, 8)}…
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs">{r.reason ?? '—'}</td>
                    <td className="px-3 py-2 text-xs font-semibold">{r.status}</td>
                    <td className="space-x-2 px-3 py-2">
                      {r.status === 'open' ? (
                        <>
                          <button
                            type="button"
                            className="text-xs font-bold text-green-700 hover:underline"
                            onClick={() => patchReport.mutate({ id: r.id, status: 'resolved' })}
                          >
                            {t('admin.reports.resolve')}
                          </button>
                          <button
                            type="button"
                            className="text-xs font-bold text-[var(--color-ushqn-muted)] hover:underline"
                            onClick={() => patchReport.mutate({ id: r.id, status: 'dismissed' })}
                          >
                            {t('admin.reports.dismiss')}
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      ) : null}

      {tab === 'audit' ? (
        <QueryState query={auditQuery} skeleton={<div className="ushqn-card h-40 animate-pulse" />}>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className="rounded-lg border border-[var(--color-ushqn-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-ushqn-text)] hover:border-[var(--color-ushqn-primary)]"
              onClick={() => {
                const rows = auditQuery.data ?? []
                const head = ['id', 'created_at', 'action', 'entity_type', 'entity_id', 'actor_id']
                const lines = [
                  head.map(csvEscape).join(','),
                  ...rows.map((r) =>
                    [r.id, r.created_at, r.action, r.entity_type, r.entity_id ?? '', r.actor_id ?? ''].map(csvEscape).join(','),
                  ),
                ]
                downloadTextFile(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'))
                trackEvent('admin_export_audit_csv')
              }}
            >
              {t('admin.audit.exportCsv')}
            </button>
          </div>
          <div className="ushqn-card max-h-[480px] overflow-auto p-0">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="sticky top-0 border-b border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)]">
                  <th className="px-3 py-2">{t('admin.audit.when')}</th>
                  <th className="px-3 py-2">{t('admin.audit.action')}</th>
                  <th className="px-3 py-2">{t('admin.audit.entity')}</th>
                </tr>
              </thead>
              <tbody>
                {(auditQuery.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-[var(--color-ushqn-border)]">
                    <td className="px-3 py-2 text-[var(--color-ushqn-muted)]">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-medium text-[var(--color-ushqn-text)]">{row.action}</td>
                    <td className="px-3 py-2 text-[var(--color-ushqn-muted)]">
                      {row.entity_type} {row.entity_id ? row.entity_id.slice(0, 8) + '…' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      ) : null}

      {tab === 'featured' ? (
        <QueryState query={jobsModQuery} skeleton={<div className="ushqn-card h-40 animate-pulse" />}>
          <div className="ushqn-card space-y-2 p-4">
            <p className="text-sm text-[var(--color-ushqn-muted)]">{t('admin.featuredHint')}</p>
            <ul className="divide-y divide-[var(--color-ushqn-border)]">
              {(jobsModQuery.data ?? []).map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-semibold text-[var(--color-ushqn-text)]">{j.title}</p>
                    <p className="text-xs text-[var(--color-ushqn-muted)]">
                      {j.is_featured && j.featured_until
                        ? `${t('admin.featuredUntil')}: ${new Date(j.featured_until).toLocaleString()}`
                        : t('admin.notFeatured')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-[var(--color-ushqn-border)] px-2 py-1 text-xs font-bold"
                      onClick={() => featureDays(j.id, 7)}
                    >
                      {t('admin.feature7d')}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[var(--color-ushqn-border)] px-2 py-1 text-xs font-bold"
                      onClick={() => featureDays(j.id, 30)}
                    >
                      {t('admin.feature30d')}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-100 px-2 py-1 text-xs font-bold text-red-600"
                      onClick={() => patchJob.mutate({ id: j.id, is_featured: false, featured_until: null })}
                    >
                      {t('admin.unfeature')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </QueryState>
      ) : null}
    </div>
  )
}
