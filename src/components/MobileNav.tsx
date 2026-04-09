import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
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

function AchievementsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06Zm9.9 0a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.06a.75.75 0 0 1 1.06 0ZM10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-7 4a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 10Zm13.25-.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5ZM5.05 16.95a.75.75 0 0 1 0-1.06l1.06-1.062a.75.75 0 0 1 1.062 1.061l-1.061 1.06a.75.75 0 0 1-1.06 0Zm9.9 0a.75.75 0 0 1-1.06 0l-1.062-1.06a.75.75 0 0 1 1.061-1.062l1.06 1.061a.75.75 0 0 1 0 1.06ZM10 17.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Z"
        clipRule="evenodd"
        className={active ? 'text-white' : 'text-current'}
        style={{ opacity: active ? 1 : 0.55 }}
      />
    </svg>
  )
}

function RatingIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.83-4.401Z"
        clipRule="evenodd"
        className={active ? 'text-white' : 'text-current'}
        style={{ opacity: active ? 1 : 0.55 }}
      />
    </svg>
  )
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
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
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
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

  const navItems = [
    { to: '/home', label: t('nav.home'), icon: HomeIcon },
    { to: '/achievements', label: t('nav.achievements'), icon: AchievementsIcon },
    { to: '/rating', label: t('nav.rating'), icon: RatingIcon },
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
        <div className="flex items-stretch">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/home'}
              className={({ isActive }) =>
                `group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-bold transition-colors duration-200 ${
                  isActive
                    ? 'text-white'
                    : 'text-[var(--color-ushqn-muted)] hover:text-[var(--color-ushqn-text)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      className="absolute inset-x-1 inset-y-1 -z-10 rounded-xl bg-gradient-to-br from-[#0052CC] to-[#2563EB] shadow-lg shadow-[#0052CC]/35 ring-1 ring-white/20"
                      aria-hidden
                    />
                  ) : null}
                  <div className="relative">
                    <item.icon active={isActive} />
                    {item.to === '/chat' && unreadCount && unreadCount > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-gradient-to-r from-[#FF5630] to-[#f97316] px-0.5 text-[8px] font-bold leading-none text-white shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <span className="relative z-10 leading-none tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
