'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Award,
  Building2,
  Cake,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Sun,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

import { Badge, DataTable, Drawer, EmptyState, Field, SectionCard, StatTile, TabBar, fieldClass } from './ui'

type EventKind = 'holiday' | 'event' | 'birthday' | 'anniversary' | 'company_anniversary'

type CalendarEvent = {
  _id: string
  kind: EventKind
  eventKind?: string
  date: string
  title: string
  subtitle?: string
  description?: string
  paid?: boolean
  years?: number
  employeeId?: string
  isSelf?: boolean
  editable?: boolean
  startDate?: string
  endDate?: string
  allDay?: boolean
  startTime?: string
  endTime?: string
  spansMultipleDays?: boolean
  location?: string
}

type Feed = {
  from: string
  to: string
  settings: { showBirthdays: boolean; showAnniversaries: boolean; showLeave: boolean }
  counts: Partial<Record<EventKind, number>>
  upcoming: CalendarEvent[]
  events: CalendarEvent[]
}

type KindMeta = {
  label: string
  tone: 'positive' | 'warning' | 'danger' | 'info' | 'neutral'
  /** Solid swatch, used for the dots inside month cells. */
  dot: string
  /** Soft background and matching text colour for the icon chip. */
  chip: string
  icon: LucideIcon
  /** One line explaining what this type is, shown in the filter row. */
  hint: string
}

const KIND_META: Record<EventKind, KindMeta> = {
  holiday: {
    label: 'Holiday', tone: 'danger', dot: 'bg-danger', chip: 'bg-danger-soft text-danger', icon: Sun,
    hint: 'Office closed. Affects attendance and payable days.',
  },
  event: {
    label: 'Event', tone: 'info', dot: 'bg-primary-500', chip: 'bg-primary-50 text-primary-700', icon: CalendarRange,
    hint: 'Meetings, training, and deadlines you add.',
  },
  birthday: {
    label: 'Birthday', tone: 'warning', dot: 'bg-warning', chip: 'bg-warning-soft text-warning', icon: Cake,
    hint: 'From each employee\'s date of birth.',
  },
  anniversary: {
    label: 'Work anniversary', tone: 'positive', dot: 'bg-success', chip: 'bg-success-soft text-success', icon: Award,
    hint: 'From each employee\'s joining date.',
  },
  company_anniversary: {
    label: 'Company', tone: 'info', dot: 'bg-primary-700', chip: 'bg-primary-100 text-primary-800', icon: Building2,
    hint: 'The date your company was founded.',
  },
}

const FALLBACK_META: KindMeta = {
  label: 'Update', tone: 'neutral', dot: 'bg-line-strong', chip: 'bg-surface-hover text-ink-soft', icon: CalendarDays,
  hint: 'Other calendar entries.',
}

/**
 * Never index KIND_META directly. The feed can gain new kinds server-side, and a
 * missing entry threw, which blanked the whole page.
 */
function metaFor(kind: string): KindMeta {
  return KIND_META[kind as EventKind] || FALLBACK_META
}

const KIND_ORDER: EventKind[] = ['holiday', 'event', 'birthday', 'anniversary', 'company_anniversary']
const EVENT_KINDS = ['company', 'meeting', 'training', 'deadline', 'celebration', 'other'] as const
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function monthBounds(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1))
  const last = new Date(Date.UTC(year, month + 1, 0))
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) }
}

/** Monday-first grid covering the whole month plus padding days. */
function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const start = new Date(first)
  start.setUTCDate(start.getUTCDate() - offset)
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setUTCDate(day.getUTCDate() + index)
    const weekday = day.getUTCDay()
    return {
      key: day.toISOString().slice(0, 10),
      inMonth: day.getUTCMonth() === month,
      day: day.getUTCDate(),
      weekend: weekday === 0 || weekday === 6,
    }
  })
}

