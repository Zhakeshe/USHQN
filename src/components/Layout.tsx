import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { OfflineBanner } from './OfflineBanner'
import { PrivacyBanner } from './PrivacyBanner'
import { NotificationPermissionPrompt } from './NotificationPermissionPrompt'
import { ThemeSync } from './ThemeSync'
import { ChatMessageNotifications } from './ChatMessageNotifications'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

/* Minimal top-bar — mobile only (lg:hidden) */
function TopBar() {
  const { t, i18n } = useTranslation()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: unread } = useQuery({
    queryKey: ['notif-count', userId],
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId!).eq('is_read', false)
      return count ?? 0
    },
  })

  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel(`topbar-notif:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['notif-count', userId] })
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [userId, qc])

  const badge = (unread ?? 0) > 0 ? Math.min(unread ?? 0, 99) : null

  function cycleLang() {
    const cur = i18n.language
    const next = cur === 'ru' ? 'kk' : cur === 'kk' ? 'en' : 'ru'
    void i18n.changeLanguage(next)
  }

  const LANGS: Record<string, string> = { ru: 'RU', kk: 'KZ', en: 'EN' }
  const curLabel = LANGS[i18n.language] ?? 'RU'

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between gap-2 border-b border-[var(--color-ushqn-border)]/80 bg-[var(--color-ushqn-surface)]/85 px-4 backdrop-blur-xl lg:hidden">
      {/* Active page text via hidden navlinks — just show app name */}
      <span className="landing-wordmark-shimmer text-sm font-black tracking-tight">{t('brand.wordmark')}</span>
      <div className="flex items-center gap-1">
        {/* Lang cycle */}
        <button
          type="button"
          onClick={cycleLang}
          className="flex h-8 items-center rounded-full border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] px-2.5 text-[11px] font-bold tracking-wide text-[var(--color-ushqn-muted)] transition hover:text-[var(--color-ushqn-text)]"
        >
          {curLabel}
        </button>
        {/* Notifications */}
        <NavLink
          to="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-ushqn-muted)] transition hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[var(--color-ushqn-text)]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.091 32.091 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.085 32.085 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z" clipRule="evenodd" /></svg>
          {badge ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gradient-to-r from-[#FF5630] to-[#f97316] px-1 text-[9px] font-bold text-white">
              {badge > 9 ? '9+' : badge}
            </span>
          ) : null}
        </NavLink>
        {/* Logout */}
        <button
          type="button"
          onClick={() => { void supabase.auth.signOut().then(() => navigate('/login', { replace: true })) }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-ushqn-muted)] transition hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[var(--color-ushqn-text)]"
          title={t('nav.logout')}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" /><path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114L8.705 10.75H18.25A.75.75 0 0 0 19 10Z" clipRule="evenodd" /></svg>
        </button>
      </div>
    </header>
  )
}

export function AppLayout() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh bg-[var(--color-ushqn-bg)] transition-colors duration-200">
      <ThemeSync />
      <ChatMessageNotifications />
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main area — offset for fixed desktop sidebar */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[220px]">
        <a href="#main-content" className="ushqn-skip-link">{t('ui.skipToContent')}</a>
        <PrivacyBanner />
        <OfflineBanner />
        <NotificationPermissionPrompt />

        {/* Slim top bar (mobile only) */}
        <TopBar />

        <main
          id="main-content"
          className="mx-auto w-full max-w-5xl flex-1 px-3 py-5 outline-none sm:px-5 sm:py-7 lg:px-6 lg:py-8"
          tabIndex={-1}
          style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
