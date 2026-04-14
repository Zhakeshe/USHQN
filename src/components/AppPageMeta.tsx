import { Helmet } from 'react-helmet-async'

/** Sets `<title>` for in-app routes (HelmetProvider is in main.tsx). */
export function AppPageMeta({ title }: { title: string }) {
  return (
    <Helmet>
      <title>{title}</title>
    </Helmet>
  )
}
