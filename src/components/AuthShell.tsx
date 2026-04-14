import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * Full-screen auth layout: dark immersive background + glass card (matches landing energy).
 */
export function AuthShell({ children, maxWidthClass = 'max-w-[460px]' }: { children: ReactNode; maxWidthClass?: string }) {
  const { t } = useTranslation()

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#020617]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.14) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
        aria-hidden
      />
      <div
        className="ushqn-auth-orb-a pointer-events-none absolute -left-24 top-24 h-[min(55vw,22rem)] w-[min(55vw,22rem)] rounded-full bg-[#0052CC]/45 blur-[100px]"
        aria-hidden
      />
      <div
        className="ushqn-auth-orb-b pointer-events-none absolute -right-20 bottom-8 h-[min(60vw,24rem)] w-[min(60vw,24rem)] rounded-full bg-indigo-500/35 blur-[110px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[28%] h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-400/15 blur-[88px]"
        aria-hidden
      />

      <header className="relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-white/85 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10 hover:text-white"
        >
          <span aria-hidden className="text-sm opacity-80">
            ←
          </span>
          {t('auth.backToLanding')}
        </Link>
        <span className="landing-wordmark-shimmer hidden text-sm font-black tracking-tight sm:inline">{t('brand.wordmark')}</span>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-10 pt-0 sm:px-6">
        <div className={`ushqn-auth-card-in w-full ${maxWidthClass}`}>
          <div className="rounded-[1.75rem] border border-white/25 bg-white/[0.98] p-7 shadow-[0_28px_90px_-16px_rgba(0,82,204,0.42)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/[0.94] sm:p-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
