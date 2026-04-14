import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useConfirm } from '../lib/confirm'
import { format } from 'date-fns'
import { getDateFnsLocale } from '../lib/dateLocale'
import { AppPageMeta } from '../components/AppPageMeta'

const CATEGORY_EMOJI: Record<string, string> = {
  robotics: '🤖', programming: '💻', sports: '⚽', debates: '🎤',
  science: '🔬', arts: '🎨', other: '🏅', music: '🎵', math: '📐',
}

export function AchievementsPage() {
  const { t, i18n } = useTranslation()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [file, setFile] = useState<File | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  type Form = { title: string; description?: string; category_id: string }
  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, t('validation.titleRequired')),
        description: z.string().optional(),
        category_id: z.string().uuid(),
      }),
    [t],
  )

  const categoriesQuery = useQuery({
    queryKey: ['achievement_categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('achievement_categories').select('id,label_ru,default_points,slug').order('label_ru')
      if (error) throw error
      return data ?? []
    },
  })

  const listQuery = useQuery({
    queryKey: ['achievements', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [{ data: rows, error: e1 }, { data: cats, error: e2 }] = await Promise.all([
        supabase.from('achievements').select('id,title,description,category_id,file_path,points_awarded,created_at').eq('user_id', userId!).order('created_at', { ascending: false }),
        supabase.from('achievement_categories').select('id,label_ru,slug'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      const labels = new Map((cats ?? []).map((c) => [c.id, c.label_ru]))
      const slugs = new Map((cats ?? []).map((c) => [c.id, c.slug as string]))
      return (rows ?? []).map((r) => ({
        ...r,
        category_label: labels.get(r.category_id) ?? '—',
        category_slug: slugs.get(r.category_id) ?? 'other',
        file_url: r.file_path ? supabase.storage.from('uploads').getPublicUrl(r.file_path).data.publicUrl : null,
      }))
    },
  })

  const filteredList = useMemo(() => {
    return (listQuery.data ?? []).filter((a) => {
      if (filterCategory !== 'all' && a.category_id !== filterCategory) return false
      if (search.trim() && !a.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [listQuery.data, filterCategory, search])

  const totalPoints = useMemo(() => (listQuery.data ?? []).reduce((s, a) => s + (a.points_awarded ?? 0), 0), [listQuery.data])

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', category_id: '' },
  })

  useEffect(() => {
    void form.clearErrors()
    void form.trigger()
  }, [schema, form])

  useEffect(() => {
    const first = categoriesQuery.data?.[0]?.id
    if (first && !form.getValues('category_id')) form.setValue('category_id', first)
  }, [categoriesQuery.data, form])

  const create = useMutation({
    mutationFn: async (values: Form) => {
      let filePath: string | null = null
      if (file && userId) {
        filePath = `${userId}/achievements/${Date.now()}-${file.name}`.replace(/\/+/g, '/')
        const { error: upErr } = await supabase.storage.from('uploads').upload(filePath, file)
        if (upErr) throw upErr
      }
      const { error } = await supabase.from('achievements').insert({
        user_id: userId!, category_id: values.category_id,
        title: values.title, description: values.description || null, file_path: filePath,
      })
      if (error) throw error
    },
    onSuccess: () => {
      form.reset({ title: '', description: '', category_id: categoriesQuery.data?.[0]?.id ?? '' })
      setFile(null)
      setShowForm(false)
      void qc.invalidateQueries({ queryKey: ['achievements', userId] })
      void qc.invalidateQueries({ queryKey: ['scores', userId] })
      void qc.invalidateQueries({ queryKey: ['leaderboard'] })
      void qc.invalidateQueries({ queryKey: ['total-points', userId] })
      toast(t('achievements.toastAdded'))
    },
    onError: () => toast(t('achievements.toastSaveErr'), 'error'),
  })

  async function remove(id: string, title: string) {
    const ok = await confirm({
      title: t('achievements.confirm_delete'),
      description: t('achievements.confirmRemoveDesc', { title }),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    await supabase.from('achievements').delete().eq('id', id)
    void qc.invalidateQueries({ queryKey: ['achievements', userId] })
    void qc.invalidateQueries({ queryKey: ['scores', userId] })
    void qc.invalidateQueries({ queryKey: ['leaderboard'] })
    void qc.invalidateQueries({ queryKey: ['total-points', userId] })
    toast(t('achievements.toastRemoved'), 'info')
  }

  const dateLocale = getDateFnsLocale(i18n.language)

  return (
    <div className="space-y-5">
      <AppPageMeta title={`${t('nav.achievements')} · USHQN`} />
      {/* Header stats */}
      <div className="ushqn-card overflow-hidden p-0">
        <div className="bg-gradient-to-r from-[#0052CC] to-[#2684FF] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold">{t('achievements.pageHeader')}</h1>
              <p className="mt-0.5 text-sm text-blue-100">{t('achievements.heroSub')}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">{totalPoints}</p>
              <p className="text-xs text-blue-100">{t('achievements.ushqPoints')}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center backdrop-blur">
              <p className="text-xl font-black">{listQuery.data?.length ?? 0}</p>
              <p className="text-[10px] text-blue-100">{t('achievements.statTotal')}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center backdrop-blur">
              <p className="text-xl font-black">{new Set(listQuery.data?.map((a) => a.category_id)).size}</p>
              <p className="text-[10px] text-blue-100">{t('achievements.statCategories')}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center backdrop-blur">
              <p className="text-xl font-black">{listQuery.data?.filter((a) => a.file_url).length ?? 0}</p>
              <p className="text-[10px] text-blue-100">{t('achievements.statWithFiles')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add achievement button / form */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ushqn-card flex w-full items-center justify-center gap-2 py-4 text-sm font-bold text-[#0052CC] hover:bg-[#DEEBFF]/40 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clipRule="evenodd"/>
          </svg>
          {t('achievements.addNew')}
        </button>
      ) : (
        <div className="ushqn-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#172B4D]">{t('achievements.newTitle')}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-[#6B778C] hover:text-[#172B4D]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
              </svg>
            </button>
          </div>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div className="sm:col-span-2">
              <label className="ushqn-label">{t('achievements.nameLabel')}</label>
              <input className="ushqn-input" placeholder={t('achievements.namePlaceholder')} {...form.register('title')} />
              {form.formState.errors.title ? <p className="mt-1 text-xs text-red-600">{form.formState.errors.title.message}</p> : null}
            </div>
            <div>
              <label className="ushqn-label">{t('achievements.categoryLabel')}</label>
              <select className="ushqn-input" {...form.register('category_id')}>
                {(categoriesQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {CATEGORY_EMOJI[c.slug as string] ?? '🏅'} {c.label_ru} (+{c.default_points} {t('achievements.pointsShort')})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ushqn-label">{t('achievements.fileLabel')}</label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#DFE1E6] bg-[#fafbfc] px-3 py-2.5 text-sm text-[#6B778C] hover:border-[#0052CC] hover:text-[#0052CC] transition">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z"/>
                </svg>
                {file ? file.name : t('achievements.pickFile')}
                <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="ushqn-label">{t('achievements.descLabel')}</label>
              <textarea rows={3} className="ushqn-input resize-none" placeholder={t('achievements.descPlaceholder')} {...form.register('description')} />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button type="submit" disabled={create.isPending} className="ushqn-btn-primary px-6">
                {create.isPending ? t('achievements.savePending') : t('achievements.addButton')}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-[#DFE1E6] px-4 py-2 text-sm font-semibold text-[#6B778C] hover:bg-[#F4F5F7] transition">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="ushqn-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('achievements.searchPlaceholder')}
            className="ushqn-input max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFilterCategory('all')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${filterCategory === 'all' ? 'border-[#0052CC] bg-[#0052CC] text-white' : 'border-[#DFE1E6] text-[#172B4D] hover:border-[#0052CC]'}`}>
              {t('common.all')}
            </button>
            {(categoriesQuery.data ?? []).map((c) => (
              <button key={c.id} type="button" onClick={() => setFilterCategory(c.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${filterCategory === c.id ? 'border-[#0052CC] bg-[#0052CC] text-white' : 'border-[#DFE1E6] text-[#172B4D] hover:border-[#0052CC]'}`}>
                {CATEGORY_EMOJI[c.slug as string] ?? '🏅'} {c.label_ru}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="ushqn-card flex flex-col items-center justify-center gap-3 py-14 text-center">
            <span className="text-5xl">🏅</span>
            <p className="text-base font-bold text-[#172B4D]">
              {search || filterCategory !== 'all' ? t('achievements.emptyFiltered') : t('achievements.emptyListTitle')}
            </p>
            <p className="text-sm text-[#6B778C]">
              {search || filterCategory !== 'all' ? t('achievements.emptyFilteredHint') : t('achievements.emptyListHint')}
            </p>
          </div>
        ) : (
          filteredList.map((a) => (
            <div key={a.id} className="ushqn-card flex flex-col gap-3 p-4 sm:flex-row sm:items-start transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#DEEBFF] to-[#B3D4FF] text-2xl">
                {CATEGORY_EMOJI[a.category_slug] ?? '🏅'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#172B4D]">{a.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#6B778C]">
                  <span className="rounded-full bg-[#DEEBFF] px-2 py-0.5 font-semibold text-[#0052CC]">{a.category_label}</span>
                  <span className="font-semibold text-[#36B37E]">
                    +{a.points_awarded} {t('achievements.points')}
                  </span>
                  <span className="text-[#36B37E] font-semibold">{t('achievements.confirmed')}</span>
                  <span>{format(new Date(a.created_at), 'PP', { locale: dateLocale })}</span>
                </div>
                {a.description ? <p className="mt-1.5 text-sm text-[#6B778C]">{a.description}</p> : null}
                {a.file_url ? (
                  <a href={a.file_url} target="_blank" rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#0052CC] hover:underline">
                    {t('achievements.openAttachment')}
                  </a>
                ) : null}
              </div>
              <button type="button" onClick={() => void remove(a.id, a.title)}
                className="shrink-0 self-start rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                {t('common.delete')}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
