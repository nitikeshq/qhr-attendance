'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Upload,
  Users,
} from 'lucide-react'

import {
  Badge,
  DataTable,
  EmptyState,
  Field,
  SearchableSelect,
  SectionCard,
  StatTile,
  fieldClass,
  type Option,
} from './ui'

type WorkLocationRef = {
  _id: string
  code: string
  name: string
  status: string
  isPayrollAddress: boolean
}

type Reference = {
  columns: string[]
  requiredColumns: string[]
  roles: string[]
  employmentTypes: string[]
  statuses: string[]
  workLocations: WorkLocationRef[]
  departments: Array<{ _id: string; code: string; name: string }>
  designations: Array<{ _id: string; code: string; name: string }>
}

type ReportRow = {
  line: number
  employeeId: string
  name: string
  email: string
  workLocation: string
  action: 'create' | 'update' | 'skip'
  errors: string[]
  warnings: string[]
}

type ValidateResult = {
  summary: { total: number; create: number; update: number; invalid: number; warnings: number }
  rows: ReportRow[]
  unknownColumns: string[]
}

type CommitResult = {
  summary: { total: number; created: number; updated: number; skipped: number; managersLinked: number }
  rows: ReportRow[]
}

type EmployeeRef = { _id: string; name: string; employeeId: string; workLocationId?: string | null }

