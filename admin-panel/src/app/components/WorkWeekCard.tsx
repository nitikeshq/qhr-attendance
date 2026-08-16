'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CalendarOff, Clock, Loader2, Sun } from 'lucide-react'

import { Field, SectionCard, fieldClass } from './ui'

/**
 * The company work week.
 *
 * Weekly offs were previously a weekday list with no editor at all, and payroll
 * only consulted it under one of three payable-day methods. A company could not
 * say "Sundays off", let alone "2nd and 4th Saturday off", and could not see
 * which days a month would actually count before running payroll.
 */

type Ordinal = 1 | 2 | 3 | 4 | 5
type DayKind = 'full' | 'half' | 'off'
type NthRule = { pattern: 'nth'; off: number[]; otherwise: DayKind }
type AlternateRule = { pattern: 'alternate'; parity: 'odd' | 'even'; otherwise: DayKind }
type WeekdayRule = DayKind | NthRule | AlternateRule
type WorkWeek = Record<string, WeekdayRule>

type PreviewDay = { date: string; kind: 'full' | 'half' | 'off' | 'holiday'; holidayName?: string | null }

type Preview = {
  period: string
  calendarDays: number
  workingDays: number
  halfDays: number
  weeklyOffDays: number
  holidayDays: number
  workingDayMethod: string
  payableDayBasis: number
  workWeekSummary: string[]
  days: PreviewDay[]
}

const WEEKDAYS: Array<{ index: number; short: string; long: string }> = [
  { index: 1, short: 'Mon', long: 'Monday' },
  { index: 2, short: 'Tue', long: 'Tuesday' },
  { index: 3, short: 'Wed', long: 'Wednesday' },
  { index: 4, short: 'Thu', long: 'Thursday' },
  { index: 5, short: 'Fri', long: 'Friday' },
  { index: 6, short: 'Sat', long: 'Saturday' },
  { index: 0, short: 'Sun', long: 'Sunday' },
]

const ORDINALS: Array<{ value: Ordinal; label: string }> = [
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' },
  { value: 5, label: '5th' },
]

const KIND_LABEL: Record<PreviewDay['kind'], string> = {
  full: 'Working day',
  half: 'Half day',
  off: 'Weekly off',
  holiday: 'Holiday',
}

const KIND_CELL: Record<PreviewDay['kind'], string> = {
  full: 'bg-white text-ink',
  half: 'bg-warning-soft text-warning',
  off: 'bg-surface-hover text-ink-muted',
  holiday: 'bg-danger-soft text-danger',
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7)
}

function isNth(rule: WeekdayRule): rule is NthRule {
  return typeof rule === 'object' && rule.pattern === 'nth'
}

/** The simple mode a weekday is in, ignoring any pattern detail. */
function modeOf(rule: WeekdayRule | undefined): 'full' | 'half' | 'off' | 'nth' {
  if (!rule) return 'full'
  if (typeof rule === 'string') return rule
  return rule.pattern === 'nth' ? 'nth' : 'full'
}

