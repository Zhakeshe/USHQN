import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > threshold)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [threshold])
  return scrolled
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
    </svg>
  )
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="ushqn-card group flex flex-col p-6 transition duration-200 hover:-translate-y-0.5 hover:border-[#B3D4FF] hover:shadow-[0_12px_40px_rgba(0,82,204,0.08)]">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#0052CC] transition group-hover:bg-[#DEEBFF]">
        {icon}
      </div>
      <h3 className="text-base font-bold text-[#172B4D]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#6B778C]">{desc}</p>
    </div>
  )
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="relative flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0052CC] text-sm font-black text-white shadow-md shadow-[#0052CC]/25">
        {n}
      </div>
      <div>
        <h3 className="text-base font-bold text-[#172B4D]">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-[#6B778C]">{text}</p>
      </div>
    </div>
  )
}

function Quote({ name, role, body }: { name: string; role: string; body: string }) {
  return (
    <blockquote className="ushqn-card flex flex-col p-6">
      <p className="text-sm leading-relaxed text-[#172B4D]">«{body}»</p>
      <footer className="mt-4 flex items-center gap-3 border-t border-[#eef1f4] pt-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#0052CC] to-[#2684FF] text-xs font-bold text-white">
          {name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)}
        </div>
        <div>
          <cite className="not-italic text-sm font-bold text-[#172B4D]">{name}</cite>
          <p className="text-xs text-[#6B778C]">{role}</p>
        </div>
      </footer>
    </blockquote>
  )
}

/* compact SVG icons */
function IcTrophy() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
    </svg>
  )
}
function IcStar() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
    </svg>
  )
}
function IcBriefcase() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
    </svg>
  )
}
function IcUsers() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}
function IcChat() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
    </svg>
  )
}
function IcCalendar() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}
function IcShop() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </svg>
  )
}

