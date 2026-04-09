declare module 'react-big-calendar' {
  import type { CSSProperties, ComponentType } from 'react'

  export type View = 'month' | 'week' | 'work_week' | 'day' | 'agenda'

  export type Localizer = Record<string, unknown>

  export function dateFnsLocalizer(args: Record<string, unknown>): Localizer

  export interface CalendarProps<TEvent extends object = Record<string, unknown>> {
    localizer: Localizer
    events: TEvent[]
    startAccessor: string
    endAccessor: string
    style?: CSSProperties
    culture?: string
    view?: View
    onView?: (view: View) => void
    date?: Date
    onNavigate?: (date: Date) => void
    messages?: Record<string, string>
  }

  export const Calendar: ComponentType<CalendarProps>
}
