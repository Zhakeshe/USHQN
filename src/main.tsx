import * as Sentry from '@sentry/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import posthog from 'posthog-js'
import App from './App.tsx'
import { ConfirmProvider } from './lib/confirm.tsx'
import { ToastProvider } from './lib/toast.tsx'
import './i18n/index.ts'
import './index.css'

const posthogKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const posthogHost = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com'
if (import.meta.env.PROD && posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    person_profiles: 'identified_only',
  })
}

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (import.meta.env.PROD && sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.15,
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false
        const status = (error as { status?: number })?.status
        if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408) return false
        return true
      },
      retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 12_000),
    },
    mutations: { retry: 0 },
  },
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').catch(() => {
    /* ignore registration errors */
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
)
