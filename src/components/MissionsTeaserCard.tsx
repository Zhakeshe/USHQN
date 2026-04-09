import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function MissionsTeaserCard() {
  const { t } = useTranslation()
  const rows = [
    { to: '/achievements', k: 'a' as const },
    { to: '/jobs', k: 'b' as const },
    { to: '/people', k: 'c' as const },
  ]
  return (
    <section className="ushqn-card p-5">
      <div className="ushqn-section-header">
        <h2 className="ushqn-section-title">{t('growth.missions.title')}</h2>
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#97A0AF]">{t('growth.missions.badge')}</span>
      </div>
      <p className="mt-1 text-sm text-[#6B778C]">{t('growth.missions.subtitle')}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.k}>
            <Link className="font-semibold text-[#0052CC] hover:underline" to={r.to}>
              {t(`growth.missions.row${r.k}`)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
