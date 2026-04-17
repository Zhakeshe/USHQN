import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/** Wordmark for login / register — matches landing energy without logo mark. */
export function AuthBrand({ slogan, extra }: { slogan?: ReactNode; extra?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="mb-6 text-center">
      <div className="relative mx-auto mb-2">
        <span
          className="pointer-events-none absolute -inset-10 rounded-full bg-gradient-to-br from-[#0052CC]/35 via-indigo-500/20 to-cyan-400/25 blur-3xl motion-safe:animate-pulse"
          aria-hidden
        />
        <h1 className="landing-wordmark-shimmer relative text-[2rem] font-black tracking-tight sm:text-[2.35rem]">
          {t('brand.wordmark')}
        </h1>
      </div>
      {t('brand.legalName') !== t('brand.wordmark') ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-400 dark:text-slate-500">{t('brand.legalName')}</p>
      ) : null}
      {slogan ? <div className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{slogan}</div> : null}
      {extra}
    </div>
  )
}
