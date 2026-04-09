import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" style={{ opacity: active ? 1 : 0.55 }}>
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
    </svg>
  )
}

function AchievementsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" style={{ opacity: active ? 1 : 0.55 }}>
      <path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06Zm9.9 0a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.06a.75.75 0 0 1 1.06 0ZM10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-7 4a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 10Zm13.25-.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5ZM5.05 16.95a.75.75 0 0 1 0-1.06l1.06-1.062a.75.75 0 0 1 1.062 1.061l-1.061 1.06a.75.75 0 0 1-1.06 0Zm9.9 0a.75.75 0 0 1-1.06 0l-1.062-1.06a.75.75 0 0 1 1.061-1.062l1.06 1.061a.75.75 0 0 1 0 1.06ZM10 17.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
    </svg>
  )
}

function RatingIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" style={{ opacity: active ? 1 : 0.55 }}>
      <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.83-4.401Z" clipRule="evenodd" />
    </svg>
  )
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" style={{ opacity: active ? 1 : 0.55 }}>
      <path fillRule="evenodd" d="M2 9.5A7.5 7.5 0 0 1 9.5 2h1A7.5 7.5 0 0 1 18 9.5v.5a7.5 7.5 0 0 1-7.5 7.5h-.5a7.469 7.469 0 0 1-3.5-.873l-3.44 1.146a.5.5 0 0 1-.622-.622l1.146-3.44A7.469 7.469 0 0 1 2 10v-.5Zm7.5-5.5a5.5 5.5 0 0 0-5.455 6.163.5.5 0 0 1-.04.29l-.832 2.496 2.497-.832a.5.5 0 0 1 .29-.04A5.5 5.5 0 1 0 9.5 4Z" clipRule="evenodd" />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" style={{ opacity: active ? 1 : 0.55 }}>
      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
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
      className="ushqn-mobilenav fixed bottom-0 left-0 right-0 z-50 border-t border-[#E4E9EF] bg-white/95 backdrop-blur-md transition-colors duration-200 sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/home'}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-[#0052CC]' : 'text-[#6B778C]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon active={isActive} />
                  {item.to === '/chat' && unreadCount && unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FF5630] text-[8px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </div>
                <span className="leading-none">{item.label}</span>
                {isActive ? (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-t-full bg-[#0052CC]" />
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
