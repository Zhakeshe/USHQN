import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { getAppBaseUrl } from '../lib/siteUrl'
import { AppPageMeta } from '../components/AppPageMeta'
import { AuthBrand } from '../components/AuthBrand'
import { AuthShell } from '../components/AuthShell'

type Form = { email: string }

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const schema = z.object({
    email: z.string().email(t('forgotPassword.invalidEmail')),
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: Form) {
    setError(null)
    const baseUrl = getAppBaseUrl()
    const { error: e } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${baseUrl}/reset-password`,
    })
    if (e) {
      setError(e.message)
      return
    }
    setSent(true)
  }

  return (
    <AuthShell maxWidthClass="max-w-[420px]">
      <AppPageMeta title={`${t('forgotPassword.title')} · USHQN`} />
      <AuthBrand />

      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-sky-100 text-3xl dark:from-emerald-900/50 dark:to-sky-900/40">
            📧
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('forgotPassword.successTitle')}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('forgotPassword.successDesc')}</p>
          <Link
            to="/login"
            className="mt-6 block w-full rounded-xl border border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            ← {t('forgotPassword.backToLogin')}
          </Link>
        </div>
      ) : (
        <>
          <h2 className="mb-2 text-center text-lg font-bold text-slate-800 dark:text-slate-100">{t('forgotPassword.title')}</h2>
          <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('forgotPassword.subtitle')}</p>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="ushqn-label" htmlFor="email">
                {t('forgotPassword.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t('forgotPassword.emailPlaceholder')}
                className="ushqn-input"
                {...register('email')}
              />
              {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
            </div>

            {error ? (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={isSubmitting} className="ushqn-btn-primary w-full py-3 shadow-lg shadow-[#0052CC]/25">
              {isSubmitting ? t('forgotPassword.submitting') : `📧 ${t('forgotPassword.submit')}`}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            <Link to="/login" className="font-bold text-[#0052CC] hover:underline dark:text-[#79b8ff]">
              ← {t('forgotPassword.backToLogin')}
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
