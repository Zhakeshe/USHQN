import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function ProtectedRoute() {
  const { t } = useTranslation()
  const { session, loading } = useAuth()
  const location = useLocation()

  const profileGuardQuery = useQuery({
    queryKey: ['profile-guard', session?.user?.id],
    enabled: Boolean(session?.user?.id && isSupabaseConfigured),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_banned,onboarding_completed_at')
        .eq('id', session!.user.id)
        .single()
      if (error) throw error
      return {
        isBanned: Boolean(data?.is_banned),
        onboardingDone: Boolean(data?.onboarding_completed_at),
      }
    },
  })

  if (!isSupabaseConfigured) {
    return (
      <div className="ushqn-card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-lg font-semibold text-[#172B4D]">{t('protectedRoute.configureTitle')}</h1>
        <p className="mt-2 text-sm text-[#6B778C]">
          {t('protectedRoute.configureDesc')}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[#6B778C]">
        {t('protectedRoute.loading')}
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace />
  }

  if (profileGuardQuery.isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[#6B778C]">
        {t('protectedRoute.loading')}
      </div>
    )
  }

  if (profileGuardQuery.data?.isBanned === true) {
    return (
      <div className="ushqn-card mx-auto mt-10 max-w-md space-y-4 p-8 text-center">
        <h1 className="text-lg font-bold text-[#172B4D]">{t('trust.banned.title')}</h1>
        <p className="text-sm text-[#6B778C]">{t('trust.banned.body')}</p>
        <button
          type="button"
          className="ushqn-btn-primary w-full py-2.5 text-sm"
          onClick={() => void supabase.auth.signOut()}
        >
          {t('trust.banned.signOut')}
        </button>
      </div>
    )
  }

  const atOnboarding = location.pathname === '/onboarding'
  if (!profileGuardQuery.data?.onboardingDone && !atOnboarding) {
    return <Navigate to="/onboarding" replace />
  }
  if (profileGuardQuery.data?.onboardingDone && atOnboarding) {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}
