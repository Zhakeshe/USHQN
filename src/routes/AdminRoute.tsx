import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { QueryState } from '../components/QueryState'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { userId } = useAuth()

  const q = useQuery({
    queryKey: ['profile-staff-flags', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('is_admin,is_moderator').eq('id', userId!).single()
      if (error) throw error
      return { isAdmin: Boolean(data?.is_admin), isModerator: Boolean(data?.is_moderator) }
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
      {q.data && (q.data.isAdmin || q.data.isModerator) ? children : <Navigate to="/home" replace />}
    </QueryState>
  )
}
