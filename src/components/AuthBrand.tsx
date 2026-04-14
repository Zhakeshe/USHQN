import type { ReactNode } from 'react'

/** Shared logo block for login / register — visually aligned with the landing hero. */
export function AuthBrand({ slogan, extra }: { slogan?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-6 text-center">
      <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center">
        <span
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0052CC] to-[#2684FF] opacity-40 blur-xl motion-safe:animate-pulse"
          aria-hidden
        />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0052CC] to-[#2684FF] text-2xl font-black text-white shadow-xl shadow-blue-500/35 ring-1 ring-white/30">
          U
        </div>
      </div>
      <h1
        className="text-[1.65rem] font-black tracking-tight sm:text-3xl"
        style={{
          background: 'linear-gradient(135deg, #0052CC 0%, #2684FF 45%, #00b8d9 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        USHQN
      </h1>
      {slogan ? <div className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">{slogan}</div> : null}
      {extra}
    </div>
  )
}
