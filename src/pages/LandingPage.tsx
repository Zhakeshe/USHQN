import { useEffect, useRef, useState } from 'react'
import { captureReferralFromHref } from '../lib/referral'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAuth } from '../hooks/useAuth'

/* ─── CSS keyframes injected once ─── */
const LANDING_CSS = `
@keyframes ushqn-glow{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.72;transform:scale(1.14)}}
@keyframes ushqn-float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-22px) rotate(5deg)}}
@keyframes ushqn-float2{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-14px) rotate(-4deg)}}
@keyframes ushqn-fade-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
@keyframes ushqn-chat-in{from{opacity:0;transform:scale(.82) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes ushqn-type-dot{0%,80%,100%{transform:scale(.6);opacity:.3}40%{transform:scale(1);opacity:1}}
@keyframes ushqn-badge-glow{0%,100%{box-shadow:0 0 0 0 rgba(0,82,204,.35)}70%{box-shadow:0 0 0 8px rgba(0,82,204,0)}}
@keyframes ushqn-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes ushqn-beam-sweep{0%{opacity:0;transform:translateX(-100%) skewX(-12deg)}15%{opacity:.55}55%{opacity:.25}100%{opacity:0;transform:translateX(180%) skewX(-12deg)}}
@keyframes ushqn-aurora-drift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(3%,-4%) scale(1.06)}}
.landing-reveal{opacity:0;transform:translateY(32px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1)}
.landing-reveal.in{opacity:1;transform:translateY(0)}
.landing-reveal-l{opacity:0;transform:translateX(-32px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1)}
.landing-reveal-l.in{opacity:1;transform:translateX(0)}
.landing-reveal-r{opacity:0;transform:translateX(32px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1)}
.landing-reveal-r.in{opacity:1;transform:translateX(0)}
.ushqn-glow-btn{transition:box-shadow .22s ease,transform .2s cubic-bezier(.34,1.56,.64,1)}
.ushqn-glow-btn:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 18px 56px rgba(0,82,204,.58),0 1px 0 rgba(255,255,255,.22) inset!important}
.ushqn-glow-btn:active{transform:scale(.97)}
.landing-hero-sweep{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.landing-hero-sweep::before{content:'';position:absolute;top:-25%;left:-30%;width:55%;height:150%;background:linear-gradient(105deg,transparent,rgba(147,197,253,.12),rgba(167,139,250,.08),transparent);animation:ushqn-beam-sweep 8.5s ease-in-out infinite}
.landing-aurora-mesh{animation:ushqn-aurora-drift 22s ease-in-out infinite}
`

/* ─── Arrow icon ─── */
function ArrowRight() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0" aria-hidden>
      <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
    </svg>
  )
}

/* ─── CountUp hook ─── */
function useCountUp(target: number, started: boolean, duration = 1400) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!started) return
    setVal(0)
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(ease * target))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [started, target, duration])
  return val
}

/* ─── Stats ─── */
const STATS_DATA = [
  { n: 2400, suffix: '+', labelKey: 'landing.statUsersL' },
  { n: 500, suffix: '+', labelKey: 'landing.statJobsL' },
  { n: 12, suffix: '', labelKey: 'landing.statCitiesL' },
  { n: 100, suffix: '%', labelKey: 'landing.statFreeL' },
]

