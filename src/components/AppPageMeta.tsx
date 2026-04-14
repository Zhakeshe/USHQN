import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

/** Sets `<title>` for in-app routes (HelmetProvider is in main.tsx). */
export function AppPageMeta({ title }: { title: string }) {
  const { t } = useTranslation()
  return (
    <Helmet>
      <title>{`${title}${t('brand.titleSuffix')}`}</title>
    </Helmet>
  )
}
