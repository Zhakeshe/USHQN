import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AppPageMeta } from '../components/AppPageMeta'
import { QueryState } from '../components/QueryState'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { formatSupabaseError } from '../lib/supabaseErrors'

export function CommunitiesPage() {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const navigate = useNavigate()
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

  const membersCountQuery = useQuery({
    queryKey: ['community-members-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('community_members').select('community_id')
      if (error) throw error
      const counts = new Map<string, number>()
      for (const row of data ?? []) {
        counts.set(row.community_id, (counts.get(row.community_id) ?? 0) + 1)
      }
      return counts
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel('community-members-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_members' }, () => {
        void qc.invalidateQueries({ queryKey: ['community-members-counts'] })
        if (userId) void qc.invalidateQueries({ queryKey: ['my-community-members', userId] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc, userId])

  const join = useMutation({
    mutationFn: async (communityId: string) => {
      const { error } = await supabase.from('community_members').insert({ community_id: communityId, user_id: userId! })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-community-members', userId] })
      toast(t('communities.joined'), 'info')
    },
    onError: (err) => toast(formatSupabaseError(err, t), 'error'),
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
    onError: (err) => toast(formatSupabaseError(err, t), 'error'),
  })

  const openCommunityChat = useMutation({
    mutationFn: async (communityId: string) => {
      const { data, error } = await supabase.rpc('get_or_create_community_chat', { p_community_id: communityId })
      if (error) throw error
      return data as string
    },
    onSuccess: (conversationId) => {
      void navigate(`/chat/${conversationId}`)
    },
    onError: (err) => toast(formatSupabaseError(err, t), 'error'),
  })

  const busyCommunityId = useMemo(() => join.variables ?? leave.variables ?? openCommunityChat.variables ?? null, [
    join.variables,
    leave.variables,
    openCommunityChat.variables,
  ])

  return (
    <div className="space-y-5">
      <AppPageMeta title={t('nav.communities')} />
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
            const membersCount = membersCountQuery.data?.get(c.id) ?? 0
            const isBusy = busyCommunityId === c.id
            return (
              <li key={c.id} className="ushqn-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold text-[#172B4D]">{c.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-[#6B778C]">{c.region_label}</p>
                    <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#0052CC]">
                      {t('communities.membersCount', { count: membersCount })}
                    </span>
                  </div>
                </div>
                {userId ? (
                  isIn ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={openCommunityChat.isPending && isBusy}
                        onClick={() => openCommunityChat.mutate(c.id)}
                        className="ushqn-btn-primary px-4 py-2 text-xs"
                      >
                        {t('communities.openChat')}
                      </button>
                      <button
                        type="button"
                        disabled={leave.isPending && isBusy}
                        onClick={() => leave.mutate(c.id)}
                        className="rounded-lg border border-[#DFE1E6] px-4 py-2 text-xs font-semibold text-[#6B778C] hover:bg-[#F4F5F7]"
                      >
                        {t('communities.leave')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={join.isPending && isBusy}
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
