import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type Props<T> = {
  query: Pick<UseQueryResult<T, Error>, 'isPending' | 'isError' | 'error' | 'refetch'>
  children: ReactNode
  skeleton?: ReactNode
}

export function QueryState<T>({ query, children, skeleton }: Props<T>) {
  const { t } = useTranslation()
  if (query.isPending) {
    return <>{skeleton ?? <div className="ushqn-card animate-pulse h-24 rounded-xl" />}</>
  }
  if (query.isError) {
    return (
      <div className="ushqn-card flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm font-medium text-[#172B4D]">{t('ui.loadError')}</p>
        {query.error?.message ? (
          <p className="max-w-md text-xs text-[#97A0AF]">{query.error.message}</p>
        ) : null}
        <button
          type="button"
          className="ushqn-btn-primary px-5 py-2 text-sm"
          onClick={() => void query.refetch()}
        >
          {t('ui.retry')}
        </button>
      </div>
    )
  }
  return <>{children}</>
}
