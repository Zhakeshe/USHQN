import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/* Hook is intentionally exported alongside ToastProvider (context module). */
/* eslint-disable react-refresh/only-export-components */

type ToastKind = 'success' | 'error' | 'info' | 'warning'

type Toast = {
  id: string
  message: string
  kind: ToastKind
}

type ToastCtx = {
  toast: (message: string, kind?: ToastKind) => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {} })

export function useToast() {
  return useContext(Ctx)
}

const ICONS: Record<ToastKind, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
}

const COLORS: Record<ToastKind, string> = {
  success: 'border-l-[#36B37E] bg-white',
  error: 'border-l-[#FF5630] bg-white',
  info: 'border-l-[#0052CC] bg-white',
  warning: 'border-l-[#FF8B00] bg-white',
}

function ToastItem({ t, onRemove }: { t: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(t.id), 300)
    }, 3500)
    return () => clearTimeout(timer)
  }, [t.id, onRemove])

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border-l-4 shadow-lg px-4 py-3 min-w-[280px] max-w-[360px] transition-all duration-300 ${COLORS[t.kind]} ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      }`}
    >
      <span className="text-lg leading-none mt-0.5">{ICONS[t.kind]}</span>
      <p className="flex-1 text-sm font-semibold text-[#172B4D] leading-snug">{t.message}</p>
      <button
        type="button"
        onClick={() => { setVisible(false); setTimeout(() => onRemove(t.id), 300) }}
        className="shrink-0 text-[#97A0AF] hover:text-[#6B778C] transition"
      >
        <svg viewBox="0 0 14 14" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M1.5 1.5 12.5 12.5M12.5 1.5 1.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = `toast-${++counterRef.current}`
    setToasts((prev) => [...prev.slice(-4), { id, message, kind }])
  }, [])

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 right-4 z-[9999] flex flex-col-reverse gap-2 sm:bottom-6">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onRemove={remove} />
        ))}
      </div>
    </Ctx.Provider>
  )
}