function HeroPreview() {
  const { t } = useTranslation()
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#0052CC]/8 via-transparent to-[#6554C0]/6 blur-2xl" aria-hidden />
      <div className="relative overflow-hidden rounded-2xl border border-[#dce3eb] bg-white shadow-[0_28px_80px_rgba(23,43,77,0.12),0_1px_0_rgba(255,255,255,0.9)_inset] ring-1 ring-black/[0.04]">
        <div className="flex items-center gap-2 border-b border-[#eef1f4] bg-[#FAFBFC] px-4 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-[#FF5630]/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#FFAB00]/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#36B37E]/80" />
          <span className="ml-3 text-[11px] font-semibold text-[#97A0AF]">{t('landing.previewUrl')}</span>
        </div>
        <div className="grid gap-0 sm:grid-cols-[1fr_1.35fr]">
          <div className="border-b border-[#eef1f4] p-4 sm:border-b-0 sm:border-r">
            <div className="mb-3 h-14 rounded-xl bg-gradient-to-br from-[#0052CC] to-[#2684FF] shadow-inner" />
            <div className="-mt-8 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-white bg-[#EEF1F4] text-lg shadow-md">👤</div>
            </div>
            <p className="mt-2 text-center text-sm font-extrabold text-[#172B4D]">{t('landing.previewProfile')}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-[#FAFBFC] py-2 ring-1 ring-[#eef1f4]">
                <div className="text-base font-black text-[#0052CC]">0</div>
                <div className="text-[10px] font-semibold text-[#6B778C]">{t('landing.previewPoints')}</div>
              </div>
              <div className="rounded-lg bg-[#FAFBFC] py-2 ring-1 ring-[#eef1f4]">
                <div className="text-base font-black text-[#172B4D]">—</div>
                <div className="text-[10px] font-semibold text-[#6B778C]">{t('landing.previewRank')}</div>
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="mb-3 rounded-xl border border-[#DEEBFF] bg-[#EFF6FF] p-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#0052CC]">{t('landing.previewWelcomeTag')}</p>
              <p className="mt-1 text-sm font-extrabold text-[#172B4D]">{t('landing.previewWelcomeTitle')}</p>
              <p className="mt-1 text-xs leading-snug text-[#6B778C]">{t('landing.previewWelcomeSub')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gradient-to-br from-[#0052CC] to-[#2684FF] p-3 text-center text-[11px] font-bold text-white shadow-sm">
                {t('landing.featTiles.ach')}
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#00875A] to-[#36B37E] p-3 text-center text-[11px] font-bold text-white shadow-sm">
                {t('landing.featTiles.job')}
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#6554C0] to-[#8777D9] p-3 text-center text-[11px] font-bold text-white shadow-sm">
                {t('landing.featTiles.people')}
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#FF8B00] to-[#FFAB00] p-3 text-center text-[11px] font-bold text-white shadow-sm">
                {t('landing.featTiles.cal')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  const { t, i18n } = useTranslation()
  const scrolled = useScrolled()
  const { session } = useAuth()
  const primary = session ? '/home' : '/register'
  const secondary = session ? '/home' : '/login'

  const canonical = typeof window !== 'undefined' ? `${window.location.origin}/` : '/'

  const jsonLd = useMemo(
    () =>
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'USHQN',
        description: t('landing.seoDescription'),
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KZT' },
      }),
    [t, i18n.language],
  )

  return (
    <div
      className="min-h-dvh text-[#172B4D]"
      style={{
        backgroundColor: '#f3f2ef',
        backgroundImage:
          'radial-gradient(ellipse 120% 80% at 50% -30%, rgba(0, 82, 204, 0.075), transparent 55%), radial-gradient(ellipse 55% 45% at 100% 0%, rgba(0, 82, 204, 0.045), transparent 50%), radial-gradient(ellipse 40% 35% at 0% 100%, rgba(101, 84, 192, 0.04), transparent 45%)',
        backgroundAttachment: 'fixed',
      }}
    >
      <Helmet>
        <html lang={i18n.language} />
        <title>{t('landing.seoTitle')}</title>
        <meta name="description" content={t('landing.seoDescription')} />
        <link rel="canonical" href={canonical} />
        <script type="application/ld+json">{jsonLd}</script>
      </Helmet>
      <header
        className={`sticky top-0 z-50 transition-[background,box-shadow,border-color] ${
          scrolled
            ? 'border-b border-[#E4E9EF] bg-white/90 shadow-[0_1px_0_rgba(23,43,77,0.06)] backdrop-blur-md'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-[3.5rem] sm:px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0052CC] text-sm font-black text-white shadow-sm">U</span>
            <span className="text-lg font-extrabold tracking-tight text-[#0052CC]">USHQN</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex" aria-label={t('landing.featuresSectionKicker')}>
            <a href="#features" className="text-sm font-semibold text-[#6B778C] hover:text-[#172B4D]">
              {t('landing.navFeatures')}
            </a>
            <a href="#steps" className="text-sm font-semibold text-[#6B778C] hover:text-[#172B4D]">
              {t('landing.navHow')}
            </a>
            <a href="#voices" className="text-sm font-semibold text-[#6B778C] hover:text-[#172B4D]">
              {t('landing.navVoices')}
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to={secondary}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#6B778C] transition hover:bg-white hover:text-[#172B4D]"
            >
              {session ? t('landing.toApp') : t('landing.login')}
            </Link>
            {!session ? (
              <Link
                to="/register"
                className="ushqn-btn-primary hidden px-4 py-2 text-sm sm:inline-flex"
              >
                {t('landing.register')}
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-5 sm:pb-24 sm:pt-14">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0052CC]">{t('landing.badge')}</p>
              <h1 className="mt-3 text-[2rem] font-black leading-[1.12] tracking-tight text-[#172B4D] sm:text-5xl lg:text-[3.25rem]">
                {t('landing.heroTitle1')} — {t('landing.heroTitle2')}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#6B778C] sm:text-lg">{t('landing.heroSub')}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={primary}
                  className="group inline-flex items-center gap-2 rounded-lg bg-[#0052CC] px-5 py-3 text-sm font-bold text-white shadow-[0_1px_2px_rgba(0,82,204,0.25)] transition hover:bg-[#0747A6] hover:shadow-md"
                >
                  {session ? t('landing.toApp') : t('landing.ctaPrimary')}
                  <ArrowRight />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center rounded-lg border border-[#DFE1E6] bg-white px-5 py-3 text-sm font-bold text-[#172B4D] shadow-sm transition hover:border-[#C7CDD6]"
                >
                  {t('landing.ctaSecondary')}
                </a>
              </div>
              <p className="mt-4 text-xs text-[#97A0AF]">{t('landing.ctaNote')}</p>
            </div>
            <HeroPreview />
          </div>
        </section>

        <section id="features" className="border-t border-[#e4e9ef] bg-white/70 py-16 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-[3px] sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-5">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#0052CC]">{t('landing.featuresSectionKicker')}</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#172B4D] sm:text-3xl">{t('landing.featuresTitle')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6B778C] sm:text-base">{t('landing.featuresSub')}</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Feature icon={<IcTrophy />} title={t('landing.feature1t')} desc={t('landing.feature1d')} />
              <Feature icon={<IcStar />} title={t('landing.feature2t')} desc={t('landing.feature2d')} />
              <Feature icon={<IcBriefcase />} title={t('landing.feature3t')} desc={t('landing.feature3d')} />
              <Feature icon={<IcUsers />} title={t('landing.feature4t')} desc={t('landing.feature4d')} />
              <Feature icon={<IcChat />} title={t('landing.feature5t')} desc={t('landing.feature5d')} />
              <Feature icon={<IcCalendar />} title={t('landing.feature6t')} desc={t('landing.feature6d')} />
              <Feature icon={<IcShop />} title={t('landing.feature7t')} desc={t('landing.feature7d')} />
              <Feature icon={<IcTrophy />} title={t('landing.feature8t')} desc={t('landing.feature8d')} />
            </div>
          </div>
        </section>

        <section id="steps" className="mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#0052CC]">{t('landing.howKicker')}</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#172B4D] sm:text-3xl">{t('landing.howTitle')}</h2>
            </div>
            <div className="space-y-8">
              <Step n="1" title={t('landing.step1t')} text={t('landing.step1d')} />
              <Step n="2" title={t('landing.step2t')} text={t('landing.step2d')} />
              <Step n="3" title={t('landing.step3t')} text={t('landing.step3d')} />
            </div>
          </div>
        </section>

        <section className="border-y border-[#e4e9ef] bg-gradient-to-r from-[#0052CC]/[0.06] via-white/80 to-[#6554C0]/[0.05] py-14 sm:py-16">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-5">
            <div>
              <h2 className="text-xl font-extrabold text-[#172B4D] sm:text-2xl">{t('landing.ctaBandTitle')}</h2>
              <p className="mt-1 text-sm text-[#6B778C]">{t('landing.ctaBandSub')}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to={primary} className="ushqn-btn-primary inline-flex items-center gap-2 px-6 py-3">
                {session ? t('landing.toApp') : t('landing.ctaBandBtn')}
                <ArrowRight />
              </Link>
              {!session ? (
                <Link
                  to="/login"
                  className="inline-flex items-center rounded-lg border border-[#DFE1E6] bg-white px-6 py-3 text-sm font-bold text-[#172B4D] shadow-sm hover:border-[#C7CDD6]"
                >
                  {t('landing.ctaBandLogin')}
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section id="voices" className="mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-20">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#0052CC]">{t('landing.voicesKicker')}</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#172B4D] sm:text-3xl">{t('landing.voicesTitle')}</h2>
          <p className="mt-2 text-sm text-[#6B778C]">{t('landing.voicesSub')}</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Quote name={t('landing.quote1n')} role={t('landing.quote1r')} body={t('landing.quote1b')} />
            <Quote name={t('landing.quote2n')} role={t('landing.quote2r')} body={t('landing.quote2b')} />
            <Quote name={t('landing.quote3n')} role={t('landing.quote3r')} body={t('landing.quote3b')} />
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e4e9ef] bg-white/80 py-10 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0052CC] text-sm font-black text-white">U</span>
            <div>
              <div className="text-sm font-extrabold text-[#172B4D]">USHQN</div>
              <div className="text-xs text-[#97A0AF]">Discover. Grow. Achieve.</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-[#6B778C]">
            <a href="#features" className="hover:text-[#0052CC]">
              {t('landing.navFeatures')}
            </a>
            <Link to="/login" className="hover:text-[#0052CC]">
              {t('landing.login')}
            </Link>
            <Link to="/register" className="hover:text-[#0052CC]">
              {t('landing.register')}
            </Link>
          </div>
          <p className="text-xs text-[#97A0AF]">{t('landing.footerCopy', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  )
}
