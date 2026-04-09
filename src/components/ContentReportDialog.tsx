import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/analytics'

export type ReportTargetType = 'job' | 'achievement' | 'message' | 'listing' | 'profile'

type TargetType = ReportTargetType

type Props = {
  open: boolean
  onClose: () => void
  targetType: TargetType
  targetId: string
}

export function ContentReportDialog({ open, onClose, targetType, targetId }: Props) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (!open) return null

  async function submit() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setBusy(true)
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason: reason.trim() || null,
    })
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    trackEvent('content_report_submitted', { target_type: targetType })
    setDone(true)
    setReason('')
    setTimeout(() => {
      setDone(false)
      onClose()
    }, 1200)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="ushqn-card max-w-md space-y-4 p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[var(--color-ushqn-text)]">{t('trust.report.title')}</h2>
        <p className="text-sm text-[var(--color-ushqn-muted)]">{t('trust.report.subtitle')}</p>
        {done ? (
          <p className="text-sm font-semibold text-green-700">{t('trust.report.sent')}</p>
        ) : (
          <>
            <textarea
              className="ushqn-input min-h-[88px] resize-none"
              placeholder={t('trust.report.reasonPh')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-[var(--color-ushqn-border)] px-4 py-2 text-sm font-semibold" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button type="button" disabled={busy} className="ushqn-btn-primary px-4 py-2 text-sm" onClick={() => void submit()}>
                {busy ? t('trust.report.sending') : t('trust.report.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