function formatLong(key: string) {
  if (!key) return '-'
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function formatShort(key: string) {
  if (!key) return '-'
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

function daysFromToday(key: string) {
  return Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${todayKey()}T00:00:00Z`)) / 86400000)
}

function relativeDays(key: string) {
  const diff = daysFromToday(key)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)} days ago`
  return `in ${diff} days`
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function entries(count: number) {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`
}

/**
 * A plain sentence saying what the entry means, so nobody has to work it out
 * from a colour. Falls back to whatever detail the feed provided.
 */
function describe(event: CalendarEvent): string {
  switch (event.kind) {
    case 'holiday':
      return event.paid === false ? 'Unpaid holiday, reduces payable days' : 'Paid holiday, office closed'
    case 'birthday':
      return event.subtitle || 'Birthday'
    case 'anniversary':
      return event.years
        ? `${plural(event.years, 'year')} with the company${event.subtitle ? ` · ${event.subtitle}` : ''}`
        : event.subtitle || 'Work anniversary'
    case 'company_anniversary':
      return event.years ? `${plural(event.years, 'year')} since the company was founded` : 'Company anniversary'
    default: {
      const type = event.eventKind ? event.eventKind.charAt(0).toUpperCase() + event.eventKind.slice(1) : 'Company event'
      const span = event.spansMultipleDays && event.startDate && event.endDate
        ? `${formatShort(event.startDate)} to ${formatShort(event.endDate)}`
        : ''
      return [type, span, event.description || ''].filter(Boolean).join(' · ')
    }
  }
}

function KindIcon({ kind, size = 'sm' }: { kind: string; size?: 'sm' | 'md' }) {
  const meta = metaFor(kind)
  const Icon = meta.icon
  const box = size === 'md' ? 'h-8 w-8' : 'h-6 w-6'
  const glyph = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  return (
    <span aria-hidden className={`flex ${box} shrink-0 items-center justify-center rounded-md ${meta.chip}`}>
      <Icon className={glyph} />
    </span>
  )
}

type Draft = {
  mode: 'event' | 'holiday'
  id: string
  title: string
  startDate: string
  endDate: string
  kind: string
  location: string
  description: string
  paid: boolean
}

const emptyDraft: Draft = {
  mode: 'event', id: '', title: '', startDate: todayKey(), endDate: '',
  kind: 'company', location: '', description: '', paid: true,
}

export default function CalendarWorkspace({
  apiRoot, token, canManage, onChanged,
}: {
  apiRoot: string
  token: string
  canManage: boolean
  onChanged: (message: string) => Promise<void> | void
}) {
  const now = new Date()
  const [year, setYear] = useState(now.getUTCFullYear())
  const [month, setMonth] = useState(now.getUTCMonth())
  const [feed, setFeed] = useState<Feed | null>(null)
  const [yearFeed, setYearFeed] = useState<Feed | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'month' | 'list' | 'settings'>('month')
  const [selectedDay, setSelectedDay] = useState(todayKey())
  const [draft, setDraft] = useState<Draft | null>(null)
  // Which types are switched off. Empty means everything is shown, which is the
  // state people expect when they land here.
  const [muted, setMuted] = useState<EventKind[]>([])

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<{ data: T; message?: string }> => {
    const response = await fetch(`${apiRoot}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.message || 'Request failed')
    return { data: (body?.data || {}) as T, message: body?.message }
  }, [apiRoot, token])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const bounds = monthBounds(year, month)
      // Two windows: the visible month for the grid, and the year for the list
      // and counters, so switching months does not refetch everything.
      const [monthData, yearData] = await Promise.all([
        request<Feed>(`/calendar?from=${bounds.from}&to=${bounds.to}`),
        request<Feed>(`/calendar?from=${year}-01-01&to=${year}-12-31`),
      ])
      setFeed(monthData.data)
      setYearFeed(yearData.data)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the calendar')
    } finally {
      setLoading(false)
    }
  }, [request, year, month])

  useEffect(() => { void load() }, [load])

  const isMuted = useCallback((kind: string) => muted.includes(kind as EventKind), [muted])
  const keep = useCallback((list: CalendarEvent[]) => list.filter((event) => !isMuted(event.kind)), [isMuted])

  function toggleKind(kind: EventKind) {
    setMuted((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]))
  }

  const monthEvents = useMemo(() => keep(feed?.events || []), [feed, keep])
  const yearEvents = useMemo(() => keep(yearFeed?.events || []), [yearFeed, keep])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of monthEvents) {
      const list = map.get(event.date) || []
      list.push(event)
      map.set(event.date, list)
    }
    return map
  }, [monthEvents])

  /** Entries per month of the selected year, so the month row shows where things are. */
  const perMonth = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => 0)
    for (const event of yearEvents) {
      const index = Number(event.date.slice(5, 7)) - 1
      if (index >= 0 && index < 12) totals[index] += 1
    }
    return totals
  }, [yearEvents])

  /** Counts per type across the year, shown on the filter chips. */
  const perKind = useMemo(() => {
    const totals = new Map<string, number>()
    for (const event of yearFeed?.events || []) totals.set(event.kind, (totals.get(event.kind) || 0) + 1)
    return totals
  }, [yearFeed])

  const upcoming = useMemo(() => {
    const rows = keep(yearFeed?.upcoming || [])
    const groups: Array<{ label: string; items: CalendarEvent[] }> = [
      { label: 'Next 7 days', items: [] },
      { label: 'Later this month', items: [] },
      { label: 'Later this year', items: [] },
    ]
    for (const event of rows) {
      const diff = daysFromToday(event.date)
      if (diff <= 7) groups[0].items.push(event)
      else if (diff <= 31) groups[1].items.push(event)
      else groups[2].items.push(event)
    }
    return groups.filter((group) => group.items.length > 0)
  }, [yearFeed, keep])

  const grid = useMemo(() => monthGrid(year, month), [year, month])
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const daySelection = byDay.get(selectedDay) || []

  function goToMonth(step: number) {
    const next = new Date(Date.UTC(year, month + step, 1))
    setYear(next.getUTCFullYear())
    setMonth(next.getUTCMonth())
  }

  function goToDay(step: number) {
    const next = new Date(`${selectedDay}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + step)
    const key = next.toISOString().slice(0, 10)
    setSelectedDay(key)
    if (next.getUTCFullYear() !== year || next.getUTCMonth() !== month) {
      setYear(next.getUTCFullYear())
      setMonth(next.getUTCMonth())
    }
  }

  function jumpTo(key: string) {
    if (!key) return
    const target = new Date(`${key}T00:00:00Z`)
    if (Number.isNaN(target.getTime())) return
    setYear(target.getUTCFullYear())
    setMonth(target.getUTCMonth())
    setSelectedDay(key)
  }

  function goToToday() {
    const today = new Date()
    setYear(today.getUTCFullYear())
    setMonth(today.getUTCMonth())
    setSelectedDay(todayKey())
  }

  function startCreate(mode: Draft['mode'], date = selectedDay) {
    setDraft({ ...emptyDraft, mode, startDate: date })
    setError('')
  }

  function startEdit(event: CalendarEvent) {
    if (event.kind === 'holiday') {
      setDraft({ ...emptyDraft, mode: 'holiday', id: event._id, title: event.title, startDate: event.date, paid: event.paid !== false })
      return
    }
    setDraft({
      mode: 'event', id: event._id, title: event.title,
      startDate: event.startDate || event.date, endDate: event.endDate && event.endDate !== event.startDate ? event.endDate : '',
      kind: event.eventKind || 'company', location: event.location || '', description: event.description || '', paid: true,
    })
  }

  async function save() {
    if (!draft) return
    if (!draft.title.trim()) { setError('A title is required'); return }
    setBusy('save')
    setError('')
    try {
      const isHoliday = draft.mode === 'holiday'
      const body = isHoliday
        ? { date: draft.startDate, name: draft.title.trim(), paid: draft.paid }
        : {
          title: draft.title.trim(),
          startDate: draft.startDate,
          endDate: draft.endDate || draft.startDate,
          kind: draft.kind,
          location: draft.location.trim(),
          description: draft.description.trim(),
        }
      const base = isHoliday ? '/calendar/holidays' : '/calendar/events'
      const { message } = await request<Record<string, unknown>>(draft.id ? `${base}/${draft.id}` : base, {
        method: draft.id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      setDraft(null)
      await load()
      await onChanged(message || 'Calendar updated')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save')
    } finally {
      setBusy('')
    }
  }

  async function remove(event: CalendarEvent) {
    const label = event.kind === 'holiday' ? 'holiday' : 'event'
    if (!window.confirm(`Remove this ${label} from the calendar?`)) return
    setBusy(`delete-${event._id}`)
    setError('')
    try {
      const base = event.kind === 'holiday' ? '/calendar/holidays' : '/calendar/events'
      const { message } = await request<Record<string, unknown>>(`${base}/${event._id}`, { method: 'DELETE' })
      await load()
      await onChanged(message || 'Removed')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove')
    } finally {
      setBusy('')
    }
  }

  async function toggleSetting(key: 'showBirthdays' | 'showAnniversaries', value: boolean) {
    setBusy(key)
    setError('')
    try {
      const { message } = await request<Record<string, unknown>>('/calendar/settings', {
        method: 'PATCH', body: JSON.stringify({ [key]: value }),
      })
      await load()
      await onChanged(message || 'Calendar settings saved')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save settings')
    } finally {
      setBusy('')
    }
  }

  if (loading && !feed) {
    return (
      <SectionCard title="Company calendar" description="Loading events">
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading
        </div>
      </SectionCard>
    )
  }

  const counts: Partial<Record<EventKind, number>> = yearFeed?.counts || {}

  /** One row of the day panel or the upcoming list. */
  function EventRow({ event, showDate }: { event: CalendarEvent; showDate?: boolean }) {
    const meta = metaFor(event.kind)
    return (
      <li className="flex items-start gap-2.5 px-3 py-2.5">
        <KindIcon kind={event.kind} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold leading-5 text-ink">{event.title}</p>
          <p className="mt-0.5 text-xs leading-5 text-ink-soft">
            <span className="font-semibold">{meta.label}</span>
            <span aria-hidden> · </span>
            {describe(event)}
          </p>
          {showDate && (
            <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
              {formatShort(event.date)} · {relativeDays(event.date)}
            </p>
          )}
          {event.location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
              <MapPin className="h-3 w-3" /> {event.location}
            </p>
          )}
        </div>
        {canManage && event.editable && (
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => startEdit(event)} aria-label={`Edit ${event.title}`} className="ghost-button p-1"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => void remove(event)} disabled={busy !== ''} aria-label={`Remove ${event.title}`} className="ghost-button p-1 text-danger disabled:opacity-40">
              {busy === `delete-${event._id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="animate-in rounded-lg border border-red-200 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={`Holidays in ${year}`} value={counts.holiday} icon={<Sun className="h-4 w-4" />} tone="danger" />
        <StatTile label={`Company events in ${year}`} value={counts.event} icon={<CalendarRange className="h-4 w-4" />} tone="info" />
        <StatTile label={`Birthdays in ${year}`} value={counts.birthday} icon={<Cake className="h-4 w-4" />} tone="warning" />
        <StatTile label={`Work anniversaries in ${year}`} value={counts.anniversary} icon={<Award className="h-4 w-4" />} tone="positive" />
      </div>

      <SectionCard
        title="Company calendar"
        description="Holidays, company events, birthdays, and work anniversaries in one shared view."
        icon={<CalendarDays className="h-4 w-4" />}
        actions={canManage ? (
          <>
            <button type="button" onClick={() => startCreate('holiday')} className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm">
              <Sun className="h-4 w-4" /> Add holiday
            </button>
            <button type="button" onClick={() => startCreate('event')} className="gradient-button flex items-center gap-2 rounded-md px-3.5 py-2 text-sm">
              <Plus className="h-4 w-4" /> Add event
            </button>
          </>
        ) : undefined}
      >
        <TabBar
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'month', label: 'Month' },
            { key: 'list', label: `All of ${year}`, count: yearEvents.length },
            ...(canManage ? [{ key: 'settings' as const, label: 'Settings' }] : []),
          ]}
        />

        {/* Year, month, and type filters sit above both views, so switching tabs
            keeps the same period and the same selection. */}
        <div className="mt-4 space-y-3 rounded-lg border border-line bg-surface-subtle p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-line bg-white p-0.5">
              <button type="button" aria-label="Previous year" onClick={() => setYear((value) => value - 1)} className="ghost-button p-1.5"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-[3.5rem] px-1 text-center text-sm font-bold tabular-nums text-ink">{year}</span>
              <button type="button" aria-label="Next year" onClick={() => setYear((value) => value + 1)} className="ghost-button p-1.5"><ChevronRight className="h-4 w-4" /></button>
            </div>

            <button type="button" onClick={goToToday} className="neu-button rounded-md px-3 py-1.5 text-xs font-semibold">Today</button>

            <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-ink-soft">
              Jump to date
              <input
                type="date" value={selectedDay} onChange={(event) => jumpTo(event.target.value)}
                className="rounded-md border border-line bg-white px-2 py-1.5 text-xs font-semibold tabular-nums text-ink"
              />
            </label>
          </div>

          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 lg:grid-cols-12">
            {MONTHS.map((label, index) => {
              const active = index === month
              const total = perMonth[index]
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setMonth(index)}
                  aria-pressed={active}
                  title={`${label} ${year} · ${entries(total)}`}
                  className={`flex flex-col items-center rounded-md px-1 py-1.5 text-xs font-semibold transition-colors ${
                    active ? 'bg-primary-500 text-white' : 'bg-white text-ink-soft hover:bg-surface-hover'
                  }`}
                >
                  <span>{label}</span>
                  <span className={`text-[10px] font-bold tabular-nums ${active ? 'text-white/80' : total ? 'text-primary-600' : 'text-ink-muted'}`}>
                    {total || '-'}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Show</span>
            {KIND_ORDER.map((kind) => {
              const meta = metaFor(kind)
              const Icon = meta.icon
              const on = !isMuted(kind)
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  aria-pressed={on}
                  title={meta.hint}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    on ? 'border-line-strong bg-white text-ink' : 'border-line bg-surface-hover text-ink-muted line-through'
                  }`}
                >
                  {on ? <Check className="h-3.5 w-3.5 text-success" /> : <Icon className="h-3.5 w-3.5" />}
                  <span className={`h-2 w-2 rounded-full ${on ? meta.dot : 'bg-line-strong'}`} />
                  {meta.label}
                  <span className="tabular-nums text-ink-muted">{perKind.get(kind) || 0}</span>
                </button>
              )
            })}
            {muted.length > 0 && (
              <button type="button" onClick={() => setMuted([])} className="ghost-button rounded-md px-2 py-1 text-xs font-semibold">Show all</button>
            )}
          </div>
        </div>

        {tab === 'month' && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-ink">{monthLabel}</p>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Previous month" onClick={() => goToMonth(-1)} className="ghost-button p-1.5"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" aria-label="Next month" onClick={() => goToMonth(1)} className="ghost-button p-1.5"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
                {WEEKDAYS.map((label) => (
                  <div key={label} className="bg-surface-subtle px-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                    {label}
                  </div>
                ))}
                {grid.map((cell) => {
                  const events = byDay.get(cell.key) || []
                  const isToday = cell.key === todayKey()
                  const isSelected = cell.key === selectedDay
                  const holiday = events.some((event) => event.kind === 'holiday')
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => setSelectedDay(cell.key)}
                      aria-current={isSelected ? 'date' : undefined}
                      aria-label={`${formatLong(cell.key)}. ${events.length ? entries(events.length) : 'Nothing scheduled'}`}
                      className={`min-h-[74px] p-1.5 text-left align-top transition-colors hover:bg-surface-hover ${
                        holiday ? 'bg-danger-soft' : cell.weekend ? 'bg-surface-subtle' : 'bg-white'
                      } ${cell.inMonth ? '' : 'opacity-45'} ${isSelected ? 'ring-2 ring-inset ring-primary-500' : ''}`}
                    >
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                        isToday ? 'bg-primary-500 text-white' : 'text-ink'
                      }`}>
                        {cell.day}
                      </span>
                      {/* Up to two named entries, then a count, so a busy day is
                          readable without opening it. */}
                      <span className="mt-1 block space-y-0.5">
                        {events.slice(0, 2).map((event) => (
                          <span key={event._id} className="flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${metaFor(event.kind).dot}`} />
                            <span className="min-w-0 truncate text-[10px] font-medium leading-4 text-ink-soft">{event.title}</span>
                          </span>
                        ))}
                        {events.length > 2 && (
                          <span className="block text-[10px] font-bold text-primary-600">+{events.length - 2} more</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>

              <p className="mt-2 text-xs text-ink-soft">
                Pick a day to see everything on it. Shaded days are weekends, and a red day is a holiday.
              </p>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="rounded-lg border border-line">
                <div className="border-b border-line bg-surface-subtle px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{formatLong(selectedDay)}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {relativeDays(selectedDay)}
                        <span aria-hidden> · </span>
                        {daySelection.length ? entries(daySelection.length) : 'nothing scheduled'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" aria-label="Previous day" onClick={() => goToDay(-1)} className="ghost-button p-1"><ChevronLeft className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Next day" onClick={() => goToDay(1)} className="ghost-button p-1"><ChevronRight className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  {canManage && (
                    <div className="mt-2 flex gap-1.5">
                      <button type="button" onClick={() => startCreate('event', selectedDay)} className="ghost-button flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold">
                        <Plus className="h-3.5 w-3.5" /> Event
                      </button>
                      <button type="button" onClick={() => startCreate('holiday', selectedDay)} className="ghost-button flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold">
                        <Sun className="h-3.5 w-3.5" /> Holiday
                      </button>
                    </div>
                  )}
                </div>
                {daySelection.length ? (
                  <ul className="divide-y divide-line">
                    {daySelection.map((event) => <EventRow key={event._id} event={event} />)}
                  </ul>
                ) : (
                  <div className="px-3 py-6 text-center">
                    <p className="text-xs font-semibold text-ink-soft">Nothing on this day</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {muted.length ? 'Some types are switched off above.' : canManage ? 'Add an event or a holiday using the buttons above.' : 'Nothing has been published for this day.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-line">
                <p className="border-b border-line bg-surface-subtle px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Coming up
                </p>
                {upcoming.length ? (
                  <div className="divide-y divide-line">
                    {upcoming.map((group) => (
                      <div key={group.label}>
                        <p className="bg-white px-3 pt-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary-600">
                          {group.label} <span className="text-ink-muted">({group.items.length})</span>
                        </p>
                        <ul className="divide-y divide-line">
                          {group.items.slice(0, 6).map((event) => (
                            <EventRow key={`${event._id}-${event.date}`} event={event} showDate />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-ink-soft">Nothing else scheduled this year</p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'list' && (
          <div className="mt-4">
            <DataTable
              headers={['Date', 'Type', 'What it is', 'Details', 'When', ...(canManage ? ['Actions'] : [])]}
              searchable
              searchPlaceholder="Search holidays, events, or people"
              defaultPageSize={25}
              empty={muted.length ? 'Nothing matches the types you have switched on' : `Nothing on the calendar for ${year}`}
              emptyHint="Add holidays and company events, or set employee dates of birth to see birthdays."
              rows={yearEvents.map((event) => [
                <span key={`${event._id}-d`} className="whitespace-nowrap tabular-nums">{formatShort(event.date)}</span>,
                <span key={`${event._id}-k`} className="flex items-center gap-1.5">
                  <KindIcon kind={event.kind} />
                  <Badge tone={metaFor(event.kind).tone}>{metaFor(event.kind).label}</Badge>
                </span>,
                <span key={`${event._id}-t`} className="font-semibold">{event.title}</span>,
                <span key={`${event._id}-s`} className="text-ink-soft">{describe(event)}</span>,
                <span key={`${event._id}-w`} className="whitespace-nowrap text-xs text-ink-soft">{relativeDays(event.date)}</span>,
                ...(canManage ? [
                  event.editable ? (
                    <div key={`${event._id}-a`} className="flex gap-1.5">
                      <button type="button" onClick={() => startEdit(event)} aria-label={`Edit ${event.title}`} className="ghost-button p-1.5"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => void remove(event)} disabled={busy !== ''} aria-label={`Remove ${event.title}`} className="ghost-button p-1.5 text-danger disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ) : <span key={`${event._id}-a`} className="text-xs text-ink-muted">From employee records</span>,
                ] : []),
              ])}
            />
          </div>
        )}

        {tab === 'settings' && canManage && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([
              ['showBirthdays', 'Show birthdays', 'Employees can still hide their own birthday from the shared calendar.'],
              ['showAnniversaries', 'Show work anniversaries', 'Derived from each employee\'s date of joining.'],
            ] as const).map(([key, label, hint]) => (
              <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-subtle p-4">
                <input
                  type="checkbox"
                  checked={feed?.settings?.[key] !== false}
                  disabled={busy !== ''}
                  onChange={(event) => void toggleSetting(key, event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-ink-soft">{hint}</span>
                </span>
              </label>
            ))}
            <p className="sm:col-span-2 text-xs text-ink-soft">
              These settings control what everyone sees. The Show filters above only change your own view.
              Birthdays need a date of birth on the employee record: set it under Employees, or include a
              <span className="font-semibold"> dateOfBirth</span> column in a Data migration import.
            </p>
          </div>
        )}
      </SectionCard>

      {!(yearFeed?.events || []).length && (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          label={`Nothing on the calendar for ${year}`}
          hint="Add your public holidays first, then company events. Birthdays and work anniversaries appear automatically from employee records."
          action={canManage ? <button type="button" onClick={() => startCreate('holiday')} className="gradient-button rounded-md px-3.5 py-2 text-sm">Add a holiday</button> : undefined}
        />
      )}

      {draft && (
        <Drawer
          title={draft.id
            ? draft.mode === 'holiday' ? 'Edit holiday' : 'Edit event'
            : draft.mode === 'holiday' ? 'Add a holiday' : 'Add a company event'}
          subtitle={draft.mode === 'holiday' ? 'Holidays affect attendance and payroll' : 'Visible to everyone in the company'}
          close={() => setDraft(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="neu-button rounded-md px-3 py-2 text-sm">Cancel</button>
              <button type="button" onClick={() => void save()} disabled={!draft.title.trim() || busy !== ''} className="gradient-button flex items-center gap-2 rounded-md px-3.5 py-2 text-sm disabled:cursor-not-allowed">
                {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={draft.mode === 'holiday' ? 'Holiday name' : 'Event title'} required>
                <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={fieldClass} />
              </Field>
            </div>
            <Field label={draft.mode === 'holiday' ? 'Date' : 'Starts'} required>
              <input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} className={fieldClass} />
            </Field>
            {draft.mode === 'event' ? (
              <>
                <Field label="Ends" hint="Leave empty for a single-day event.">
                  <input type="date" min={draft.startDate} value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} className={fieldClass} />
                </Field>
                <Field label="Type">
                  <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })} className={fieldClass}>
                    {EVENT_KINDS.map((kind) => <option key={kind} value={kind}>{kind.charAt(0).toUpperCase() + kind.slice(1)}</option>)}
                  </select>
                </Field>
                <Field label="Location">
                  <input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Head office" className={fieldClass} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Description">
                    <textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={fieldClass} />
                  </Field>
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-subtle p-4 text-sm">
                  <input type="checkbox" checked={draft.paid} onChange={(event) => setDraft({ ...draft, paid: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary-600" />
                  <span>
                    <span className="block font-semibold text-ink">Paid holiday</span>
                    <span className="mt-0.5 block text-xs leading-5 text-ink-soft">Unpaid holidays reduce payable days in payroll.</span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </div>
  )
}
