import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

export function ProtectedRoute() {
  const { t } = useTranslation()
  const { session, loading } = useAuth()

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

  return <Outlet />
}
