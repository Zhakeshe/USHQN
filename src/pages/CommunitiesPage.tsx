import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { QueryState } from '../components/QueryState'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

export function CommunitiesPage() {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()

  const listQuery = useQuery({
    queryKey: ['communities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('communities').select('*').order('title')
      if (error) throw error
      return data ?? []
    },
  })

  const myMemberships = useQuery({
    queryKey: ['my-community-members', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('community_members').select('community_id').eq('user_id', userId!)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.community_id))
    },
  })

  const join = useMutation({
    mutationFn: async (communityId: string) => {
      const { error } = await supabase.from('community_members').insert({ community_id: communityId, user_id: userId! })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-community-members', userId] })
      toast(t('communities.joined'), 'info')
    },
    onError: () => toast(t('common.error'), 'error'),
  })

  const leave = useMutation({
    mutationFn: async (communityId: string) => {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-community-members', userId] })
      toast(t('communities.left'), 'info')
    },
    onError: () => toast(t('common.error'), 'error'),
  })

  return (
    <div className="space-y-5">
      <div className="ushqn-card overflow-hidden p-0">
        <div className="bg-gradient-to-r from-[#00875A] to-[#36B37E] px-6 py-7 text-white">
          <h1 className="text-2xl font-extrabold">{t('communities.title')}</h1>
          <p className="mt-1 text-sm text-white/90">{t('communities.subtitle')}</p>
        </div>
      </div>

      <QueryState query={listQuery} skeleton={<div className="ushqn-card h-40 animate-pulse" />}>
        <ul className="space-y-3">
          {(listQuery.data ?? []).map((c) => {
            const isIn = myMemberships.data?.has(c.id)
            return (
              <li key={c.id} className="ushqn-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold text-[#172B4D]">{c.title}</p>
                  <p className="text-xs text-[#6B778C]">{c.region_label}</p>
                </div>
                {userId ? (
                  isIn ? (
                    <button
                      type="button"
                      disabled={leave.isPending}
                      onClick={() => leave.mutate(c.id)}
                      className="rounded-lg border border-[#DFE1E6] px-4 py-2 text-xs font-semibold text-[#6B778C] hover:bg-[#F4F5F7]"
                    >
                      {t('communities.leave')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={join.isPending}
                      onClick={() => join.mutate(c.id)}
                      className="ushqn-btn-primary px-4 py-2 text-xs"
                    >
                      {t('communities.join')}
                    </button>
                  )
                ) : null}
              </li>
            )
          })}
        </ul>
      </QueryState>
    </div>
  )
}
