'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Briefcase, CalendarDays, Download, KeyRound, Laptop, Loader2, Mail,
  MapPin, Pencil, Phone, Save, ShieldCheck, Wallet, X,
} from 'lucide-react'

import EmployeeFormFields, { useEmployeeFormState, type OrgPickerProps } from './EmployeeForm'
import { Badge, DataTable, EmptyState, KeyValue, SectionCard, StatTile, TabBar, type EmployeeProfileTab, type Option } from './ui'

type EmployeeLike = {
  _id: string
  companyId?: string
  employeeId: string
  firstName?: string
  lastName?: string
  name: string
  email: string
  phone?: string | null
  role: string
  status: string
  department?: string
  designation?: string
  departmentId?: string | null
  designationId?: string | null
  employmentType?: string
  dateOfJoining?: string
  lastWorkingDate?: string | null
  managerId?: string | null
  workLocationId?: string | null
  dateOfBirth?: string | null
  profile?: Record<string, string>
  permissionGrants?: string[]
  permissionRevokes?: string[]
}
type SalaryStructure = {
  payrollEnabled?: boolean
  monthlyGross?: number
  annualCtc?: number
  basic?: number
  hra?: number
  effectiveFrom?: string
  pfApplicable?: boolean
  esiApplicable?: boolean
  uan?: string
  esiNumber?: string
  pan?: string
  bankName?: string
  bankAccountLast4?: string
  paymentMode?: string
}

type Payslip = {
  _id: string
  period: string
  status: string
  paymentStatus?: string
  net: number
  salaryGross?: number
  gross: number
  deductions: number
  paidAt?: string | null
}

type AttendanceDay = { date: string; status: string; payableDays: number; lossOfPayDays: number; workDuration?: number; isLate?: boolean }
type LeaveRow = { _id: string; leaveType: string; startDate: string; endDate: string; days: number; status: string; reason?: string }
type Balance = { balances?: Record<string, { total: number; used: number; remaining: number }> }
type Asset = {
  _id: string
  assetTag: string
  name: string
  category: string
  make?: string | null
  model?: string | null
  condition: string
  status: string
  currentAssignment?: { assignedAt?: string | null; expectedReturnAt?: string | null } | null
}

type Props = {
  apiRoot: string
  token: string
  employee: EmployeeLike
  tab: EmployeeProfileTab
  period: string
  canManageSalary: boolean
  canEdit: boolean
  workLocationName?: string
  managerName?: string
  roleOptions: string[]
  managerOptions: Option[]
  onBack: () => void
  onContextChange: (tab: EmployeeProfileTab, period: string) => void
  onSave: (values: Record<string, unknown>) => Promise<void>
  onResetPassword?: () => void
  onOpenPayroll?: () => void
} & OrgPickerProps

function money(value?: number | null) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0)
}

