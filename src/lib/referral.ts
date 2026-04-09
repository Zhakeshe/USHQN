import { trackEvent } from './analytics'

export const REFERRAL_STORAGE_KEY = 'ushqn_referral_uid'

export function captureReferralFromHref(href: string) {
  try {
    const u = new URL(href)
    const ref = u.searchParams.get('ref')
    if (!ref || !/^[0-9a-f-]{36}$/i.test(ref)) return
    sessionStorage.setItem(REFERRAL_STORAGE_KEY, ref)
    trackEvent('referral_landing')
  } catch {
    /* ignore */
  }
}

export function peekReferralUserId(): string | null {
  const v = sessionStorage.getItem(REFERRAL_STORAGE_KEY)
  if (!v || !/^[0-9a-f-]{36}$/i.test(v)) return null
  return v
}

export function clearReferralFromStorage() {
  sessionStorage.removeItem(REFERRAL_STORAGE_KEY)
}
