import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { CategoryScores } from '../components/CategoryScores'
import { ProfileCard } from '../components/ProfileCard'
import { SkillsCard } from '../components/SkillsCard'
import { useAuth } from '../hooks/useAuth'
import { ACCENT_PRESETS, isValidAccentHex } from '../lib/profileTheme'
import { supabase } from '../lib/supabase'
import { uploadPublicFile } from '../lib/upload'
import type { UserRole } from '../types/database'

const editSchema = z.object({
  display_name: z.string().min(1),
  location: z.string().optional(),
  headline: z.string().optional(),
  school_or_org: z.string().optional(),
  role: z.enum(['pupil', 'student', 'parent']),
  is_employer: z.boolean(),
  accent_color: z
    .string()
    .optional()
    .refine((s) => !s || isValidAccentHex(s), { message: 'hex' }),
})

type EditForm = z.infer<typeof editSchema>

export function ProfilePage() {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })

  const skillsQuery = useQuery({
    queryKey: ['skills', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_skills')
        .select('skill')
        .eq('user_id', userId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data.map((r) => r.skill)
    },
  })

  const scoresQuery = useQuery({
    queryKey: ['scores', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [{ data: scores, error: e1 }, { data: cats, error: e2 }] = await Promise.all([
        supabase.from('user_category_scores').select('category_id, points').eq('user_id', userId!),
        supabase.from('achievement_categories').select('id, label_ru'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      const labels = new Map((cats ?? []).map((c) => [c.id, c.label_ru]))
      return (scores ?? []).map((s) => ({
        category_label: labels.get(s.category_id) ?? '—',
        points: s.points,
      }))
    },
  })

  const interestsQuery = useQuery({
    queryKey: ['interests-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('interests').select('id,label_ru').order('label_ru')
      if (error) throw error
      return data ?? []
    },
  })

  const myInterestsQuery = useQuery({
    queryKey: ['my-interests', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_interests')
        .select('interest_id')
        .eq('user_id', userId!)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.interest_id))
    },
  })

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      display_name: '',
      location: '',
      headline: '',
      school_or_org: '',
      role: 'student',
      is_employer: false,
      accent_color: '#0052CC',
    },
  })

  useEffect(() => {
    const p = profileQuery.data
    if (!p) return
    form.reset({
      display_name: p.display_name,
      location: p.location ?? '',
      headline: p.headline ?? '',
      school_or_org: p.school_or_org ?? '',
      role: p.role as UserRole,
      is_employer: p.is_employer,
      accent_color: isValidAccentHex(p.accent_color) ? p.accent_color : '#0052CC',
    })
  }, [profileQuery.data, form])

  const updateProfile = useMutation({
    mutationFn: async (values: EditForm) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: values.display_name,
          location: values.location || null,
          headline: values.headline || null,
          school_or_org: values.school_or_org || null,
          role: values.role,
          is_employer: values.is_employer,
          accent_color: isValidAccentHex(values.accent_color) ? values.accent_color : null,
        })
        .eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', userId] })
      setEditing(false)
    },
  })

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    const url = await uploadPublicFile(userId, `avatars/${Date.now()}-${file.name}`, file)
    if (!url) return
    const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
    if (!error) void qc.invalidateQueries({ queryKey: ['profile', userId] })
  }

  async function onBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    const url = await uploadPublicFile(userId, `banners/${Date.now()}-${file.name}`, file)
    if (!url) return
    const { error } = await supabase.from('profiles').update({ banner_url: url }).eq('id', userId)
    if (!error) void qc.invalidateQueries({ queryKey: ['profile', userId] })
  }

  async function clearBanner() {
    if (!userId) return
    const { error } = await supabase.from('profiles').update({ banner_url: null }).eq('id', userId)
    if (!error) void qc.invalidateQueries({ queryKey: ['profile', userId] })
  }

  async function addSkill(skill: string) {
    if (!skill.trim() || !userId) return
    const { error } = await supabase.from('profile_skills').insert({ user_id: userId, skill: skill.trim() })
    if (!error) void qc.invalidateQueries({ queryKey: ['skills', userId] })
  }

  async function removeSkill(skill: string) {
    if (!userId) return
    const { error } = await supabase.from('profile_skills').delete().eq('user_id', userId).eq('skill', skill)
    if (!error) void qc.invalidateQueries({ queryKey: ['skills', userId] })
  }

  async function toggleInterest(interestId: string) {
    if (!userId) return
    const set = myInterestsQuery.data
    if (!set) return
    if (set.has(interestId)) {
      await supabase.from('profile_interests').delete().eq('user_id', userId).eq('interest_id', interestId)
    } else {
      await supabase.from('profile_interests').insert({ user_id: userId, interest_id: interestId })
    }
    void qc.invalidateQueries({ queryKey: ['my-interests', userId] })
  }

  if (profileQuery.isLoading || !profileQuery.data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="ushqn-card h-52" />
        <div className="ushqn-card h-32" />
        <div className="ushqn-card h-32" />
      </div>
    )
  }

  const p = profileQuery.data

  return (
    <div className="space-y-4">
      <ProfileCard
        profile={{
          display_name: p.display_name,
          location: p.location,
          headline: p.headline,
          school_or_org: p.school_or_org,
          role: p.role as UserRole,
          avatar_url: p.avatar_url,
          banner_url: p.banner_url,
          accent_color: p.accent_color,
          bio: p.bio,
          github_url: p.github_url,
          telegram_url: p.telegram_url,
          linkedin_url: p.linkedin_url,
          website_url: p.website_url,
          profile_views: p.profile_views,
        }}
        userId={userId ?? undefined}
        onEdit={() => setEditing(true)}
      />

      <SkillsCard
        skills={skillsQuery.data ?? []}
        newSkill=""
        onNewSkillChange={() => {}}
        onAdd={(s) => void addSkill(s)}
        onRemove={(s) => void removeSkill(s)}
      />

      <CategoryScores rows={scoresQuery.data ?? []} />

      <section className="ushqn-card p-5">
        <div className="ushqn-section-header">
          <h2 className="ushqn-section-title">{t('profile.edit.interestsTitle')}</h2>
          <span className="text-xs text-[#6B778C]">
            {t('profile.edit.selected', { n: myInterestsQuery.data?.size ?? 0 })}
          </span>
        </div>
        <p className="mb-4 text-sm text-[#6B778C]">{t('profile.edit.interestsHint')}</p>
        <div className="flex flex-wrap gap-2">
          {(interestsQuery.data ?? []).map((i) => {
            const on = myInterestsQuery.data?.has(i.id)
            return (
              <button
                type="button"
                key={i.id}
                onClick={() => void toggleInterest(i.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ${
                  on
                    ? 'border-[#0052CC] bg-[#0052CC] text-white shadow-sm shadow-blue-200'
                    : 'border-[#DFE1E6] bg-white text-[#172B4D] hover:border-[#0052CC] hover:bg-[#DEEBFF]/40'
                }`}
              >
                {i.label_ru}
                {on ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                  </svg>
                ) : null}
              </button>
            )
          })}
        </div>
      </section>

      {/* MODAL */}
      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(23,43,77,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div className="ushqn-card max-h-[92vh] w-full max-w-lg overflow-y-auto p-7">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#172B4D]">{t('profile.edit.modalTitle')}</h3>
                <p className="mt-0.5 text-sm text-[#6B778C]">{t('profile.edit.modalSub')}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full p-1.5 text-[#6B778C] hover:bg-gray-100"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((vals) => updateProfile.mutate(vals))}
            >
              <div>
                <label className="ushqn-label">{t('profile.edit.nameLabel')}</label>
                <input className="ushqn-input" placeholder={t('profile.edit.namePh')} {...form.register('display_name')} />
                {form.formState.errors.display_name ? (
                  <p className="mt-1 text-xs text-red-500">{t('profile.edit.nameRequired')}</p>
                ) : null}
              </div>
              <div>
                <label className="ushqn-label">{t('profile.edit.cityLabel')}</label>
                <input className="ushqn-input" placeholder={t('profile.edit.cityPh')} {...form.register('location')} />
              </div>
              <div>
                <label className="ushqn-label">{t('profile.edit.orgLabel')}</label>
                <input className="ushqn-input" placeholder={t('profile.edit.orgPh')} {...form.register('school_or_org')} />
              </div>
              <div>
                <label className="ushqn-label">{t('profile.edit.headlineLabel')}</label>
                <input className="ushqn-input" placeholder={t('profile.edit.headlinePh')} {...form.register('headline')} />
              </div>
              <div>
                <label className="ushqn-label">{t('profile.role')}</label>
                <select className="ushqn-input" {...form.register('role')}>
                  <option value="pupil">{t('profile.roles.pupil')}</option>
                  <option value="student">{t('profile.roles.student')}</option>
                  <option value="parent">{t('profile.roles.parent')}</option>
                </select>
              </div>
              <label className="flex items-center gap-2.5 rounded-lg border border-[#DFE1E6] bg-[#fafbfc] px-3 py-2.5 cursor-pointer hover:border-[#0052CC] transition">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#0052CC]"
                  {...form.register('is_employer')}
                />
                <span className="text-sm font-medium text-[#172B4D]">{t('profile.edit.employerCheck')}</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="ushqn-label">{t('profile.edit.avatarLabel')}</label>
                  <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#DFE1E6] bg-[#fafbfc] px-3 py-2.5 text-sm text-[#6B778C] hover:border-[#0052CC] hover:text-[#0052CC] transition">
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0a5.5 5.5 0 1 1 0 11A5.5 5.5 0 0 1 8 0Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 6.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"/>
                    </svg>
                    {t('profile.edit.upload')}
                    <input type="file" accept="image/*" className="sr-only" onChange={onAvatarChange} />
                  </label>
                </div>
                <div>
                  <label className="ushqn-label">{t('profile.edit.bannerLabel')}</label>
                  <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#DFE1E6] bg-[#fafbfc] px-3 py-2.5 text-sm text-[#6B778C] hover:border-[#0052CC] hover:text-[#0052CC] transition">
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M1.5 2h13A1.5 1.5 0 0 1 16 3.5v9A1.5 1.5 0 0 1 14.5 14h-13A1.5 1.5 0 0 1 0 12.5v-9A1.5 1.5 0 0 1 1.5 2ZM1.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-13Z"/>
                    </svg>
                    {t('profile.edit.upload')}
                    <input type="file" accept="image/*" className="sr-only" onChange={onBannerChange} />
                  </label>
                  {p.banner_url ? (
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-[#64748b] underline decoration-dotted hover:text-[#0052CC]"
                      onClick={() => void clearBanner()}
                    >
                      {t('profile.edit.removeBanner')}
                    </button>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="ushqn-label">{t('profile.edit.accentLabel')}</label>
                <p className="text-xs text-[#64748b]">{t('profile.edit.accentHint')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCENT_PRESETS.map((c) => {
                    const cur = form.watch('accent_color')
                    return (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        onClick={() => form.setValue('accent_color', c, { shouldDirty: true })}
                        className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition ${
                          cur === c ? 'ring-[#0f172a]' : 'ring-transparent hover:ring-[#94a3b8]'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    )
                  })}
                </div>
                <input type="hidden" {...form.register('accent_color')} />
                <input
                  type="color"
                  className="mt-3 h-10 w-14 cursor-pointer rounded border border-[#DFE1E6] bg-white p-0"
                  value={isValidAccentHex(form.watch('accent_color')) ? form.watch('accent_color') : '#0052CC'}
                  onChange={(e) =>
                    form.setValue('accent_color', e.target.value, { shouldDirty: true, shouldValidate: true })
                  }
                />
              </div>

              {updateProfile.isError ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{t('profile.edit.saveFailed')}</p>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-[#eef1f4] pt-4">
                <button
                  type="button"
                  className="rounded-full border border-[#DFE1E6] px-5 py-2 text-sm font-semibold text-[#172B4D] hover:bg-gray-50 transition"
                  onClick={() => setEditing(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="ushqn-btn-primary px-6 py-2"
                >
                  {updateProfile.isPending ? t('profile.saving') : t('profile.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
