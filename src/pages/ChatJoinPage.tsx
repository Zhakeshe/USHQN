import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { formatSupabaseError } from '../lib/supabaseErrors'
import { AppPageMeta } from '../components/AppPageMeta'

export function ChatJoinPage() {
  const { channelSlug } = useParams<{ channelSlug: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()

  const join = useMutation({
    mutationFn: async () => {
      const slug = (channelSlug ?? '').trim()
      if (!slug) throw new Error('empty')
      const { data, error } = await supabase.rpc('join_public_channel', { p_slug: slug })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      void navigate(`/chat/${id}`, { replace: true })
    },
    onError: (e) => {
      toast(formatSupabaseError(e, t), 'error')
      void navigate('/chat', { replace: true })
    },
  })

  useEffect(() => {
    join.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for slug from URL
  }, [channelSlug])

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <AppPageMeta title={t('chat.joinChannelTitle')} />
      <p className="text-sm font-semibold text-[var(--color-ushqn-text)]">{t('chat.joinChannelWorking')}</p>
    </div>
  )
}
