function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function googleCalendarEventUrl(opts: {
  title: string
  details?: string
  start: Date
  end: Date
  location?: string
}) {
  const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d{3}/g, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${fmt(opts.start)}/${fmt(opts.end)}`,
    details: opts.details ?? '',
    location: opts.location ?? '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildIcsEvent(opts: {
  uid: string
  title: string
  description?: string
  start: Date
  end: Date
  location?: string
}) {
  const esc = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//USHQN//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(opts.start)}`,
    `DTEND:${icsDate(opts.end)}`,
    `SUMMARY:${esc(opts.title)}`,
  ]
  if (opts.description) lines.push(`DESCRIPTION:${esc(opts.description)}`)
  if (opts.location) lines.push(`LOCATION:${esc(opts.location)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadTextFile(filename: string, text: string, mime = 'text/calendar;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
