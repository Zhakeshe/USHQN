import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MobileNav } from './MobileNav'
import { Navbar } from './Navbar'
import { OfflineBanner } from './OfflineBanner'
import { PrivacyBanner } from './PrivacyBanner'
import { ThemeSync } from './ThemeSync'

export function AppLayout() {
  const { t } = useTranslation()
  return (
    <div className="min-h-dvh bg-[var(--color-ushqn-bg)] transition-colors duration-200">
      <ThemeSync />
      <a
        href="#main-content"
        className="ushqn-skip-link"
      >
        {t('ui.skipToContent')}
      </a>
      <PrivacyBanner />
      <OfflineBanner />
      <Navbar />
      <main
        id="main-content"
        className="mx-auto max-w-6xl px-4 py-7 sm:px-5 sm:py-9 outline-none"
        tabIndex={-1}
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Outlet />
      </main>
      <MobileNav />
    </div>
  )
}
