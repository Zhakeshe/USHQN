import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const SPRING = 'transition-all duration-200 ease-[cubic-bezier(.34,1.35,.64,1)]'

/* ── Nav icons ── */
function IHome() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" /></svg>
}
function IJobs() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M6 3.75A2.75 2.75 0 0 1 8.75 1h2.5A2.75 2.75 0 0 1 14 3.75v.443c.572.055 1.14.122 1.706.2C17.053 4.582 18 5.75 18 7.07v3.469c0 1.126-.694 2.191-1.83 2.54-1.952.599-4.024.921-6.17.921s-4.219-.322-6.17-.921C2.694 12.73 2 11.665 2 10.539V7.07c0-1.32.947-2.489 2.294-2.676A41.047 41.047 0 0 1 6 4.193V3.75Zm6.5 0v.325a41.622 41.622 0 0 0-5 0V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25ZM10 10a1 1 0 0 0-1 1v.01a1 1 0 0 0 1 1h.01a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1H10Z" clipRule="evenodd" /><path d="M3 15.055v-.684c.278.071.56.13.844.18A42.097 42.097 0 0 0 10 15c2.113 0 4.27-.312 6.156-.449.284-.05.566-.109.844-.18v.684A1.75 1.75 0 0 1 15.25 16.75h-10.5A1.75 1.75 0 0 1 3 15.055Z" /></svg>
}
function IPeople() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" /></svg>
}
function IChat() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M2 9.5A7.5 7.5 0 0 1 9.5 2h1A7.5 7.5 0 0 1 18 9.5v.5a7.5 7.5 0 0 1-7.5 7.5h-.5a7.469 7.469 0 0 1-3.5-.873l-3.44 1.146a.5.5 0 0 1-.622-.622l1.146-3.44A7.469 7.469 0 0 1 2 10v-.5Z" clipRule="evenodd" /></svg>
}
function ICalendar() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" /></svg>
}
function IProfile() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" /></svg>
}
function IAch() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-7 4a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 10Zm13.25-.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z" clipRule="evenodd" /></svg>
}
function IRating() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.83-4.401Z" clipRule="evenodd" /></svg>
}
function IGroups() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" /></svg>
}
function IShowcase() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h13A1.5 1.5 0 0 1 18 3.5v10A1.5 1.5 0 0 1 16.5 15H3.5A1.5 1.5 0 0 1 2 13.5v-10ZM3.5 3a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5h-13Zm3.75 14.25a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5Z" clipRule="evenodd" /></svg>
}
function ISettings() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 0 1 1.262.125l1.67 1.67a1 1 0 0 1 .124 1.262l-.833 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 0 1 .804.98v2.361a1 1 0 0 1-.804.98l-1.473.295a6.95 6.95 0 0 1-.587 1.416l.833 1.25a1 1 0 0 1-.124 1.262l-1.67 1.67a1 1 0 0 1-1.262.124l-1.25-.833a6.953 6.953 0 0 1-1.416.587l-.294 1.473a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.295-1.473a6.957 6.957 0 0 1-1.416-.587l-1.25.833a1 1 0 0 1-1.262-.124l-1.67-1.67a1 1 0 0 1-.124-1.262l.833-1.25a6.957 6.957 0 0 1-.587-1.416l-1.473-.294A1 1 0 0 1 1 11.18V8.82a1 1 0 0 1 .804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.833-1.25a1 1 0 0 1 .124-1.262l1.67-1.67a1 1 0 0 1 1.262-.125l1.25.834a6.957 6.957 0 0 1 1.416-.587L7.84 1.804ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" /></svg>
}
function IBell() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.091 32.091 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.085 32.085 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.54 33.54 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z" clipRule="evenodd" /></svg>
}
function ILogout() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" /><path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114L8.705 10.75H18.25A.75.75 0 0 0 19 10Z" clipRule="evenodd" /></svg>
}
function IAdmin() {
  return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.563 2 12.162 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.749Z" clipRule="evenodd" /></svg>
}
function IConnections() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 112.828-2.828l3-3z" />
    </svg>
  )
}

/* ── Lang switcher inside sidebar ── */
const LANGS = [
  { code: 'ru', label: 'RU' },
  { code: 'kk', label: 'KZ' },
  { code: 'en', label: 'EN' },
]

