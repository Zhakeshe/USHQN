import { useTranslation } from 'react-i18next'
import { useToast } from '../lib/toast'
import { bannerFallbackGradient, isValidAccentHex } from '../lib/profileTheme'
import type { UserRole } from '../types/database'

export type ProfileCardData = {
  display_name: string
  location: string | null
  headline: string | null
  school_or_org: string | null
  role: UserRole
  avatar_url: string | null
  banner_url: string | null
  accent_color?: string | null
  bio?: string | null
  github_url?: string | null
  telegram_url?: string | null
  linkedin_url?: string | null
  website_url?: string | null
  profile_views?: number
}

type Props = {
  profile: ProfileCardData
  onEdit?: () => void
  userId?: string
}

function IconGithub({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.74-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

function IconTelegram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8.287 5.906c-.778.324-2.334.994-4.666 2.009-.48.22-.87.748-.758 1.245.152.78.646 2.182.916 2.942.12.36.354.478.544.493.194.016.378-.092.532-.21.2-.155 2.233-1.64 2.36-1.783.12-.145.266-.102.362.045.097.147.824.957 1.045 1.272.217.31.366.444.605.408.192-.03.35-.175.533-.387.27-.316 1.39-2.33 1.82-3.19.18-.34.27-.594.277-.79a.55.55 0 0 0-.289-.497c-.22-.11-.532-.065-.84-.026z" />
    </svg>
  )
}

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-1.492-.796-2.188-1.858-2.188-.922 0-1.396.517-1.63 1.018v-.877H8.05c.03 0 .03-.03.03-.06V12.4c0 .03-.03.06-.06.06h2.401zm.03-8.817h-.03c-.04 0-.06.03-.06.06v4.878c0 .03.03.06.06.06h2.071c.04 0 .06-.03.06-.06V6.169c0-.03-.03-.06-.06-.06h-2.071z" />
    </svg>
  )
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8.636 3.646a.5.5 0 0 0-.707-.707l-2 2a.5.5 0 0 0 0 .707l2 2a.5.5 0 1 0 .707-.707L7.293 5.5h4.656a2 2 0 1 0 0-1H7.293l1.343-1.354zm-1.272 8.708a.5.5 0 1 0 .707-.707l2-2a.5.5 0 0 0 0-.707l-2-2a.5.5 0 0 0-.707.707L8.707 8.5H4.05a2 2 0 1 0 0 1h4.656l-1.343 1.354z" />
    </svg>
  )
}

function IconChain({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 2.547 2.257l1.828 1.829A4 4 0 0 0 4.47 5.058l-.544.484zm5.65 2.885a1 1 0 0 0-.154.199 2 2 0 0 1-2.547 2.257l-1.828 1.829A4 4 0 0 0 11.526 14l.645-.576a3 3 0 0 0-4.243-4.243l-1.828 1.829a3 3 0 0 0 4.243 4.243L11.526 14a4 4 0 0 0 .435-5.557z" />
    </svg>
  )
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M12.146.854a.5.5 0 0 1 .708 0l2.292 2.292a.5.5 0 0 1 0 .708l-9.526 9.526a.5.5 0 0 1-.168.11l-3.5 1.5a.5.5 0 0 1-.65-.65l1.5-3.5a.5.5 0 0 1 .11-.168l9.526-9.526zm-1.646 1.646L3.902 9l1.293 1.293 6.598-6.598-1.292-1.293zM3.5 12.293l1.207-.518 1.793 1.793-.518 1.207-2.482.768.7-2.25z" />
    </svg>
  )
}

