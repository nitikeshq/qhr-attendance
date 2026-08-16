'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MapPin, RefreshCw, X } from 'lucide-react'
import {
  Badge,
  DataTable,
  EmployeeProfileLink,
  EmptyState,
  Field,
  SearchableSelect,
  SectionCard,
  TabBar,
  fieldClass,
  humanize,
  type EmployeeProfileTab,
  type Option,
} from './ui'

type CheckIn = { time?: string | null; areaName?: string | null; distanceMeters?: number | null }
type CheckOut = { time?: string | null; areaName?: string | null }

export type AttendanceTeamRow = {
  employee: { _id: string; employeeId: string; firstName?: string; lastName?: string }
  attendance: {
    checkIn?: CheckIn | null
    checkOut?: CheckOut | null
    workDuration?: number | null
    status?: string | null
    isLate?: boolean
  } | null
  day: { status?: string | null; payableDays?: number | null } | null
  summary: { lossOfPayDays?: number | null; payrollImpact?: string | null } | null
  areaId?: string | null
  areaName?: string | null
  workLocationId?: string | null
  workLocationName?: string | null
}

type TeamResponse = {
  date: string
  period?: string
  policy?: { payrollImpact?: string } | null
  attendances: AttendanceTeamRow[]
  filters?: Record<string, string | null>
}

type LocationGroup = {
  areaId: string | null
  areaName?: string | null
  address?: string | null
  employees: number
  present: number
  late: number
  rows: AttendanceTeamRow[]
}

type LocationResponse = { date: string; groups: LocationGroup[]; unassigned: LocationGroup }

type Props = {
  apiRoot: string
  token: string
  policyLabel?: string
  areas: Array<{ _id: string; name: string; address?: string }>
  workLocations: Array<{ _id: string; name: string }>
  onOpenEmployee?: (employeeId: string, tab: EmployeeProfileTab, period?: string) => void
  onError?: (message: string) => void
}

type TabKey = 'register' | 'locations'

const STATUS_FILTERS = [
  'present',
  'half_day',
  'short_day',
  'work_from_home',
  'paid_leave',
  'unpaid_leave',
  'holiday',
  'weekly_off',
  'absent',
  'unnoticed_absence',
  'not_checked_in',
]

