import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { supabase } from '../lib/supabase'
import { uploadPublicFile } from '../lib/upload'
import { useToast } from '../lib/toast'
import { useConfirm } from '../lib/confirm'
import type { ListingKind } from '../types/database'
import { AppPageMeta } from '../components/AppPageMeta'
import { QueryState } from '../components/QueryState'

type Form = { title: string; description?: string; price_text?: string; kind: ListingKind; collection_slug?: string }

export function ShowcasePage() {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()
  const { confirm } = useConfirm()

  const qUrl = searchParams.get('q') ?? ''
  const collectionUrl = searchParams.get('collection') ?? ''
  const [collectionInput, setCollectionInput] = useState(collectionUrl)
  const [filter, setFilter] = useState<'all' | ListingKind>(() => {
    const f = searchParams.get('kind')
    if (f === 'good' || f === 'service') return f
    return 'all'
  })
  const [search, setSearch] = useState(qUrl)
  const debouncedSearch = useDebouncedValue(search.trim(), 350)

  useEffect(() => {
    setSearch(qUrl)
  }, [qUrl])

  useEffect(() => {
    setCollectionInput(collectionUrl)
  }, [collectionUrl])

  useEffect(() => {
    const curQ = searchParams.get('q') ?? ''
    const curKind = searchParams.get('kind')
    const curCol = searchParams.get('collection') ?? ''
    const wantKind = filter === 'all' ? null : filter
    const kindMatch =
      wantKind == null ? curKind == null || curKind === '' : curKind === wantKind
    const colTrim = collectionInput.trim()
    if (curQ === debouncedSearch && kindMatch && curCol === colTrim) return
    const next = new URLSearchParams(searchParams)
    if (debouncedSearch) next.set('q', debouncedSearch)
    else next.delete('q')
    if (filter !== 'all') next.set('kind', filter)
    else next.delete('kind')
    if (colTrim) next.set('collection', colTrim)
    else next.delete('collection')
    setSearchParams(next, { replace: true })
  }, [debouncedSearch, filter, collectionInput, searchParams, setSearchParams])

  const [image, setImage] = useState<File | null>(null)
  const [showForm, setShowForm] = useState(false)

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, t('validation.titleRequired')),
        description: z.string().optional(),
        price_text: z.string().optional(),
        kind: z.enum(['good', 'service']),
        collection_slug: z.string().max(80).optional(),
      }),
    [t],
  )

  const collectionFilter = collectionUrl.trim()

  const listQuery = useQuery({
    queryKey: ['listings', filter, debouncedSearch, collectionFilter],
    queryFn: async () => {
      let q = supabase
        .from('listings')
        .select('id,owner_id,kind,title,description,price_text,image_url,created_at,collection_slug')
        .order('created_at', { ascending: false })
      if (filter !== 'all') q = q.eq('kind', filter)
      if (collectionFilter) q = q.eq('collection_slug', collectionFilter)
      if (debouncedSearch) q = q.or(`title.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'good', title: '', description: '', price_text: '', collection_slug: '' },
  })

  useEffect(() => {
    void form.clearErrors()
    void form.trigger()
  }, [schema, form])

  const create = useMutation({
    mutationFn: async (values: Form) => {
      let imageUrl: string | null = null
      if (image && userId) imageUrl = await uploadPublicFile(userId, `listings/${Date.now()}-${image.name}`, image)
      const { error } = await supabase.from('listings').insert({
        owner_id: userId!,
        kind: values.kind,
        title: values.title,
        description: values.description || null,
        price_text: values.price_text || null,
        image_url: imageUrl,
        collection_slug: values.collection_slug?.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      form.reset({ kind: 'good', title: '', description: '', price_text: '', collection_slug: '' })
      setImage(null)
      setShowForm(false)
      void qc.invalidateQueries({ queryKey: ['listings'] })
      toast(t('showcase.toastListingOk'))
    },
    onError: () => toast(t('showcase.toastListingErr'), 'error'),
  })

  async function removeListing(id: string, title: string) {
    const ok = await confirm({
      title: t('showcase.confirmDeleteListing'),
      description: `«${title}»`,
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    await supabase.from('listings').delete().eq('id', id)
    void qc.invalidateQueries({ queryKey: ['listings'] })
    toast(t('showcase.toastListingRemoved'), 'info')
  }

  async function contactSeller(ownerId: string) {
    const { data, error } = await supabase.rpc('get_or_create_dm', { other_id: ownerId })
    if (error) {
      toast(t('jobs.chatOpenErr'), 'error')
      return
    }
    void navigate(`/chat/${data}`)
  }

  return (
    <div className="space-y-5">
      <AppPageMeta title={t('nav.services')} />
      <div className="ushqn-card overflow-hidden p-0">
        <div className="bg-gradient-to-r from-[#6554C0] to-[#8777D9] px-6 py-7 text-white">
          <h1 className="text-2xl font-extrabold">{t('showcase.pageTitle')}</h1>
          <p className="mt-1 text-sm text-purple-100">{t('showcase.pageSub')}</p>
          <span className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            {t('showcase.listingsCount', { count: listQuery.data?.length ?? 0 })}
          </span>
        </div>
      </div>

      <div className="ushqn-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('showcase.searchPh')}
            className="ushqn-input max-w-xs"
            autoComplete="off"
            name="showcase-search"
            enterKeyHint="search"
          />
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#6B778C]" htmlFor="showcase-collection">
              {t('showcase.collectionLabel')}
            </label>
            <input
              id="showcase-collection"
              value={collectionInput}
              onChange={(e) => setCollectionInput(e.target.value)}
              placeholder={t('showcase.collectionPh')}
              className="ushqn-input w-full text-sm"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'good', 'service'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  filter === v ? 'border-[#6554C0] bg-[#6554C0] text-white' : 'border-[#DFE1E6] text-[#172B4D] hover:border-[#6554C0]'
                }`}
              >
                {v === 'all' ? t('showcase.filterAll') : v === 'good' ? t('showcase.filterGood') : t('showcase.filterService')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ushqn-card flex w-full items-center justify-center gap-2 py-4 text-sm font-bold text-[#6554C0] hover:bg-[#EAE6FF]/40 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z"
              clipRule="evenodd"
            />
          </svg>
          {t('showcase.addListing')}
        </button>
      ) : (
        <div className="ushqn-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#172B4D]">{t('showcase.newListing')}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-[#6B778C]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div>
              <label className="ushqn-label">{t('showcase.typeLabel')}</label>
              <select className="ushqn-input" {...form.register('kind')}>
                <option value="good">{t('showcase.kindGood')}</option>
                <option value="service">{t('showcase.kindService')}</option>
              </select>
            </div>
            <div>
              <label className="ushqn-label">{t('showcase.priceLabel')}</label>
              <input className="ushqn-input" placeholder={t('showcase.pricePh')} {...form.register('price_text')} />
            </div>
            <div className="sm:col-span-2">
              <label className="ushqn-label">{t('showcase.headlineLabel')}</label>
              <input className="ushqn-input" placeholder={t('showcase.headlinePh')} {...form.register('title')} />
              {form.formState.errors.title ? (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.title.message}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className="ushqn-label">{t('showcase.descLabel')}</label>
              <textarea rows={3} className="ushqn-input resize-none" {...form.register('description')} />
            </div>
            <div className="sm:col-span-2">
              <label className="ushqn-label">{t('showcase.collectionLabel')}</label>
              <input className="ushqn-input" placeholder={t('showcase.collectionPh')} {...form.register('collection_slug')} />
            </div>
            <div className="sm:col-span-2">
              <label className="ushqn-label">{t('showcase.imageLabel')}</label>
              <label className="mt-1 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#DFE1E6] bg-[#fafbfc] px-3 py-2.5 text-sm text-[#6B778C] transition hover:border-[#6554C0] hover:text-[#6554C0]">
                📷 {image ? image.name : t('showcase.uploadImagePh')}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={create.isPending}
                className="inline-flex items-center justify-center rounded-lg bg-[#6554C0] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#403294] disabled:opacity-50"
              >
                {create.isPending ? t('jobs.publishPending') : t('showcase.publishListing')}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-[#DFE1E6] px-4 py-2 text-sm font-semibold text-[#6B778C] transition hover:bg-[#F4F5F7]"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <QueryState
        query={listQuery}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="ushqn-card animate-pulse h-72" />
            ))}
          </div>
        }
      >
        {(listQuery.data ?? []).length === 0 ? (
          <div className="ushqn-card flex flex-col items-center justify-center gap-3 py-14 text-center">
            <span className="text-5xl">🛍️</span>
            <p className="text-base font-bold text-[#172B4D]">{t('showcase.emptyListings')}</p>
            <p className="text-sm text-[#6B778C]">{t('showcase.emptyListingsHint')}</p>
            <button type="button" onClick={() => setShowForm(true)} className="ushqn-btn-primary mt-1 px-5 py-2 text-sm">
              {t('showcase.addListing')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(listQuery.data ?? []).map((r) => (
              <article key={r.id} className="ushqn-card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
                {r.image_url ? (
                  <img src={r.image_url} alt="" className="h-44 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-gradient-to-br from-[#EAE6FF] to-[#DEEBFF] text-4xl">
                    {r.kind === 'good' ? '🏷️' : '🛠️'}
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        r.kind === 'service' ? 'bg-[#EAE6FF] text-[#6554C0]' : 'bg-[#DEEBFF] text-[#0052CC]'
                      }`}
                    >
                      {r.kind === 'good' ? t('showcase.kindGood') : t('showcase.kindService')}
                    </span>
                    {(r as { collection_slug?: string | null }).collection_slug ? (
                      <span className="rounded-full bg-[#F4F5F7] px-2 py-0.5 text-[10px] font-bold text-[#6B778C]">
                        #{(r as { collection_slug?: string | null }).collection_slug}
                      </span>
                    ) : null}
                    {r.price_text ? <span className="text-sm font-extrabold text-[#0052CC]">{r.price_text}</span> : null}
                  </div>
                  <h3 className="mt-2 text-base font-bold leading-snug text-[#172B4D]">{r.title}</h3>
                  {r.description ? <p className="mt-1 line-clamp-2 flex-1 text-sm text-[#6B778C]">{r.description}</p> : null}
                  <div className="mt-3 flex items-center gap-2">
                    {r.owner_id === userId ? (
                      <button
                        type="button"
                        onClick={() => void removeListing(r.id, r.title)}
                        className="flex-1 rounded-lg border border-red-100 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                      >
                        {t('common.delete')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void contactSeller(r.owner_id)}
                        className="flex-1 rounded-lg bg-[#6554C0] py-2 text-xs font-bold text-white transition hover:bg-[#403294]"
                      >
                        💬 {t('showcase.contact')}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  )
}
