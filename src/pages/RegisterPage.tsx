import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import type { AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getAppBaseUrl } from '../lib/siteUrl'
import { trackEvent } from '../lib/analytics'
import type { UserRole } from '../types/database'

function formatRegisterError(e: AuthError, t: (k: string) => string): string {
  const m = e.message.toLowerCase()
  if (m.includes('signups not allowed') || m.includes('signup disabled')) {
    return 'In your Supabase project: Authentication → Settings → enable «Enable email signup».'
  }
  if (m.includes('already registered') || m.includes('user already')) {
    return t('login.noAccount')
  }
  return e.message
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

type Form = {
  email: string
  password: string
  display_name: string
  role: UserRole
}

function PasswordStrength({ password, t }: { password: string; t: (k: string) => string }) {
  const checks = [
    { label: t('register.passwordStrength.chars'), ok: password.length >= 8 },
    { label: t('register.passwordStrength.uppercase'), ok: /[A-Z]/.test(password) },
    { label: t('register.passwordStrength.digit'), ok: /[0-9]/.test(password) },
  ]
  const score = checks.filter((c) => c.ok).length
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400']
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score] : 'bg-[#DFE1E6]'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map((c) => (
          <span key={c.label} className={`text-xs ${c.ok ? 'text-green-600' : 'text-[#97A0AF]'}`}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<UserRole>('student')

  const roleOptions: { value: UserRole; label: string; icon: string; desc: string }[] = [
    { value: 'pupil', label: t('register.roles.pupil'), icon: '🎒', desc: t('register.roles.pupilDesc') },
    { value: 'student', label: t('register.roles.student'), icon: '🎓', desc: t('register.roles.studentDesc') },
    { value: 'parent', label: t('register.roles.parent'), icon: '👨‍👩‍👧', desc: t('register.roles.parentDesc') },
  ]

  const schema = z.object({
    email: z.string().email(t('register.errors.invalidEmail')),
    password: z.string()
      .min(8, t('register.errors.minPassword'))
      .regex(/[A-Z]/, t('register.errors.uppercaseRequired'))
      .regex(/[0-9]/, t('register.errors.digitRequired')),
    display_name: z.string().min(2, t('register.errors.minName')),
    role: z.enum(['pupil', 'student', 'parent']),
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'student' },
  })

  const passwordValue = watch('password') ?? ''

  async function signInWithGoogle() {
    setGoogleLoading(true)
    setError(null)
    const baseUrl = getAppBaseUrl()
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${baseUrl}/`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (e) {
      trackEvent('register_failed', { method: 'google' })
      setError(e.message)
      setGoogleLoading(false)
      return
    }
    trackEvent('oauth_start', { provider: 'google', source: 'register' })
  }

  async function onSubmit(values: Form) {
    setError(null)
    setInfo(null)
    const baseUrl = getAppBaseUrl()
    const { data, error: e } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: baseUrl ? `${baseUrl}/` : undefined,
        data: { display_name: values.display_name, role: values.role },
      },
    })
    if (e) {
      trackEvent('register_failed', { method: 'email' })
      setError(formatRegisterError(e, t))
      return
    }
    if (data.session) { navigate('/home', { replace: true }); return }
    if (data.user) {
      trackEvent('register_success', { method: 'email', role: values.role })
      setInfo(`${t('register.successTitle')} ${t('register.successDesc')} ${values.email}`)
      return
    }
    setError('Registration failed. Check your .env keys.')
  }

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #f3f2ef 60%, #e8f5e9 100%)' }}
    >
      <div className="ushqn-card w-full max-w-[460px] p-8 sm:p-10">
        {/* Branding */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0052CC] text-xl font-black text-white shadow-lg shadow-blue-200">
            U
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0052CC]">USHQN</h1>
          <p className="mt-0.5 text-sm font-semibold text-[#6B778C]">{t('login.slogan')}</p>
        </div>

        <h2 className="mb-5 text-center text-lg font-bold text-[#172B4D]">{t('register.title')}</h2>

        {/* Google */}
        <button
          type="button"
          disabled={googleLoading}
          onClick={() => void signInWithGoogle()}
          className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-[#DFE1E6] bg-white px-4 py-2.5 text-sm font-semibold text-[#172B4D] shadow-sm transition hover:border-[#C7CDD6] hover:bg-[#FAFBFC] active:scale-[0.99] disabled:opacity-60"
        >
          <GoogleIcon />
          {googleLoading ? t('login.googleLoading') : t('register.google')}
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#DFE1E6]" />
          <span className="text-xs font-medium text-[#97A0AF]">{t('register.orEmail')}</span>
          <div className="h-px flex-1 bg-[#DFE1E6]" />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {/* Role selector */}
          <div>
            <label className="ushqn-label mb-2">{t('register.roleDesc')}</label>
            <div className="grid grid-cols-3 gap-2">
              {roleOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { setSelectedRole(o.value); setValue('role', o.value) }}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all ${
                    selectedRole === o.value
                      ? 'border-[#0052CC] bg-[#DEEBFF] text-[#0052CC]'
                      : 'border-[#DFE1E6] bg-white text-[#172B4D] hover:border-[#0052CC]/40'
                  }`}
                >
                  <span className="text-2xl">{o.icon}</span>
                  <span className="text-xs font-bold">{o.label}</span>
                  <span className="text-[10px] text-[#6B778C] leading-tight">{o.desc}</span>
                </button>
              ))}
            </div>
            <input type="hidden" {...register('role')} />
          </div>

          <div>
            <label className="ushqn-label" htmlFor="display_name">{t('register.displayName')}</label>
            <input
              id="display_name"
              className="ushqn-input"
              autoComplete="name"
              placeholder={t('register.displayNamePlaceholder')}
              {...register('display_name')}
            />
            {errors.display_name ? <p className="mt-1 text-xs text-red-600">{errors.display_name.message}</p> : null}
          </div>

          <div>
            <label className="ushqn-label" htmlFor="email">{t('register.email')}</label>
            <input id="email" type="email" autoComplete="email" className="ushqn-input" placeholder={t('register.emailPlaceholder')} {...register('email')} />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
          </div>

          <div>
            <label className="ushqn-label" htmlFor="password">{t('register.password')}</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('register.passwordPlaceholder')}
                className="ushqn-input pr-11"
                {...register('password')}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#97A0AF] hover:text-[#6B778C]"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
                    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
                    <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd"/>
                    <path d="M10.748 13.93l2.523 2.523a10.003 10.003 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z"/>
                  </svg>
                )}
              </button>
            </div>
            {passwordValue ? <PasswordStrength password={passwordValue} t={t} /> : null}
            {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
          </div>

          {error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm leading-snug text-red-700">{error}</p>
          ) : null}
          {info ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm leading-snug text-green-900">{info}</p>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="ushqn-btn-primary w-full py-3 text-base">
            {isSubmitting ? t('register.submitting') : `${t('register.submit')} 🚀`}
          </button>
        </form>

        <div className="mt-4 rounded-xl bg-gradient-to-r from-[#E3FCEF] to-[#DEEBFF] px-4 py-3 text-center">
          <p className="text-sm font-bold text-[#006644]">🎁 +500 {t('common.points')}!</p>
        </div>

        <p className="mt-4 text-center text-sm text-[#6B778C]">
          {t('register.hasAccount')}{' '}
          <Link to="/login" className="font-bold text-[#0052CC] hover:underline">{t('register.login')}</Link>
        </p>
      </div>
    </div>
  )
}
