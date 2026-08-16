'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, SlidersHorizontal } from 'lucide-react'

import { Badge, DataTable, Drawer, EmployeeProfileLink, EmptyState, SectionCard, StatTile, type EmployeeProfileTab } from './ui'

/**
 * Confirm a payroll month before committing it.
 *
 * Nothing here writes: the same computation generation would persist is run and
 * discarded. Previously the only way to see what a month produced was to
 * generate it, which meant auditing after the fact instead of confirming first.
 *
 * The table stays scannable on purpose. An earlier version printed every warning
 * inline, which put seven lines of coloured text on every row and buried the one
 * blocker that actually stopped the run. Counts here, detail on request.
 */

type Problem = { code: string; message: string; fix?: string }

type PreviewRow = {
  employee: { _id: string; employeeId: string; name: string; department?: string; designation?: string }
  payrollEnabled: boolean
  existingStatus: string | null
  skipped: boolean
  skipReason: string | null
  reasons: string[]
  blockers: Problem[]
  warnings: Problem[]
  attendance: {
    scheduledDays?: number
    payableDays?: number
    lossOfPayDays?: number
    unpaidLeaveDays?: number
    unnoticedAbsenceDays?: number
    halfDayDays?: number
    weeklyOffDays?: number
    presentDays?: number
  } | null
  figures: { salaryGross: number; deductions: number; net: number } | null
}

type Preview = {
  period: string
  ready: boolean
  payment?: { date: string; requestedDate: string; shifted: boolean; reason?: string | null } | null
  company: { blockers: Problem[]; warnings: Problem[] }
  counts: { employees: number; payable: number; skipped: number; blocked: number; warned: number; exceptions: number; clean: number }
  totals: { salaryGross: number; deductions: number; net: number }
  rows: PreviewRow[]
}

function money(value?: number | null) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0)
}

function days(value?: number | null) {
  return value === undefined || value === null ? '-' : String(Math.round(Number(value) * 100) / 100)
}

const FIX_LABEL: Record<string, string> = {
  settings: 'Company & settings',
  org: 'Organisation',
  employees: 'Employees',
  payroll: 'Payroll',
  attendance: 'Attendance',
  leaves: 'Leave Requests',
  wfh: 'WFH Requests',
  reimbursements: 'Reimbursements',
}

