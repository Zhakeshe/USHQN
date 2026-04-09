import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

/* Hook is intentionally exported alongside ConfirmProvider (context module). */
/* eslint-disable react-refresh/only-export-components */

type ConfirmOpts = {
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
}

type ConfirmCtx = {
  confirm: (opts: ConfirmOpts) => Promise<boolean>
}

const Ctx = createContext<ConfirmCtx>({ confirm: async () => false })

export function useConfirm() {
  return useContext(Ctx)
}

type Pending = ConfirmOpts & { resolve: (v: boolean) => void }

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback((opts: ConfirmOpts): Promise<boolean> => {
    return new Promise((resolve) => {
      setPending({ ...opts, resolve })
    })
  }, [])

  function handle(value: boolean) {
    pending?.resolve(value)
    setPending(null)
  }

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      {pending ? (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          style={{ background: 'rgba(23,43,77,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div className="ushqn-card w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-[#172B4D]">{pending.title}</h3>
            {pending.description ? (
              <p className="mt-2 text-sm text-[#6B778C]">{pending.description}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => handle(false)}
                className="rounded-lg border border-[#DFE1E6] px-4 py-2 text-sm font-semibold text-[#172B4D] hover:bg-[#F4F5F7] transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handle(true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                  pending.danger
                    ? 'bg-[#FF5630] hover:bg-[#bf2600]'
                    : 'bg-[#0052CC] hover:bg-[#0747A6]'
                }`}
              >
                {pending.confirmLabel ?? 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  )
}
