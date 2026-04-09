const envUrl = import.meta.env.VITE_APP_URL as string | undefined

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, '')
}

export function getAppBaseUrl() {
  if (envUrl && envUrl.trim().length > 0) return trimTrailingSlash(envUrl.trim())
  if (typeof window !== 'undefined') return trimTrailingSlash(window.location.origin)
  return ''
}
