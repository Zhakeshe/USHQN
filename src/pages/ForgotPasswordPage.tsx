import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

type Form = { email: string }

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const schema = z.object({
    email: z.string().email(t('forgotPassword.invalidEmail')),
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: Form) {
    setError(null)
    const { error: e } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (e) { setError(e.message); return }
    setSent(true)
  }

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #f3f2ef 60%, #e8f5e9 100%)' }}
    >
      <div className="ushqn-card w-full max-w-[420px] p-8 sm:p-10">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0052CC] text-xl font-black text-white shadow-lg shadow-blue-200">
            U
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0052CC]">USHQN</h1>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E3FCEF] text-3xl">
              📧
            </div>
            <h2 className="text-lg font-bold text-[#172B4D]">{t('forgotPassword.successTitle')}</h2>
            <p className="mt-2 text-sm text-[#6B778C]">{t('forgotPassword.successDesc')}</p>
            <Link
              to="/login"
              className="mt-6 block w-full rounded-xl border border-[#DFE1E6] bg-white py-2.5 text-center text-sm font-semibold text-[#172B4D] hover:bg-[#F4F5F7] transition"
            >
              ← {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-center text-lg font-bold text-[#172B4D]">{t('forgotPassword.title')}</h2>
            <p className="mb-6 text-center text-sm text-[#6B778C]">{t('forgotPassword.subtitle')}</p>

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label className="ushqn-label" htmlFor="email">{t('forgotPassword.email')}</label>
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
                <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}

              <button type="submit" disabled={isSubmitting} className="ushqn-btn-primary w-full py-3">
                {isSubmitting ? t('forgotPassword.submitting') : `📧 ${t('forgotPassword.submit')}`}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-[#6B778C]">
              <Link to="/login" className="font-bold text-[#0052CC] hover:underline">← {t('forgotPassword.backToLogin')}</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
