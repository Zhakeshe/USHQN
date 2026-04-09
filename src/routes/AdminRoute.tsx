import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { QueryState } from '../components/QueryState'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { userId } = useAuth()

  const q = useQuery({
    queryKey: ['profile-admin-flag', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('is_admin').eq('id', userId!).single()
      if (error) throw error
      return Boolean(data?.is_admin)
    },
  })

  if (!userId) {
    return <Navigate to="/login" replace />
  }

  return (
    <QueryState
      query={q}
      skeleton={<div className="ushqn-card h-40 animate-pulse" />}
    >
      {q.data ? children : <Navigate to="/home" replace />}
    </QueryState>
  )
}