function today() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function reason(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function rowStatus(row: AttendanceTeamRow) {
  return row.attendance?.status || row.day?.status || 'not_checked_in'
}

function employeeName(row: AttendanceTeamRow) {
  const { firstName, lastName, employeeId } = row.employee
  return `${firstName || ''} ${lastName || ''}`.trim() || employeeId
}

function formatTime(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatHours(minutes?: number | null) {
  const total = Number(minutes || 0)
  if (!total) return '-'
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
}

function formatDays(value?: number | null) {
  return Number(value || 0).toFixed(1)
}

async function request<T>(apiRoot: string, token: string, path: string): Promise<T> {
  const response = await fetch(`${apiRoot}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`)
  return payload.data as T
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="neu-inset rounded-lg p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function GeofenceCell({ row }: { row: AttendanceTeamRow }) {
  const areaName = row.attendance?.checkIn?.areaName || row.areaName
  const distance = row.attendance?.checkIn?.distanceMeters
  if (!areaName) return <span className="text-slate-400">Not captured</span>
  return (
    <div className="min-w-0">
      <p className="font-semibold text-slate-800">{areaName}</p>
      <p className="text-xs text-slate-500">
        {typeof distance === 'number' ? `${Math.round(distance)} m from centre` : 'Distance not recorded'}
      </p>
    </div>
  )
}

function attendanceRows(
  rows: AttendanceTeamRow[],
  period: string,
  onOpenEmployee?: (employeeId: string, tab: EmployeeProfileTab, period?: string) => void,
) {
  return rows.map((row) => {
    const status = rowStatus(row)
    const checkIn = formatTime(row.attendance?.checkIn?.time)
    const checkOut = formatTime(row.attendance?.checkOut?.time)
    return [
      <div key="employee" className="min-w-0">
        <EmployeeProfileLink employeeId={row.employee._id} tab="attendance" period={period} onOpen={onOpenEmployee}>{employeeName(row)}</EmployeeProfileLink>
        <p className="text-xs text-slate-500">{row.employee.employeeId}</p>
      </div>,
      <div key="status" className="flex flex-wrap gap-1.5">
        <Badge>{status}</Badge>
        {row.attendance?.isLate && <Badge tone="warning">late</Badge>}
      </div>,
      checkIn || <span key="in" className="text-slate-400">-</span>,
      checkOut || <span key="out" className="text-slate-400">-</span>,
      formatHours(row.attendance?.workDuration),
      <GeofenceCell key="geofence" row={row} />,
      row.workLocationName || <span key="location" className="text-slate-400">Not set</span>,
      formatDays(row.day?.payableDays),
      formatDays(row.summary?.lossOfPayDays),
    ]
  })
}

const TABLE_HEADERS = ['Employee', 'Status', 'Check in', 'Check out', 'Hours', 'Geofence', 'Work location', 'Payable', 'Month LOP']

export default function AttendanceWorkspace({ apiRoot, token, policyLabel, areas, workLocations, onOpenEmployee, onError }: Props) {
  const [tab, setTab] = useState<TabKey>('register')
  const [date, setDate] = useState(() => today())
  const [areaId, setAreaId] = useState('')
  const [workLocationId, setWorkLocationId] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<AttendanceTeamRow[]>([])
  const [locations, setLocations] = useState<LocationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const areaOptions = useMemo<Option[]>(
    () => areas.map((area) => ({ value: area._id, label: area.name, hint: area.address })),
    [areas],
  )
  const locationOptions = useMemo<Option[]>(
    () => workLocations.map((location) => ({ value: location._id, label: location.name })),
    [workLocations],
  )
  const statusOptions = useMemo<Option[]>(
    () => STATUS_FILTERS.map((value) => ({ value, label: humanize(value) })),
    [],
  )

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    if (!date) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ date })
      if (areaId) params.set('areaId', areaId)
      if (workLocationId) params.set('workLocationId', workLocationId)
      if (status) params.set('status', status)
      if (query) params.set('q', query)
      const queryString = params.toString()
      const [team, byLocation] = await Promise.all([
        request<TeamResponse>(apiRoot, token, `/attendance/team?${queryString}`),
        request<LocationResponse>(apiRoot, token, `/attendance/by-location?${queryString}`),
      ])
      setRows(team.attendances || [])
      setLocations(byLocation)
    } catch (failure) {
      const message = reason(failure, 'Could not load attendance')
      setError(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }, [apiRoot, token, date, areaId, workLocationId, status, query, onError])

  useEffect(() => { void load() }, [load])

  const metrics = useMemo(() => {
    const totals = { present: 0, late: 0, wfh: 0, leave: 0, absent: 0 }
    for (const row of rows) {
      const value = rowStatus(row)
      if (row.attendance?.isLate) totals.late += 1
      if (value.includes('work_from_home')) totals.wfh += 1
      else if (value.includes('leave')) totals.leave += 1
      else if (value === 'present' || value === 'half_day' || value === 'short_day') totals.present += 1
      else if (value.includes('absent') || value === 'not_checked_in') totals.absent += 1
    }
    return totals
  }, [rows])

  const groups = useMemo(() => locations?.groups || [], [locations])
  const unassigned = locations?.unassigned || null
  const filtersApplied = Boolean(areaId || workLocationId || status || query)

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      <SectionCard
        title="Attendance"
        description={policyLabel ? `Payroll policy: ${policyLabel}` : 'Daily attendance with geofence evidence.'}
        actions={
          <button type="button" onClick={() => { void load() }} disabled={loading} className="neu-button rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50">
            {loading ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 inline h-4 w-4" />}Refresh
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Date">
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Attendance date" className={fieldClass} />
          </Field>
          <Field label="Geofence area">
            <SearchableSelect options={areaOptions} value={areaId} onChange={setAreaId} allowEmpty emptyLabel="All areas" placeholder="Search area" />
          </Field>
          <Field label="Work location">
            <SearchableSelect options={locationOptions} value={workLocationId} onChange={setWorkLocationId} allowEmpty emptyLabel="All locations" placeholder="Search location" />
          </Field>
          <Field label="Status">
            <SearchableSelect options={statusOptions} value={status} onChange={setStatus} allowEmpty emptyLabel="All statuses" placeholder="Search status" />
          </Field>
          <Field label="Search employee">
            <input
              value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or employee ID" aria-label="Search employee" className={fieldClass}
            />
          </Field>
        </div>
        {loading && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading attendance for {date}
          </p>
        )}
      </SectionCard>

      <TabBar
        tabs={[
          { key: 'register' as TabKey, label: 'Register', count: rows.length },
          { key: 'locations' as TabKey, label: 'By location', count: groups.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'register' && (
        <SectionCard title="Daily register" description="Geofence column shows the matched area and the distance recorded at check in.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Present" value={metrics.present} hint="Including half and short days" />
            <Metric label="Late" value={metrics.late} hint="Past the grace window" />
            <Metric label="Work from home" value={metrics.wfh} hint="Approved remote work" />
            <Metric label="On leave" value={metrics.leave} hint="Paid and unpaid" />
            <Metric label="Absent" value={metrics.absent} hint="No attendance captured" />
          </div>
          <div className="mt-5">
            {rows.length ? (
              <DataTable headers={TABLE_HEADERS} rows={attendanceRows(rows, date.slice(0, 7), onOpenEmployee)} searchable searchPlaceholder="Filter loaded rows" />
            ) : (
              <EmptyState
                label={filtersApplied ? 'No attendance matches these filters' : 'No attendance recorded for this date'}
                hint={filtersApplied ? 'Clear a filter or pick another date.' : 'Rows appear once employees check in or a leave is approved.'}
              />
            )}
          </div>
        </SectionCard>
      )}

      {tab === 'locations' && (
        <div className="space-y-4">
          {!groups.length && !unassigned?.rows?.length ? (
            <EmptyState label="No geofence activity for this date" hint="Check ins grouped by area will appear here." />
          ) : (
            <>
              {groups.map((group) => (
                <SectionCard
                  key={group.areaId || 'group'}
                  title={group.areaName || 'Unnamed area'}
                  description={group.address || 'No address recorded for this geofence'}
                  actions={
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="neu-inset rounded-md px-2.5 py-1.5">{group.employees} on roll</span>
                      <span className="neu-inset rounded-md px-2.5 py-1.5">{group.present} present</span>
                      <span className="neu-inset rounded-md px-2.5 py-1.5">{group.late} late</span>
                    </div>
                  }
                >
                  {group.rows?.length ? (
                    <DataTable headers={TABLE_HEADERS} rows={attendanceRows(group.rows, date.slice(0, 7), onOpenEmployee)} defaultPageSize={10} />
                  ) : (
                    <EmptyState label="No employees matched this area" />
                  )}
                </SectionCard>
              ))}
              {unassigned && (
                <SectionCard
                  title={unassigned.areaName || 'Unassigned'}
                  description="These check ins had no geofence match, so they were recorded manually or from outside every area."
                  actions={
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="neu-inset rounded-md px-2.5 py-1.5">{unassigned.employees} on roll</span>
                      <span className="neu-inset rounded-md px-2.5 py-1.5">{unassigned.present} present</span>
                      <span className="neu-inset rounded-md px-2.5 py-1.5">{unassigned.late} late</span>
                    </div>
                  }
                >
                  <p className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5" />
                    Review these rows before payroll. No area centre distance is available for them.
                  </p>
                  {unassigned.rows?.length ? (
                    <DataTable headers={TABLE_HEADERS} rows={attendanceRows(unassigned.rows, date.slice(0, 7), onOpenEmployee)} defaultPageSize={10} />
                  ) : (
                    <EmptyState label="No unmatched check ins" hint="Every recorded check in fell inside a geofence." />
                  )}
                </SectionCard>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
