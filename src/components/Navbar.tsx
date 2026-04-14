import type { ReactNode } from 'react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const LANGS = [
  { code: 'ru', label: 'RU' },
  { code: 'kk', label: 'KZ' },
  { code: 'en', label: 'EN' },
]

const NAV_SPRING = 'motion-safe:transition-[transform,box-shadow,background-color,color,opacity] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.34,1.35,0.64,1)]'

const NAV_MENU_LINK = `ushqn-tap-clear mx-1 my-0.5 block rounded-xl px-3 py-2.5 text-sm font-semibold ${NAV_SPRING} motion-safe:active:scale-[0.97]`

function LangSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGS.find((l) => l.code === i18n.language) ?? LANGS[0]

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`ushqn-tap-clear flex h-9 items-center gap-1 rounded-full border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] px-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-ushqn-muted)] shadow-sm hover:border-[#93c5fd]/80 hover:text-[var(--color-ushqn-primary)] hover:shadow-md ${NAV_SPRING} motion-safe:active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2`}
        aria-label="Change language"
      >
        <span>{current.label}</span>
        <svg viewBox="0 0 12 12" fill="currentColor" className="h-2 w-2.5 opacity-50">
          <path d="M6 8L1 3h10L6 8z" />
        </svg>
      </button>
      {open ? (
        <div className="ushqn-nav-dropdown absolute right-0 top-full z-[60] mt-2 min-w-[10rem] overflow-hidden rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] py-1 shadow-xl shadow-slate-900/10 ring-1 ring-black/5">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                void i18n.changeLanguage(lang.code)
                setOpen(false)
              }}
              className={`ushqn-tap-clear mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${NAV_SPRING} motion-safe:active:scale-[0.98] ${
                i18n.language === lang.code
                  ? 'bg-[#EFF6FF] text-[#0052CC] shadow-sm shadow-[#0052CC]/8 dark:bg-blue-950/50 dark:text-[var(--color-ushqn-primary)]'
                  : 'text-[var(--color-ushqn-text)] hover:bg-[var(--color-ushqn-surface-muted)]'
              }`}
            >
              <span>
                {lang.label === 'RU' ? 'Русский' : lang.label === 'KZ' ? 'Қазақша' : 'English'}
              </span>
              {i18n.language === lang.code ? (
                <svg viewBox="0 0 16 16" fill="currentColor" className="ml-auto h-3.5 w-3.5">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function NavPill({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `ushqn-tap-clear relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold ${NAV_SPRING} motion-safe:active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 ${
          isActive
            ? 'bg-gradient-to-r from-[#0052CC] via-[#1d4ed8] to-[#2563EB] text-white shadow-lg shadow-[#0052CC]/32 ring-1 ring-white/30 motion-safe:hover:shadow-xl motion-safe:hover:shadow-[#0052CC]/40 motion-safe:hover:scale-[1.02]'
            : 'text-[var(--color-ushqn-text)]/75 hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[var(--color-ushqn-text)] motion-safe:hover:scale-[1.04] motion-safe:hover:shadow-sm'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span
              className="pointer-events-none absolute inset-x-2 top-1 z-10 h-px rounded-full bg-gradient-to-r from-transparent via-white/45 to-transparent"
              aria-hidden
            />
          ) : null}
          <span className="relative z-10">{children}</span>
        </>
      )}
    </NavLink>
  )
}

function MenuTriggerIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M4.5 4.5h4v4h-4v-4Zm7 0h4v4h-4v-4Zm-7 7h4v4h-4v-4Zm7 0h4v4h-4v-4Z" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.091 32.091 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.085 32.085 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

type MoreItem = { to: string; label: string }

export function Navbar() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const { data: staff } = useQuery({
    queryKey: ['profile-staff-flags', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('is_admin,is_moderator').eq('id', userId!).single()
      if (error) throw error
      return { isAdmin: Boolean(data?.is_admin), isModerator: Boolean(data?.is_moderator) }
    },
  })
  const showStaffNav = Boolean(staff?.isAdmin || staff?.isModerator)

  const { data: unreadCount } = useQuery({
    queryKey: ['notif-count', userId],
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .eq('is_read', false)
      if (error) return 0
      return count ?? 0
    },
  })

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notif-live:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ['notif-count', userId] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, qc])

  const moreItems: MoreItem[] = useMemo(() => {
    const base: MoreItem[] = [
      { to: '/achievements', label: t('nav.achievements') },
      { to: '/rating', label: t('nav.rating') },
      { to: '/people', label: t('nav.people') },
      { to: '/communities', label: t('nav.communities') },
      { to: '/settings', label: t('nav.settings') },
    ]
    if (showStaffNav) base.push({ to: '/admin', label: t('nav.admin') })
    return base
  }, [t, showStaffNav])

  const morePrefixes = useMemo(() => moreItems.map((x) => x.to), [moreItems])
  const isMoreActive = morePrefixes.some((p) => pathname === p || (p !== '/' && pathname.startsWith(p + '/')))

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const badgeCount = unreadCount && unreadCount > 0 ? Math.min(unreadCount, 99) : null

  return (
    <header className="ushqn-navbar sticky top-0 z-40 border-b border-[var(--color-ushqn-border)]/80 bg-[var(--color-ushqn-surface)]/80 shadow-[0_4px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl backdrop-saturate-150 transition-colors duration-300">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-[3.75rem] sm:px-5">
        <Link
          to="/home"
          className="ushqn-tap-clear group flex shrink-0 items-center gap-2 rounded-xl py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
        >
          <span className="hidden flex-col leading-none sm:flex">
            <span className={`landing-wordmark-shimmer text-lg font-black tracking-tight sm:text-xl ${NAV_SPRING} motion-safe:group-hover:opacity-95`}>
              {t('brand.wordmark')}
            </span>
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-ushqn-muted)]">
              {t('brand.navTagline')}
            </span>
          </span>
          <span className="landing-wordmark-shimmer text-base font-black tracking-tight sm:hidden">{t('brand.wordmark')}</span>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
          aria-label={t('nav.home')}
        >
          <div
            className={`flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-[var(--color-ushqn-border)]/60 bg-[var(--color-ushqn-surface-muted)]/80 p-1 shadow-inner ring-1 ring-black/[0.04] dark:ring-white/[0.06] ${NAV_SPRING} motion-safe:hover:shadow-md motion-safe:hover:ring-black/[0.06]`}
          >
            <NavPill to="/home" end>
              {t('nav.home')}
            </NavPill>
            <NavPill to="/profile">{t('nav.profile')}</NavPill>
            <NavPill to="/jobs">{t('nav.jobs')}</NavPill>
            <NavPill to="/chat">{t('nav.chat')}</NavPill>
            <NavPill to="/calendar">{t('nav.calendar')}</NavPill>
            <NavPill to="/showcase">{t('nav.services')}</NavPill>
          </div>
        </nav>

        <div className="flex flex-1 justify-end lg:flex-initial" ref={moreRef}>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative lg:hidden">
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="true"
                onClick={() => setMoreOpen((v) => !v)}
                className={`group ushqn-tap-clear flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-bold shadow-sm ${NAV_SPRING} motion-safe:active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 ${
                  moreOpen || isMoreActive
                    ? 'border-[#0052CC]/40 bg-[#EFF6FF] text-[#0052CC] shadow-md shadow-[#0052CC]/12'
                    : 'border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] text-[var(--color-ushqn-text)] hover:border-[#93c5fd]/70 hover:shadow-md motion-safe:hover:scale-[1.02]'
                }`}
              >
                <MenuTriggerIcon className={`h-4 w-4 ${NAV_SPRING} motion-safe:group-active:scale-90`} />
                <span>{t('nav.menu')}</span>
              </button>
              {moreOpen ? (
                <div className="ushqn-nav-dropdown absolute right-0 top-full z-[60] mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] shadow-2xl shadow-slate-900/15 ring-1 ring-black/5">
                  <div className="h-1 bg-gradient-to-r from-[#0052CC] via-[#4f46e5] to-[#60a5fa]" aria-hidden />
                  <div className="border-b border-[var(--color-ushqn-border)] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--color-ushqn-muted)]">
                    {t('nav.primary')}
                  </div>
                  {(
                    [
                      { to: '/home', label: t('nav.home'), end: true as const },
                      { to: '/profile', label: t('nav.profile') },
                      { to: '/jobs', label: t('nav.jobs') },
                      { to: '/chat', label: t('nav.chat') },
                      { to: '/calendar', label: t('nav.calendar') },
                      { to: '/showcase', label: t('nav.services') },
                    ] as const
                  ).map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={'end' in item ? item.end : false}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        `${NAV_MENU_LINK} ${
                          isActive
                            ? 'bg-[#EFF6FF] text-[#0052CC] shadow-sm shadow-[#0052CC]/10 dark:bg-blue-950/45 dark:text-[var(--color-ushqn-primary)]'
                            : 'text-[var(--color-ushqn-text)] hover:bg-[var(--color-ushqn-surface-muted)]'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                  <div className="mt-1 border-t border-[var(--color-ushqn-border)] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--color-ushqn-muted)]">
                    {t('nav.discover')}
                  </div>
                  {moreItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        `${NAV_MENU_LINK} ${
                          isActive
                            ? 'bg-[#EFF6FF] text-[#0052CC] shadow-sm shadow-[#0052CC]/10 dark:bg-blue-950/45 dark:text-[var(--color-ushqn-primary)]'
                            : 'text-[var(--color-ushqn-text)] hover:bg-[var(--color-ushqn-surface-muted)]'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                  <NavLink
                    to="/notifications"
                    onClick={() => setMoreOpen(false)}
                    className={`ushqn-tap-clear mx-1 mb-1 mt-1 flex items-center gap-2 rounded-xl border-t border-[var(--color-ushqn-border)] px-3 py-2.5 text-sm font-semibold text-[var(--color-ushqn-text)] hover:bg-[var(--color-ushqn-surface-muted)] ${NAV_SPRING} motion-safe:active:scale-[0.98]`}
                  >
                    {t('nav.notifications')}
                    {badgeCount ? (
                      <span className="ml-auto rounded-full bg-[#FF5630] px-2 py-0.5 text-[10px] font-bold text-white">
                        {badgeCount}
                      </span>
                    ) : null}
                  </NavLink>
                </div>
              ) : null}
            </div>

            <div className="relative hidden lg:block">
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="true"
                onClick={() => setMoreOpen((v) => !v)}
                className={`group ushqn-tap-clear flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold shadow-sm ${NAV_SPRING} motion-safe:active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 ${
                  moreOpen || isMoreActive
                    ? 'border-[#0052CC]/45 bg-[#EFF6FF] text-[#0052CC] shadow-md shadow-[#0052CC]/12'
                    : 'border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] text-[var(--color-ushqn-text)]/85 hover:border-[#93c5fd]/80 hover:bg-[var(--color-ushqn-surface-muted)] hover:shadow-md motion-safe:hover:scale-[1.02]'
                }`}
              >
                <MenuTriggerIcon className={`h-4 w-4 opacity-90 ${NAV_SPRING} motion-safe:group-active:scale-90`} />
                {t('nav.menu')}
              </button>
              {moreOpen ? (
                <div className="ushqn-nav-dropdown absolute right-0 top-full z-[60] mt-2 min-w-[13rem] overflow-hidden rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] py-0.5 shadow-2xl shadow-slate-900/12 ring-1 ring-black/5">
                  <div className="h-1 bg-gradient-to-r from-[#0052CC] via-[#4f46e5] to-[#60a5fa]" aria-hidden />
                  {moreItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        `${NAV_MENU_LINK} ${
                          isActive
                            ? 'bg-[#EFF6FF] text-[#0052CC] shadow-sm shadow-[#0052CC]/10 dark:bg-blue-950/45 dark:text-[var(--color-ushqn-primary)]'
                            : 'text-[var(--color-ushqn-text)] hover:bg-[var(--color-ushqn-surface-muted)]'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>

            <LangSwitcher />

            <Link
              to="/notifications"
              className={`ushqn-tap-clear relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-ushqn-muted)] hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[var(--color-ushqn-text)] hover:shadow-md ${NAV_SPRING} motion-safe:active:scale-[0.88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2`}
              title={t('nav.notifications')}
            >
              <BellIcon />
              {badgeCount ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gradient-to-r from-[#FF5630] to-[#f97316] px-1 text-[9px] font-bold leading-none text-white shadow-sm">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              onClick={() => void logout()}
              className={`ushqn-tap-clear hidden items-center justify-center rounded-full border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-ushqn-text)]/80 shadow-sm hover:border-[#93c5fd]/80 hover:text-[var(--color-ushqn-text)] hover:shadow-md sm:inline-flex ${NAV_SPRING} motion-safe:active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2`}
            >
              {t('nav.logout')}
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className={`ushqn-tap-clear inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-ushqn-border)] text-[var(--color-ushqn-muted)] hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[var(--color-ushqn-text)] hover:shadow sm:hidden ${NAV_SPRING} motion-safe:active:scale-[0.88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2`}
              title={t('nav.logout')}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
                  clipRule="evenodd"
                />
                <path
                  fillRule="evenodd"
                  d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114L8.705 10.75H18.25A.75.75 0 0 0 19 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
