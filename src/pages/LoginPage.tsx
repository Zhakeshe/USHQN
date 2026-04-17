import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { getAppBaseUrl } from '../lib/siteUrl'
import { trackEvent } from '../lib/analytics'
import { AppPageMeta } from '../components/AppPageMeta'
import { AuthBrand } from '../components/AuthBrand'
import { AuthShell } from '../components/AuthShell'

function makeSchema(t: (k: string) => string) {
  return z.object({
    email: z.string().email(t('login.invalidEmail')),
    password: z.string().min(6, t('login.minPassword')),
  })
}

type Form = { email: string; password: string }

function isEmailNotConfirmed(err: { message?: string; code?: string } | null) {
  if (!err) return false
  const m = (err.message ?? '').toLowerCase()
  return err.code === 'email_not_confirmed' || m.includes('email not confirmed')
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

export function LoginPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [resendHint, setResendHint] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const schema = makeSchema(t)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(values: Form) {
    setError(null)
    setNeedsConfirm(false)
    setPendingEmail(null)
    setResendHint(null)
    const { error: e } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    if (e) {
      trackEvent('login_failed', { method: 'password' })
      if (isEmailNotConfirmed(e)) {
        setNeedsConfirm(true)
        setPendingEmail(values.email)
        setError(t('login.emailNotConfirmed'))
        return
      }
      setError(e.message)
      return
    }
    trackEvent('login_success', { method: 'password' })
    navigate('/onboarding', { replace: true })
  }

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
      trackEvent('login_failed', { method: 'google' })
      setError(e.message)
      setGoogleLoading(false)
      return
    }
    trackEvent('oauth_start', { provider: 'google', source: 'login' })
  }

  async function resendConfirmation() {
    const email = pendingEmail ?? getValues('email')
    if (!email) return
    setResending(true)
    setResendHint(null)
    const { error: e } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (e) { setResendHint(e.message); return }
    setResendHint(t('login.resendHint'))
  }

  return (
    <AuthShell maxWidthClass="max-w-[420px]">
      <AppPageMeta title={t('login.title')} />
      <AuthBrand slogan={t('login.slogan')} />

      <h2 className="mb-5 text-center text-lg font-bold text-slate-800 dark:text-slate-100">{t('login.title')}</h2>

      {/* Google OAuth */}
      <button
        type="button"
        disabled={googleLoading}
        onClick={() => void signInWithGoogle()}
        className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-md active:scale-[0.99] disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <GoogleIcon />
        {googleLoading ? t('login.googleLoading') : t('login.google')}
      </button>

      {/* Divider */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('login.orEmail')}</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-600" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="ushqn-label" htmlFor="email">{t('login.email')}</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('login.emailPlaceholder')}
            className="ushqn-input"
            {...register('email')}
          />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="ushqn-label" htmlFor="password">{t('login.password')}</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-[#0052CC] hover:underline dark:text-[#79b8ff]">
              {t('login.forgotPassword')}
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t('login.passwordPlaceholder')}
              className="ushqn-input pr-11"
              {...register('password')}
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
          {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
        </div>

        {error ? (
          <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm leading-snug text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {needsConfirm ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/95 p-4 text-sm text-slate-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-bold text-amber-900 dark:text-amber-200">{t('login.setupHint')}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-amber-950/90 dark:text-amber-100/90">
              <li dangerouslySetInnerHTML={{ __html: t('login.setupStep1') }} />
              <li dangerouslySetInnerHTML={{ __html: t('login.setupStep2') }} />
            </ol>
            <button
              type="button"
              disabled={resending}
              onClick={() => void resendConfirmation()}
              className="mt-3 w-full rounded-lg border border-[#0052CC] bg-white py-2 text-xs font-semibold text-[#0052CC] transition hover:bg-[#DEEBFF] disabled:opacity-60 dark:border-[#79b8ff] dark:bg-slate-900 dark:text-[#79b8ff] dark:hover:bg-slate-800"
            >
              {resending ? t('login.resending') : t('login.resendEmail')}
            </button>
            {resendHint ? <p className="mt-2 text-xs text-green-700 dark:text-green-400">{resendHint}</p> : null}
          </div>
        ) : null}

        <button type="submit" disabled={isSubmitting} className="ushqn-btn-primary w-full py-3 text-base shadow-lg shadow-[#0052CC]/25">
          {isSubmitting ? t('login.submitting') : t('login.submit')}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        {t('login.noAccount')}{' '}
        <Link to="/register" className="font-bold text-[#0052CC] hover:underline dark:text-[#79b8ff]">
          {t('login.register')}
        </Link>
      </p>
    </AuthShell>
  )
}
