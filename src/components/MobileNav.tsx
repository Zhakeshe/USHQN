import { NavLink } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const MN_SPRING =
  'motion-safe:transition-[transform,background-color,box-shadow,color,opacity] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.34,1.35,0.64,1)]'

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 ${MN_SPRING} motion-safe:group-active:scale-90`}>
      <path
        fillRule="evenodd"
        d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z"
        clipRule="evenodd"
        className={active ? 'text-white' : 'text-current'}
        style={{ opacity: active ? 1 : 0.55 }}
      />
    </svg>
  )
}

function JobsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 ${MN_SPRING} motion-safe:group-active:scale-90`}>
      <path
        fillRule="evenodd"
        d="M6 3.75A2.75 2.75 0 0 1 8.75 1h2.5A2.75 2.75 0 0 1 14 3.75v.443c.572.055 1.14.122 1.706.2C17.053 4.582 18 5.75 18 7.07v3.469c0 1.126-.694 2.191-1.83 2.54-1.952.599-4.024.921-6.17.921s-4.219-.322-6.17-.921C2.694 12.73 2 11.665 2 10.539V7.07c0-1.32.947-2.489 2.294-2.676A41.047 41.047 0 0 1 6 4.193V3.75Zm6.5 0v.325a41.622 41.622 0 0 0-5 0V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25ZM10 10a1 1 0 0 0-1 1v.01a1 1 0 0 0 1 1h.01a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1H10Z"
        clipRule="evenodd"
        className={active ? 'text-white' : 'text-current'}
        style={{ opacity: active ? 1 : 0.55 }}
      />
      <path
        d="M3 15.055v-.684c.278.071.56.13.844.18A42.097 42.097 0 0 0 10 15c2.113 0 4.27-.312 6.156-.449.284-.05.566-.109.844-.18v.684A1.75 1.75 0 0 1 15.25 16.75h-10.5A1.75 1.75 0 0 1 3 15.055Z"
        className={active ? 'text-white' : 'text-current'}
        style={{ opacity: active ? 1 : 0.55 }}
      />
    </svg>
  )
}

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 ${MN_SPRING} motion-safe:group-active:scale-90`}>
      <path
        d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z"
        className={active ? 'text-white' : 'text-current'}
        style={{ opacity: active ? 1 : 0.55 }}
      />
    </svg>
  )
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 ${MN_SPRING} motion-safe:group-active:scale-90`}>
      <path
        fillRule="evenodd"
        d="M2 9.5A7.5 7.5 0 0 1 9.5 2h1A7.5 7.5 0 0 1 18 9.5v.5a7.5 7.5 0 0 1-7.5 7.5h-.5a7.469 7.469 0 0 1-3.5-.873l-3.44 1.146a.5.5 0 0 1-.622-.622l1.146-3.44A7.469 7.469 0 0 1 2 10v-.5Zm7.5-5.5a5.5 5.5 0 0 0-5.455 6.163.5.5 0 0 1-.04.29l-.832 2.496 2.497-.832a.5.5 0 0 1 .29-.04A5.5 5.5 0 1 0 9.5 4Z"
        clipRule="evenodd"
        className={active ? 'text-white' : 'text-current'}
        style={{ opacity: active ? 1 : 0.55 }}
      />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 ${MN_SPRING} motion-safe:group-active:scale-90`}>
      <path
        d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z"
        className={active ? 'text-white' : 'text-current'}
        style={{ opacity: active ? 1 : 0.55 }}
      />
    </svg>
  )
}

export function MobileNav() {
  const { userId } = useAuth()
  const { t } = useTranslation()
  const qc = useQueryClient()

  const { data: unreadCount } = useQuery({
    queryKey: ['notif-count', userId],
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .eq('is_read', false)
      return count ?? 0
    },
  })

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notif-live-mobile:${userId}`)
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

  const navItems = [
    { to: '/home', label: t('nav.home'), icon: HomeIcon },
    { to: '/jobs', label: t('nav.jobs'), icon: JobsIcon },
    { to: '/people', label: t('nav.people'), icon: PeopleIcon },
    { to: '/chat', label: t('nav.chat'), icon: ChatIcon },
    { to: '/profile', label: t('nav.profile'), icon: ProfileIcon },
  ]

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 sm:hidden"
      aria-label={t('nav.menu')}
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="ushqn-mobilenav pointer-events-auto mx-3 mb-1 rounded-2xl border border-[var(--color-ushqn-border)]/90 bg-[var(--color-ushqn-surface)]/92 px-1 py-1 shadow-[0_12px_40px_rgba(15,23,42,0.12),0_0_0_1px_rgba(255,255,255,0.06)_inset] backdrop-blur-xl backdrop-saturate-150 dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
        <div className="flex items-stretch gap-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/home'}
              className={({ isActive }) =>
                `group ushqn-tap-clear relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-[10px] font-bold outline-none select-none ${MN_SPRING} motion-safe:active:scale-[0.88] focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 ${
                  isActive
                    ? 'text-white'
                    : 'text-[var(--color-ushqn-muted)] hover:text-[var(--color-ushqn-text)] active:bg-[var(--color-ushqn-surface-muted)]/80'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      className="ushqn-mobilenav-pill-in absolute inset-x-0.5 inset-y-0.5 -z-10 overflow-hidden rounded-xl bg-gradient-to-br from-[#0052CC] via-[#1d4ed8] to-[#2563EB] shadow-[0_6px_20px_rgba(0,82,204,0.38),0_1px_0_rgba(255,255,255,0.22)_inset] ring-1 ring-white/25"
                      aria-hidden
                    >
                      <span className="pointer-events-none absolute inset-x-3 top-1 h-[2px] rounded-full bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                    </span>
                  ) : null}
                  <div className="relative">
                    <item.icon active={isActive} />
                    {item.to === '/chat' && unreadCount && unreadCount > 0 ? (
                      <span
                        className={`absolute -right-1 -top-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-gradient-to-r from-[#FF5630] to-[#f97316] px-0.5 text-[8px] font-bold leading-none text-white shadow-md ${MN_SPRING} motion-safe:group-active:scale-110`}
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <span className="relative z-10 max-w-full truncate px-0.5 leading-none tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
