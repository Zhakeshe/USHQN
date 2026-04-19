import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { format } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useConfirm } from '../lib/confirm'
import { getDateFnsLocale } from '../lib/dateLocale'
import { AppPageMeta } from '../components/AppPageMeta'
import { QueryState } from '../components/QueryState'
import { ContentReportDialog } from '../components/ContentReportDialog'
import { trackEvent } from '../lib/analytics'
import type { Database, JobApplicationStatus, JobVacancyStatus, JobWorkMode } from '../types/database'

/* ── Job Alert Toggle component ── */
function JobAlertToggle({
  userId,
  employment,
  workMode,
  sphere,
  queryText,
  t,
}: {
  userId: string
  employment: string | null
  workMode: string | null
  sphere: string | null
  queryText: string | null
  t: TFunction
}) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const alertQuery = useQuery({
    queryKey: ['job-alert', userId, employment, workMode, sphere, queryText],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_alerts')
        .select('id,enabled')
        .eq('user_id', userId)
        .eq('employment_type', employment ?? '')
        .eq('work_mode', workMode ?? '')
        .eq('sphere', sphere ?? '')
        .eq('query_text', queryText ?? '')
        .maybeSingle()
      return data ?? null
    },
  })

  const toggleAlert = useMutation({
    mutationFn: async () => {
      if (alertQuery.data) {
        if (alertQuery.data.enabled) {
          await supabase.from('job_alerts').update({ enabled: false }).eq('id', alertQuery.data.id)
        } else {
          await supabase.from('job_alerts').update({ enabled: true }).eq('id', alertQuery.data.id)
        }
      } else {
        await supabase.from('job_alerts').insert({
          user_id: userId,
          employment_type: employment,
          work_mode: workMode,
          sphere: sphere,
          query_text: queryText,
          enabled: true,
        })
      }
    },
    onSuccess: (_, __, context) => {
      void qc.invalidateQueries({ queryKey: ['job-alert', userId] })
      // Use the state BEFORE mutation to determine the message
      const wasOn = Boolean((context as { wasOn?: boolean })?.wasOn)
      toast(wasOn ? t('jobs.alertOff') : t('jobs.alertOn'), 'info')
    },
    onMutate: () => {
      return { wasOn: Boolean(alertQuery.data?.enabled) }
    },
  })

  const isOn = Boolean(alertQuery.data?.enabled)

  return (
    <button
      type="button"
      onClick={() => toggleAlert.mutate()}
      disabled={toggleAlert.isPending}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
        isOn
          ? 'border-[#0052CC] bg-[#EFF6FF] text-[#0052CC]'
          : 'border-[#DFE1E6] text-[#6B778C] hover:border-[#0052CC] hover:text-[#0052CC]'
      }`}
    >
      <svg viewBox="0 0 20 20" fill={isOn ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
        <path fillRule="evenodd" d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.091 32.091 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.085 32.085 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z" clipRule="evenodd" />
      </svg>
      {isOn ? t('jobs.alertActive') : t('jobs.alertSubscribe')}
    </button>
  )
}

const JOBS_FILTERS_KEY = 'ushqn_jobs_filters_v1'

type JobRow = Database['public']['Tables']['jobs']['Row']

function vacancyOf(j: JobRow): JobVacancyStatus {
  return j.vacancy_status ?? 'open'
}

function isJobOpenForApplicants(j: JobRow, viewerId: string | null): boolean {
  if (j.owner_id === viewerId) return true
  return vacancyOf(j) === 'open'
}
type AppRow = {
  id: string
  job_id: string
  applicant_id: string
  status: JobApplicationStatus
  name: string
  interview_slot: string | null
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Form = {
  title: string
  description?: string
  format_text?: string
  work_mode: JobWorkMode
  company_name?: string
  hide_company_until_applied: boolean
}
type EmploymentFilter = 'all' | 'internship' | 'fulltime' | 'parttime' | 'project'
type JobSort = 'new' | 'relevance'
type WorkModeFilter = 'all' | JobWorkMode

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
  const [workMode, setWorkMode] = useState<WorkModeFilter>('all')
  const [filtersHydrated, setFiltersHydrated] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [reportJobId, setReportJobId] = useState<string | null>(null)

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
          workMode?: WorkModeFilter
        }
        if (p.employment && ['all', 'internship', 'fulltime', 'parttime', 'project'].includes(p.employment)) {
          setEmployment(p.employment)
        }
        if (p.sphere && ['all', 'it', 'marketing', 'design'].includes(p.sphere)) {
          setSphere(p.sphere)
        }
        if (p.sort === 'new' || p.sort === 'relevance') setSort(p.sort)
        if (p.workMode && ['all', 'any', 'remote', 'onsite', 'hybrid'].includes(p.workMode)) {
          setWorkMode(p.workMode)
        }
      }
    } catch {
      /* ignore */
    }
    setFiltersHydrated(true)
  }, [])

  useEffect(() => {
    if (!filtersHydrated) return
    try {
      localStorage.setItem(JOBS_FILTERS_KEY, JSON.stringify({ employment, sphere, sort, workMode }))
    } catch {
      /* ignore */
    }
  }, [employment, sphere, sort, workMode, filtersHydrated])

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, t('validation.titleRequired')),
        description: z.string().optional(),
        format_text: z.string().optional(),
        work_mode: z.enum(['any', 'remote', 'onsite', 'hybrid']),
        company_name: z.string().optional(),
        hide_company_until_applied: z.boolean(),
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
      { value: 'finance', labelKey: 'sphere.finance', emoji: '💰' },
      { value: 'education', labelKey: 'sphere.education', emoji: '📚' },
      { value: 'medicine', labelKey: 'sphere.medicine', emoji: '🏥' },
      { value: 'engineering', labelKey: 'sphere.engineering', emoji: '⚙️' },
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
      return (data ?? []) as JobRow[]
    },
  })

  const myAppsQuery = useQuery({
    queryKey: ['my-job-applications', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('job_applications').select('job_id, status').eq('applicant_id', userId!)
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.job_id, r.status as JobApplicationStatus]))
    },
  })

  const myJobIds = useMemo(() => {
    if (!userId) return [] as string[]
    return (listQuery.data ?? []).filter((j) => j.owner_id === userId).map((j) => j.id)
  }, [listQuery.data, userId])

  const appsByJobQuery = useQuery({
    queryKey: ['job-apps-by-owner', userId, myJobIds.join('|')],
    enabled: Boolean(userId) && myJobIds.length > 0,
    queryFn: async (): Promise<Map<string, AppRow[]>> => {
      const { data, error } = await supabase
        .from('job_applications')
        .select('id, job_id, applicant_id, status, interview_slot')
        .in('job_id', myJobIds)
      if (error) throw error
      const applicants = [...new Set((data ?? []).map((r) => r.applicant_id))]
      if (applicants.length === 0) return new Map()
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', applicants)
      const names = new Map((profs ?? []).map((p) => [p.id, p.display_name]))
      const map = new Map<string, AppRow[]>()
      for (const row of data ?? []) {
        const arr = map.get(row.job_id) ?? []
        arr.push({
          id: row.id,
          job_id: row.job_id,
          applicant_id: row.applicant_id,
          status: row.status as JobApplicationStatus,
          name: names.get(row.applicant_id) ?? '—',
          interview_slot: (row as { interview_slot?: string | null }).interview_slot ?? null,
        })
        map.set(row.job_id, arr)
      }
      return map
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

  function isJobFeatured(j: { is_featured?: boolean; featured_until?: string | null }) {
    if (!j.is_featured || !j.featured_until) return false
    return new Date(j.featured_until) > new Date()
  }

  const employerStats = useMemo(() => {
    if (!userId) return null
    const mine = (listQuery.data ?? []).filter((j) => j.owner_id === userId)
    if (mine.length === 0) return null
    const count = (s: JobVacancyStatus) => mine.filter((j) => vacancyOf(j) === s).length
    return {
      total: mine.length,
      open: count('open'),
      filled: count('filled'),
      notNeeded: count('closed_not_needed'),
      otherClosed: count('closed_other'),
    }
  }, [listQuery.data, userId])

  const pendingApplicantReviews = useMemo(() => {
    let n = 0
    for (const apps of appsByJobQuery.data?.values() ?? []) {
      n += apps.filter((a) => a.status === 'submitted' || a.status === 'viewed').length
    }
    return n
  }, [appsByJobQuery.data])

  const patchJobVacancy = useMutation({
    mutationFn: async (p: { id: string; vacancy_status: JobVacancyStatus; closed_reason?: string | null }) => {
      const needReason = p.vacancy_status === 'closed_not_needed' || p.vacancy_status === 'closed_other'
      const { error } = await supabase
        .from('jobs')
        .update({
          vacancy_status: p.vacancy_status,
          closed_reason: needReason ? p.closed_reason?.trim() || null : null,
          closed_at: p.vacancy_status === 'open' ? null : new Date().toISOString(),
        })
        .eq('id', p.id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jobs'] })
      toast(t('jobs.vacancyUpdated'), 'info')
    },
    onError: () => toast(t('common.error'), 'error'),
  })

  const filteredJobs = useMemo(() => {
    let list = (listQuery.data ?? []).filter((j) => {
      if (userId && j.owner_id !== userId && !isJobOpenForApplicants(j, userId)) {
        return false
      }
      if (workMode !== 'all') {
        const mode = (j.work_mode ?? 'any') as JobWorkMode
        if (mode !== 'any' && mode !== workMode) return false
      }
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
      const f = Number(isJobFeatured(b)) - Number(isJobFeatured(a))
      if (f !== 0) return f
      if (sort === 'relevance' && debouncedQ) {
        const d = relevanceScore(b, debouncedQ) - relevanceScore(a, debouncedQ)
        if (d !== 0) return d
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return list
  }, [listQuery.data, employment, sphere, debouncedQ, sort, workMode, userId])

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      work_mode: 'any',
      company_name: '',
      hide_company_until_applied: false,
    },
  })

  useEffect(() => {
    void form.clearErrors()
    void form.trigger()
  }, [schema, form])

  const patchApplication = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: JobApplicationStatus }) => {
      const { error } = await supabase.from('job_applications').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['job-apps-by-owner'] })
      void qc.invalidateQueries({ queryKey: ['my-job-applications'] })
      toast(t('jobs.statusUpdated'), 'info')
    },
    onError: () => toast(t('common.error'), 'error'),
  })

  const patchInterviewSlot = useMutation({
    mutationFn: async ({ id, interview_slot }: { id: string; interview_slot: string | null }) => {
      const { error } = await supabase.from('job_applications').update({ interview_slot }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['job-apps-by-owner'] })
      toast(t('jobs.interviewSlotSaved'), 'info')
    },
    onError: () => toast(t('common.error'), 'error'),
  })

  const create = useMutation({
    mutationFn: async (values: Form) => {
      const { error } = await supabase.from('jobs').insert({
        owner_id: userId!,
        title: values.title,
        description: values.description || null,
        format_text: values.format_text || null,
        work_mode: values.work_mode,
        company_name: values.company_name?.trim() || null,
        hide_company_until_applied: values.hide_company_until_applied,
      })
      if (error) throw error
    },
    onSuccess: () => {
      form.reset({
        title: '',
        description: '',
        format_text: '',
        work_mode: 'any',
        company_name: '',
        hide_company_until_applied: false,
      })
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

  async function applyToJob(jobId: string, ownerId: string) {
    if (!userId) return
    const existing = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('applicant_id', userId)
      .maybeSingle()
    if (!existing.data) {
      const { error: insErr } = await supabase.from('job_applications').insert({
        job_id: jobId,
        applicant_id: userId,
        status: 'submitted',
      })
      if (insErr) {
        trackEvent('job_apply_failed')
        toast(insErr.message, 'error')
        return
      }
      void qc.invalidateQueries({ queryKey: ['my-job-applications'] })
      void qc.invalidateQueries({ queryKey: ['job-apps-by-owner'] })
    }
    const { data, error } = await supabase.rpc('get_or_create_dm', { other_id: ownerId })
    if (error) {
      trackEvent('job_apply_failed')
      toast(t('jobs.chatOpenErr'), 'error')
      return
    }
    trackEvent('job_applied')
    void navigate(`/chat/${data}`)
  }

  function companyDisplay(j: JobRow, hasApplied: boolean): string | null {
    const name = j.company_name?.trim()
    if (!name) return null
    const hidden = Boolean(j.hide_company_until_applied)
    if (!hidden) return name
    if (!userId) return t('jobs.companyHidden')
    if (j.owner_id === userId) return name
    if (hasApplied) return name
    return t('jobs.companyHidden')
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
      <AppPageMeta title={t('nav.jobs')} />
      <ContentReportDialog
        open={Boolean(reportJobId)}
        onClose={() => setReportJobId(null)}
        targetType="job"
        targetId={reportJobId ?? ''}
      />
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
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#6B778C]">{t('jobs.filterWorkMode')}</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'remote', 'onsite', 'hybrid'] as WorkModeFilter[]).map((wm) => (
                <button
                  key={wm}
                  type="button"
                  onClick={() => setWorkMode(wm)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    workMode === wm ? 'border-[#0052CC] bg-[#0052CC] text-white' : 'border-[#DFE1E6] text-[#172B4D] hover:border-[#0052CC]'
                  }`}
                >
                  {t(`jobs.workMode.${wm}`)}
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

      {/* Job alert toggle */}
      {userId ? (
        <JobAlertToggle
          userId={userId}
          employment={employment === 'all' ? null : employment}
          workMode={workMode === 'all' ? null : workMode}
          sphere={sphere === 'all' ? null : sphere}
          queryText={debouncedQ || null}
          t={t}
        />
      ) : null}

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
            <div>
              <label className="ushqn-label" htmlFor="job-work-mode">
                {t('jobs.workModeField')}
              </label>
              <select id="job-work-mode" className="ushqn-input w-full max-w-md" {...form.register('work_mode')}>
                <option value="any">{t('jobs.workMode.any')}</option>
                <option value="remote">{t('jobs.workMode.remote')}</option>
                <option value="onsite">{t('jobs.workMode.onsite')}</option>
                <option value="hybrid">{t('jobs.workMode.hybrid')}</option>
              </select>
            </div>
            <div>
              <label className="ushqn-label">{t('jobs.companyName')}</label>
              <input className="ushqn-input" placeholder={t('jobs.companyNamePh')} {...form.register('company_name')} />
            </div>
            <label className="flex items-center gap-2.5 rounded-lg border border-[#DFE1E6] bg-[#fafbfc] px-3 py-2.5 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-[#0052CC]" {...form.register('hide_company_until_applied')} />
              <span className="text-sm font-medium text-[#172B4D]">{t('jobs.hideCompanyUntilApplied')}</span>
            </label>
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

      {employerStats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="ushqn-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B778C]">{t('jobs.employerStats.myVacancies')}</p>
            <p className="mt-1 text-2xl font-black text-[#172B4D]">{employerStats.total}</p>
          </div>
          <div className="ushqn-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B778C]">{t('jobs.employerStats.open')}</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">{employerStats.open}</p>
          </div>
          <div className="ushqn-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B778C]">{t('jobs.employerStats.filled')}</p>
            <p className="mt-1 text-2xl font-black text-[#172B4D]">{employerStats.filled}</p>
          </div>
          <div className="ushqn-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B778C]">{t('jobs.employerStats.notNeeded')}</p>
            <p className="mt-1 text-2xl font-black text-[#172B4D]">{employerStats.notNeeded}</p>
          </div>
          <div className="ushqn-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B778C]">{t('jobs.employerStats.otherClosed')}</p>
            <p className="mt-1 text-2xl font-black text-[#172B4D]">{employerStats.otherClosed}</p>
          </div>
          <div className="ushqn-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B778C]">{t('jobs.employerStats.pendingReviews')}</p>
            <p className="mt-1 text-2xl font-black text-[#0052CC]">{pendingApplicantReviews}</p>
          </div>
        </div>
      ) : null}

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
                  setWorkMode('all')
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
            const myStatus = myAppsQuery.data?.get(j.id)
            const hasApplied = Boolean(myStatus)
            const comp = companyDisplay(j, hasApplied)
            const appsList = appsByJobQuery.data?.get(j.id) ?? []
            const wm = (j.work_mode ?? 'any') as JobWorkMode
            return (
              <article key={j.id} className="ushqn-card flex flex-col transition-shadow hover:shadow-md">
                <div className="flex items-start gap-4 p-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#DEEBFF] to-[#B3D4FF] text-2xl font-bold text-[#0052CC]">
                    {(j.title ?? 'W').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-[#172B4D]">{j.title}</h3>
                    {comp ? <p className="mt-0.5 text-xs font-medium text-[#505F79]">{comp}</p> : null}
                    <p className="text-xs text-[#6B778C]">
                      {format(new Date(j.created_at), 'PP', { locale: dateLocale })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {isOwner ? (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            vacancyOf(j) === 'open'
                              ? 'bg-emerald-100 text-emerald-900'
                              : vacancyOf(j) === 'filled'
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-[#F4F5F7] text-[#505F79]'
                          }`}
                        >
                          {t(`jobs.vacancyStatus.${vacancyOf(j)}`)}
                        </span>
                      ) : null}
                      {isJobFeatured(j) ? (
                        <span
                          title={t('jobs.featuredExplained')}
                          className="cursor-help rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
                        >
                          {t('jobs.featuredBadge')}
                        </span>
                      ) : null}
                      {(j as { is_verified_employer?: boolean }).is_verified_employer ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E3FCEF] px-2.5 py-0.5 text-xs font-semibold text-[#006644]">
                          ✓ {t('jobs.verifiedEmployer')}
                        </span>
                      ) : null}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tag.bg} ${tag.text}`}>{tag.label}</span>
                      {j.format_text ? (
                        <span className="rounded-full bg-[#F4F5F7] px-2.5 py-0.5 text-xs font-semibold text-[#6B778C]">
                          {j.format_text}
                        </span>
                      ) : null}
                      {wm !== 'any' ? (
                        <span className="rounded-full border border-[#DFE1E6] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#172B4D]">
                          {t(`jobs.workMode.${wm}`)}
                        </span>
                      ) : null}
                    </div>
                    {!isOwner && myStatus ? (
                      <p className="mt-2 text-xs font-semibold text-[#0052CC]">
                        {t('jobs.myApplicationStatus')}: {t(`jobs.appStatus.${myStatus}`)}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleBookmark(j.id)}
                    className={`shrink-0 rounded-full p-1.5 transition ${isBookmarked ? 'text-[#0052CC]' : 'text-[#97A0AF] hover:text-[#0052CC]'}`}
                    title={isBookmarked ? t('jobs.bookmarkRemoveTitle') : t('jobs.bookmarkAddTitle')}
                  >
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
                {isOwner ? (
                  <div className="flex flex-col gap-2 border-t border-[#f4f5f7] px-5 py-3 sm:flex-row sm:items-center">
                    <label className="text-xs font-bold uppercase tracking-wide text-[#6B778C]">
                      {t('jobs.vacancyLabel')}
                    </label>
                    <select
                      className="ushqn-input max-w-xs py-1.5 text-xs"
                      value={vacancyOf(j)}
                      disabled={patchJobVacancy.isPending}
                      onChange={(e) => {
                        const v = e.target.value as JobVacancyStatus
                        let closed_reason: string | undefined
                        if (v === 'closed_not_needed' || v === 'closed_other') {
                          const r = window.prompt(t('jobs.closeReasonPrompt'))
                          if (r === null) return
                          closed_reason = r
                        }
                        patchJobVacancy.mutate({ id: j.id, vacancy_status: v, closed_reason })
                      }}
                    >
                      {(['open', 'filled', 'closed_not_needed', 'closed_other'] as const).map((s) => (
                        <option key={s} value={s}>
                          {t(`jobs.vacancyStatus.${s}`)}
                        </option>
                      ))}
                    </select>
                    {j.closed_reason && vacancyOf(j) !== 'open' ? (
                      <span className="text-xs text-[#6B778C]">
                        {t('jobs.closedNote')}: {j.closed_reason}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {isOwner && appsList.length > 0 ? (
                  <div className="space-y-2 border-t border-[#f4f5f7] px-5 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#6B778C]">{t('jobs.applicantsTitle')}</p>
                    {appsList.map((appRow) => (
                      <div key={appRow.id} className="flex flex-col gap-1.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                        <Link to={`/u/${appRow.applicant_id}`} className="font-semibold text-[#0052CC] hover:underline">
                          {appRow.name}
                        </Link>
                        <select
                          className="ushqn-input max-w-[12rem] py-1 text-xs"
                          value={appRow.status}
                          disabled={patchApplication.isPending}
                          onChange={(e) =>
                            patchApplication.mutate({
                              id: appRow.id,
                              status: e.target.value as JobApplicationStatus,
                            })
                          }
                        >
                          {(
                            [
                              'submitted',
                              'viewed',
                              'replied',
                              'test_task',
                              'interview',
                              'accepted',
                              'rejected',
                              'withdrawn',
                            ] as JobApplicationStatus[]
                          ).map((s) => (
                            <option key={s} value={s}>
                              {t(`jobs.appStatus.${s}`)}
                            </option>
                          ))}
                        </select>
                        <label className="flex min-w-0 flex-col gap-0.5 sm:inline-flex sm:flex-row sm:items-center sm:gap-1">
                          <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-[#6B778C]">
                            {t('jobs.interviewSlot')}
                          </span>
                          <input
                            type="datetime-local"
                            className="ushqn-input max-w-[11.5rem] py-1 text-xs"
                            value={toDatetimeLocalValue(appRow.interview_slot)}
                            disabled={patchInterviewSlot.isPending}
                            onChange={(e) => {
                              const v = e.target.value
                              patchInterviewSlot.mutate({
                                id: appRow.id,
                                interview_slot: v ? new Date(v).toISOString() : null,
                              })
                            }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[#f4f5f7] px-5 py-3">
                  {isOwner ? (
                    <button type="button" onClick={() => void remove(j.id, j.title)}
                      className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                      {t('common.delete')}
                    </button>
                  ) : isJobOpenForApplicants(j, userId) ? (
                    <button
                      type="button"
                      onClick={() => void applyToJob(j.id, j.owner_id)}
                      className="ushqn-btn-primary px-4 py-1.5 text-xs"
                    >
                      💬 {hasApplied ? t('jobs.openChat') : t('jobs.apply')}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-[#6B778C]">{t(`jobs.vacancyBadge.${vacancyOf(j)}`)}</span>
                  )}
                  {!isOwner && userId ? (
                    <button
                      type="button"
                      className="rounded-lg border border-[#eef1f4] px-3 py-1.5 text-xs font-semibold text-[#6B778C] hover:bg-[#f4f5f7]"
                      onClick={() => setReportJobId(j.id)}
                    >
                      {t('trust.report.open')}
                    </button>
                  ) : null}
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
