import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { AppPageMeta } from '../components/AppPageMeta'
import { AuthBrand } from '../components/AuthBrand'
import { AuthShell } from '../components/AuthShell'

type Form = { password: string; confirm: string }

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [ready, setReady] = useState(false)

  const schema = z.object({
    password: z.string()
      .min(8, t('resetPassword.errors.minPassword'))
      .regex(/[A-Z]/, t('resetPassword.errors.uppercase'))
      .regex(/[0-9]/, t('resetPassword.errors.digit')),
    confirm: z.string(),
  }).refine((d) => d.password === d.confirm, {
    message: t('resetPassword.errors.mismatch'),
    path: ['confirm'],
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function onSubmit(values: Form) {
    setError(null)
    const { error: e } = await supabase.auth.updateUser({ password: values.password })
    if (e) { setError(e.message); return }
    setSuccess(true)
    setTimeout(() => navigate('/login', { replace: true }), 2500)
  }

  if (!ready) {
    return (
      <AuthShell maxWidthClass="max-w-sm">
        <AppPageMeta title={`${t('resetPassword.title')} · USHQN`} />
        <AuthBrand />
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell maxWidthClass="max-w-[420px]">
      <AppPageMeta title={`${t('resetPassword.title')} · USHQN`} />
      <AuthBrand />

      {success ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-3xl dark:from-emerald-900/50 dark:to-teal-900/40">
            ✅
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('resetPassword.success')}</h2>
        </div>
      ) : (
        <>
          <h2 className="mb-2 text-center text-lg font-bold text-slate-800 dark:text-slate-100">{t('resetPassword.title')}</h2>
          <p className="mb-5 text-center text-sm text-slate-500 dark:text-slate-400">{t('resetPassword.subtitle')}</p>
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label className="ushqn-label">{t('resetPassword.newPassword')}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="ushqn-input pr-11"
                    placeholder={t('settings.security.newPasswordPlaceholder')}
                    {...register('password')}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#97A0AF] hover:text-[#6B778C]"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
                      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
                {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
              </div>
              <div>
                <label className="ushqn-label">{t('resetPassword.confirm')}</label>
                <input type="password" className="ushqn-input" placeholder="…" {...register('confirm')} />
                {errors.confirm ? <p className="mt-1 text-xs text-red-600">{errors.confirm.message}</p> : null}
              </div>
              {error ? (
                <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={isSubmitting} className="ushqn-btn-primary w-full py-3 shadow-lg shadow-[#0052CC]/25">
                {isSubmitting ? t('resetPassword.submitting') : t('resetPassword.submit')}
              </button>
            </form>
          </>
        )}
    </AuthShell>
  )
}
