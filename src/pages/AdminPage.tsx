import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { QueryState } from '../components/QueryState'
import { trackEvent } from '../lib/analytics'

async function countRows(table: string) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}


export function AdminPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

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
        .select('id, display_name, role, created_at, is_admin')
        .order('created_at', { ascending: false })
        .limit(25)
      if (error) throw error
      return data ?? []
    },
  })

  const recentFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return recentQuery.data ?? []
    return (recentQuery.data ?? []).filter((r) => r.display_name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q))
  }, [recentQuery.data, search])

  const totalPages = Math.max(1, Math.ceil(recentFiltered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = recentFiltered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const stats = statsQuery.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-ushqn-text)]">{t('admin.title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-ushqn-muted)]">{t('admin.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-semibold">{t('admin.grantHintTitle')}</p>
        <p className="mt-1 opacity-90">{t('admin.grantHintBody')}</p>
      </div>

      <QueryState
        query={statsQuery}
        skeleton={<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="ushqn-card h-24 animate-pulse" />)}</div>}
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
              placeholder="Search by name or role"
              className="ushqn-input w-full sm:max-w-xs"
            />
            <p className="text-xs text-[var(--color-ushqn-muted)]">{recentFiltered.length} users</p>
          </div>
        </div>
        <QueryState
          query={recentQuery}
          skeleton={<div className="p-5"><div className="h-32 animate-pulse rounded bg-[var(--color-ushqn-surface-muted)]" /></div>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)]">
                  <th className="px-4 py-2 font-semibold text-[var(--color-ushqn-text)]">{t('admin.col.name')}</th>
                  <th className="px-4 py-2 font-semibold text-[var(--color-ushqn-text)]">{t('admin.col.role')}</th>
                  <th className="px-4 py-2 font-semibold text-[var(--color-ushqn-text)]">{t('admin.col.joined')}</th>
                  <th className="px-4 py-2 font-semibold text-[var(--color-ushqn-text)]">{t('admin.col.link')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--color-ushqn-border)]">
                    <td className="px-4 py-2">
                      <span className="font-medium text-[var(--color-ushqn-text)]">{row.display_name}</span>
                      {row.is_admin ? (
                        <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                          {t('admin.badgeStaff')}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-ushqn-muted)]">{row.role}</td>
                    <td className="px-4 py-2 text-[var(--color-ushqn-muted)]">
                      {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2">
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
              Page {safePage} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                className="rounded border border-[var(--color-ushqn-border)] px-2 py-1 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                className="rounded border border-[var(--color-ushqn-border)] px-2 py-1 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </QueryState>
      </div>
    </div>
  )
}