import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../lib/toast'
import { useOnline } from '../hooks/useOnline'

export function OfflineBanner() {
  const { t } = useTranslation()
  const online = useOnline()
  const { toast } = useToast()
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!online) wasOffline.current = true
    if (online && wasOffline.current) {
      wasOffline.current = false
      toast(t('ui.backOnline'), 'info')
    }
  }, [online, t, toast])

  if (online) return null
  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900"
    >
      {t('ui.offline')}
    </div>
  )
}
