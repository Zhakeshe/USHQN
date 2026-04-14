import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useConfirm } from '../lib/confirm'
import { getAppBaseUrl } from '../lib/siteUrl'
import { trackEvent } from '../lib/analytics'
import { AppPageMeta } from '../components/AppPageMeta'

const LANG_OPTIONS = [
  { code: 'ru', key: 'settings.language.ru' },
  { code: 'kk', key: 'settings.language.kk' },
  { code: 'en', key: 'settings.language.en' },
]

type SocialForm = {
  bio?: string
  github_url?: string
  telegram_url?: string
  linkedin_url?: string
  website_url?: string
  username?: string
}

type PasswordForm = {
  newPassword: string
  confirm: string
}

type Section = 'profile' | 'invite' | 'appearance' | 'security' | 'notifications' | 'privacy' | 'language'

type UserSettingsPatch = Partial<{
  notify_follows: boolean
  notify_messages: boolean
  notify_achievements: boolean
  profile_public: boolean
  show_in_people_search: boolean
  theme: 'light' | 'dark' | 'system'
  reduce_motion: boolean
  digest_email_enabled: boolean
  push_notify_opt_in: boolean
}>

function NavIcon({ name }: { name: Section }) {
  const c = 'h-4 w-4 shrink-0 opacity-80'
  switch (name) {
    case 'profile':
      return (
        <svg className={c} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.468 7.126A5.985 5.985 0 0 1 8 13a5.985 5.985 0 0 1 5.468 2.126A8.959 8.959 0 0 0 8 15c-1.98 0-3.812.642-5.468 1.876Z" />
        </svg>
      )
    case 'security':
      return (
        <svg className={c} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 1 2 3v5.09c0 3.52 2.29 6.79 6 7.91 3.71-1.12 6-4.39 6-7.91V3L8 1Zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
        </svg>
      )
    case 'notifications':
      return (
        <svg className={c} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 1a5 5 0 0 0-5 5v2.09L2 11v1h12v-1l-1-2.91V6a5 5 0 0 0-5-5Zm0 14a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2Z" />
        </svg>
      )
    case 'privacy':
      return (
        <svg className={c} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 0 0 3v4c0 4.42 3.58 8 8 8s8-3.58 8-8V3L8 0Zm0 2.12L14 4.5V7c0 3.31-2.69 6-6 6S2 10.31 2 7V4.5L8 2.12Z M6 6h4v4H6V6Z" />
        </svg>
      )
    case 'appearance':
      return (
        <svg className={c} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.5 3.5a.5.5 0 0 0-.5.5v1.5L3 9.793V12h2.207L9 8.207V5.5a.5.5 0 0 0-.5-.5h-3Zm2.646 5.354L6.207 10.5H5v-1.207l1.5-1.5V7.793L10.207 3H12v1.793l-3.854 3.854Z" />
        </svg>
      )
    case 'language':
      return (
        <svg className={c} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM1.5 8.5h4.07c.05.99.25 1.94.6 2.83H2.7A6.48 6.48 0 0 1 1.5 8.5Zm0-1a6.48 6.48 0 0 1 1.2-2.83h3.47a12.04 12.04 0 0 0-.6 2.83H1.5Zm11 1c0 1-.2 1.95-.51 2.83h3.01A6.48 6.48 0 0 0 14.5 8.5h-2Zm2-1h-2a12.04 12.04 0 0 0-.51-2.83h2.31c.32.88.51 1.83.51 2.83ZM10.35 1.54A6.97 6.97 0 0 1 12.5 6h-3.15a12.04 12.04 0 0 0-.6-2.83 7.04 7.04 0 0 1 1.6-1.63ZM8.75 6H7.25a10.98 10.98 0 0 1 .53-3h.44c.24.95.4 1.95.53 3ZM6.4 3c-.35.89-.55 1.84-.6 2.83H3.65A6.97 6.97 0 0 1 6.4 3Zm0 7.5c.36.89.85 1.7 1.45 2.39a6.98 6.98 0 0 1-3.2-2.39H6.4Zm2.15 3.46a7.04 7.04 0 0 1-1.6-1.63c.35-.89.55-1.84.6-2.83h3.15a6.97 6.97 0 0 1-2.15 4.46ZM8.75 10c-.13 1.05-.29 2.05-.53 3h-.44a10.98 10.98 0 0 1-.53-3h1.5Z" />
        </svg>
      )
    case 'invite':
      return (
        <svg className={c} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM6 5.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Zm5 5.5v-.5a2.5 2.5 0 0 0-2.5-2.5h-3A2.5 2.5 0 0 0 3 10.5v.5h8Zm3.28-6.72a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 1 1 1.06-1.06l1.72 1.72 4.72-4.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
      )
    default:
      return null
  }
}

