import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { applyDocumentTheme, subscribeSystemTheme } from '../lib/themeApply'

export function ThemeSync() {
  const { userId } = useAuth()

  const { data: settings } = useQuery({
    queryKey: ['user-settings', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('user_settings').select('theme, reduce_motion').eq('user_id', userId!).single()
      if (error) throw error
      return data as { theme: string | null; reduce_motion: boolean | null }
    },
  })

  const theme = settings?.theme ?? 'system'
  const reduceMotion = settings?.reduce_motion ?? false

  useEffect(() => {
    applyDocumentTheme(theme, reduceMotion)
    if (theme !== 'system') return undefined
    return subscribeSystemTheme(() => applyDocumentTheme('system', reduceMotion))
  }, [theme, reduceMotion])

  return null
}
