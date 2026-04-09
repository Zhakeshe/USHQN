import type { ReactNode } from 'react'
import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { IconBriefcase, IconTrophy, IconUser } from './NavIcons'
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
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#DFE1E6] bg-white px-2.5 text-xs font-bold text-[#6B778C] shadow-sm transition hover:border-[#C7CDD6] hover:text-[#172B4D]"
        aria-label="Change language"
      >
        <span>{current.label}</span>
        <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5 opacity-50">
          <path d="M6 8L1 3h10L6 8z" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[7rem] overflow-hidden rounded-xl border border-[#E4E9EF] bg-white shadow-lg">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                void i18n.changeLanguage(lang.code)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                i18n.language === lang.code
                  ? 'bg-[#EFF6FF] text-[#0052CC]'
                  : 'text-[#172B4D] hover:bg-[#F4F5F7]'
              }`}
            >
              <span>{lang.label === 'RU' ? 'Русский' : lang.label === 'KZ' ? 'Қазақша' : 'English'}</span>
              {i18n.language === lang.code ? (
                <svg viewBox="0 0 16 16" fill="currentColor" className="ml-auto h-3.5 w-3.5 text-[#0052CC]">
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

function TabLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-[2.75rem] min-w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:min-w-[4.5rem] sm:px-3 ${
          isActive
            ? 'bg-[#EFF6FF] text-[#0052CC] shadow-[inset_0_0_0_1px_rgba(0,82,204,0.12)]'
            : 'text-[#6B778C] hover:bg-[#F4F5F7] hover:text-[#172B4D]'
        }`
      }
    >
      <span className="[&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <span className="mt-0.5 hidden max-w-[5rem] truncate sm:inline">{label}</span>
      <span className="mt-0.5 text-[10px] sm:hidden">{label.slice(0, 4)}</span>
    </NavLink>
  )
}

function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `shrink-0 rounded-md px-1.5 py-1 text-sm font-semibold whitespace-nowrap transition-colors ${
          isActive
            ? 'text-[#0052CC]'
            : 'text-[#6B778C] hover:bg-[#F4F5F7] hover:text-[#172B4D]'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.091 32.091 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.085 32.085 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z" clipRule="evenodd"/>
    </svg>
  )
}

export function Navbar() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const { data: isAdmin } = useQuery({
    queryKey: ['profile-admin-flag', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('is_admin').eq('id', userId!).single()
      if (error) throw error
      return Boolean(data?.is_admin)
    },
  })

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

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const badgeCount = unreadCount && unreadCount > 0 ? Math.min(unreadCount, 99) : null

  return (
    <header className="ushqn-navbar sticky top-0 z-40 border-b border-[#E4E9EF] bg-white/80 shadow-[0_1px_0_rgba(23,43,77,0.06)] backdrop-blur-md backdrop-saturate-150 transition-colors duration-200">
      <div className="mx-auto max-w-6xl px-4 sm:px-5">
        <div className="flex h-[3.25rem] items-center justify-between gap-3 sm:h-[3.5rem]">
          <Link
            to="/home"
            className="shrink-0 text-lg font-extrabold tracking-tight text-[#0052CC] sm:text-xl"
          >
            USHQN
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-2">
            <nav
              className="flex items-center gap-0.5 rounded-xl bg-[#F3F2EF]/90 p-1 sm:gap-1"
              aria-label={t('nav.profile')}
            >
              <TabLink to="/profile" icon={<IconUser />} label={t('nav.profile')} />
              <TabLink to="/rating" icon={<IconTrophy />} label={t('nav.rating')} />
              <TabLink to="/showcase" icon={<IconBriefcase />} label={t('nav.services')} />
            </nav>
            <div className="hidden h-7 w-px shrink-0 bg-[#DFE1E6] lg:block" />
            <div className="hidden items-center gap-1 lg:flex">
              <TextLink to="/achievements">{t('nav.achievements')}</TextLink>
              <TextLink to="/jobs">{t('nav.jobs')}</TextLink>
              <TextLink to="/people">{t('nav.people')}</TextLink>
              <TextLink to="/chat">{t('nav.chat')}</TextLink>
              <TextLink to="/calendar">{t('nav.calendar')}</TextLink>
              {isAdmin ? <TextLink to="/admin">{t('nav.admin')}</TextLink> : null}
            </div>
          </div>

          {/* Right side: lang + bell + logout */}
          <div className="flex shrink-0 items-center gap-1.5">
            <LangSwitcher />

            {/* Notification bell */}
            <Link
              to="/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#6B778C] transition hover:bg-[#F4F5F7] hover:text-[#172B4D]"
              title={t('nav.notifications')}
            >
              <BellIcon />
              {badgeCount ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#FF5630] px-1 text-[9px] font-bold leading-none text-white">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border border-[#DFE1E6] bg-white px-3 py-1.5 text-sm font-semibold text-[#6B778C] shadow-sm transition hover:border-[#C7CDD6] hover:bg-[#FAFBFC] hover:text-[#172B4D]"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>

        <div
          className="flex gap-2 overflow-x-auto border-t border-[#F0F2F5] py-2.5 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={t('nav.achievements')}
        >
          <TextLink to="/achievements">{t('nav.achievements')}</TextLink>
          <TextLink to="/jobs">{t('nav.jobs')}</TextLink>
          <TextLink to="/people">{t('nav.people')}</TextLink>
          <TextLink to="/chat">{t('nav.chat')}</TextLink>
          <TextLink to="/calendar">{t('nav.calendar')}</TextLink>
          <TextLink to="/notifications">{t('nav.notifications')}</TextLink>
          <TextLink to="/settings">{t('nav.settings')}</TextLink>
          {isAdmin ? <TextLink to="/admin">{t('nav.admin')}</TextLink> : null}
        </div>
      </div>
    </header>
  )
}