export function ProfileCard({ profile, onEdit, userId }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()

  const accent = isValidAccentHex(profile.accent_color) ? profile.accent_color : '#0052CC'

  function copyLink() {
    if (!userId) return
    void navigator.clipboard.writeText(`${window.location.origin}/u/${userId}`).then(() => {
      toast(t('common.copied'), 'success')
    })
  }

  const tgHref = profile.telegram_url
    ? profile.telegram_url.startsWith('@')
      ? `https://t.me/${profile.telegram_url.slice(1)}`
      : profile.telegram_url
    : null

  const socialLinks: { href: string; label: string; Icon: typeof IconGithub }[] = [
    { href: profile.github_url ?? '', label: 'GitHub', Icon: IconGithub },
    { href: tgHref ?? '', label: 'Telegram', Icon: IconTelegram },
    { href: profile.linkedin_url ?? '', label: 'LinkedIn', Icon: IconLinkedIn },
    { href: profile.website_url ?? '', label: t('profileCard.site'), Icon: IconLink },
  ].filter((s) => s.href)

  const roleKey = `profile.roles.${profile.role}` as const

  const bannerStyle = profile.banner_url
    ? { backgroundImage: `url(${profile.banner_url})` as const }
    : { background: bannerFallbackGradient(accent) }

  return (
    <section className="ushqn-card overflow-hidden">
      <div
        className="relative h-40 w-full bg-cover bg-center sm:h-48"
        style={bannerStyle}
      >
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent"
          aria-hidden
        />
      </div>
      <div className="relative px-5 pb-5 pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="-mt-12 shrink-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  loading="lazy"
                  className="h-28 w-28 rounded-full border-[4px] border-white object-cover shadow-md sm:h-[140px] sm:w-[140px]"
                  style={{ boxShadow: `0 0 0 2px ${accent}40, 0 8px 24px rgba(0,0,0,0.08)` }}
                />
              ) : (
                <div
                  className="flex h-28 w-28 items-center justify-center rounded-full border-[4px] border-white text-3xl font-extrabold text-white shadow-md sm:h-[140px] sm:w-[140px]"
                  style={{
                    background: `linear-gradient(145deg, ${accent}, ${accent}cc)`,
                    boxShadow: `0 0 0 2px ${accent}40`,
                  }}
                >
                  {profile.display_name.slice(0, 1).toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="min-w-0 pt-2 sm:ml-3 sm:pt-10">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ushqn-text)] sm:text-[1.75rem]">
                {profile.display_name}
              </h1>
              <p className="mt-0.5 text-sm text-[var(--color-ushqn-muted)]">
                {[profile.location, profile.school_or_org].filter(Boolean).join(' · ') ||
                  t('profileCard.addLocation')}
              </p>
              {profile.headline ? (
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-[var(--color-ushqn-text)]">
                  {profile.headline}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-md px-2.5 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: `${accent}18`, color: accent }}
                >
                  {t(roleKey)}
                </span>
                {typeof profile.profile_views === 'number' ? (
                  <span className="text-xs text-[var(--color-ushqn-muted)]">
                    {t('profileCard.views', { count: profile.profile_views })}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {onEdit ? (
            <div className="flex gap-2 sm:pt-6">
              {userId ? (
                <button
                  type="button"
                  onClick={copyLink}
                  title={t('publicProfile.shareLink')}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-ushqn-border)] bg-white text-[var(--color-ushqn-muted)] transition hover:border-[var(--color-ushqn-primary)] hover:text-[var(--color-ushqn-primary)]"
                >
                  <IconChain className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                style={{ backgroundColor: accent }}
              >
                <IconPencil className="h-4 w-4" />
                {t('profile.editProfile')}
              </button>
            </div>
          ) : null}
        </div>

        {profile.bio ? (
          <p className="mt-4 rounded-lg border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] px-4 py-3 text-sm leading-relaxed text-[var(--color-ushqn-text)]">
            {profile.bio}
          </p>
        ) : null}

        {socialLinks.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-ushqn-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ushqn-text)] transition hover:border-[var(--color-ushqn-primary)] hover:text-[var(--color-ushqn-primary)]"
              >
                <s.Icon className="h-3.5 w-3.5 opacity-80" />
                {s.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
