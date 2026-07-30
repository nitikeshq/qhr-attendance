'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, RefreshCw, SlidersHorizontal } from 'lucide-react'

import { Badge, DataTable, EmptyState, SectionCard, StatTile } from './ui'

/**
 * Confirm a payroll month before committing it.
 *
 * Nothing here writes: the same computation generation would persist is run and
 * discarded. Previously the only way to see what a month produced was to
 * generate it, which meant auditing after the fact instead of confirming first.
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
  } | null
  figures: { salaryGross: number; deductions: number; net: number } | null
}

type Preview = {
  period: string
  ready: boolean
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

export default function PayrollPreviewCard({
  apiRoot, token, period, onOpenPage,
}: {
  apiRoot: string
  token: string
  period: string
  onOpenPage?: (page: string) => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [view, setView] = useState<'exceptions' | 'all'>('exceptions')
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

  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => {
    if (!preview) return []
    return view === 'exceptions'
      ? preview.rows.filter((row) => row.reasons.length > 0 || row.blockers.length > 0)
      : preview.rows
  }, [preview, view])

  const tableRows = rows.map((row) => [
    <div key="who" className="min-w-0">
      <p className="font-semibold text-ink">{row.employee.name}</p>
      <p className="text-xs text-ink-soft">{row.employee.employeeId}{row.employee.department ? ` Â· ${row.employee.department}` : ''}</p>
    </div>,
    <span key="sched" className="tabular-nums">{days(row.attendance?.scheduledDays)}</span>,
    <span key="payable" className="tabular-nums font-semibold">{days(row.attendance?.payableDays)}</span>,
    <span key="lop" className={`tabular-nums ${(row.attendance?.lossOfPayDays || 0) > 0 ? 'font-semibold text-danger' : ''}`}>
      {days(row.attendance?.lossOfPayDays)}
    </span>,
    <span key="gross" className="tabular-nums">{row.figures ? money(row.figures.salaryGross) : '-'}</span>,
    <span key="ded" className="tabular-nums">{row.figures ? money(row.figures.deductions) : '-'}</span>,
    <span key="net" className="tabular-nums font-semibold">{row.figures ? money(row.figures.net) : '-'}</span>,
    <div key="why" className="min-w-0 space-y-1">
      {row.blockers.map((item) => (
        <p key={item.code} className="flex items-start gap-1 text-xs font-semibold text-danger">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" /> {item.message}
        </p>
      ))}
      {row.warnings.map((item) => (
        <p key={item.code} className="flex items-start gap-1 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {item.message}
        </p>
      ))}
      {!row.blockers.length && !row.warnings.length && row.reasons.length > 0 && (
        <p className="text-xs text-ink-soft">{row.reasons.join(' Â· ')}</p>
      )}
      {!row.blockers.length && !row.warnings.length && !row.reasons.length && (
        <span className="text-xs text-success">Clean full month</span>
      )}
    </div>,
  ])

  return (
    <SectionCard
      title="Before you run: preview and checks"
      description="What this month would produce, computed without writing anything. Fix what is flagged, preview again, then generate."
      icon={<SlidersHorizontal className="h-4 w-4" />}
      actions={(
        <button
          type="button" onClick={() => void load()} disabled={loading}
          className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Re-check
        </button>
      )}
    >
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>
      )}

      {loading && !preview && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" /> Building the preview
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
                  : `${preview.period} is not ready: ${preview.counts.blocked + preview.company.blockers.length} blocker(s) to clear`}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                {preview.counts.payable} payable Â· {preview.counts.skipped} skipped Â· {preview.counts.exceptions} need review Â· {preview.counts.clean} clean
              </p>
            </div>
          </div>

          {(preview.company.blockers.length > 0 || preview.company.warnings.length > 0) && (
            <ul className="mb-4 space-y-1.5">
              {preview.company.blockers.map((item) => (
                <li key={item.code} className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">{item.message}</span>
                  {item.fix && onOpenPage && (
                    <button type="button" onClick={() => onOpenPage(item.fix as string)} className="underline underline-offset-2">Fix now</button>
                  )}
                </li>
              ))}
              {preview.company.warnings.map((item) => (
                <li key={item.code} className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">{item.message}</span>
                  {item.fix && onOpenPage && (
                    <button type="button" onClick={() => onOpenPage(item.fix as string)} className="underline underline-offset-2">Open</button>
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
            <span className="text-xs text-ink-soft">
              {view === 'exceptions'
                ? 'Only people whose figures differ from a clean full month.'
                : 'Every employee in the run.'}
            </span>
          </div>

          {rows.length ? (
            <DataTable
              headers={['Employee', 'Scheduled', 'Payable', 'LOP', 'Gross', 'Deductions', 'Net', 'Needs attention']}
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
  )
}

