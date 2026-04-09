const CATEGORY_ICONS: Record<string, string> = {
  Программирование: '💻',
  Робототехника: '🤖',
  Спорт: '⚽',
  Дебаты: '🎤',
  Музыка: '🎵',
  Математика: '📐',
  Физика: '🔬',
  Химия: '⚗️',
  Дизайн: '🎨',
  Предпринимательство: '🚀',
}

type Row = {
  category_label: string
  points: number
}

type Props = {
  rows: Row[]
  maxScale?: number
}

export function CategoryScores({ rows, maxScale = 100 }: Props) {
  if (!rows.length) {
    return (
      <section className="ushqn-card p-5">
        <div className="ushqn-section-header">
          <h2 className="ushqn-section-title">🏅 Рейтинг по направлениям</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <span className="text-4xl">🏆</span>
          <p className="mt-2 text-sm font-medium text-[#172B4D]">Нет очков пока</p>
          <p className="mt-1 text-xs text-[#6B778C]">
            Добавьте достижения — очки по категориям появятся здесь.
          </p>
        </div>
      </section>
    )
  }

  const top = Math.max(maxScale, ...rows.map((r) => r.points), 1)
  const sortedRows = [...rows].sort((a, b) => b.points - a.points)

  return (
    <section className="ushqn-card p-5">
      <div className="ushqn-section-header">
        <h2 className="ushqn-section-title">🏅 Рейтинг по направлениям</h2>
        <span className="ushqn-badge">
          {rows.reduce((sum, r) => sum + r.points, 0)} очков
        </span>
      </div>
      <ul className="space-y-4">
        {sortedRows.map((r, idx) => {
          const pct = Math.min(100, (r.points / top) * 100)
          const icon = CATEGORY_ICONS[r.category_label] ?? '⭐'
          const gradients = [
            'from-[#0052CC] to-[#2684FF]',
            'from-[#00875A] to-[#36B37E]',
            'from-[#6554C0] to-[#8777D9]',
            'from-[#FF5630] to-[#FF8B00]',
            'from-[#00B8D9] to-[#79E2F2]',
          ]
          const grad = gradients[idx % gradients.length]
          return (
            <li key={r.category_label}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[#172B4D]">
                  <span>{icon}</span>
                  {r.category_label}
                </span>
                <span className="rounded-full bg-[#F4F5F7] px-2.5 py-0.5 text-xs font-bold text-[#172B4D]">
                  {r.points} очк.
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#F4F5F7]">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
