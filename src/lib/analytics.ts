declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, string | number | boolean> }) => void
    gtag?: (...args: unknown[]) => void
  }
}

function isClient() {
  return typeof window !== 'undefined'
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (!isClient()) return
  try {
    window.plausible?.(name, props ? { props } : undefined)
    if (window.gtag) {
      window.gtag('event', name, props ?? {})
    }
  } catch {
    // Never block user flow because analytics failed.
  }
}