function StatCard({ n, suffix, labelKey, started, delay, t }: {
  n: number; suffix: string; labelKey: string; started: boolean; delay: number; t: TFunction
}) {
  const val = useCountUp(n, started, 1400)
  return (
    <div
      className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/6 px-3 py-4 text-center backdrop-blur-sm"
      style={{
        opacity: started ? 1 : 0,
        transform: started ? 'translateY(0)' : 'translateY(10px)',
        transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms`,
      }}
    >
      <div
        className="text-3xl font-black tabular-nums tracking-tight sm:text-4xl"
        style={{
          background: 'linear-gradient(135deg, #fff 40%, #93c5fd)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {n > 999 ? `${Math.round(val / 100) / 10}k`.replace('.', '\u202F') : `${val}`}{suffix}
      </div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-white/45">{t(labelKey)}</div>
    </div>
  )
}

/* ─── Chat demo ─── */
const CHAT_MSGS_KEYS = [
  { me: false, key: 'landing.chatMsg1', nameKey: 'landing.chatFrom1' },
  { me: true, key: 'landing.chatMsg2', nameKey: 'landing.chatFrom2' },
  { me: false, key: 'landing.chatMsg3', nameKey: 'landing.chatFrom1' },
  { me: true, key: 'landing.chatMsg4', nameKey: 'landing.chatFrom2' },
]

function useChatStep(len: number) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const delay = step >= len ? 3000 : 1300
    const id = setTimeout(() => setStep((s) => (s >= len ? 0 : s + 1)), delay)
    return () => clearTimeout(id)
  }, [step, len])
  return step
}

function ChatMockup({ t }: { t: TFunction }) {
  const step = useChatStep(CHAT_MSGS_KEYS.length)
  const visible = CHAT_MSGS_KEYS.slice(0, step)
  const typing = step < CHAT_MSGS_KEYS.length

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
      style={{ minHeight: 280 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/8 bg-white/5 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-white/20" />
          <div className="h-2 w-2 rounded-full bg-white/20" />
          <div className="h-2 w-2 rounded-full bg-white/20" />
        </div>
        <div className="mx-auto flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold text-white/60">
            {t('landing.chatWindowTitle', { wordmark: t('brand.wordmark') })}
          </span>
        </div>
      </div>
      {/* Messages */}
      <div className="flex min-h-[220px] flex-col justify-end gap-2 p-4">
        {visible.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 ${m.me ? 'flex-row-reverse' : 'flex-row'}`}
            style={{ animation: 'ushqn-chat-in .35s cubic-bezier(.34,1.56,.64,1) both' }}
          >
            {!m.me ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0052CC] to-[#2684FF] text-[10px] font-bold text-white">
                АС
              </div>
            ) : null}
            <div
              className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow ${
                m.me
                  ? 'rounded-tr-sm bg-gradient-to-br from-[#0052CC] to-[#1d4ed8] text-white'
                  : 'rounded-tl-sm border border-white/10 bg-white/8 text-white/90'
              }`}
            >
              {t(m.key)}
            </div>
          </div>
        ))}
        {typing && step < CHAT_MSGS_KEYS.length ? (
          <div className="flex items-center gap-1.5 px-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0052CC] to-[#2684FF] text-[10px] font-bold text-white">
              {CHAT_MSGS_KEYS[step].me ? 'Сіз' : 'АС'}
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-white/10 bg-white/8 px-3 py-2.5">
              {[0, 200, 400].map((d) => (
                <span
                  key={d}
                  className="block h-1.5 w-1.5 rounded-full bg-white/50"
                  style={{ animation: `ushqn-type-dot 1s ease-in-out ${d}ms infinite` }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ─── Feature cards ─── */
const FEATURES = [
  { emoji: '🏆', titleKey: 'landing.feature1t', descKey: 'landing.feature1d', accent: '#FFAB00' },
  { emoji: '💼', titleKey: 'landing.feature3t', descKey: 'landing.feature3d', accent: '#0052CC' },
  { emoji: '👥', titleKey: 'landing.feature4t', descKey: 'landing.feature4d', accent: '#6554C0' },
  { emoji: '💬', titleKey: 'landing.feature5t', descKey: 'landing.feature5d', accent: '#00B8D9' },
  { emoji: '📅', titleKey: 'landing.feature6t', descKey: 'landing.feature6d', accent: '#36B37E' },
  { emoji: '⭐', titleKey: 'landing.feature2t', descKey: 'landing.feature2d', accent: '#FF5630' },
]

/* ─── Mock people ─── */
const MOCK_PEOPLE = [
  { initials: 'АН', name: 'Асель Н.', role: 'Frontend Dev', city: 'Алматы', grad: 'from-[#0052CC] to-[#2684FF]' },
  { initials: 'ДС', name: 'Данияр С.', role: 'Олимпиадашы', city: 'Астана', grad: 'from-[#00875A] to-[#36B37E]' },
  { initials: 'АЖ', name: 'Айгерім Ж.', role: 'UI/UX Designer', city: 'Шымкент', grad: 'from-[#6554C0] to-[#8777D9]' },
  { initials: 'ТА', name: 'Тимур А.', role: 'Backend · Ментор', city: 'Алматы', grad: 'from-[#FF5630] to-[#FF8B00]' },
  { initials: 'ЖБ', name: 'Жансая Б.', role: 'Студент, КБТУ', city: 'Алматы', grad: 'from-[#00B8D9] to-[#79E2F2]' },
  { initials: 'НС', name: 'Нурбол С.', role: 'IT · Жұмыс беруші', city: 'Астана', grad: 'from-[#FF7452] to-[#FFAB00]' },
]

/* ─── Scroll reveal hook ─── */
function useScrollReveal() {
  useEffect(() => {
    const selectors = ['.landing-reveal', '.landing-reveal-l', '.landing-reveal-r']
    const allEls = selectors.flatMap((s) => [...document.querySelectorAll(s)])
    const obs = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in') }) },
      { threshold: 0.12 },
    )
    allEls.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

/* ─── useScrolled ─── */
function useScrolled(thr = 10) {
  const [s, setS] = useState(false)
  useEffect(() => {
    const h = () => setS(window.scrollY > thr)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [thr])
  return s
}

function useScrollParallax() {
  const [y, setY] = useState(0)
  useEffect(() => {
    const h = () => setY(window.scrollY)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  return y
}

/* ════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════ */
export function LandingPage() {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const scrolled = useScrolled()
  const scrollY = useScrollParallax()
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsVisible, setStatsVisible] = useState(false)
  const primary = session ? '/home' : '/register'

  useEffect(() => { captureReferralFromHref(window.location.href) }, [])

  /* inject CSS once */
  useEffect(() => {
    const el = document.createElement('style')
    el.dataset.landingCss = '1'
    el.textContent = LANDING_CSS
    document.head.appendChild(el)
    return () => { el.remove() }
  }, [])

  /* stats counter trigger */
  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect() } }, { threshold: 0.25 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useScrollReveal()

  const canonical = typeof window !== 'undefined' ? `${window.location.origin}/` : '/'

  return (
    <div className="overflow-x-hidden">
      <Helmet>
        <html lang={i18n.language} />
        <title>{t('landing.seoTitle', { wordmark: t('brand.wordmark') })}</title>
        <meta name="description" content={t('landing.seoDescription')} />
        <link rel="canonical" href={canonical} />
      </Helmet>

      {/* ── STICKY NAV ── */}
      <header
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(2,8,24,0.88)' : 'transparent',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
          backdropFilter: scrolled ? 'blur(20px) saturate(160%)' : 'none',
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="landing-wordmark-shimmer text-lg font-black tracking-tight sm:text-xl">{t('brand.wordmark')}</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {[['#features', t('landing.navFeatures')], ['#chat', t('landing.chatSectionKicker')], ['#people', t('landing.peopleSectionKicker')]].map(([href, label]) => (
              <a key={href} href={href} className="text-sm font-semibold text-white/55 transition hover:text-white">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/60 transition hover:text-white">
              {t('landing.login')}
            </Link>
            <Link
              to="/register"
              className="ushqn-glow-btn rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#0052CC,#2684FF)', boxShadow: '0 4px 20px rgba(0,82,204,.45)' }}
            >
              {t('landing.register')}
            </Link>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, #020818 0%, #0b1630 50%, #0d2045 100%)',
          minHeight: '100dvh',
        }}
      >
        {/* Orbs + parallax */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div
            className="landing-aurora-mesh"
            style={{
              position: 'absolute',
              width: '55vw',
              height: '55vw',
              maxWidth: 800,
              maxHeight: 800,
              background: 'radial-gradient(circle,rgba(0,82,204,.44) 0%,transparent 65%)',
              top: '-12%',
              right: '-8%',
              animation: 'ushqn-glow 8s ease-in-out infinite',
              transform: `translate3d(0, ${scrollY * 0.045}px, 0)`,
            }}
          />
          <div
            className="landing-aurora-mesh"
            style={{
              position: 'absolute',
              width: '45vw',
              height: '45vw',
              maxWidth: 600,
              maxHeight: 600,
              background: 'radial-gradient(circle,rgba(101,84,192,.32) 0%,transparent 65%)',
              bottom: '-8%',
              left: '-8%',
              animation: 'ushqn-glow 11s ease-in-out infinite 4s',
              transform: `translate3d(0, ${scrollY * -0.035}px, 0)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: '28vw',
              height: '28vw',
              maxWidth: 380,
              maxHeight: 380,
              background: 'radial-gradient(circle,rgba(0,184,217,.22) 0%,transparent 70%)',
              top: '35%',
              left: '25%',
              animation: 'ushqn-float 14s ease-in-out infinite 2s',
              transform: `translate3d(0, ${scrollY * 0.06}px, 0)`,
            }}
          />
        </div>

        {/* Grid lines */}
        <div className="pointer-events-none absolute inset-0" aria-hidden style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />

        <div className="landing-hero-sweep" aria-hidden />

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:py-28 lg:py-36 sm:px-5">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
              style={{ border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', backdropFilter: 'blur(12px)', animation: 'ushqn-fade-up .7s ease-out both' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animation: 'ushqn-glow 2s ease-in-out infinite' }} />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/65">{t('landing.badge')}</span>
            </div>

            {/* Headline */}
            <h1 className="tracking-tight" style={{ animation: 'ushqn-fade-up .85s ease-out .08s both' }}>
              <span className="landing-wordmark-shimmer block text-5xl font-black leading-none sm:text-6xl lg:text-7xl">
                {t('brand.wordmark')}
              </span>
              <span className="mt-4 block text-2xl font-bold leading-tight text-white/90 sm:text-3xl lg:text-4xl">
                {t('landing.heroHeadline')}
              </span>
            </h1>

            {/* Subline */}
            <p
              className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg"
              style={{ animation: 'ushqn-fade-up .8s ease-out .22s both' }}
            >
              {t('landing.heroSub')}
            </p>

            {/* CTAs */}
            <div
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
              style={{ animation: 'ushqn-fade-up .8s ease-out .34s both' }}
            >
              <Link
                to={primary}
                className="ushqn-glow-btn inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#0052CC,#2684FF)', boxShadow: '0 8px 32px rgba(0,82,204,.5),0 1px 0 rgba(255,255,255,.15) inset' }}
              >
                {session ? t('landing.toApp') : t('landing.ctaPrimary')}
                <ArrowRight />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center rounded-xl px-6 py-3.5 text-sm font-bold text-white/75 transition hover:text-white"
                style={{ border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', backdropFilter: 'blur(8px)' }}
              >
                {t('landing.ctaSecondary')}
              </a>
            </div>

            {/* Trust note */}
            <p className="mt-4 text-xs text-white/30" style={{ animation: 'ushqn-fade-up .8s ease-out .44s both' }}>
              {t('landing.ctaNote')}
            </p>

            {/* Stats */}
            <div
              ref={statsRef}
              className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4"
              style={{ animation: 'ushqn-fade-up .8s ease-out .5s both' }}
            >
              {STATS_DATA.map((s, i) => (
                <StatCard key={i} {...s} started={statsVisible} delay={i * 120} t={t} />
              ))}
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center" style={{ animation: 'ushqn-fade-up 1s ease-out .8s both' }}>
          <a href="#features" className="flex flex-col items-center gap-1 text-white/25 transition hover:text-white/50">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
          </a>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════ */}
      <section id="features" className="relative overflow-hidden bg-[#030712] py-20 sm:py-28">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background: 'radial-gradient(ellipse 100% 70% at 50% -25%, rgba(0,82,204,.28), transparent 50%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-5">
          <div className="landing-reveal mx-auto max-w-xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#60a5fa]">{t('landing.featuresSectionKicker')}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">{t('landing.featuresTitle')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">{t('landing.featuresSub')}</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="landing-reveal group flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,.06)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#0052CC]/40 hover:shadow-[0_24px_80px_rgba(0,82,204,.2)]"
                style={{ borderLeftWidth: 3, borderLeftColor: f.accent, transitionDelay: `${i * 60}ms` }}
              >
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                  style={{ background: `${f.accent}22`, border: `1px solid ${f.accent}33` }}
                >
                  {f.emoji}
                </div>
                <h3 className="text-base font-bold text-white">{t(f.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════ */}
      <section className="border-t border-white/5 bg-[#0a0f18] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="landing-reveal-l">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#60a5fa]">{t('landing.howKicker')}</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t('landing.howTitle')}</h2>
            </div>
            <div className="space-y-6 landing-reveal-r">
              {([1, 2, 3] as const).map((n) => (
                <div key={n} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0052CC] to-[#2684FF] text-sm font-black text-white shadow-lg shadow-[#0052CC]/35 ring-2 ring-white/10">
                    {n}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{t(`landing.step${n}t`)}</h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-400">{t(`landing.step${n}d`)}</p>
                  </div>
                </div>
              ))}
              <Link
                to={primary}
                className="ushqn-glow-btn mt-4 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#0052CC,#2684FF)', boxShadow: '0 8px 24px rgba(0,82,204,.35)' }}
              >
                {t('landing.ctaPrimary')} <ArrowRight />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CHAT DEMO (DARK)
      ══════════════════════════════════════════ */}
      <section
        id="chat"
        className="py-16 sm:py-24"
        style={{ background: 'linear-gradient(150deg, #020818 0%, #0b1630 60%, #0d2045 100%)' }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="landing-reveal-l">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#60a5fa]">{t('landing.chatSectionKicker')}</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t('landing.chatSectionTitle')}</h2>
              <p className="mt-4 text-sm leading-relaxed text-white/55 sm:text-base">{t('landing.chatSectionSub')}</p>
              <div className="mt-6 flex flex-col gap-3">
                {(['landing.chatBullet1', 'landing.chatBullet2', 'landing.chatBullet3'] as const).map((k) => (
                  <div key={k} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0052CC]/30 text-[11px] text-[#60a5fa]">✓</div>
                    <span className="text-sm font-medium text-white/70">{t(k)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="landing-reveal-r">
              <ChatMockup t={t} />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PEOPLE
      ══════════════════════════════════════════ */}
      <section id="people" className="bg-[#030712] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="landing-reveal mb-10 text-center">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#60a5fa]">{t('landing.peopleSectionKicker')}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t('landing.peopleSectionTitle')}</h2>
            <p className="mt-2 text-sm text-slate-400 sm:text-base">{t('landing.peopleSectionSub')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {MOCK_PEOPLE.map((p, i) => (
              <div
                key={i}
                className="landing-reveal flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,.05)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_20px_50px_rgba(0,82,204,.12)]"
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${p.grad} text-sm font-bold text-white shadow-lg ring-1 ring-white/15`}
                >
                  {p.initials}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{p.name}</p>
                  <p className="text-[10px] text-slate-400">{p.role}</p>
                  <p className="mt-0.5 text-[9px] text-slate-500">📍 {p.city}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="landing-reveal mt-8 text-center">
            <Link
              to={primary}
              className="ushqn-glow-btn inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#0052CC,#2684FF)', boxShadow: '0 8px 24px rgba(0,82,204,.35)' }}
            >
              {t('landing.peopleCta')} <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          VOICES
      ══════════════════════════════════════════ */}
      <section className="border-t border-white/5 bg-[#0a0f18] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="landing-reveal mb-10">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#60a5fa]">{t('landing.voicesKicker')}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t('landing.voicesTitle')}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <blockquote
                key={n}
                className="landing-reveal rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,.06)] backdrop-blur-md transition hover:border-[#0052CC]/35 hover:shadow-[0_20px_60px_rgba(0,82,204,.12)]"
                style={{ transitionDelay: `${(n - 1) * 80}ms` }}
              >
                <div className="mb-3 text-2xl text-[#60a5fa]/50">❝</div>
                <p className="text-sm leading-relaxed text-slate-200">{t(`landing.quote${n}b`)}</p>
                <footer className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#0052CC] to-[#2684FF] text-xs font-bold text-white">
                    {t(`landing.quote${n}n`).split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <cite className="not-italic text-sm font-bold text-white">{t(`landing.quote${n}n`)}</cite>
                    <p className="text-xs text-slate-400">{t(`landing.quote${n}r`)}</p>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA BAND
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-16 sm:py-24" style={{ background: 'linear-gradient(135deg,#0052CC 0%,#1d4ed8 50%,#6554C0 100%)' }}>
        <div className="pointer-events-none absolute inset-0" aria-hidden style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.08) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative landing-reveal mx-auto max-w-2xl px-4 text-center sm:px-5">
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">{t('landing.ctaBandTitle')}</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">{t('landing.ctaBandSub')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={primary}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white px-7 py-3.5 text-sm font-bold text-[#0052CC] shadow-xl transition hover:scale-[1.02] hover:shadow-2xl active:scale-[.98]"
            >
              {session ? t('landing.toApp') : t('landing.ctaBandBtn')} <ArrowRight />
            </Link>
            {!session ? (
              <Link to="/login" className="inline-flex items-center rounded-xl border border-white/20 bg-white/8 px-7 py-3.5 text-sm font-bold text-white/85 backdrop-blur-sm transition hover:bg-white/15 hover:text-white">
                {t('landing.ctaBandLogin')}
              </Link>
            ) : null}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            {(['ctaCheck1', 'ctaCheck2', 'ctaCheck3', 'ctaCheck4'] as const).map((k) => (
              <span key={k} className="text-xs font-semibold text-white/60">{t(`landing.${k}`)}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="py-10"
        style={{ background: 'linear-gradient(150deg,#020818 0%,#0b1630 100%)', borderTop: '1px solid rgba(255,255,255,.06)' }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-5">
          <div className="text-center sm:text-left">
            <div className="landing-wordmark-shimmer text-lg font-black sm:text-xl">{t('brand.wordmark')}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">{t('brand.navTagline')}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm font-semibold text-white/35">
            <a href="#features" className="transition hover:text-white/70">{t('landing.navFeatures')}</a>
            <Link to="/login" className="transition hover:text-white/70">{t('landing.login')}</Link>
            <Link to="/register" className="transition hover:text-white/70">{t('landing.register')}</Link>
          </div>
          <p className="text-xs text-white/25">{t('landing.footerCopy', { year: new Date().getFullYear(), legalName: t('brand.legalName') })}</p>
        </div>
      </footer>
    </div>
  )
}
