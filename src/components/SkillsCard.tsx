import { useState } from 'react'

type Props = {
  skills: string[]
  newSkill?: string
  onNewSkillChange?: (v: string) => void
  onAdd: (skill: string) => void
  onRemove: (skill: string) => void
  readOnly?: boolean
}

export function SkillsCard({ skills, onAdd, onRemove, readOnly }: Props) {
  const [input, setInput] = useState('')

  function handleAdd() {
    const s = input.trim()
    if (!s) return
    onAdd(s)
    setInput('')
  }

  return (
    <section className="ushqn-card p-5">
      <div className="ushqn-section-header">
        <h2 className="ushqn-section-title">🛠 Навыки</h2>
        {!readOnly ? (
          <span className="text-xs text-[#6B778C]">{skills.length} навыков</span>
        ) : null}
      </div>

      {skills.length === 0 && readOnly ? (
        <p className="text-sm text-[#6B778C]">Навыки не указаны.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span
            key={s}
            className="group inline-flex items-center gap-1.5 rounded-full bg-[#DEEBFF] px-3.5 py-1.5 text-sm font-semibold text-[#0052CC] transition-colors hover:bg-[#b3d4ff]"
          >
            {s}
            {!readOnly ? (
              <button
                type="button"
                aria-label={`Удалить ${s}`}
                className="flex h-4 w-4 items-center justify-center rounded-full text-[#0052CC]/60 hover:bg-[#0052CC] hover:text-white transition-all"
                onClick={() => onRemove(s)}
              >
                <svg viewBox="0 0 10 10" fill="currentColor" className="h-2.5 w-2.5">
                  <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
              </button>
            ) : null}
          </span>
        ))}
      </div>

      {!readOnly ? (
        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            placeholder="Новый навык (напр. Python)"
            className="ushqn-input max-w-xs"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="ushqn-btn-primary"
          >
            + Добавить
          </button>
        </div>
      ) : null}
    </section>
  )
}