export default function PayrollPreviewCard({
  apiRoot, token, period, onOpenPage, onOpenEmployee,
}: {
  apiRoot: string
  token: string
  period: string
  onOpenPage?: (page: string) => void
  onOpenEmployee?: (employeeId: string, tab: EmployeeProfileTab, period?: string) => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [view, setView] = useState<'exceptions' | 'all'>('exceptions')
  const [detail, setDetail] = useState<PreviewRow | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!period) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiRoot}/payroll/preview?period=${period}&view=all`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.message || 'Could not build the preview')
      setPreview((body?.data || null) as Preview)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not build the preview')
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [apiRoot, token, period])

  // Only fetched when opened. A dry run over every employee is real work, and the
  // page should not pay for it before anyone asks to see it.
  useEffect(() => { if (open) void load() }, [open, load])

  const rows = useMemo(() => {
    if (!preview) return []
    return view === 'exceptions'
      ? preview.rows.filter((row) => row.reasons.length > 0 || row.blockers.length > 0)
      : preview.rows
  }, [preview, view])

  const tableRows = rows.map((row) => [
    <div key="who" className="min-w-0">
      <EmployeeProfileLink employeeId={row.employee._id} tab="salary" period={period} onOpen={onOpenEmployee}>{row.employee.name}</EmployeeProfileLink>
      <p className="text-xs text-ink-soft">{row.employee.employeeId}{row.employee.department ? ` · ${row.employee.department}` : ''}</p>
    </div>,
    <span key="sched" className="tabular-nums">{days(row.attendance?.scheduledDays)}</span>,
    <span key="payable" className="tabular-nums font-semibold">{days(row.attendance?.payableDays)}</span>,
    <span key="lop" className={`tabular-nums ${(row.attendance?.lossOfPayDays || 0) > 0 ? 'font-semibold text-danger' : ''}`}>
      {days(row.attendance?.lossOfPayDays)}
    </span>,
    <span key="net" className="tabular-nums font-semibold">{row.figures ? money(row.figures.net) : '-'}</span>,
    <div key="why" className="flex flex-wrap items-center gap-1.5">
      {row.blockers.length > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">
          <ShieldAlert className="h-3 w-3" /> {row.blockers.length} blocker{row.blockers.length === 1 ? '' : 's'}
        </span>
      )}
      {row.warnings.length > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">
          <AlertTriangle className="h-3 w-3" /> {row.warnings.length} to check
        </span>
      )}
      {!row.blockers.length && !row.warnings.length && row.reasons.length > 0 && (
        <span className="text-xs text-ink-soft">
          {row.reasons[0]}{row.reasons.length > 1 ? ` +${row.reasons.length - 1}` : ''}
        </span>
      )}
      {!row.blockers.length && !row.warnings.length && !row.reasons.length && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
          <CheckCircle2 className="h-3 w-3" /> Clean
        </span>
      )}
    </div>,
    <button
      key="detail" type="button" onClick={() => setDetail(row)}
      className="ghost-button rounded-md px-2.5 py-1.5 text-xs font-semibold"
    >
      Details
    </button>,
  ])

  if (!open) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-subtle px-3.5 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-500 text-white">
          <SlidersHorizontal className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Check {period} before you run it</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Works out what this month would produce without writing anything, and lists what needs fixing first.
          </p>
        </div>
        <button
          type="button" onClick={() => setOpen(true)}
          className="neu-button shrink-0 rounded-md px-3.5 py-2 text-sm font-semibold"
        >
          Run the check
        </button>
      </div>
    )
  }

  return (
    <>
      <SectionCard
        title={`Pre-run check for ${period}`}
        description="Computed without writing anything. Fix what is flagged, re-check, then generate."
        icon={<SlidersHorizontal className="h-4 w-4" />}
        actions={(
          <>
            <button
              type="button" onClick={() => void load()} disabled={loading}
              className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Re-check
            </button>
            <button
              type="button" onClick={() => setOpen(false)}
              className="ghost-button rounded-md px-3 py-2 text-sm font-semibold"
            >
              Hide
            </button>
          </>
        )}
      >
        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>
        )}

        {loading && !preview && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin" /> Working out this month
          </div>
        )}

        {preview && (
          <>
            <div className={`mb-4 flex items-start gap-3 rounded-lg border px-3.5 py-3 ${
              preview.ready ? 'border-emerald-200 bg-success-soft' : 'border-red-200 bg-danger-soft'
            }`}>
              <span className={`mt-0.5 shrink-0 ${preview.ready ? 'text-success' : 'text-danger'}`}>
                {preview.ready ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${preview.ready ? 'text-success' : 'text-danger'}`}>
                  {preview.ready
                    ? `Ready to run ${preview.period}`
                    : `Not ready: ${preview.counts.blocked + preview.company.blockers.length} blocker(s) to clear`}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                  {preview.counts.payable} payable · {preview.counts.skipped} skipped · {preview.counts.exceptions} need review · {preview.counts.clean} clean
                </p>
                {preview.payment && (
                  <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                    Salary pay date <strong className="text-ink">{preview.payment.date}</strong>
                    {preview.payment.shifted
                      ? ` · brought forward from ${preview.payment.requestedDate}, which is not a working day`
                      : ''}
                  </p>
                )}
              </div>
            </div>

            {preview.company.blockers.concat(preview.company.warnings).length > 0 && (
              <ul className="mb-4 space-y-1.5">
                {preview.company.blockers.map((item) => (
                  <li key={item.code} className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0">{item.message}</span>
                    {item.fix && onOpenPage && (
                      <button type="button" onClick={() => onOpenPage(item.fix as string)} className="underline underline-offset-2">
                        Open {FIX_LABEL[item.fix] || item.fix}
                      </button>
                    )}
                  </li>
                ))}
                {preview.company.warnings.map((item) => (
                  <li key={item.code} className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0">{item.message}</span>
                    {item.fix && onOpenPage && (
                      <button type="button" onClick={() => onOpenPage(item.fix as string)} className="underline underline-offset-2">
                        Open {FIX_LABEL[item.fix] || item.fix}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Employees" value={preview.counts.employees} />
              <StatTile label="Salary gross" value={money(preview.totals.salaryGross)} />
              <StatTile label="Deductions" value={money(preview.totals.deductions)} tone="danger" />
              <StatTile label="Net payable" value={money(preview.totals.net)} tone="positive" />
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {([
                ['exceptions', `Needs review (${preview.counts.exceptions})`],
                ['all', `Everyone (${preview.counts.employees})`],
              ] as const).map(([value, label]) => (
                <button
                  key={value} type="button" onClick={() => setView(value)}
                  aria-pressed={view === value}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    view === value ? 'bg-primary-500 text-white' : 'bg-surface-hover text-ink-soft hover:bg-surface-subtle'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {rows.length ? (
              <DataTable
                headers={['Employee', 'Scheduled', 'Payable', 'LOP', 'Net', 'Status', '']}
                rows={tableRows}
                searchable
                searchPlaceholder="Search employee"
                defaultPageSize={25}
              />
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                label={view === 'exceptions' ? 'Nothing needs review' : 'No employees in this run'}
                hint={view === 'exceptions'
                  ? 'Every payslip is a clean full month. Switch to Everyone to see them all.'
                  : 'Add employees and salary structures before running payroll.'}
              />
            )}
          </>
        )}
      </SectionCard>

      {detail && (
        <Drawer
          title={detail.employee.name}
          subtitle={`${detail.employee.employeeId} · ${period}`}
          close={() => setDetail(null)}
          wide
        >
          <div className="space-y-4">
            {detail.skipped && (
              <p className="rounded-lg border border-red-200 bg-danger-soft px-3.5 py-2.5 text-sm font-semibold text-danger">
                Skipped by the run: {detail.skipReason}
              </p>
            )}

            {detail.attendance && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Days</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ['Scheduled', detail.attendance.scheduledDays],
                    ['Payable', detail.attendance.payableDays],
                    ['Present', detail.attendance.presentDays],
                    ['Loss of pay', detail.attendance.lossOfPayDays],
                    ['Unpaid leave', detail.attendance.unpaidLeaveDays],
                    ['Weekly offs', detail.attendance.weeklyOffDays],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-md border border-line bg-surface-subtle px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-ink">{days(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.figures && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Money</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ['Salary gross', detail.figures.salaryGross],
                    ['Deductions', detail.figures.deductions],
                    ['Net pay', detail.figures.net],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-md border border-line bg-surface-subtle px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-ink">{money(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.blockers.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-danger">Must fix before approving</p>
                <ul className="space-y-1.5">
                  {detail.blockers.map((item) => (
                    <li key={item.code} className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0">{item.message}</span>
                      {item.fix && onOpenPage && (
                        <button type="button" onClick={() => { setDetail(null); onOpenPage(item.fix as string) }} className="underline underline-offset-2">
                          Open {FIX_LABEL[item.fix] || item.fix}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.warnings.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-warning">Worth checking</p>
                <ul className="space-y-1.5">
                  {detail.warnings.map((item) => (
                    <li key={item.code} className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0">{item.message}</span>
                      {item.fix && onOpenPage && (
                        <button type="button" onClick={() => { setDetail(null); onOpenPage(item.fix as string) }} className="underline underline-offset-2">
                          Open {FIX_LABEL[item.fix] || item.fix}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.reasons.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Why this is not a clean month</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.reasons.map((reason) => <Badge key={reason}>{reason}</Badge>)}
                </div>
              </div>
            )}

            {detail.existingStatus && (
              <p className="text-xs text-ink-soft">
                A payslip already exists for this month with status <span className="font-semibold">{detail.existingStatus}</span>.
              </p>
            )}
          </div>
        </Drawer>
      )}
    </>
  )
}
