import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useConfirm } from '../lib/confirm'
import { getDateFnsLocale } from '../lib/dateLocale'
import { QueryState } from '../components/QueryState'
import { trackEvent } from '../lib/analytics'

const JOBS_FILTERS_KEY = 'ushqn_jobs_filters_v1'

type Form = { title: string; description?: string; format_text?: string }
type EmploymentFilter = 'all' | 'internship' | 'fulltime' | 'parttime' | 'project'
type JobSort = 'new' | 'relevance'

export function JobsPage() {
  const { t, i18n } = useTranslation()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [employment, setEmployment] = useState<EmploymentFilter>('all')
  const [sphere, setSphere] = useState<string>('all')
  const [sort, setSort] = useState<JobSort>('new')
  const [filtersHydrated, setFiltersHydrated] = useState(false)
  const [showForm, setShowForm] = useState(false)

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(JOBS_FILTERS_KEY)
      if (raw) {
        const p = JSON.parse(raw) as {
          employment?: EmploymentFilter
          sphere?: string
          sort?: JobSort
        }
        if (p.employment && ['all', 'internship', 'fulltime', 'parttime', 'project'].includes(p.employment)) {
          setEmployment(p.employment)
        }
        if (p.sphere && ['all', 'it', 'marketing', 'design'].includes(p.sphere)) {
          setSphere(p.sphere)
        }
        if (p.sort === 'new' || p.sort === 'relevance') setSort(p.sort)
      }
    } catch {
      /* ignore */
    }
    setFiltersHydrated(true)
  }, [])

  useEffect(() => {
    if (!filtersHydrated) return
    try {
      localStorage.setItem(JOBS_FILTERS_KEY, JSON.stringify({ employment, sphere, sort }))
    } catch {
      /* ignore */
    }
  }, [employment, sphere, sort, filtersHydrated])

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, t('validation.titleRequired')),
        description: z.string().optional(),
        format_text: z.string().optional(),
      }),
    [t],
  )

  const employmentChips: { value: EmploymentFilter; labelKey: string; emoji: string }[] = useMemo(
    () => [
      { value: 'all', labelKey: 'employment.all', emoji: '📋' },
      { value: 'internship', labelKey: 'employment.internship', emoji: '🎓' },
      { value: 'fulltime', labelKey: 'employment.fulltime', emoji: '💼' },
      { value: 'parttime', labelKey: 'employment.parttime', emoji: '⏰' },
      { value: 'project', labelKey: 'employment.project', emoji: '🚀' },
    ],
    [],
  )

  const sphereChips = useMemo(
    () => [
      { value: 'all', labelKey: 'sphere.all', emoji: '🌐' },
      { value: 'it', labelKey: 'sphere.it', emoji: '💻' },
      { value: 'marketing', labelKey: 'sphere.marketing', emoji: '📣' },
      { value: 'design', labelKey: 'sphere.design', emoji: '🎨' },
    ],
    [],
  )

  const tagConfig = useMemo(
    () =>
      ({
        internship: { bg: 'bg-blue-100', text: 'text-blue-700', label: t('jobs.tag.internship') },
        parttime: { bg: 'bg-amber-100', text: 'text-amber-700', label: t('jobs.tag.parttime') },
        project: { bg: 'bg-purple-100', text: 'text-purple-700', label: t('jobs.tag.project') },
        fulltime: { bg: 'bg-green-100', text: 'text-green-700', label: t('jobs.tag.fulltime') },
        other: { bg: 'bg-gray-100', text: 'text-gray-700', label: t('jobs.tag.other') },
      }) as Record<string, { bg: string; text: string; label: string }>,
    [t],
  )

  const listQuery = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const bookmarksQuery = useQuery({
    queryKey: ['bookmarks-jobs', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase.from('bookmarks').select('target_id').eq('user_id', userId!).eq('target_type', 'job')
      return new Set((data ?? []).map((b) => b.target_id))
    },
  })

  const relevanceScore = (j: { title: string; description: string | null; format_text: string | null }, q: string) => {
    if (!q) return 0
    const qq = q.toLowerCase()
    const title = j.title.toLowerCase()
    const desc = `${j.description ?? ''} ${j.format_text ?? ''}`.toLowerCase()
    if (title.includes(qq)) return 2
    if (desc.includes(qq)) return 1
    return 0
  }

  const filteredJobs = useMemo(() => {
    let list = (listQuery.data ?? []).filter((j) => {
      const fmt = `${j.title} ${j.format_text ?? ''} ${j.description ?? ''}`.toLowerCase()
      if (employment === 'internship' && !/(стаж|intern)/i.test(fmt)) return false
      if (employment === 'fulltime' && !/(полн|full|офис)/i.test(fmt)) return false
      if (employment === 'parttime' && !/(част|part|гибрид)/i.test(fmt)) return false
      if (employment === 'project' && !/(проект|project|фриланс)/i.test(fmt)) return false
      if (sphere === 'it' && !/(it|разраб|програм|developer|код)/i.test(fmt)) return false
      if (sphere === 'marketing' && !/(маркет|smm|реклам)/i.test(fmt)) return false
      if (sphere === 'design' && !/(дизайн|design|ux|ui)/i.test(fmt)) return false
      return true
    })
    if (debouncedQ) {
      const qq = debouncedQ.toLowerCase()
      list = list.filter((j) =>
        `${j.title} ${j.description ?? ''} ${j.format_text ?? ''}`.toLowerCase().includes(qq),
      )
    }
    list = [...list].sort((a, b) => {
      if (sort === 'relevance' && debouncedQ) {
        const d = relevanceScore(b, debouncedQ) - relevanceScore(a, debouncedQ)
        if (d !== 0) return d
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return list
  }, [listQuery.data, employment, sphere, debouncedQ, sort])

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: {} })

  useEffect(() => {
    void form.clearErrors()
    void form.trigger()
  }, [schema, form])

  const create = useMutation({
    mutationFn: async (values: Form) => {
      const { error } = await supabase.from('jobs').insert({
        owner_id: userId!, title: values.title,
        description: values.description || null, format_text: values.format_text || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      form.reset()
      setShowForm(false)
      void qc.invalidateQueries({ queryKey: ['jobs'] })
      trackEvent('job_created')
      toast(t('jobs.toastPublished'))
    },
    onError: () => toast(t('jobs.toastPublishErr'), 'error'),
  })

  async function remove(id: string, title: string) {
    const ok = await confirm({
      title: t('jobs.confirmDeleteJob'),
      description: `«${title}»`,
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    await supabase.from('jobs').delete().eq('id', id)
    void qc.invalidateQueries({ queryKey: ['jobs'] })
    toast(t('jobs.toastJobRemoved'), 'info')
  }

  async function toggleBookmark(jobId: string) {
    if (!userId) return
    const bookmarks = bookmarksQuery.data
    if (bookmarks?.has(jobId)) {
      await supabase.from('bookmarks').delete().eq('user_id', userId).eq('target_type', 'job').eq('target_id', jobId)
      toast(t('jobs.bookmarkRemoved'), 'info')
    } else {
      await supabase.from('bookmarks').insert({ user_id: userId, target_type: 'job', target_id: jobId })
      toast(t('jobs.bookmarkAdded'))
    }
    void qc.invalidateQueries({ queryKey: ['bookmarks-jobs', userId] })
  }

  async function applyToJob(ownerId: string) {
    if (!userId) return
    const { data, error } = await supabase.rpc('get_or_create_dm', { other_id: ownerId })
    if (error) {
      trackEvent('job_apply_failed')
      toast(t('jobs.chatOpenErr'), 'error')
      return
    }
    trackEvent('job_applied')
    void navigate(`/chat/${data}`)
  }

  function getTag(j: { format_text: string | null; title: string; description: string | null }) {
    const text = `${j.format_text ?? ''} ${j.title} ${j.description ?? ''}`.toLowerCase()
    if (/стаж|intern/.test(text)) return tagConfig.internship
    if (/част|part/.test(text)) return tagConfig.parttime
    if (/проект|project/.test(text)) return tagConfig.project
    if (/полн|full/.test(text)) return tagConfig.fulltime
    return tagConfig.other
  }

  const dateLocale = getDateFnsLocale(i18n.language)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="ushqn-card overflow-hidden p-0">
        <div className="bg-gradient-to-r from-[#0052CC] to-[#2684FF] px-6 py-7 text-white">
          <h1 className="text-2xl font-extrabold">{t('jobs.pageTitle')}</h1>
          <p className="mt-1 text-sm text-blue-100">{t('jobs.pageSub')}</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              {t('jobs.jobsCount', { count: listQuery.data?.length ?? 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="ushqn-card p-4">
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6B778C]">{t('jobs.filterEmployment')}</p>
            <div className="flex flex-wrap gap-2">
              {employmentChips.map((c) => (
                <button key={c.value} type="button" onClick={() => setEmployment(c.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${employment === c.value ? 'border-[#0052CC] bg-[#0052CC] text-white' : 'border-[#DFE1E6] text-[#172B4D] hover:border-[#0052CC]'}`}>
                  {t('jobs.' + c.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6B778C]">{t('jobs.filterSphere')}</p>
            <div className="flex flex-wrap gap-2">
              {sphereChips.map((c) => (
                <button key={c.value} type="button" onClick={() => setSphere(c.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${sphere === c.value ? 'border-[#0052CC] bg-[#0052CC] text-white' : 'border-[#DFE1E6] text-[#172B4D] hover:border-[#0052CC]'}`}>
                  {t('jobs.' + c.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6B778C]">{t('common.search')}</p>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t('jobs.searchInList')}
                className="ushqn-input w-full max-w-md"
                autoComplete="off"
                name="jobs-search"
                enterKeyHint="search"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#6B778C]" htmlFor="jobs-sort">
                {t('jobs.sortLabel')}
              </label>
              <select
                id="jobs-sort"
                className="ushqn-input min-w-[11rem]"
                value={sort}
                onChange={(e) => setSort(e.target.value as JobSort)}
              >
                <option value="new">{t('jobs.sortNew')}</option>
                <option value="relevance">{t('jobs.sortRelevance')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Add vacancy */}
      {!showForm ? (
        <button type="button" onClick={() => setShowForm(true)}
          className="ushqn-card flex w-full items-center justify-center gap-2 py-4 text-sm font-bold text-[#0052CC] hover:bg-[#DEEBFF]/40 transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clipRule="evenodd"/>
          </svg>
          {t('jobs.publishVacancy')}
        </button>
      ) : (
        <div className="ushqn-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#172B4D]">{t('jobs.newVacancy')}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-[#6B778C]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
              </svg>
            </button>
          </div>
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div>
              <label className="ushqn-label">{t('jobs.positionLabel')}</label>
              <input className="ushqn-input" placeholder={t('jobs.positionPh')} {...form.register('title')} />
              {form.formState.errors.title ? <p className="mt-1 text-xs text-red-600">{form.formState.errors.title.message}</p> : null}
            </div>
            <div>
              <label className="ushqn-label">{t('jobs.formatLabel')}</label>
              <input className="ushqn-input" placeholder={t('jobs.formatPh')} {...form.register('format_text')} />
            </div>
            <div>
              <label className="ushqn-label">{t('jobs.jobDescLabel')}</label>
              <textarea rows={4} className="ushqn-input resize-none" {...form.register('description')} />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={create.isPending} className="ushqn-btn-primary px-6">
                {create.isPending ? t('jobs.publishPending') : t('jobs.publishBtn')}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-[#DFE1E6] px-4 py-2 text-sm font-semibold text-[#6B778C] hover:bg-[#F4F5F7] transition">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Jobs list */}
      <QueryState
        query={listQuery}
        skeleton={
          <div className="grid gap-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="ushqn-card animate-pulse h-48" />
            ))}
          </div>
        }
      >
        {filteredJobs.length === 0 ? (
          <div className="ushqn-card flex flex-col items-center justify-center gap-3 py-14 text-center">
            <span className="text-5xl">💼</span>
            <p className="text-base font-bold text-[#172B4D]">{t('jobs.empty')}</p>
            <p className="text-sm text-[#6B778C]">{t('jobs.emptyHint')}</p>
            {(listQuery.data ?? []).length > 0 ? (
              <button
                type="button"
                className="ushqn-btn-primary mt-2 px-5 py-2 text-sm"
                onClick={() => {
                  setSearchText('')
                  setEmployment('all')
                  setSphere('all')
                  setSort('new')
                  const next = new URLSearchParams(searchParams)
                  next.delete('q')
                  setSearchParams(next, { replace: true })
                }}
              >
                {t('jobs.clearFilters')}
              </button>
            ) : null}
          </div>
        ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredJobs.map((j) => {
            const tag = getTag(j)
            const isBookmarked = bookmarksQuery.data?.has(j.id)
            const isOwner = j.owner_id === userId
            return (
              <article key={j.id} className="ushqn-card flex flex-col transition-shadow hover:shadow-md">
                <div className="flex items-start gap-4 p-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#DEEBFF] to-[#B3D4FF] text-2xl font-bold text-[#0052CC]">
                    {(j.title ?? 'W').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-[#172B4D]">{j.title}</h3>
                    <p className="text-xs text-[#6B778C]">
                      {format(new Date(j.created_at), 'PP', { locale: dateLocale })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tag.bg} ${tag.text}`}>{tag.label}</span>
                      {j.format_text ? <span className="rounded-full bg-[#F4F5F7] px-2.5 py-0.5 text-xs font-semibold text-[#6B778C]">{j.format_text}</span> : null}
                    </div>
                  </div>
                  <button type="button" onClick={() => void toggleBookmark(j.id)}
                    className={`shrink-0 rounded-full p-1.5 transition ${isBookmarked ? 'text-[#0052CC]' : 'text-[#97A0AF] hover:text-[#0052CC]'}`}
                    title={isBookmarked ? t('jobs.bookmarkRemoveTitle') : t('jobs.bookmarkAddTitle')}>
                    <svg viewBox="0 0 20 20" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/>
                    </svg>
                  </button>
                </div>
                {j.description ? (
                  <div className="px-5 pb-3">
                    <p className="line-clamp-3 text-sm text-[#6B778C]">{j.description}</p>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-[#f4f5f7] px-5 py-3 mt-auto">
                  {isOwner ? (
                    <button type="button" onClick={() => void remove(j.id, j.title)}
                      className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                      {t('common.delete')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => void applyToJob(j.owner_id)}
                      className="ushqn-btn-primary px-4 py-1.5 text-xs">
                      💬 {t('jobs.apply')}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
        )}
      </QueryState>
    </div>
  )
}
