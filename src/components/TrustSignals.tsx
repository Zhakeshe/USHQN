import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { getDateFnsLocale } from '../lib/dateLocale'
import { parsePortfolioLinks } from '../lib/portfolio'

type Props = {
  createdAt: string
  orgVerified: boolean
  headline: string | null
  location: string | null
  schoolOrOrg: string | null
  bio: string | null
  avatarUrl: string | null
  skillsCount: number
  portfolioRaw: unknown
}

function profileStrengthPct(p: Omit<Props, 'createdAt' | 'orgVerified'>): number {
  const pts =
    (p.headline?.trim() ? 1 : 0) +
    (p.location?.trim() ? 1 : 0) +
    (p.schoolOrOrg?.trim() ? 1 : 0) +
    ((p.bio?.trim().length ?? 0) >= 20 ? 1 : 0) +
    (p.avatarUrl ? 1 : 0) +
    (p.skillsCount > 0 ? 1 : 0) +
    (parsePortfolioLinks(p.portfolioRaw).length > 0 ? 1 : 0)
  const max = 7
  return Math.min(100, Math.round((pts / max) * 100))
}

export function TrustSignals(props: Props) {
  const { t, i18n } = useTranslation()
  const pct = profileStrengthPct(props)
  const locale = getDateFnsLocale(i18n.language)
  let memberSince = '—'
  try {
    memberSince = format(new Date(props.createdAt), 'PP', { locale })
  } catch {
    memberSince = '—'
  }

  return (
    <section className="ushqn-card p-4 text-sm">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[#6B778C]">{t('trust.signals.title')}</h3>
      <ul className="mt-3 space-y-2 text-[#172B4D]">
        <li className="flex flex-wrap items-center gap-2">
          <span>{props.orgVerified ? '✓' : '○'}</span>
          <span>{props.orgVerified ? t('trust.signals.orgVerified') : t('trust.signals.orgNotVerified')}</span>
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <span>📊</span>
          <span>{t('trust.signals.profileFill', { pct })}</span>
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <span>📅</span>
          <span>{t('trust.signals.memberSince', { date: memberSince })}</span>
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <span>🛡️</span>
          <Link to="/settings" className="font-semibold text-[#0052CC] hover:underline">
            {t('trust.signals.reportHint')}
          </Link>
        </li>
      </ul>
    </section>
  )
}
