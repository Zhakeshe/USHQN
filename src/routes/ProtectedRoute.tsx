import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function ProtectedRoute() {
  const { t } = useTranslation()
  const { session, loading } = useAuth()

  const banQuery = useQuery({
    queryKey: ['profile-ban', session?.user?.id],
    enabled: Boolean(session?.user?.id && isSupabaseConfigured),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_banned')
        .eq('id', session!.user.id)
        .single()
      if (error) throw error
      return Boolean(data?.is_banned)
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

  if (banQuery.isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[#6B778C]">
        {t('protectedRoute.loading')}
      </div>
    )
  }

  if (banQuery.data === true) {
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

  return <Outlet />
}