function date(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function humanize(value: string) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
export default function EmployeeProfile({
  apiRoot, token, employee, tab, period, canManageSalary, canEdit, workLocationName, managerName,
  roleOptions, managerOptions, departments, designations, workLocations, onBack, onContextChange,
  onSave, onResetPassword, onOpenPayroll,
}: Props) {
  const [salary, setSalary] = useState<SalaryStructure | null>(null)
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [attendance, setAttendance] = useState<{ summary: Record<string, number>; days: AttendanceDay[] } | null>(null)
  const [leaves, setLeaves] = useState<LeaveRow[]>([])
  const [balance, setBalance] = useState<Balance | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loaded, setLoaded] = useState<EmployeeProfileTab[]>([])
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const form = useEmployeeFormState(employee, workLocations)

  const request = useCallback(async <T,>(path: string): Promise<T> => {
    const response = await fetch(`${apiRoot}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.message || 'Request failed')
    return (body?.data || {}) as T
  }, [apiRoot, token])

  const loadTab = useCallback(async (target: EmployeeProfileTab, forPeriod: string) => {
    setError('')
    try {
      if (target === 'salary' && canManageSalary && !loaded.includes('salary')) {
        setLoading('salary')
        const data = await request<{ salaryStructure?: { structure?: SalaryStructure } }>(`/payroll/salary-structures/${employee._id}`)
        setSalary(data.salaryStructure?.structure || {})
      } else if (target === 'payslips' && canManageSalary && !loaded.includes('payslips')) {
        setLoading('payslips')
        const params = new URLSearchParams({ employeeId: employee._id, page: '1', limit: '100' })
        const data = await request<{ payroll?: Payslip[] }>(`/payroll?${params.toString()}`)
        setPayslips(data.payroll || [])
      } else if (target === 'attendance') {
        setLoading('attendance')
        const data = await request<{ summary: Record<string, number>; days: AttendanceDay[] }>(`/attendance/employee/${employee._id}?period=${forPeriod}`)
        setAttendance({ summary: data.summary || {}, days: data.days || [] })
      } else if (target === 'leave' && !loaded.includes('leave')) {
        setLoading('leave')
        const [history, bal] = await Promise.all([
          request<{ leaves?: LeaveRow[] }>(`/leaves/employee/${employee._id}?page=1&limit=100`),
          request<{ balance?: Balance }>(`/leaves/balance?employeeId=${employee._id}`).catch(() => ({ balance: null })),
        ])
        setLeaves(history.leaves || [])
        setBalance(bal.balance || null)
      } else if (target === 'assets' && !loaded.includes('assets')) {
        setLoading('assets')
        const data = await request<{ assets?: Asset[] }>(`/assets?employeeId=${employee._id}&page=1&limit=100`)
        setAssets(data.assets || [])
      }
      if (!['overview', 'attendance', 'access'].includes(target)) {
        setLoaded((current) => current.includes(target) ? current : [...current, target])
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this section')
    } finally {
      setLoading('')
    }
  }, [request, employee._id, canManageSalary, loaded])

  useEffect(() => { if (!editing) void loadTab(tab, period) }, [tab, period, editing, loadTab])
  const tabs = useMemo(() => ([
    { key: 'overview' as const, label: 'Overview' },
    ...(canManageSalary ? [{ key: 'salary' as const, label: 'Salary' }] : []),
    ...(canManageSalary ? [{ key: 'payslips' as const, label: 'Payslips', count: payslips.length || undefined }] : []),
    { key: 'attendance' as const, label: 'Attendance' },
    { key: 'leave' as const, label: 'Leave', count: leaves.length || undefined },
    { key: 'assets' as const, label: 'Assets', count: assets.length || undefined },
    { key: 'access' as const, label: 'Access' },
  ]), [canManageSalary, payslips.length, leaves.length, assets.length])

  const profile = employee.profile || {}

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget))
      await onSave({
        ...values,
        managerId: form.managerId || null,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
        workLocationId: form.workLocationId || null,
        lastWorkingDate: values.lastWorkingDate || '',
      })
      setEditing(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save employee details')
    } finally {
      setSaving(false)
    }
  }

  async function downloadPayslip(payslip: Payslip) {
    try {
      const response = await fetch(`${apiRoot}/payroll/${payslip._id}/download`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('Could not download the payslip')
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `payslip-${employee.employeeId}-${payslip.period}.html`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not download the payslip')
    }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="ghost-button inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Back to employees
      </button>

      <SectionCard
        title={employee.name}
        description={[employee.designation, employee.department].filter(Boolean).join(' · ') || 'No placement recorded'}
        actions={(
          <>
            {canEdit && !editing && (
              <button type="button" onClick={() => setEditing(true)} className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold">
                <Pencil className="h-4 w-4" /> Edit profile
              </button>
            )}
            {onOpenPayroll && canManageSalary && !editing && (
              <button type="button" onClick={onOpenPayroll} className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold">
                <Wallet className="h-4 w-4" /> Payroll
              </button>
            )}
            {onResetPassword && !editing && (
              <button type="button" onClick={onResetPassword} className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4" /> Reset password
              </button>
            )}
          </>
        )}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-soft">
          <span className="font-semibold text-ink">{employee.employeeId}</span>
          <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {employee.email}</span>
          {employee.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {employee.phone}</span>}
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {workLocationName || 'Payroll address'}</span>
          <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> {humanize(employee.role)}</span>
          <Badge tone={employee.status === 'inactive' ? 'danger' : 'positive'}>{employee.status}</Badge>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>}

        {editing ? (
          <form onSubmit={saveProfile} className="mt-5 space-y-6 border-t border-line pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-3.5 py-3">
              <div><p className="text-sm font-bold text-primary-800">Edit employee profile</p><p className="mt-0.5 text-xs text-primary-700">Changes stay on this organized profile; no separate popup is opened.</p></div>
              <button type="button" onClick={() => { setEditing(false); setError('') }} className="ghost-button inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold"><X className="h-4 w-4" /> Cancel</button>
            </div>
            <EmployeeFormFields
              mode="edit" employee={employee} roleOptions={roleOptions} managerOptions={managerOptions}
              departments={departments} designations={designations} workLocations={workLocations} {...form}
            />
            <div className="sticky bottom-3 flex justify-end gap-2 rounded-lg border border-line bg-white/95 p-3 shadow-raised backdrop-blur">
              <button type="button" onClick={() => { setEditing(false); setError('') }} className="neu-button rounded-md px-4 py-2 text-sm font-semibold">Cancel</button>
              <button disabled={saving} className="gradient-button inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="mt-4"><TabBar value={tab} onChange={(next) => onContextChange(next, period)} tabs={tabs} /></div>
            {loading && <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" /> Loading {loading}</p>}

            {tab === 'overview' && (
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border border-line p-3.5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Placement</p><KeyValue label="Department" value={employee.department || '-'} /><KeyValue label="Designation" value={employee.designation || '-'} /><KeyValue label="Work location" value={workLocationName || 'Payroll address'} /><KeyValue label="Reporting manager" value={managerName || 'None'} /><KeyValue label="Employment type" value={humanize(employee.employmentType || 'full_time')} /></div>
                <div className="rounded-lg border border-line p-3.5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Records</p><KeyValue label="Joined" value={date(employee.dateOfJoining)} /><KeyValue label="Last working day" value={date(employee.lastWorkingDate)} /><KeyValue label="Date of birth" value={date(employee.dateOfBirth)} /><KeyValue label="Sign-in role" value={humanize(employee.role)} /></div>
                <div className="rounded-lg border border-line p-3.5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Contact</p><KeyValue label="Email" value={employee.email} /><KeyValue label="Phone" value={employee.phone || '-'} /><KeyValue label="City" value={profile.city || '-'} /><KeyValue label="State" value={profile.state || '-'} /><KeyValue label="Emergency contact" value={profile.emergencyContactName || '-'} /></div>
              </div>
            )}
            {tab === 'salary' && canManageSalary && (
              salary?.payrollEnabled ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatTile label="Monthly gross" value={money(salary.monthlyGross)} /><StatTile label="Annual CTC" value={money(salary.annualCtc)} /><StatTile label="Basic" value={money(salary.basic)} /><StatTile label="HRA" value={money(salary.hra)} /></div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-line p-3.5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Statutory</p><KeyValue label="Provident fund" value={salary.pfApplicable ? 'Applies' : 'Not applicable'} /><KeyValue label="UAN" value={salary.uan || '-'} /><KeyValue label="ESI" value={salary.esiApplicable ? 'Applies' : 'Not applicable'} /><KeyValue label="ESI number" value={salary.esiNumber || '-'} /><KeyValue label="PAN" value={salary.pan || '-'} /></div>
                    <div className="rounded-lg border border-line p-3.5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Payment</p><KeyValue label="Mode" value={humanize(salary.paymentMode || 'bank_transfer')} /><KeyValue label="Bank" value={salary.bankName || '-'} /><KeyValue label="Account" value={salary.bankAccountLast4 ? `•••• ${salary.bankAccountLast4}` : '-'} /><KeyValue label="Effective from" value={date(salary.effectiveFrom)} /></div>
                  </div>
                </div>
              ) : !loading && <div className="mt-4"><EmptyState icon={<Wallet className="h-5 w-5" />} label="No salary structure" hint="Without one this employee is skipped by every payroll run." action={onOpenPayroll ? <button type="button" onClick={onOpenPayroll} className="gradient-button rounded-md px-3.5 py-2 text-sm font-semibold">Set up salary</button> : undefined} /></div>
            )}

            {tab === 'payslips' && canManageSalary && (
              payslips.length ? <div className="mt-4"><DataTable headers={['Month', 'Gross', 'Deductions', 'Net', 'Status', 'Payment', '']} rows={payslips.map((item) => [
                <span key="p" className="font-semibold tabular-nums">{item.period}</span>, <span key="g" className="tabular-nums">{money(item.salaryGross ?? item.gross)}</span>, <span key="d" className="tabular-nums">{money(item.deductions)}</span>, <span key="n" className="font-semibold tabular-nums">{money(item.net)}</span>, <Badge key="s">{item.status}</Badge>, <span key="pay" className="text-xs text-ink-soft">{item.paymentStatus === 'paid' ? `Paid ${date(item.paidAt)}` : 'Unpaid'}</span>, <button key="dl" type="button" onClick={() => void downloadPayslip(item)} className="ghost-button inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> Download</button>,
              ])} defaultPageSize={12} /></div> : !loading && <div className="mt-4"><EmptyState label="No payslips yet" hint="Payslips appear here once payroll has been generated for this employee." /></div>
            )}

            {tab === 'attendance' && (
              <div className="mt-4 space-y-4">
                <label className="inline-flex items-center gap-2 text-sm font-semibold">Month<input type="month" value={period} onChange={(event) => onContextChange('attendance', event.target.value || new Date().toISOString().slice(0, 7))} className="rounded-md border border-line bg-white px-2.5 py-1.5 text-sm font-semibold tabular-nums" /></label>
                {attendance && <><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5"><StatTile label="Scheduled" value={attendance.summary.scheduledDays ?? '-'} /><StatTile label="Payable" value={attendance.summary.payableDays ?? '-'} tone="positive" /><StatTile label="Present" value={attendance.summary.presentDays ?? '-'} /><StatTile label="Loss of pay" value={attendance.summary.lossOfPayDays ?? '-'} tone="danger" /><StatTile label="Weekly offs" value={attendance.summary.weeklyOffDays ?? '-'} /></div>{attendance.days.length ? <DataTable headers={['Date', 'Status', 'Payable', 'Loss of pay', 'Hours']} rows={attendance.days.map((day) => [<span key="d" className="whitespace-nowrap tabular-nums">{day.date}</span>, <Badge key="s" tone={day.status === 'weekly_off' || day.status === 'holiday' ? 'neutral' : day.lossOfPayDays > 0 ? 'danger' : 'positive'}>{humanize(day.status)}</Badge>, <span key="p" className="tabular-nums">{day.payableDays}</span>, <span key="l" className={`tabular-nums ${day.lossOfPayDays > 0 ? 'font-semibold text-danger' : ''}`}>{day.lossOfPayDays}</span>, <span key="h" className="tabular-nums">{day.workDuration ? `${Math.round(day.workDuration / 6) / 10} h` : '-'}</span>])} defaultPageSize={31} /> : <EmptyState icon={<CalendarDays className="h-5 w-5" />} label="Nothing recorded for this month" />}</>}
              </div>
            )}
            {tab === 'leave' && (
              <div className="mt-4 space-y-4">
                {balance?.balances && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(balance.balances).map(([code, bucket]) => <div key={code} className="rounded-lg border border-line bg-surface-subtle px-3 py-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{humanize(code)}</p><p className="mt-0.5 text-sm font-bold tabular-nums text-ink">{bucket.remaining} left</p><p className="text-xs text-ink-soft">{bucket.used} used of {bucket.total}</p></div>)}</div>}
                {leaves.length ? <DataTable headers={['Type', 'From', 'To', 'Days', 'Status', 'Reason']} rows={leaves.map((item) => [<span key="t">{humanize(item.leaveType)}</span>, <span key="f" className="whitespace-nowrap tabular-nums">{date(item.startDate)}</span>, <span key="e" className="whitespace-nowrap tabular-nums">{date(item.endDate)}</span>, <span key="d" className="tabular-nums">{item.days}</span>, <Badge key="s">{item.status}</Badge>, <span key="r" className="text-xs text-ink-soft">{item.reason || '-'}</span>])} defaultPageSize={15} /> : !loading && <EmptyState label="No leave requests" hint="Requests appear here as soon as this employee applies." />}
              </div>
            )}

            {tab === 'assets' && (
              <div className="mt-4">
                {assets.length ? <DataTable headers={['Asset', 'Tag', 'Category', 'Condition', 'Assigned', 'Expected return', 'Status']} rows={assets.map((asset) => [<div key="asset"><p className="font-semibold text-ink">{asset.name}</p><p className="text-xs text-ink-soft">{[asset.make, asset.model].filter(Boolean).join(' ') || 'No model recorded'}</p></div>, <span key="tag" className="font-mono text-xs font-semibold">{asset.assetTag}</span>, humanize(asset.category), <Badge key="condition">{asset.condition}</Badge>, date(asset.currentAssignment?.assignedAt), date(asset.currentAssignment?.expectedReturnAt), <Badge key="status" tone={asset.status === 'assigned' ? 'positive' : 'neutral'}>{asset.status}</Badge>])} defaultPageSize={15} /> : !loading && <EmptyState icon={<Laptop className="h-5 w-5" />} label="No assets in custody" hint="Current laptop, device, and other asset assignments appear here." />}
              </div>
            )}

            {tab === 'access' && (
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border border-line p-3.5"><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-muted"><ShieldCheck className="h-4 w-4" /> Role access</p><KeyValue label="Assigned role" value={humanize(employee.role)} /><KeyValue label="Account status" value={humanize(employee.status)} /><p className="mt-3 text-xs leading-5 text-ink-soft">The assigned role provides the company defaults. Change the role through Edit profile.</p></div>
                <div className="rounded-lg border border-line p-3.5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Additional access</p>{employee.permissionGrants?.length ? <div className="flex flex-wrap gap-2">{employee.permissionGrants.map((permission) => <Badge key={permission} tone="positive">{humanize(permission)}</Badge>)}</div> : <p className="text-sm text-ink-soft">No access added beyond the role.</p>}</div>
                <div className="rounded-lg border border-line p-3.5"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Restricted access</p>{employee.permissionRevokes?.length ? <div className="flex flex-wrap gap-2">{employee.permissionRevokes.map((permission) => <Badge key={permission} tone="danger">{humanize(permission)}</Badge>)}</div> : <p className="text-sm text-ink-soft">No role permissions have been removed.</p>}</div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  )
}