export function SettingsPage() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { t, i18n } = useTranslation()
  const [section, setSection] = useState<Section>('profile')
  const [showPass, setShowPass] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const debouncedUsername = useDebouncedValue(usernameInput, 500)

  const SECTIONS: { id: Section; label: string; icon: ReactNode }[] = [
    { id: 'profile', label: t('settings.sections.profile'), icon: <NavIcon name="profile" /> },
    { id: 'invite', label: t('settings.sections.invite'), icon: <NavIcon name="invite" /> },
    { id: 'appearance', label: t('settings.sections.appearance'), icon: <NavIcon name="appearance" /> },
    { id: 'security', label: t('settings.sections.security'), icon: <NavIcon name="security" /> },
    { id: 'notifications', label: t('settings.sections.notifications'), icon: <NavIcon name="notifications" /> },
    { id: 'privacy', label: t('settings.sections.privacy'), icon: <NavIcon name="privacy" /> },
    { id: 'language', label: t('settings.sections.language'), icon: <NavIcon name="language" /> },
  ]

  const socialSchema = z.object({
    bio: z.string().max(300).optional(),
    username: z.string().optional().refine((v) => !v || /^[a-z0-9_]{3,30}$/.test(v), {
      message: t('settings.profile.usernameInvalid'),
    }),
    github_url: z.string().url(t('settings.profile.invalidUrl')).or(z.literal('')).optional(),
    telegram_url: z.string().optional(),
    linkedin_url: z.string().url(t('settings.profile.invalidUrl')).or(z.literal('')).optional(),
    website_url: z.string().url(t('settings.profile.invalidUrl')).or(z.literal('')).optional(),
  })

  const passwordSchema = z.object({
    newPassword: z.string()
      .min(8, t('settings.security.errors.minPassword'))
      .regex(/[A-Z]/, t('settings.security.errors.uppercase'))
      .regex(/[0-9]/, t('settings.security.errors.digit')),
    confirm: z.string(),
  }).refine((d) => d.newPassword === d.confirm, {
    message: t('settings.security.errors.mismatch'),
    path: ['confirm'],
  })

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single()
      if (error) throw error
      return data
    },
  })

  const usernameCheckQuery = useQuery({
    queryKey: ['username-check', debouncedUsername, userId],
    enabled: /^[a-z0-9_]{3,30}$/.test(debouncedUsername) && Boolean(userId),
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('username', debouncedUsername.toLowerCase())
        .neq('id', userId!)
      return (count ?? 0) === 0
    },
  })

  const settingsQuery = useQuery({
    queryKey: ['user-settings', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId!).single()
      return data
    },
  })

  const socialForm = useForm<SocialForm>({ resolver: zodResolver(socialSchema) })
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  useEffect(() => {
    const p = profileQuery.data
    if (!p) return
    socialForm.reset({
      bio: p.bio ?? '',
      username: (p as { username?: string | null }).username ?? '',
      github_url: p.github_url ?? '',
      telegram_url: p.telegram_url ?? '',
      linkedin_url: p.linkedin_url ?? '',
      website_url: p.website_url ?? '',
    })
  }, [profileQuery.data, socialForm])

  const saveSocial = useMutation({
    mutationFn: async (values: SocialForm) => {
      const { error } = await supabase.from('profiles').update({
        bio: values.bio || null,
        username: values.username ? values.username.toLowerCase().trim() : null,
        github_url: values.github_url || null,
        telegram_url: values.telegram_url || null,
        linkedin_url: values.linkedin_url || null,
        website_url: values.website_url || null,
      }).eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', userId] })
      toast(t('settings.profile.saved'))
    },
    onError: () => toast(t('common.error'), 'error'),
  })

  const changePassword = useMutation({
    mutationFn: async (values: PasswordForm) => {
      const { error } = await supabase.auth.updateUser({ password: values.newPassword })
      if (error) throw error
    },
    onSuccess: () => {
      passwordForm.reset()
      toast(t('settings.security.passwordChanged'))
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const updateSettings = useMutation({
    mutationFn: async (patch: UserSettingsPatch) => {
      const { error } = await supabase.from('user_settings').upsert({ user_id: userId!, ...patch })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user-settings', userId] })
      toast(t('settings.saved'))
    },
    onError: () => toast(t('common.error'), 'error'),
  })

  async function deleteAccount() {
    const ok = await confirm({
      title: t('settings.security.deleteConfirmTitle'),
      description: t('settings.security.deleteConfirmDesc'),
      confirmLabel: t('settings.security.deleteConfirmBtn'),
      danger: true,
    })
    if (!ok) return
    toast(t('settings.security.deleteAdminNote'), 'info')
  }

  const s = settingsQuery.data

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <AppPageMeta title={t('nav.settings')} />
      <div className="ushqn-card p-5">
        <h1 className="text-2xl font-extrabold text-[#172B4D]">{t('settings.title')}</h1>
        <p className="mt-0.5 text-sm text-[#6B778C]">{t('settings.subtitle')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Sidebar */}
        <nav className="ushqn-card h-fit p-2 lg:col-span-1">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSection(sec.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                section === sec.id
                  ? 'bg-[#DEEBFF] text-[#0052CC]'
                  : 'text-[#6B778C] hover:bg-[#F4F5F7] hover:text-[#172B4D]'
              }`}
            >
              <span>{sec.icon}</span>
              {sec.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="ushqn-card p-6 lg:col-span-3">
          {/* Profile & Social */}
          {section === 'profile' ? (
            <form onSubmit={socialForm.handleSubmit((v) => saveSocial.mutate(v))} className="space-y-4">
              <h2 className="ushqn-section-title">{t('settings.profile.title')}</h2>
              {/* Username */}
              <div>
                <label className="ushqn-label">{t('settings.profile.username')}</label>
                <div
                  className={`flex items-center overflow-hidden rounded-xl border bg-[var(--color-ushqn-surface-muted)] focus-within:ring-2 ${
                    usernameCheckQuery.data === false
                      ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-400/20'
                      : usernameCheckQuery.data === true && debouncedUsername.length >= 3
                      ? 'border-emerald-400 focus-within:border-emerald-400 focus-within:ring-emerald-400/20'
                      : 'border-[var(--color-ushqn-border)] focus-within:border-[#0052CC] focus-within:ring-[#0052CC]/20'
                  }`}
                >
                  <span className="border-r border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] px-3 py-2.5 text-sm font-bold text-[var(--color-ushqn-muted)]">@</span>
                  <input
                    className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--color-ushqn-text)] outline-none placeholder:text-[var(--color-ushqn-muted)]"
                    placeholder={t('settings.profile.usernamePh')}
                    {...socialForm.register('username', {
                      onChange: (e) => setUsernameInput((e.target as HTMLInputElement).value),
                    })}
                  />
                  {usernameCheckQuery.isFetching ? (
                    <span className="pr-3 text-xs text-[var(--color-ushqn-muted)]">…</span>
                  ) : usernameCheckQuery.data === true && debouncedUsername.length >= 3 ? (
                    <span className="pr-3 text-xs font-bold text-emerald-500">✓</span>
                  ) : usernameCheckQuery.data === false ? (
                    <span className="pr-3 text-xs font-bold text-red-500">✕</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-ushqn-muted)]">{t('settings.profile.usernameHint')}</p>
                {usernameCheckQuery.data === false ? (
                  <p className="mt-1 text-xs font-semibold text-red-500">{t('settings.profile.usernameTaken')}</p>
                ) : null}
                {socialForm.formState.errors.username ? <p className="mt-1 text-xs text-red-600">{socialForm.formState.errors.username.message}</p> : null}
              </div>
              {/* Bio */}
              <div>
                <label className="ushqn-label">{t('settings.profile.bio')}</label>
                <textarea
                  rows={3}
                  className="ushqn-input resize-none"
                  placeholder={t('settings.profile.bioPlaceholder')}
                  {...socialForm.register('bio')}
                />
                {socialForm.formState.errors.bio ? <p className="mt-1 text-xs text-red-600">{socialForm.formState.errors.bio.message}</p> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="ushqn-label">
                    <span className="mr-1.5">🐙</span>{t('settings.profile.github')}
                  </label>
                  <input className="ushqn-input" placeholder={t('settings.profile.githubPlaceholder')} {...socialForm.register('github_url')} />
                  {socialForm.formState.errors.github_url ? <p className="mt-1 text-xs text-red-600">{socialForm.formState.errors.github_url.message}</p> : null}
                </div>
                <div>
                  <label className="ushqn-label">
                    <span className="mr-1.5">✈️</span>{t('settings.profile.telegram')}
                  </label>
                  <input className="ushqn-input" placeholder={t('settings.profile.telegramPlaceholder')} {...socialForm.register('telegram_url')} />
                </div>
                <div>
                  <label className="ushqn-label">
                    <span className="mr-1.5">💼</span>{t('settings.profile.linkedin')}
                  </label>
                  <input className="ushqn-input" placeholder={t('settings.profile.linkedinPlaceholder')} {...socialForm.register('linkedin_url')} />
                  {socialForm.formState.errors.linkedin_url ? <p className="mt-1 text-xs text-red-600">{socialForm.formState.errors.linkedin_url.message}</p> : null}
                </div>
                <div>
                  <label className="ushqn-label">
                    <span className="mr-1.5">🌐</span>{t('settings.profile.website')}
                  </label>
                  <input className="ushqn-input" placeholder={t('settings.profile.websitePlaceholder')} {...socialForm.register('website_url')} />
                  {socialForm.formState.errors.website_url ? <p className="mt-1 text-xs text-red-600">{socialForm.formState.errors.website_url.message}</p> : null}
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saveSocial.isPending} className="ushqn-btn-primary px-6">
                  {saveSocial.isPending ? t('settings.profile.saving') : t('settings.profile.save')}
                </button>
              </div>
            </form>
          ) : null}

          {section === 'invite' && userId ? (
            <div className="space-y-3">
              <h2 className="ushqn-section-title">{t('settings.invite.title')}</h2>
              <p className="text-sm text-[#6B778C]">{t('settings.invite.desc')}</p>
              <div className="rounded-xl border border-[#eef1f4] bg-[#FAFBFC] p-3">
                <p className="break-all text-xs font-mono text-[#172B4D]">
                  {`${getAppBaseUrl()}/register?ref=${userId}`}
                </p>
              </div>
              <button
                type="button"
                className="ushqn-btn-primary px-4 py-2 text-sm"
                onClick={() => {
                  void navigator.clipboard.writeText(`${getAppBaseUrl()}/register?ref=${userId}`).then(() => {
                    trackEvent('referral_link_copied')
                    toast(t('common.copied'))
                  })
                }}
              >
                {t('settings.invite.copy')}
              </button>
            </div>
          ) : null}

          {/* Appearance */}
          {section === 'appearance' ? (
            <div className="space-y-4">
              <h2 className="ushqn-section-title">{t('settings.appearance.title')}</h2>
              <p className="text-sm text-[#6B778C]">{t('settings.appearance.themeHint')}</p>
              <div>
                <p className="ushqn-label">{t('settings.appearance.themeLabel')}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      { id: 'light' as const, label: t('settings.appearance.themeLight') },
                      { id: 'dark' as const, label: t('settings.appearance.themeDark') },
                      { id: 'system' as const, label: t('settings.appearance.themeSystem') },
                    ]
                  ).map((opt) => {
                    const active = (s?.theme ?? 'system') === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateSettings.mutate({ theme: opt.id })}
                        disabled={updateSettings.isPending}
                        className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold transition ${
                          active
                            ? 'border-[#0052CC] bg-[#EFF6FF] text-[#0052CC]'
                            : 'border-[#DFE1E6] bg-white text-[#172B4D] hover:border-[#B3D4FF]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#DFE1E6] p-4 hover:border-[#0052CC]/30 transition">
                <div>
                  <p className="text-sm font-semibold text-[#172B4D]">{t('settings.appearance.reduceMotion')}</p>
                  <p className="text-xs text-[#6B778C]">{t('settings.appearance.reduceMotionDesc')}</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#0052CC]"
                  checked={s?.reduce_motion ?? false}
                  onChange={(e) => updateSettings.mutate({ reduce_motion: e.target.checked })}
                />
              </label>
            </div>
          ) : null}

          {/* Security */}
          {section === 'security' ? (
            <div className="space-y-6">
              <h2 className="ushqn-section-title">{t('settings.security.title')}</h2>
              <form onSubmit={passwordForm.handleSubmit((v) => changePassword.mutate(v))} className="space-y-4">
                <h3 className="text-sm font-bold text-[#172B4D]">{t('settings.security.changePassword')}</h3>
                <div>
                  <label className="ushqn-label">{t('settings.security.newPassword')}</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="ushqn-input pr-11"
                      placeholder={t('settings.security.newPasswordPlaceholder')}
                      {...passwordForm.register('newPassword')}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#97A0AF]">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
                        <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd"/>
                      </svg>
                    </button>
                  </div>
                  {passwordForm.formState.errors.newPassword ? <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.newPassword.message}</p> : null}
                </div>
                <div>
                  <label className="ushqn-label">{t('settings.security.confirmPassword')}</label>
                  <input type="password" className="ushqn-input" placeholder={t('settings.security.confirmPlaceholder')} {...passwordForm.register('confirm')} />
                  {passwordForm.formState.errors.confirm ? <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.confirm.message}</p> : null}
                </div>
                <button type="submit" disabled={changePassword.isPending} className="ushqn-btn-primary">
                  {changePassword.isPending ? t('settings.security.submitting') : t('settings.security.submit')}
                </button>
              </form>

              <div className="border-t border-[#eef1f4] pt-6">
                <h3 className="text-sm font-bold text-[#172B4D]">{t('settings.security.dangerZone')}</h3>
                <p className="mt-1 text-xs text-[#6B778C]">{t('settings.security.dangerDesc')}</p>
                <button
                  type="button"
                  onClick={() => void deleteAccount()}
                  className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition"
                >
                  {t('settings.security.deleteAccount')}
                </button>
              </div>
            </div>
          ) : null}

          {/* Notifications */}
          {section === 'notifications' ? (
            <div className="space-y-4">
              <h2 className="ushqn-section-title">{t('settings.notificationsSection.title')}</h2>
              <p className="text-sm text-[#6B778C]">{t('settings.notificationsSection.desc')}</p>
              {([
                { key: 'notify_follows' as const, label: t('settings.notificationsSection.follows'), desc: t('settings.notificationsSection.followsDesc') },
                { key: 'notify_messages' as const, label: t('settings.notificationsSection.messages'), desc: t('settings.notificationsSection.messagesDesc') },
                { key: 'notify_achievements' as const, label: t('settings.notificationsSection.achievements'), desc: t('settings.notificationsSection.achievementsDesc') },
                { key: 'digest_email_enabled' as const, label: t('settings.notificationsSection.digestEmail'), desc: t('settings.notificationsSection.digestEmailDesc') },
                { key: 'push_notify_opt_in' as const, label: t('settings.notificationsSection.pushOptIn'), desc: t('settings.notificationsSection.pushOptInDesc') },
              ]).map((item) => (
                <label key={item.key} className="flex cursor-pointer items-center justify-between rounded-xl border border-[#DFE1E6] p-4 hover:border-[#0052CC]/30 transition">
                  <div>
                    <p className="text-sm font-semibold text-[#172B4D]">{item.label}</p>
                    <p className="text-xs text-[#6B778C]">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#0052CC]"
                    checked={
                      item.key === 'digest_email_enabled'
                        ? (s?.digest_email_enabled ?? true)
                        : item.key === 'push_notify_opt_in'
                          ? Boolean(s?.push_notify_opt_in)
                          : (s?.[item.key] ?? true)
                    }
                    onChange={async (e) => {
                      const checked = e.target.checked
                      if (item.key === 'push_notify_opt_in' && checked && typeof Notification !== 'undefined') {
                        const perm = await Notification.requestPermission()
                        if (perm !== 'granted') {
                          toast(t('settings.notificationsSection.pushDenied'), 'info')
                          return
                        }
                      }
                      updateSettings.mutate({ [item.key]: checked })
                    }}
                  />
                </label>
              ))}
            </div>
          ) : null}

          {/* Privacy */}
          {section === 'privacy' ? (
            <div className="space-y-4">
              <h2 className="ushqn-section-title">{t('settings.privacy.title')}</h2>
              <p className="text-sm text-[#6B778C]">{t('settings.privacy.desc')}</p>
              {([
                { key: 'profile_public' as const, label: t('settings.privacy.publicProfile'), desc: t('settings.privacy.publicProfileDesc') },
                { key: 'show_in_people_search' as const, label: t('settings.privacy.showInSearch'), desc: t('settings.privacy.showInSearchDesc') },
              ]).map((item) => (
                <label key={item.key} className="flex cursor-pointer items-center justify-between rounded-xl border border-[#DFE1E6] p-4 hover:border-[#0052CC]/30 transition">
                  <div>
                    <p className="text-sm font-semibold text-[#172B4D]">{item.label}</p>
                    <p className="text-xs text-[#6B778C]">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#0052CC]"
                    checked={s?.[item.key] ?? true}
                    onChange={(e) => updateSettings.mutate({ [item.key]: e.target.checked })}
                  />
                </label>
              ))}

              <div className="rounded-xl border border-[#DFE1E6] p-4">
                <p className="text-sm font-semibold text-[#172B4D]">{t('settings.privacy.profileLink')}</p>
                <p className="mt-1 text-xs text-[#6B778C]">{t('settings.privacy.profileLinkDesc')}</p>
                <div className="mt-2 flex gap-2">
                  <code className="flex-1 rounded-md bg-[#F4F5F7] px-3 py-1.5 text-xs text-[#172B4D] truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/u/${userId}` : ''}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(`${window.location.origin}/u/${userId}`)
                      toast(t('settings.privacy.linkCopied'), 'info')
                    }}
                    className="rounded-md border border-[#DFE1E6] px-3 py-1.5 text-xs font-semibold hover:bg-[#F4F5F7] transition"
                  >
                    {t('settings.privacy.copyLink')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Language */}
          {section === 'language' ? (
            <div className="space-y-4">
              <h2 className="ushqn-section-title">{t('settings.language.title')}</h2>
              <p className="text-sm text-[#6B778C]">{t('settings.language.desc')}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {LANG_OPTIONS.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => void i18n.changeLanguage(lang.code)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      i18n.language === lang.code
                        ? 'border-[#0052CC] bg-[#EFF6FF] shadow-[0_0_0_3px_rgba(0,82,204,0.12)]'
                        : 'border-[#DFE1E6] bg-white hover:border-[#B3D4FF] hover:bg-[#FAFBFC]'
                    }`}
                  >
                    <div>
                      <p className={`font-bold ${i18n.language === lang.code ? 'text-[#0052CC]' : 'text-[#172B4D]'}`}>
                        {t(lang.key)}
                      </p>
                      {i18n.language === lang.code ? (
                        <p className="mt-0.5 text-xs font-semibold text-[#0052CC]">✓ {t('settings.language.active')}</p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