export default function WorkWeekCard({
  apiRoot, token, canEdit, onSaved,
}: {
  apiRoot: string
  token: string
  canEdit: boolean
  onSaved?: (message: string) => Promise<void> | void
}) {
  const [workWeek, setWorkWeek] = useState<WorkWeek>({})
  const [period, setPeriod] = useState(currentPeriod)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingMethod, setSavingMethod] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [error, setError] = useState('')

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${apiRoot}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.message || 'Request failed')
    return (body?.data || {}) as T
  }, [apiRoot, token])

  const loadPreview = useCallback(async (targetPeriod: string) => {
    try {
      const data = await request<Preview>(`/attendance/work-week/preview?period=${targetPeriod}`)
      setPreview(data)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the month preview')
    }
  }, [request])

  useEffect(() => {
    let active = true
    setLoading(true)
    void (async () => {
      try {
        const policy = await request<{ workWeek?: WorkWeek }>('/attendance/policy')
        if (!active) return
        setWorkWeek(policy.workWeek || {})
        setDirty(false)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load the work week')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [request])

  useEffect(() => {
    void loadPreview(period)
  }, [loadPreview, period])

  function setMode(weekday: number, mode: 'full' | 'half' | 'off' | 'nth') {
    setDirty(true)
    setSavedMessage('')
    setWorkWeek((current) => {
      const next = { ...current }
      if (mode === 'nth') {
        const existing = current[weekday]
        next[weekday] = isNth(existing)
          ? existing
          : { pattern: 'nth', off: [2, 4], otherwise: 'full' }
      } else {
        next[weekday] = mode
      }
      return next
    })
  }

  function toggleOccurrence(weekday: number, occurrence: Ordinal) {
    setDirty(true)
    setSavedMessage('')
    setWorkWeek((current) => {
      const rule = current[weekday]
      if (!isNth(rule)) return current
      const off = rule.off.includes(occurrence)
        ? rule.off.filter((item) => item !== occurrence)
        : [...rule.off, occurrence].sort((left, right) => left - right)
      return { ...current, [weekday]: { ...rule, off } }
    })
  }

  function setOtherwise(weekday: number, otherwise: DayKind) {
    setDirty(true)
    setSavedMessage('')
    setWorkWeek((current) => {
      const rule = current[weekday]
      if (!isNth(rule)) return current
      return { ...current, [weekday]: { ...rule, otherwise } }
    })
  }

  async function save() {
    setSaving(true)
    setError('')
    setSavedMessage('')
    try {
      const saved = await request<{ workWeek?: WorkWeek }>('/attendance/work-week', {
        method: 'PATCH',
        body: JSON.stringify({ workWeek }),
      })
      setWorkWeek(saved.workWeek || workWeek)
      setDirty(false)
      setSavedMessage('Saved and active')
      await loadPreview(period)
      await onSaved?.('Work week saved and active.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the work week')
    } finally {
      setSaving(false)
    }
  }

  /** Monday-first grid with leading blanks, so dates line up under weekday names. */
  const grid = useMemo(() => {
    if (!preview?.days.length) return []
    const first = new Date(`${preview.days[0].date}T00:00:00Z`)
    const offset = (first.getUTCDay() + 6) % 7
    return [...Array.from({ length: offset }, () => null), ...preview.days]
  }, [preview])

  const methodLabel = preview?.workingDayMethod === 'fixed_30'
    ? 'Fixed 30 days'
    : preview?.workingDayMethod === 'working_days'
      ? 'Actual working days'
      : 'Calendar days'

  /**
   * The salary-day basis lived only in Payroll settings, so a company that had set
   * its weekly offs here still saw "31 / 31" on a payslip and reasonably concluded
   * the roster was being ignored. The choice belongs next to the roster it divides.
   */
  async function saveMethod(method: string) {
    setSavingMethod(true)
    setError('')
    try {
      await request('/payroll/settings', { method: 'PATCH', body: JSON.stringify({ workingDayMethod: method }) })
      await loadPreview(period)
      await onSaved?.('Salary-day basis updated.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not change the salary-day basis')
    } finally {
      setSavingMethod(false)
    }
  }

  if (loading) {
    return (
      <SectionCard title="Work week" description="Loading the weekly pattern">
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="Work week and weekly offs"
      description="Which days your company works. This decides who is expected in, so a non-working day is never counted as an absence."
      icon={<CalendarDays className="h-4 w-4" />}
      actions={canEdit ? (
        <div className="flex items-center gap-3">
          {/* Save state is explicit: an edited pattern that was never saved used to
              look identical to a saved one, which is why saving felt broken. */}
          <span className={`text-xs font-semibold ${dirty ? 'text-warning' : 'text-ink-soft'}`}>
            {dirty ? 'Unsaved changes' : savedMessage || 'All changes saved'}
          </span>
          <button
            type="button" onClick={() => void save()} disabled={saving || !dirty}
            className="gradient-button flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save work week
          </button>
        </div>
      ) : undefined}
    >
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>
      )}
      {dirty && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-warning-soft px-3.5 py-2.5 text-sm font-medium text-warning">
          These weekday changes are not saved yet. The month preview below still shows the saved pattern until you save.
        </p>
      )}

      <div className="space-y-2">
        {WEEKDAYS.map(({ index, long }) => {
          const rule = workWeek[index]
          const mode = modeOf(rule)
          return (
            <div key={index} className="rounded-lg border border-line bg-surface-subtle p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="w-24 shrink-0 text-sm font-semibold text-ink">{long}</span>
                <div className="flex flex-wrap gap-1">
                  {([
                    ['full', 'Full day'],
                    ['half', 'Half day'],
                    ['off', 'Weekly off'],
                    ['nth', 'Some weeks off'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value} type="button" disabled={!canEdit}
                      onClick={() => setMode(index, value)}
                      aria-pressed={mode === value}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                        mode === value ? 'bg-primary-500 text-white' : 'bg-white text-ink-soft hover:bg-surface-hover'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {isNth(rule) && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
                  <span className="text-xs font-semibold text-ink-soft">Off on the</span>
                  <div className="flex gap-1">
                    {ORDINALS.map(({ value, label }) => (
                      <button
                        key={value} type="button" disabled={!canEdit}
                        onClick={() => toggleOccurrence(index, value)}
                        aria-pressed={rule.off.includes(value)}
                        className={`rounded-md px-2 py-1 text-xs font-bold transition-colors disabled:cursor-not-allowed ${
                          rule.off.includes(value) ? 'bg-ink text-white' : 'bg-white text-ink-soft hover:bg-surface-hover'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-ink-soft">Other weeks</span>
                  <select
                    value={rule.otherwise} disabled={!canEdit}
                    onChange={(event) => setOtherwise(index, event.target.value as DayKind)}
                    className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink"
                  >
                    <option value="full">Full day</option>
                    <option value="half">Half day</option>
                  </select>
                  {!rule.off.length && (
                    <span className="text-xs text-warning">Pick at least one week, or this is just a normal day.</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* The month preview is the answer to "how many days will payroll count?",
          available before payroll runs rather than after. */}
      <div className="mt-5 rounded-lg border border-line">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-surface-subtle px-3.5 py-3">
          <div>
            <p className="text-sm font-bold text-ink">Month preview</p>
            <p className="mt-0.5 text-xs text-ink-soft">Saved pattern applied to a month, with the day counts payroll will use.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Salary-day basis" hint="What payroll divides a monthly salary by.">
              <select
                value={preview?.workingDayMethod || 'working_days'}
                disabled={!canEdit || savingMethod}
                onChange={(event) => void saveMethod(event.target.value)}
                className={fieldClass}
              >
                <option value="working_days">Actual working days (excludes weekly offs and holidays)</option>
                <option value="calendar_days">Calendar days (weekly offs stay paid and counted)</option>
                <option value="fixed_30">Fixed 30 days</option>
              </select>
            </Field>
            <Field label="Month">
              <input
                type="month" value={period} onChange={(event) => setPeriod(event.target.value || currentPeriod())}
                className={fieldClass}
              />
            </Field>
          </div>
        </div>

        {preview && (
          <>
            <div className="grid gap-3 border-b border-line px-3.5 py-3 sm:grid-cols-3 lg:grid-cols-5">
              {([
                ['Working days', preview.workingDays, <Clock key="i" className="h-3.5 w-3.5" />],
                ['Half days', preview.halfDays, <Sun key="i" className="h-3.5 w-3.5" />],
                ['Weekly offs', preview.weeklyOffDays, <CalendarOff key="i" className="h-3.5 w-3.5" />],
                ['Holidays', preview.holidayDays, <CalendarDays key="i" className="h-3.5 w-3.5" />],
                [`Payable-day basis (${methodLabel})`, preview.payableDayBasis, <CalendarDays key="i" className="h-3.5 w-3.5" />],
              ] as const).map(([label, value, icon]) => (
                <div key={label} className="rounded-md border border-line bg-white px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{icon}{label}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">{value}</p>
                </div>
              ))}
            </div>

            <div className="px-3.5 py-3">
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-line bg-line">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                  <div key={label} className="bg-surface-subtle px-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</div>
                ))}
                {grid.map((day, index) => (
                  day ? (
                    <div
                      key={day.date}
                      title={`${day.date} · ${day.holidayName || KIND_LABEL[day.kind]}`}
                      className={`min-h-[46px] px-1.5 py-1 ${KIND_CELL[day.kind]}`}
                    >
                      <span className="text-[11px] font-bold tabular-nums">{Number(day.date.slice(8, 10))}</span>
                      <span className="mt-0.5 block truncate text-[9px] font-semibold leading-3">
                        {day.holidayName || (day.kind === 'full' ? '' : KIND_LABEL[day.kind])}
                      </span>
                    </div>
                  ) : <div key={`pad-${index}`} className="min-h-[46px] bg-surface-subtle" />
                ))}
              </div>

              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {(Object.keys(KIND_LABEL) as Array<PreviewDay['kind']>).map((kind) => (
                  <li key={kind} className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <span className={`h-3 w-3 rounded-sm border border-line ${KIND_CELL[kind]}`} />
                    {KIND_LABEL[kind]}
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-xs leading-5 text-ink-soft">
                Working days are who is expected in. The payable-day basis is the divisor payroll uses, set separately
                by the working-day method in Payroll settings, because statutory practice often uses a flat 30 regardless
                of the roster.
              </p>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  )
}