async function request<T>(apiRoot: string, token: string, path: string, init: RequestInit = {}): Promise<{ data: T; message?: string }> {
  const response = await fetch(`${apiRoot}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.message || body?.error || 'Request failed')
  return { data: (body?.data || {}) as T, message: body?.message }
}

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback
}

function toCsvBlob(headers: string[], rows: Array<Record<string, unknown>>) {
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const content = [headers.map(quote).join(','), ...rows.map((row) => headers.map((key) => quote(row[key])).join(','))].join('\r\n')
  return new Blob([content], { type: 'text/csv;charset=utf-8' })
}

function saveBlob(blob: Blob, filename: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function ImportWorkspace({
  apiRoot, token, employees, onChanged,
}: {
  apiRoot: string
  token: string
  employees: EmployeeRef[]
  onChanged: (message: string) => Promise<void> | void
}) {
  const [reference, setReference] = useState<Reference | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const [fileName, setFileName] = useState('')
  const [csv, setCsv] = useState('')
  const [validation, setValidation] = useState<ValidateResult | null>(null)
  const [commit, setCommit] = useState<CommitResult | null>(null)
  const [defaultPasscode, setDefaultPasscode] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const [bulkLocation, setBulkLocation] = useState('')
  const [bulkEmployees, setBulkEmployees] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await request<Reference>(apiRoot, token, '/imports/employees/reference')
        if (!cancelled) setReference(data)
      } catch (reason) {
        if (!cancelled) setError(messageOf(reason, 'Could not load import reference data'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [apiRoot, token])

  const locationOptions: Option[] = useMemo(
    () => (reference?.workLocations || [])
      .filter((item) => item.status !== 'inactive')
      .map((item) => ({
        value: item._id,
        label: `${item.name} (${item.code})`,
        hint: item.isPayrollAddress ? 'Payroll address' : undefined,
      })),
    [reference],
  )

  async function downloadTemplate() {
    setBusy('template')
    setError('')
    try {
      const response = await fetch(`${apiRoot}/imports/employees/template`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Could not download the template')
      saveBlob(await response.blob(), 'qhr-employee-import-template.csv')
    } catch (reason) {
      setError(messageOf(reason, 'Could not download the template'))
    } finally {
      setBusy('')
    }
  }

  function readFile(file: File | null) {
    if (!file) return
    setError('')
    setValidation(null)
    setCommit(null)
    const reader = new FileReader()
    reader.onload = () => {
      setCsv(String(reader.result || ''))
      setFileName(file.name)
    }
    reader.onerror = () => setError('Could not read that file')
    // Read as text and post as JSON: no multipart handling on the server, and the
    // operator gets to preview the parse result before anything is written.
    reader.readAsText(file)
  }

  async function validate() {
    if (!csv.trim()) { setError('Choose a CSV file first'); return }
    setBusy('validate')
    setError('')
    setCommit(null)
    try {
      const { data } = await request<ValidateResult>(apiRoot, token, '/imports/employees/validate', {
        method: 'POST', body: JSON.stringify({ csv }),
      })
      setValidation(data)
    } catch (reason) {
      setValidation(null)
      setError(messageOf(reason, 'Validation failed'))
    } finally {
      setBusy('')
    }
  }

  async function apply() {
    if (!validation) return
    setBusy('commit')
    setError('')
    try {
      const { data, message } = await request<CommitResult>(apiRoot, token, '/imports/employees/commit', {
        method: 'POST',
        body: JSON.stringify({ csv, ...(defaultPasscode.trim() ? { defaultPasscode: defaultPasscode.trim() } : {}) }),
      })
      setCommit(data)
      setValidation(null)
      await onChanged(message || 'Import applied')
    } catch (reason) {
      setError(messageOf(reason, 'Import failed'))
    } finally {
      setBusy('')
    }
  }

  async function assignLocation() {
    if (!bulkLocation || !bulkEmployees.length) {
      setError('Pick a work location and at least one employee')
      return
    }
    setBusy('assign')
    setError('')
    try {
      const { message } = await request<{ assigned: number }>(apiRoot, token, `/org/work-locations/${bulkLocation}/assign`, {
        method: 'POST', body: JSON.stringify({ employeeIds: bulkEmployees }),
      })
      setBulkEmployees([])
      await onChanged(message || 'Employees assigned')
    } catch (reason) {
      setError(messageOf(reason, 'Could not assign employees'))
    } finally {
      setBusy('')
    }
  }

  function downloadReport(rows: ReportRow[], name: string) {
    saveBlob(
      toCsvBlob(
        ['line', 'employeeId', 'name', 'email', 'workLocation', 'action', 'errors', 'warnings'],
        rows.map((row) => ({ ...row, errors: row.errors.join('; '), warnings: row.warnings.join('; ') })),
      ),
      name,
    )
  }

  const report = commit?.rows || validation?.rows || []

  if (loading) {
    return (
      <SectionCard title="Data migration" description="Loading reference data">
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="animate-in rounded-lg border border-red-200 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <SectionCard
        title="Import employees from a spreadsheet"
        description="Upload a CSV to migrate your existing employee register. Nothing is saved until you review the validation report and confirm."
        icon={<FileSpreadsheet className="h-4 w-4" />}
        actions={
          <button type="button" onClick={() => void downloadTemplate()} disabled={busy !== ''} className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm disabled:cursor-not-allowed">
            {busy === 'template' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Template
          </button>
        }
      >
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            ['Download the template', 'It carries the exact column names and two example rows.'],
            ['Fill in your register', 'Match work locations, departments and designations by code or name.'],
            ['Validate, then apply', 'Row-level errors are reported before anything is written.'],
          ].map(([title, copy], index) => (
            <li key={title} className="flex gap-2.5 rounded-lg border border-line bg-surface-subtle p-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[11px] font-bold text-white">{index + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-xs leading-5 text-ink-soft">{copy}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-subtle px-4 py-8 text-center transition-colors hover:border-primary-400 hover:bg-primary-50">
              <Upload className="h-6 w-6 text-ink-muted" />
              <span className="text-sm font-semibold text-ink">{fileName || 'Choose a CSV file'}</span>
              <span className="text-xs text-ink-soft">Up to 2,000 rows per file</span>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => readFile(event.target.files?.[0] || null)}
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void validate()} disabled={!csv.trim() || busy !== ''} className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm disabled:cursor-not-allowed">
                {busy === 'validate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Validate file
              </button>
              <button
                type="button" onClick={() => void apply()}
                disabled={!validation || validation.summary.create + validation.summary.update === 0 || busy !== ''}
                title={validation ? undefined : 'Validate the file first'}
                className="gradient-button flex items-center gap-2 rounded-md px-3.5 py-2 text-sm disabled:cursor-not-allowed"
              >
                {busy === 'commit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Apply import
              </button>
              {(fileName || validation || commit) && (
                <button
                  type="button"
                  onClick={() => { setCsv(''); setFileName(''); setValidation(null); setCommit(null); if (fileInput.current) fileInput.current.value = '' }}
                  className="ghost-button px-3 py-2 text-sm"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Field label="Temporary passcode" hint="Given to newly created employees, who must change it at first sign-in. Defaults to 1234.">
              <input value={defaultPasscode} onChange={(event) => setDefaultPasscode(event.target.value)} placeholder="1234" className={fieldClass} />
            </Field>
            <div className="rounded-lg border border-line bg-surface-subtle p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">Work location codes</p>
              {reference?.workLocations.length ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {reference.workLocations.map((item) => (
                    <li key={item._id} className="chip border border-line bg-white text-ink-soft">{item.code}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-xs text-warning">No work locations yet. Add them in Organisation first, or the import cannot place anyone.</p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {(validation || commit) && (
        <SectionCard
          title={commit ? 'Import result' : 'Validation report'}
          description={commit ? 'The import has been applied. Rows that failed were skipped and are listed below.' : 'Nothing has been saved yet. Review the rows, then apply.'}
          actions={
            report.length ? (
              <button type="button" onClick={() => downloadReport(report, commit ? 'import-result.csv' : 'import-validation.csv')} className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                <Download className="h-4 w-4" /> Report
              </button>
            ) : undefined
          }
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {commit ? (
              <>
                <StatTile label="Created" value={commit.summary.created} tone="positive" />
                <StatTile label="Updated" value={commit.summary.updated} tone="info" />
                <StatTile label="Skipped" value={commit.summary.skipped} tone={commit.summary.skipped ? 'danger' : 'neutral'} />
                <StatTile label="Managers linked" value={commit.summary.managersLinked} />
              </>
            ) : validation ? (
              <>
                <StatTile label="Rows in file" value={validation.summary.total} />
                <StatTile label="Will create" value={validation.summary.create} tone="positive" />
                <StatTile label="Will update" value={validation.summary.update} tone="info" />
                <StatTile label="Blocked" value={validation.summary.invalid} tone={validation.summary.invalid ? 'danger' : 'neutral'} />
              </>
            ) : null}
          </div>

          {validation?.unknownColumns.length ? (
            <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-warning-soft px-3.5 py-2.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>These columns were not recognised and will be ignored: {validation.unknownColumns.join(', ')}</span>
            </p>
          ) : null}

          <DataTable
            headers={['Row', 'Employee', 'Email', 'Work location', 'Action', 'Findings']}
            searchable
            searchPlaceholder="Search rows, emails, or errors"
            defaultPageSize={25}
            rows={report.map((row) => [
              <span key={`${row.line}-line`} className="tabular-nums text-ink-soft">{row.line}</span>,
              <span key={`${row.line}-name`} className="font-semibold">{row.name || '-'}{row.employeeId ? <span className="ml-1.5 text-xs font-normal text-ink-soft">{row.employeeId}</span> : null}</span>,
              <span key={`${row.line}-email`} className="text-ink-soft">{row.email || '-'}</span>,
              <span key={`${row.line}-loc`}>{row.workLocation || <span className="text-ink-muted">Payroll address</span>}</span>,
              <Badge key={`${row.line}-action`} tone={row.action === 'skip' ? 'danger' : row.action === 'create' ? 'positive' : 'info'}>{row.action === 'skip' ? 'blocked' : row.action}</Badge>,
              <span key={`${row.line}-notes`} className="block max-w-md space-y-1">
                {row.errors.map((item) => <span key={item} className="block text-xs text-danger">{item}</span>)}
                {row.warnings.map((item) => <span key={item} className="block text-xs text-warning">{item}</span>)}
                {!row.errors.length && !row.warnings.length && <span className="text-xs text-ink-muted">No issues</span>}
              </span>,
            ])}
            empty="No rows to report"
          />
        </SectionCard>
      )}

      <SectionCard
        title="Assign employees to a work location"
        description="The location on an employee's record is the place of work printed on their payslip. Assign several people at once instead of editing them one by one."
        icon={<MapPin className="h-4 w-4" />}
      >
        {!locationOptions.length ? (
          <EmptyState
            icon={<MapPin className="h-5 w-5" />}
            label="No active work locations"
            hint="Add work locations under Organisation before assigning employees."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="space-y-3">
              <Field label="Work location" required>
                <SearchableSelect options={locationOptions} value={bulkLocation} onChange={setBulkLocation} placeholder="Search locations" required />
              </Field>
              <button
                type="button" onClick={() => void assignLocation()}
                disabled={!bulkLocation || !bulkEmployees.length || busy !== ''}
                className="gradient-button flex w-full items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm disabled:cursor-not-allowed"
              >
                {busy === 'assign' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Assign {bulkEmployees.length || ''} employee{bulkEmployees.length === 1 ? '' : 's'}
              </button>
              <p className="text-xs text-ink-soft">
                Employees without a location fall back to the company payroll address on their payslip.
              </p>
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-ink">Select employees</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setBulkEmployees(employees.map((item) => item._id))} className="ghost-button px-2 py-1 text-xs">Select all</button>
                  <button type="button" onClick={() => setBulkEmployees([])} disabled={!bulkEmployees.length} className="ghost-button px-2 py-1 text-xs disabled:opacity-40">Clear</button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
                {employees.length ? employees.map((employee) => {
                  const checked = bulkEmployees.includes(employee._id)
                  return (
                    <label key={employee._id} className="flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-2 text-sm last:border-b-0 hover:bg-surface-subtle">
                      <input
                        type="checkbox" checked={checked}
                        onChange={(event) => setBulkEmployees((current) => (
                          event.target.checked ? [...current, employee._id] : current.filter((id) => id !== employee._id)
                        ))}
                        className="h-4 w-4 accent-primary-600"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{employee.name}</span>
                      <span className="shrink-0 text-xs text-ink-soft">{employee.employeeId}</span>
                    </label>
                  )
                }) : (
                  <p className="px-3 py-8 text-center text-sm text-ink-soft">No employees yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
