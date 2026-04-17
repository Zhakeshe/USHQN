import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const PROMPT_FLAG_KEY = 'ushqn:notifications:prompted:v1'

/**
 * Shows one-time browser notification permission prompt after sign-in.
 * Trigger condition: notify_messages is enabled and Notification permission is "default".
 */
export function NotificationPermissionPrompt() {
  const { t } = useTranslation()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const [dismissed, setDismissed] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ['user-settings', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('notify_messages,push_notify_opt_in')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const shouldShow = useMemo(() => {
    if (dismissed) return false
    if (!userId) return false
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    if (Notification.permission !== 'default') return false
    if (localStorage.getItem(PROMPT_FLAG_KEY) === '1') return false
    return settingsQuery.data?.notify_messages !== false
  }, [dismissed, userId, settingsQuery.data])

  useEffect(() => {
    if (!shouldShow) return
    // Mark as prompted (we still allow explicit request via Settings later).
    localStorage.setItem(PROMPT_FLAG_KEY, '1')
  }, [shouldShow])

  const allow = useMutation({
    mutationFn: async () => {
      const perm = await Notification.requestPermission()
      const patch = { user_id: userId!, push_notify_opt_in: perm === 'granted' }
      const { error } = await supabase.from('user_settings').upsert(patch)
      if (error) throw error
      return perm
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user-settings', userId] })
      setDismissed(true)
    },
    onError: () => {
      setDismissed(true)
    },
  })

  function later() {
    setDismissed(true)
  }

  if (!shouldShow) return null

  return (
    <div className="mx-auto mb-3 w-full max-w-5xl rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[var(--color-ushqn-text)]">{t('settings.notificationsSection.promptTitle')}</p>
          <p className="mt-0.5 text-xs text-[var(--color-ushqn-muted)]">{t('settings.notificationsSection.promptDesc')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={later}
            className="rounded-lg border border-[var(--color-ushqn-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ushqn-text)] transition hover:bg-[var(--color-ushqn-surface-muted)]"
          >
            {t('settings.notificationsSection.promptLater')}
          </button>
          <button
            type="button"
            disabled={allow.isPending}
            onClick={() => allow.mutate()}
            className="rounded-lg bg-[#0052CC] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#0747A6] disabled:opacity-60"
          >
            {allow.isPending ? t('settings.notificationsSection.promptAsking') : t('settings.notificationsSection.promptAllow')}
          </button>
        </div>
      </div>
    </div>
  )
}