export function Sidebar() {
  const { t, i18n } = useTranslation()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  const { data: staff } = useQuery({
    queryKey: ['profile-staff-flags', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('is_admin,is_moderator,role').eq('id', userId!).single()
      return {
        isAdmin: Boolean(data?.is_admin),
        isModerator: Boolean(data?.is_moderator),
        role: (data?.role as string) ?? '',
      }
    },
  })

  const { data: unreadCount } = useQuery({
    queryKey: ['notif-count', userId],
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId!).eq('is_read', false)
      return count ?? 0
    },
  })

  const { data: unreadChat } = useQuery({
    queryKey: ['chat-unread-total', userId],
    enabled: Boolean(userId),
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase.rpc('my_chat_sidebar')
      const rows = (data ?? []) as { unread_count: number }[]
      return rows.reduce((s, r) => s + (r.unread_count ?? 0), 0)
    },
  })

  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel(`sidebar-notif:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['notif-count', userId] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        void qc.invalidateQueries({ queryKey: ['chat-unread-total', userId] })
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [userId, qc])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const showAdmin = Boolean(staff?.isAdmin || staff?.isModerator)
  const showConnectionsLink = ['parent', 'teacher', 'student', 'pupil'].includes(staff?.role ?? '')
  const notifBadge = (unreadCount ?? 0) > 0 ? Math.min(unreadCount ?? 0, 99) : null
  const chatBadge = (unreadChat ?? 0) > 0 ? Math.min(unreadChat ?? 0, 99) : null
  const curLang = LANGS.find((l) => l.code === i18n.language) ?? LANGS[0]

  const primary = [
    { to: '/home', icon: IHome, label: t('nav.home'), end: true },
    { to: '/jobs', icon: IJobs, label: t('nav.jobs') },
    { to: '/people', icon: IPeople, label: t('nav.people') },
    { to: '/chat', icon: IChat, label: t('nav.chat'), badge: chatBadge },
    { to: '/calendar', icon: ICalendar, label: t('nav.calendar') },
  ]
  const secondary = [
    { to: '/profile', icon: IProfile, label: t('nav.profile') },
    { to: '/achievements', icon: IAch, label: t('nav.achievements') },
    { to: '/rating', icon: IRating, label: t('nav.rating') },
    ...(showConnectionsLink ? [{ to: '/connections', icon: IConnections, label: t('nav.connections') }] : []),
    { to: '/communities', icon: IGroups, label: t('nav.communities') },
    { to: '/showcase', icon: IShowcase, label: t('nav.services') },
  ]

  function NavItem({ to, icon: Icon, label, end, badge }: { to: string; icon: () => React.ReactElement; label: string; end?: boolean; badge?: number | null }) {
    return (
      <NavLink
        to={to}
        end={end}
        title={label}
        className={({ isActive }) =>
          `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none ${SPRING} focus-visible:ring-2 focus-visible:ring-[#0052CC] ${
            isActive
              ? 'bg-gradient-to-r from-[#0052CC] to-[#1d4ed8] text-white shadow-md shadow-[#0052CC]/25'
              : 'text-[var(--color-ushqn-text)]/70 hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[var(--color-ushqn-text)]'
          }`
        }
      >
        <span className="relative shrink-0">
          <Icon />
          {badge ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-[#FF5630] px-0.5 text-[8px] font-bold text-white">
              {badge > 9 ? '9+' : badge}
            </span>
          ) : null}
        </span>
        <span className="truncate">{label}</span>
      </NavLink>
    )
  }

  return (
    <aside
      className="hidden lg:flex"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 220,
        zIndex: 40,
        flexDirection: 'column',
        padding: '1rem 0.75rem',
        gap: 0,
        background: 'var(--color-ushqn-surface)',
        borderRight: '1px solid var(--color-ushqn-border)',
        boxShadow: '2px 0 16px rgba(15,23,42,0.06)',
        overflowY: 'auto',
      }}
    >
      {/* Primary nav */}
      <div className="space-y-0.5">
        <p className="mb-1.5 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-ushqn-muted)]">
          {t('nav.primary')}
        </p>
        {primary.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </div>

      {/* Divider */}
      <div className="my-3 h-px bg-[var(--color-ushqn-border)]" />

      {/* Secondary nav */}
      <div className="space-y-0.5">
        <p className="mb-1.5 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-ushqn-muted)]">
          {t('nav.discover')}
        </p>
        {secondary.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </div>

      {/* Divider */}
      <div className="my-3 h-px bg-[var(--color-ushqn-border)]" />

      {/* Utility */}
      <div className="space-y-0.5">
        <NavItem to="/notifications" icon={IBell} label={t('nav.notifications')} badge={notifBadge} />
        <NavItem to="/settings" icon={ISettings} label={t('nav.settings')} />
        {showAdmin ? <NavItem to="/admin" icon={IAdmin} label={t('nav.admin')} /> : null}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Lang + Logout */}
      <div className="mt-3 space-y-1 border-t border-[var(--color-ushqn-border)] pt-3">
        {/* Lang switcher */}
        <div ref={langRef} className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${SPRING} text-[var(--color-ushqn-text)]/70 hover:bg-[var(--color-ushqn-surface-muted)] hover:text-[var(--color-ushqn-text)]`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0"><path fillRule="evenodd" d="M7.172 2a.75.75 0 0 1 .75.75V3.5h4.5V2.75a.75.75 0 0 1 1.5 0V3.5h.75A2.25 2.25 0 0 1 17 5.75v2.028a.75.75 0 0 1-.22.53l-7.25 7.25a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 0-1.06l7.25-7.25A.75.75 0 0 1 11.75 3.5H7.922V2.75A.75.75 0 0 1 7.172 2Zm1.328 2h-2.5l-6.5 6.5L3 14l4.5 4.5 7.5-7.5V6.25a.75.75 0 0 0-.75-.75h-5.75Z" clipRule="evenodd" /></svg>
            <span>{curLang.label === 'RU' ? 'Русский' : curLang.label === 'KZ' ? 'Қазақша' : 'English'}</span>
            <svg viewBox="0 0 12 12" fill="currentColor" className="ml-auto h-2.5 w-2.5 opacity-40"><path d="M6 8L1 3h10L6 8z" /></svg>
          </button>
          {langOpen ? (
            <div className="absolute bottom-full left-0 mb-1 w-full overflow-hidden rounded-xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] py-1 shadow-xl">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => { void i18n.changeLanguage(l.code); setLangOpen(false) }}
                  className={`w-full px-3 py-2 text-left text-sm font-semibold transition hover:bg-[var(--color-ushqn-surface-muted)] ${i18n.language === l.code ? 'text-[#0052CC]' : 'text-[var(--color-ushqn-text)]'}`}
                >
                  {l.label === 'RU' ? 'Русский' : l.label === 'KZ' ? 'Қазақша' : 'English'}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={() => void logout()}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${SPRING} text-[var(--color-ushqn-text)]/60 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400`}
        >
          <ILogout />
          <span>{t('nav.logout')}</span>
        </button>
      </div>
    </aside>
  )
}
