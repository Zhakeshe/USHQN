import type { ReactNode } from 'react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const LANGS = [
  { code: 'ru', label: 'RU' },
  { code: 'kk', label: 'KZ' },
  { code: 'en', label: 'EN' },
]

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
        className="flex h-9 items-center gap-1 rounded-full border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] px-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-ushqn-muted)] shadow-sm transition hover:border-[#93c5fd]/80 hover:text-[var(--color-ushqn-primary)]"
        aria-label="Change language"
      >
        <span>{current.label}</span>
        <svg viewBox="0 0 12 12" fill="currentColor" className="h-2 w-2.5 opacity-50">
          <path d="M6 8L1 3h10L6 8z" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-[60] mt-2 min-w-[10rem] overflow-hidden rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] py-1 shadow-xl shadow-slate-900/10 ring-1 ring-black/5">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                void i18n.changeLanguage(lang.code)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                i18n.language === lang.code
                  ? 'bg-[#EFF6FF] text-[#0052CC] dark:bg-blue-950/50 dark:text-[var(--color-ushqn-primary)]'
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
        `whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-[#0052CC] to-[#2563EB] text-white shadow-lg shadow-[#0052CC]/28 ring-1 ring-white/25'
            : 'text-[var(--color-ushqn-text)]/75 hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[var(--color-ushqn-text)]'
        }`
      }
    >
      {children}
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
          className="group flex shrink-0 items-center gap-2.5 rounded-xl py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0052CC] via-[#1d4ed8] to-[#60a5fa] text-sm font-black tracking-tight text-white shadow-lg shadow-[#0052CC]/30 ring-2 ring-white/40 transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-[0.98]">
            U
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="text-base font-extrabold tracking-tight text-[var(--color-ushqn-text)]">USHQN</span>
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-ushqn-muted)]">
              Grow
            </span>
          </span>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
          aria-label={t('nav.home')}
        >
          <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-[var(--color-ushqn-border)]/60 bg-[var(--color-ushqn-surface-muted)]/80 p-1 shadow-inner">
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
                className={`flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-bold transition ${
                  moreOpen || isMoreActive
                    ? 'border-[#0052CC]/40 bg-[#EFF6FF] text-[#0052CC]'
                    : 'border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] text-[var(--color-ushqn-text)] hover:border-[#93c5fd]/70'
                }`}
              >
                <MenuTriggerIcon className="h-4 w-4" />
                <span>{t('nav.menu')}</span>
              </button>
              {moreOpen ? (
                <div className="absolute right-0 top-full z-[60] mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] shadow-2xl shadow-slate-900/15 ring-1 ring-black/5">
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
                        `block px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                          isActive
                            ? 'bg-[#EFF6FF] text-[#0052CC]'
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
                        `block px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                          isActive
                            ? 'bg-[#EFF6FF] text-[#0052CC]'
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
                    className="flex items-center gap-2 border-t border-[var(--color-ushqn-border)] px-3.5 py-2.5 text-sm font-semibold text-[var(--color-ushqn-text)] hover:bg-[var(--color-ushqn-surface-muted)]"
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
                className={`flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ${
                  moreOpen || isMoreActive
                    ? 'border-[#0052CC]/45 bg-[#EFF6FF] text-[#0052CC] shadow-sm'
                    : 'border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] text-[var(--color-ushqn-text)]/85 hover:border-[#93c5fd]/80 hover:bg-[var(--color-ushqn-surface-muted)]'
                }`}
              >
                <MenuTriggerIcon className="h-4 w-4 opacity-90" />
                {t('nav.menu')}
              </button>
              {moreOpen ? (
                <div className="absolute right-0 top-full z-[60] mt-2 min-w-[13rem] overflow-hidden rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] shadow-2xl shadow-slate-900/12 ring-1 ring-black/5">
                  <div className="h-1 bg-gradient-to-r from-[#0052CC] via-[#4f46e5] to-[#60a5fa]" aria-hidden />
                  {moreItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        `block px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                          isActive
                            ? 'bg-[#EFF6FF] text-[#0052CC]'
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
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-ushqn-muted)] transition hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[var(--color-ushqn-text)]"
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
              className="hidden items-center justify-center rounded-full border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-ushqn-text)]/80 shadow-sm transition hover:border-[#93c5fd]/80 hover:text-[var(--color-ushqn-text)] sm:inline-flex"
            >
              {t('nav.logout')}
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-ushqn-border)] text-[var(--color-ushqn-muted)] transition hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[var(--color-ushqn-text)] sm:hidden"
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
