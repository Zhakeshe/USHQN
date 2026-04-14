import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS, kk, ru } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useConfirm } from '../lib/confirm'
import { getDateFnsLocale } from '../lib/dateLocale'
import { buildIcsEvent, downloadTextFile, googleCalendarEventUrl } from '../lib/calendarLinks'
import { AppPageMeta } from '../components/AppPageMeta'

type Form = {
  title: string
  description?: string
  starts_at: string
  ends_at?: string
  location_text?: string
  is_online: boolean
  is_public: boolean
}

type EventRow = { id: string; title: string; description: string | null; starts_at: string; ends_at: string | null; owner_id: string; location_text: string | null; is_online: boolean; is_public: boolean }

export function CalendarPage() {
  const { t, i18n } = useTranslation()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [calView, setCalView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null)
  const [showForm, setShowForm] = useState(false)

  const culture = i18n.language.startsWith('en') ? 'en-US' : i18n.language.startsWith('kk') ? 'kk' : 'ru'
  const dfLocale = getDateFnsLocale(i18n.language)

  const localizer = useMemo(
    () =>
      dateFnsLocalizer({
        format,
        parse,
        startOfWeek: (d: Date) => startOfWeek(d, { locale: dfLocale }),
        getDay,
        locales: { ru, 'en-US': enUS, kk },
      }),
    [dfLocale],
  )

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, t('validation.titleRequired')),
        description: z.string().optional(),
        starts_at: z.string().min(1, t('validation.timeRequired')),
        ends_at: z.string().optional(),
        location_text: z.string().optional(),
        is_online: z.boolean(),
        is_public: z.boolean(),
      }),
    [t],
  )

  const eventsQuery = useQuery({
    queryKey: ['events', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*').order('starts_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as EventRow[]
    },
  })

  const rsvpsQuery = useQuery({
    queryKey: ['my-rsvps', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase.from('event_rsvps').select('event_id,status').eq('user_id', userId!)
      return new Map((data ?? []).map((r) => [r.event_id, r.status as string]))
    },
  })

  const calendarEvents = useMemo(() =>
    (eventsQuery.data ?? []).map((e) => ({
      id: e.id, title: e.title,
      start: new Date(e.starts_at),
      end: e.ends_at ? new Date(e.ends_at) : new Date(new Date(e.starts_at).getTime() + 60 * 60 * 1000),
      resource: e,
    })), [eventsQuery.data])

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', starts_at: '', ends_at: '', location_text: '', is_online: false, is_public: true },
  })

  useEffect(() => {
    void form.clearErrors()
    void form.trigger()
  }, [schema, form])

  const create = useMutation({
    mutationFn: async (values: Form) => {
      const { error } = await supabase.from('events').insert({
        owner_id: userId!, title: values.title, description: values.description || null,
        starts_at: new Date(values.starts_at).toISOString(),
        ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
        location_text: values.location_text || null,
        is_online: values.is_online, is_public: values.is_public,
      })
      if (error) throw error
    },
    onSuccess: () => {
      form.reset({ title: '', description: '', starts_at: '', ends_at: '', location_text: '', is_online: false, is_public: true })
      setShowForm(false)
      void qc.invalidateQueries({ queryKey: ['events', userId] })
      toast(t('calendar.toastAdded'))
    },
    onError: () => toast(t('calendar.toastSaveErr'), 'error'),
  })

  async function removeEvent(id: string, title: string) {
    const ok = await confirm({
      title: t('calendar.confirmDeleteEvent'),
      description: `«${title}»`,
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    await supabase.from('events').delete().eq('id', id)
    void qc.invalidateQueries({ queryKey: ['events', userId] })
    toast(t('calendar.toastEventRemoved'), 'info')
  }

  async function rsvp(eventId: string, status: 'going' | 'maybe' | 'not_going') {
    if (!userId) return
    const current = rsvpsQuery.data?.get(eventId)
    if (current === status) {
      await supabase.from('event_rsvps').delete().eq('user_id', userId).eq('event_id', eventId)
      toast(t('calendar.rsvpCancel'), 'info')
    } else {
      await supabase.from('event_rsvps').upsert({ user_id: userId, event_id: eventId, status })
      const labels = { going: t('calendar.rsvpGoing'), maybe: t('calendar.rsvpMaybe'), not_going: t('calendar.rsvpNotGoing') }
      toast(labels[status])
    }
    void qc.invalidateQueries({ queryKey: ['my-rsvps', userId] })
  }

  const calMessages = useMemo(
    () => ({
      today: t('calendar.calToday'),
      previous: t('calendar.calPrev'),
      next: t('calendar.calNext'),
      month: t('calendar.calMonth'),
      week: t('calendar.calWeek'),
      day: t('calendar.calDay'),
      agenda: t('calendar.calAgenda'),
      date: t('calendar.calDate'),
      time: t('calendar.calTime'),
      event: t('calendar.calEvent'),
      noEventsInRange: t('calendar.calNoEvents'),
    }),
    [t],
  )

  const upcomingEvents = useMemo(() =>
    (eventsQuery.data ?? []).filter((e) => new Date(e.starts_at) >= new Date()).slice(0, 5),
    [eventsQuery.data])

  return (
    <div className="space-y-5">
      <AppPageMeta title={`${t('nav.calendar')} · USHQN`} />
      {/* Header */}
      <div className="ushqn-card overflow-hidden p-0">
        <div className="bg-gradient-to-r from-[#00875A] to-[#36B37E] px-6 py-7 text-white">
          <h1 className="text-2xl font-extrabold">{t('calendar.pageHeader')}</h1>
          <p className="mt-1 text-sm text-green-100">{t('calendar.pageSub')}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center backdrop-blur">
              <p className="text-xl font-black">{eventsQuery.data?.length ?? 0}</p>
              <p className="text-[10px] text-green-100">{t('calendar.statTotalEvents')}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center backdrop-blur">
              <p className="text-xl font-black">{upcomingEvents.length}</p>
              <p className="text-[10px] text-green-100">{t('calendar.statUpcoming')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add event */}
      {!showForm ? (
        <button type="button" onClick={() => setShowForm(true)}
          className="ushqn-card flex w-full items-center justify-center gap-2 py-4 text-sm font-bold text-[#00875A] hover:bg-[#E3FCEF]/40 transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clipRule="evenodd"/>
          </svg>
          {t('calendar.add')}
        </button>
      ) : (
        <div className="ushqn-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#172B4D]">{t('calendar.newEventTitle')}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-[#6B778C]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
              </svg>
            </button>
          </div>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
            <div className="sm:col-span-2">
              <label className="ushqn-label">{t('calendar.titleLabel')}</label>
              <input className="ushqn-input" placeholder={t('calendar.titlePh')} {...form.register('title')} />
              {form.formState.errors.title ? <p className="mt-1 text-xs text-red-600">{form.formState.errors.title.message}</p> : null}
            </div>
            <div>
              <label className="ushqn-label">{t('calendar.startsLabel')}</label>
              <input type="datetime-local" className="ushqn-input" {...form.register('starts_at')} />
              {form.formState.errors.starts_at ? <p className="mt-1 text-xs text-red-600">{form.formState.errors.starts_at.message}</p> : null}
            </div>
            <div>
              <label className="ushqn-label">{t('calendar.endsLabel')}</label>
              <input type="datetime-local" className="ushqn-input" {...form.register('ends_at')} />
            </div>
            <div className="sm:col-span-2">
              <label className="ushqn-label">{t('calendar.locationLabel')}</label>
              <input className="ushqn-input" placeholder={t('calendar.locationPh')} {...form.register('location_text')} />
            </div>
            <div className="sm:col-span-2">
              <label className="ushqn-label">{t('calendar.descLabel')}</label>
              <textarea rows={3} className="ushqn-input resize-none" {...form.register('description')} />
            </div>
            <div className="flex flex-wrap gap-4 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-[#00875A]" {...form.register('is_online')} />
                {t('calendar.onlineCheck')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-[#00875A]" {...form.register('is_public')} />
                {t('calendar.publicCheck')}
              </label>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" disabled={create.isPending}
                className="inline-flex items-center justify-center rounded-lg bg-[#00875A] px-6 py-2 text-sm font-bold text-white hover:bg-[#006644] transition disabled:opacity-50">
                {create.isPending ? t('calendar.savePending') : t('calendar.saveBtn')}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-[#DFE1E6] px-4 py-2 text-sm font-semibold text-[#6B778C] hover:bg-[#F4F5F7] transition">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calendar */}
      <div className="ushqn-card p-4">
        <Calendar
          culture={culture}
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start" endAccessor="end" style={{ height: 520 }}
          view={calView} onView={setCalView} date={date} onNavigate={setDate}
          // @ts-expect-error react-big-calendar types incomplete
          onSelectEvent={(e: { resource: EventRow }) => setSelectedEvent(e.resource)}
          messages={calMessages}
          eventPropGetter={() => ({
            style: { backgroundColor: '#0052CC', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600' }
          })}
        />
      </div>

      {/* Upcoming events list */}
      {upcomingEvents.length > 0 ? (
        <div className="ushqn-card p-5">
          <h2 className="ushqn-section-title">{t('calendar.upcomingSection')}</h2>
          <div className="space-y-3">
            {upcomingEvents.map((e) => {
              const myRsvp = rsvpsQuery.data?.get(e.id)
              return (
                <div key={e.id} className="flex items-start gap-4 rounded-xl border border-[#eef1f4] p-4 hover:border-[#0052CC]/20 transition">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#E3FCEF] to-[#DEEBFF] text-center">
                    <span className="text-xs font-bold text-[#00875A]">{format(new Date(e.starts_at), 'dd', { locale: dfLocale })}</span>
                    <span className="text-[9px] font-semibold uppercase text-[#6B778C]">{format(new Date(e.starts_at), 'MMM', { locale: dfLocale })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#172B4D]">{e.title}</p>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[#6B778C]">
                      <span>{format(new Date(e.starts_at), 'HH:mm')}</span>
                      {e.is_online ? <span className="rounded-full bg-[#DEEBFF] px-1.5 font-semibold text-[#0052CC]">{t('calendar.onlineCheck')}</span> : null}
                      {e.location_text ? <span>📍 {e.location_text}</span> : null}
                    </div>
                    {/* RSVP */}
                    {e.owner_id !== userId ? (
                      <div className="mt-2 flex gap-2">
                        {(['going', 'maybe', 'not_going'] as const).map((s) => {
                          const labels = { going: t('calendar.rsvpGoing'), maybe: t('calendar.rsvpMaybeShort'), not_going: t('calendar.rsvpNotGoing') }
                          return (
                            <button key={s} type="button" onClick={() => void rsvp(e.id, s)}
                              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition ${
                                myRsvp === s ? 'border-[#0052CC] bg-[#0052CC] text-white' : 'border-[#DFE1E6] text-[#6B778C] hover:border-[#0052CC]'
                              }`}>
                              {labels[s]}
                            </button>
                          )
                        })}
                      </div>
                    ) : <span className="mt-1 inline-block text-[10px] text-[#0052CC] font-semibold">{t('calendar.yourEvent')}</span>}
                  </div>
                  {e.owner_id === userId ? (
                    <button type="button" onClick={() => void removeEvent(e.id, e.title)}
                      className="shrink-0 rounded-md border border-red-100 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                      ✕
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Event detail modal */}
      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(23,43,77,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedEvent(null)}>
          <div className="ushqn-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold text-[#172B4D]">{selectedEvent.title}</h3>
              <button type="button" onClick={() => setSelectedEvent(null)} className="text-[#6B778C] hover:text-[#172B4D]">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
                </svg>
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[#6B778C]">
              <p>
                📅 {format(new Date(selectedEvent.starts_at), 'PPp', { locale: dfLocale })}
              </p>
              {selectedEvent.ends_at ? (
                <p>
                  {t('calendar.modalEnds')} {format(new Date(selectedEvent.ends_at), 'PPp', { locale: dfLocale })}
                </p>
              ) : null}
              <p className="text-xs text-[#97A0AF]">
                {t('calendar.timezoneHint', { tz: Intl.DateTimeFormat().resolvedOptions().timeZone })}
              </p>
              {selectedEvent.location_text ? <p>📍 {selectedEvent.location_text}</p> : null}
              {selectedEvent.is_online ? <p>{t('calendar.modalOnline')}</p> : null}
              {selectedEvent.description ? <p className="mt-2 text-[#172B4D]">{selectedEvent.description}</p> : null}
            </div>
            {(() => {
              const start = new Date(selectedEvent.starts_at)
              const end = selectedEvent.ends_at
                ? new Date(selectedEvent.ends_at)
                : new Date(start.getTime() + 60 * 60 * 1000)
              const gcal = googleCalendarEventUrl({
                title: selectedEvent.title,
                details: selectedEvent.description ?? undefined,
                start,
                end,
                location: selectedEvent.location_text ?? undefined,
              })
              const ics = buildIcsEvent({
                uid: `ushqn-${selectedEvent.id}@local`,
                title: selectedEvent.title,
                description: selectedEvent.description ?? undefined,
                start,
                end,
                location: selectedEvent.location_text ?? undefined,
              })
              return (
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={gcal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-[#DFE1E6] px-3 py-2 text-xs font-semibold text-[#0052CC] hover:bg-[#DEEBFF]"
                  >
                    {t('calendar.calGoogle')}
                  </a>
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-[#DFE1E6] px-3 py-2 text-xs font-semibold text-[#172B4D] hover:bg-[#F4F5F7]"
                    onClick={() =>
                      downloadTextFile(
                        `${selectedEvent.title.replace(/\s+/g, '_').slice(0, 40) || 'event'}.ics`,
                        ics,
                      )
                    }
                  >
                    {t('calendar.calIcs')}
                  </button>
                </div>
              )
            })()}
            {selectedEvent.owner_id !== userId ? (
              <div className="mt-5 flex gap-2">
                {(['going', 'maybe', 'not_going'] as const).map((s) => {
                  const myRsvp = rsvpsQuery.data?.get(selectedEvent.id)
                  const labels = { going: t('calendar.rsvpGoing'), maybe: t('calendar.rsvpMaybe'), not_going: t('calendar.rsvpNotGoing') }
                  return (
                    <button key={s} type="button" onClick={() => void rsvp(selectedEvent.id, s)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${
                        myRsvp === s ? 'border-[#0052CC] bg-[#0052CC] text-white' : 'border-[#DFE1E6] text-[#172B4D] hover:border-[#0052CC]'
                      }`}>
                      {labels[s]}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
