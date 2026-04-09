import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'ushqn_privacy_ack'

export function PrivacyBanner() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return true
    }
  })

  if (dismissed) return null

  return (
    <div className="border-b border-[#DEEBFF] bg-[#EFF6FF] px-4 py-2.5 text-center text-xs text-[#172B4D] sm:text-sm">
      <span className="inline-block max-w-3xl">{t('privacy.cookieShort')}</span>{' '}
      <button
        type="button"
        className="ml-2 font-bold text-[#0052CC] underline decoration-[#0052CC]/40 hover:decoration-[#0052CC]"
        onClick={() => {
          try {
            localStorage.setItem(STORAGE_KEY, '1')
          } catch {
            /* ignore */
          }
          setDismissed(true)
        }}
      >
        {t('privacy.accept')}
      </button>
    </div>
  )
}
