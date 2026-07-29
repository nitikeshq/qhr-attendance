'use client'

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, ChevronRight, Circle, ListChecks, Loader2, MinusCircle, Plus, RefreshCw, Rocket, Trash2,
} from 'lucide-react'
import {
  Badge,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  KeyValue,
  SearchableSelect,
  SectionCard,
  TabBar,
  fieldClass,
  humanize,
  type Option,
} from './ui'

type StepKey =
  | 'company_profile'
  | 'payroll_identity'
  | 'work_locations'
  | 'org_structure'
  | 'statutory'
  | 'attendance_policy'
  | 'leave_policy'
  | 'holidays'
  | 'team'
  | 'review'

type OnboardingStep = {
  key: StepKey
  title: string
  description?: string
  required: boolean
  complete: boolean
  skipped: boolean
  missing: string[]
  summary: string
}

type ProfileData = {
  name?: string; email?: string; phone?: string | null; domain?: string | null
  registeredAddress?: string; city?: string; state?: string; pincode?: string
  industry?: string; foundedOn?: string; timezone?: string
}

type SettingsData = {
  officeStart?: string; officeEnd?: string; timezone?: string
  gpsTracking?: boolean; autoCheckIn?: boolean; requirePhotoAttendance?: boolean
  attendancePolicy?: { payrollImpact?: string; fullDayMinutes?: number; halfDayMinutes?: number; lateGraceMinutes?: number }
}

type PayrollSettingsData = {
  currency?: string; payFrequency?: string; paymentDay?: number
  identity?: {
    legalName?: string; registeredAddress?: string; state?: string; pan?: string; tan?: string; gstin?: string
    pfEstablishmentCode?: string; esiEmployerCode?: string; payslipFooter?: string
  }
  statutory?: {
    pfEnabled?: boolean; esiEnabled?: boolean; professionalTaxEnabled?: boolean
    labourWelfareFundEnabled?: boolean; gratuityEnabled?: boolean; tdsEnabled?: boolean
  }
}

type WorkLocationData = {
  _id?: string; name?: string; code?: string; addressLine?: string; city?: string; state?: string; pincode?: string
  timezone?: string; isPayrollAddress?: boolean; pfEstablishmentCode?: string; esiEmployerCode?: string; status?: string
}

type DepartmentData = { _id?: string; name?: string; code?: string; parentDepartmentId?: string | null; headEmployeeId?: string | null; status?: string }
type DesignationData = { _id?: string; name?: string; code?: string; level?: number; departmentId?: string | null; status?: string }
type LeaveTypeData = { code?: string; name?: string; annualAllowance?: number; paid?: boolean; payrollTreatment?: string }
type HolidayData = { date?: string; name?: string; paid?: boolean }
type AreaData = { _id?: string; name?: string; address?: string; latitude?: number; longitude?: number; radiusMeters?: number; active?: boolean }

type SnapshotData = {
  profile?: ProfileData
  settings?: SettingsData
  payrollSettings?: PayrollSettingsData
  workLocations?: WorkLocationData[]
  departments?: DepartmentData[]
  designations?: DesignationData[]
  leaveTypes?: LeaveTypeData[]
  holidays?: HolidayData[]
  attendanceAreas?: AreaData[]
  employeeCount?: number
}

type Snapshot = {
  status: 'in_progress' | 'completed'
  progress: { completedRequired: number; totalRequired: number; percent: number }
  canComplete: boolean
  completedAt?: string | null
  currentStep?: StepKey | null
  steps: OnboardingStep[]
  data: SnapshotData
}

type ProfileForm = {
  name: string; email: string; phone: string; domain: string; registeredAddress: string
  city: string; state: string; pincode: string; industry: string; foundedOn: string; timezone: string
  officeStart: string; officeEnd: string
}

type IdentityForm = {
  legalName: string; registeredAddress: string; state: string; pan: string; tan: string; gstin: string
  pfEstablishmentCode: string; esiEmployerCode: string; payslipFooter: string
  currency: string; payFrequency: string; paymentDay: string
}

type LocationRow = {
  _id?: string; name: string; code: string; addressLine: string; city: string; state: string; pincode: string
  timezone: string; isPayrollAddress: boolean; pfEstablishmentCode: string; esiEmployerCode: string; status: string
}

type DepartmentRow = { _id?: string; name: string; code: string; parentDepartmentId: string; headEmployeeId: string; status: string }
type DesignationRow = { _id?: string; name: string; code: string; level: string; departmentId: string; status: string }
type StatutoryForm = {
  pfEnabled: boolean; esiEnabled: boolean; professionalTaxEnabled: boolean
  labourWelfareFundEnabled: boolean; gratuityEnabled: boolean; tdsEnabled: boolean
}
type AttendanceForm = {
  payrollImpact: string; fullDayMinutes: string; halfDayMinutes: string; lateGraceMinutes: string
  gpsTracking: boolean; autoCheckIn: boolean; requirePhotoAttendance: boolean
}
type AreaRow = { _id?: string; name: string; address: string; latitude: string; longitude: string; radiusMeters: string; active: boolean }
type LeaveTypeRow = { code: string; name: string; annualAllowance: string; paid: boolean; payrollTreatment: string }
type HolidayRow = { date: string; name: string; paid: boolean }

type Drafts = {
  profile: ProfileForm
  identity: IdentityForm
  locations: LocationRow[]
  departments: DepartmentRow[]
  designations: DesignationRow[]
  statutory: StatutoryForm
  attendance: AttendanceForm
  areas: AreaRow[]
  leaveTypes: LeaveTypeRow[]
  holidays: HolidayRow[]
}

type Props = {
  apiRoot: string
  token: string
  role: 'hr' | 'admin'
  onChanged: (message: string) => Promise<void> | void
}

type ApiError = Error & { status?: number; missing?: string[] }

const stepOrder: StepKey[] = [
  'company_profile', 'payroll_identity', 'work_locations', 'org_structure', 'statutory',
  'attendance_policy', 'leave_policy', 'holidays', 'team', 'review',
]

const stepMeta: Record<StepKey, { title: string; description: string }> = {
  company_profile: { title: 'Company profile', description: 'Registered identity, contact details, and office hours.' },
  payroll_identity: { title: 'Payroll identity', description: 'Statutory identifiers printed on payslips and filings.' },
  work_locations: { title: 'Work locations', description: 'Offices and sites employees are mapped to.' },
  org_structure: { title: 'Organisation structure', description: 'Departments and designations for your reporting lines.' },
  statutory: { title: 'Statutory setup', description: 'Which deductions and contributions apply to this company.' },
  attendance_policy: { title: 'Attendance policy', description: 'Working-day rules, tracking, and geofenced areas.' },
  leave_policy: { title: 'Leave policy', description: 'Leave types, allowances, and payroll treatment.' },
  holidays: { title: 'Holiday calendar', description: 'Company holidays for the current year.' },
  team: { title: 'Team', description: 'Invite the people who will use QHR.' },
  review: { title: 'Review & go live', description: 'Confirm everything before switching the workspace on.' },
}

const adminOnlySteps: StepKey[] = ['payroll_identity', 'statutory']

const timezoneOptions: Option[] = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata', hint: 'IST (UTC+05:30)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai', hint: 'GST (UTC+04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore', hint: 'SGT (UTC+08:00)' },
  { value: 'Europe/London', label: 'Europe/London', hint: 'GMT / BST' },
  { value: 'America/New_York', label: 'America/New_York', hint: 'ET' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles', hint: 'PT' },
  { value: 'UTC', label: 'UTC', hint: 'Coordinated Universal Time' },
]

const industryOptions: Option[] = [
  'information_technology', 'software_services', 'manufacturing', 'retail', 'healthcare', 'education',
  'financial_services', 'logistics', 'construction', 'hospitality', 'media', 'consulting', 'other',
].map((value) => ({ value, label: humanize(value) }))

const stateOptions: Option[] = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
].map((value) => ({ value, label: value }))

const currencyOptions: Option[] = [
  { value: 'INR', label: 'INR', hint: 'Indian Rupee' },
  { value: 'USD', label: 'USD', hint: 'US Dollar' },
  { value: 'AED', label: 'AED', hint: 'UAE Dirham' },
  { value: 'SGD', label: 'SGD', hint: 'Singapore Dollar' },
  { value: 'GBP', label: 'GBP', hint: 'Pound Sterling' },
]

const payFrequencyOptions: Option[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'semi_monthly', label: 'Semi monthly' },
  { value: 'weekly', label: 'Weekly' },
]

const payrollImpactOptions: Option[] = [
  { value: 'none', label: 'No payroll impact', hint: 'Attendance is tracked only' },
  { value: 'leave_only', label: 'Leave only', hint: 'Unpaid leave affects payable days' },
  { value: 'attendance_and_leave', label: 'Attendance and leave', hint: 'Absence and leave both affect payroll' },
]

const payrollTreatmentOptions: Option[] = [
  { value: 'paid', label: 'Paid leave' },
  { value: 'unpaid', label: 'Loss of pay' },
]

const statusOptions: Option[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const statutoryFields: Array<{ key: keyof StatutoryForm; label: string; hint: string }> = [
  { key: 'pfEnabled', label: 'Provident fund (PF)', hint: 'Employee and employer contributions on eligible wages.' },
  { key: 'esiEnabled', label: 'Employee state insurance (ESI)', hint: 'Applies below the ESI gross ceiling.' },
  { key: 'professionalTaxEnabled', label: 'Professional tax', hint: 'State-level monthly deduction.' },
  { key: 'labourWelfareFundEnabled', label: 'Labour welfare fund', hint: 'Periodic state contribution.' },
  { key: 'gratuityEnabled', label: 'Gratuity', hint: 'Accrued for employees crossing eligibility.' },
  { key: 'tdsEnabled', label: 'TDS on salary', hint: 'Income tax deducted at source each month.' },
]

async function request<T>(
  apiRoot: string, token: string, path: string, options: RequestInit = {},
): Promise<{ data: T; message: string }> {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  })
  const payload = (await response.json().catch(() => ({}))) as {
    data?: T & { missing?: string[] }
    details?: { missing?: string[] }
    message?: string
    missing?: string[]
  }
  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status})`) as ApiError
    error.status = response.status
    // The API returns aggregated blockers under `details` (see utils/responses.js fail()).
    error.missing = payload.details?.missing || payload.missing || payload.data?.missing || []
    throw error
  }
  return { data: payload.data as T, message: payload.message || '' }
}

function messageOf(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function numberText(value: unknown, fallback: string): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback
}

function toNumber(value: string, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatDate(value?: string | null): string {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function buildDrafts(data: SnapshotData): Drafts {
  const profile = data.profile || {}
  const settings = data.settings || {}
  const policy = settings.attendancePolicy || {}
  const payroll = data.payrollSettings || {}
  const identity = payroll.identity || {}
  const statutory = payroll.statutory || {}
  return {
    profile: {
      name: text(profile.name),
      email: text(profile.email),
      phone: text(profile.phone),
      domain: text(profile.domain),
      registeredAddress: text(profile.registeredAddress),
      city: text(profile.city),
      state: text(profile.state),
      pincode: text(profile.pincode),
      industry: text(profile.industry),
      foundedOn: text(profile.foundedOn),
      timezone: text(profile.timezone) || text(settings.timezone) || 'Asia/Kolkata',
      officeStart: text(settings.officeStart) || '09:30',
      officeEnd: text(settings.officeEnd) || '18:30',
    },
    identity: {
      legalName: text(identity.legalName) || text(profile.name),
      registeredAddress: text(identity.registeredAddress) || text(profile.registeredAddress),
      state: text(identity.state) || text(profile.state),
      pan: text(identity.pan),
      tan: text(identity.tan),
      gstin: text(identity.gstin),
      pfEstablishmentCode: text(identity.pfEstablishmentCode),
      esiEmployerCode: text(identity.esiEmployerCode),
      payslipFooter: text(identity.payslipFooter),
      currency: text(payroll.currency) || 'INR',
      payFrequency: text(payroll.payFrequency) || 'monthly',
      paymentDay: numberText(payroll.paymentDay, '1'),
    },
    locations: (data.workLocations || []).map((item) => ({
      _id: item._id,
      name: text(item.name),
      code: text(item.code),
      addressLine: text(item.addressLine),
      city: text(item.city),
      state: text(item.state),
      pincode: text(item.pincode),
      timezone: text(item.timezone) || 'Asia/Kolkata',
      isPayrollAddress: item.isPayrollAddress === true,
      pfEstablishmentCode: text(item.pfEstablishmentCode),
      esiEmployerCode: text(item.esiEmployerCode),
      status: text(item.status) || 'active',
    })),
    departments: (data.departments || []).map((item) => ({
      _id: item._id,
      name: text(item.name),
      code: text(item.code),
      parentDepartmentId: text(item.parentDepartmentId),
      headEmployeeId: text(item.headEmployeeId),
      status: text(item.status) || 'active',
    })),
    designations: (data.designations || []).map((item) => ({
      _id: item._id,
      name: text(item.name),
      code: text(item.code),
      level: numberText(item.level, '1'),
      departmentId: text(item.departmentId),
      status: text(item.status) || 'active',
    })),
    statutory: {
      pfEnabled: statutory.pfEnabled === true,
      esiEnabled: statutory.esiEnabled === true,
      professionalTaxEnabled: statutory.professionalTaxEnabled === true,
      labourWelfareFundEnabled: statutory.labourWelfareFundEnabled === true,
      gratuityEnabled: statutory.gratuityEnabled === true,
      tdsEnabled: statutory.tdsEnabled === true,
    },
    attendance: {
      payrollImpact: text(policy.payrollImpact) || 'leave_only',
      fullDayMinutes: numberText(policy.fullDayMinutes, '480'),
      halfDayMinutes: numberText(policy.halfDayMinutes, '240'),
      lateGraceMinutes: numberText(policy.lateGraceMinutes, '15'),
      gpsTracking: settings.gpsTracking !== false,
      autoCheckIn: settings.autoCheckIn === true,
      requirePhotoAttendance: settings.requirePhotoAttendance === true,
    },
    areas: (data.attendanceAreas || []).map((item) => ({
      _id: item._id,
      name: text(item.name),
      address: text(item.address),
      latitude: numberText(item.latitude, ''),
      longitude: numberText(item.longitude, ''),
      radiusMeters: numberText(item.radiusMeters, '150'),
      active: item.active !== false,
    })),
    leaveTypes: (data.leaveTypes || []).map((item) => ({
      code: text(item.code),
      name: text(item.name),
      annualAllowance: numberText(item.annualAllowance, '0'),
      paid: item.paid !== false,
      payrollTreatment: text(item.payrollTreatment) || (item.paid === false ? 'unpaid' : 'paid'),
    })),
    holidays: (data.holidays || []).map((item) => ({
      date: text(item.date).slice(0, 10),
      name: text(item.name),
      paid: item.paid !== false,
    })),
  }
}

function buildPayload(step: StepKey, drafts: Drafts): Record<string, unknown> {
  if (step === 'company_profile') {
    const form = drafts.profile
    return {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      domain: form.domain.trim(),
      registeredAddress: form.registeredAddress.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      industry: form.industry,
      foundedOn: form.foundedOn.trim(),
      timezone: form.timezone,
      officeStart: form.officeStart,
      officeEnd: form.officeEnd,
    }
  }
  if (step === 'payroll_identity') {
    const form = drafts.identity
    return {
      identity: {
        legalName: form.legalName.trim(),
        registeredAddress: form.registeredAddress.trim(),
        state: form.state,
        pan: form.pan.trim().toUpperCase(),
        tan: form.tan.trim().toUpperCase(),
        gstin: form.gstin.trim().toUpperCase(),
        pfEstablishmentCode: form.pfEstablishmentCode.trim(),
        esiEmployerCode: form.esiEmployerCode.trim(),
        payslipFooter: form.payslipFooter.trim(),
      },
      currency: form.currency,
      payFrequency: form.payFrequency,
      paymentDay: toNumber(form.paymentDay, 1),
    }
  }
  if (step === 'work_locations') {
    return {
      workLocations: drafts.locations.map((row) => ({
        ...(row._id ? { _id: row._id } : {}),
        name: row.name.trim(),
        code: row.code.trim(),
        addressLine: row.addressLine.trim(),
        city: row.city.trim(),
        state: row.state,
        pincode: row.pincode.trim(),
        timezone: row.timezone,
        isPayrollAddress: row.isPayrollAddress,
        pfEstablishmentCode: row.pfEstablishmentCode.trim(),
        esiEmployerCode: row.esiEmployerCode.trim(),
        status: row.status,
      })),
    }
  }
  if (step === 'org_structure') {
    return {
      departments: drafts.departments.map((row) => ({
        ...(row._id ? { _id: row._id } : {}),
        name: row.name.trim(),
        code: row.code.trim(),
        parentDepartmentId: row.parentDepartmentId || null,
        headEmployeeId: row.headEmployeeId || null,
        status: row.status,
      })),
      designations: drafts.designations.map((row) => {
        // `name:` values point at a department created in this same save, so they
        // travel as a reference the backend resolves rather than as an id.
        const reference = row.departmentId || ''
        const unsaved = reference.startsWith('name:')
        return {
          ...(row._id ? { _id: row._id } : {}),
          name: row.name.trim(),
          code: row.code.trim(),
          level: toNumber(row.level, 1),
          departmentId: unsaved ? null : (reference || null),
          ...(unsaved ? { departmentRef: reference.slice('name:'.length) } : {}),
          status: row.status,
        }
      }),
    }
  }
  if (step === 'statutory') return { statutory: { ...drafts.statutory } }
  if (step === 'attendance_policy') {
    const form = drafts.attendance
    return {
      attendancePolicy: {
        payrollImpact: form.payrollImpact,
        fullDayMinutes: toNumber(form.fullDayMinutes, 480),
        halfDayMinutes: toNumber(form.halfDayMinutes, 240),
        lateGraceMinutes: toNumber(form.lateGraceMinutes, 15),
      },
      gpsTracking: form.gpsTracking,
      autoCheckIn: form.autoCheckIn,
      requirePhotoAttendance: form.requirePhotoAttendance,
      attendanceAreas: drafts.areas.map((row) => ({
        ...(row._id ? { _id: row._id } : {}),
        name: row.name.trim(),
        address: row.address.trim(),
        latitude: toNumber(row.latitude, 0),
        longitude: toNumber(row.longitude, 0),
        radiusMeters: toNumber(row.radiusMeters, 150),
        active: row.active,
      })),
    }
  }
  if (step === 'leave_policy') {
    return {
      leaveTypes: drafts.leaveTypes.map((row) => ({
        code: row.code.trim().toLowerCase(),
        name: row.name.trim(),
        annualAllowance: toNumber(row.annualAllowance, 0),
        paid: row.paid,
        payrollTreatment: row.payrollTreatment,
      })),
    }
  }
  if (step === 'holidays') {
    return {
      holidays: drafts.holidays.map((row) => ({
        date: row.date,
        name: row.name.trim(),
        paid: row.paid,
      })),
    }
  }
  return {}
}

function validate(step: StepKey, drafts: Drafts): string {
  if (step === 'company_profile') {
    const form = drafts.profile
    if (!form.name.trim()) return 'Company name is required.'
    if (!form.email.trim()) return 'A company contact email is required.'
    if (!form.timezone) return 'Pick the workspace timezone.'
    if (!form.officeStart || !form.officeEnd) return 'Office start and end times are required.'
  }
  if (step === 'payroll_identity') {
    const form = drafts.identity
    if (!form.legalName.trim()) return 'Legal company name is required.'
    if (!form.registeredAddress.trim()) return 'Registered office address is required.'
    if (!form.state) return 'Registered state is required.'
    const day = toNumber(form.paymentDay, 0)
    if (day < 1 || day > 28) return 'Payment day must be between 1 and 28.'
  }
  if (step === 'work_locations') {
    if (!drafts.locations.length) return 'Add at least one work location.'
    if (drafts.locations.some((row) => !row.name.trim())) return 'Every work location needs a name.'
    if (drafts.locations.some((row) => !row.city.trim())) return 'Every work location needs a city.'
  }
  if (step === 'org_structure') {
    if (!drafts.departments.length) return 'Add at least one department.'
    if (drafts.departments.some((row) => !row.name.trim())) return 'Every department needs a name.'
    if (drafts.designations.some((row) => !row.name.trim())) return 'Every designation needs a name.'
  }
  if (step === 'attendance_policy') {
    const form = drafts.attendance
    if (toNumber(form.fullDayMinutes, 0) <= 0) return 'Full day minutes must be greater than zero.'
    if (toNumber(form.halfDayMinutes, 0) <= 0) return 'Half day minutes must be greater than zero.'
    if (toNumber(form.halfDayMinutes, 0) >= toNumber(form.fullDayMinutes, 0)) return 'Half day minutes must be less than full day minutes.'
    if (drafts.areas.some((row) => !row.name.trim())) return 'Every geofence area needs a name.'
    if (drafts.areas.some((row) => row.latitude === '' || row.longitude === '')) return 'Every geofence area needs latitude and longitude.'
  }
  if (step === 'leave_policy') {
    if (!drafts.leaveTypes.length) return 'Add at least one leave type.'
    if (drafts.leaveTypes.some((row) => !row.code.trim() || !row.name.trim())) return 'Every leave type needs a code and a name.'
    const codes = drafts.leaveTypes.map((row) => row.code.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) return 'Leave type codes must be unique.'
  }
  if (step === 'holidays') {
    if (drafts.holidays.some((row) => !row.date)) return 'Every holiday needs a date.'
    if (drafts.holidays.some((row) => !row.name.trim())) return 'Every holiday needs a name.'
  }
  return ''
}

function InlineError({ message }: { message: string }) {
  if (!message) return null
  return <p className="mt-2 text-sm font-semibold text-danger">{message}</p>
}

function MissingPanel({ items, title }: { items: string[]; title: string }) {
  if (!items.length) return null
  return (
    <div className="mb-5 rounded-lg border border-amber-200 bg-warning-soft px-3.5 py-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-warning">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        {title}
      </p>
      {/* Chips rather than bullets: these are short field names, and a wrapping
          row reads as a compact checklist instead of a long ragged list. */}
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item} className="chip border border-amber-200 bg-white text-warning">{item}</li>
        ))}
      </ul>
    </div>
  )
}

function BlockedPanel({ items, message }: { items: string[]; message: string }) {
  if (!message && !items.length) return null
  return (
    <div className="rounded-lg border border-red-200 bg-danger-soft px-3.5 py-3">
      <p className="text-sm font-semibold text-danger">{message || 'This workspace cannot go live yet.'}</p>
      {items.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item} className="chip border border-red-200 bg-white text-danger">{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Toggle({ label, hint, checked, disabled = false, onChange }: {
  label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void
}) {
  return (
    <label className={`flex items-start gap-3 rounded-lg border border-line bg-surface-subtle px-3 py-2.5 text-sm ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <input
        type="checkbox" checked={checked} disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
      />
      <span className="min-w-0">
        <span className="font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-xs font-normal leading-relaxed text-ink-soft">{hint}</span>}
      </span>
    </label>
  )
}

function EditableRow({ label, error, disabled, onRemove, children }: {
  label: string; error?: string; disabled?: boolean; onRemove: () => void; children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-subtle p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
        <button
          type="button" onClick={onRemove} disabled={disabled}
          className="neu-button flex items-center gap-1.5 rounded-md px-2 py-1 text-xs disabled:cursor-not-allowed"
        >
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}

function AddRowButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm disabled:cursor-not-allowed"
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  )
}

function StepStateIcon({ step }: { step: OnboardingStep }) {
  if (step.complete) return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Complete" />
  if (step.skipped) return <MinusCircle className="h-4 w-4 shrink-0 text-ink-muted" aria-label="Skipped" />
  return <Circle className="h-4 w-4 shrink-0 fill-warning text-warning" aria-label="Incomplete" />
}

export default function OnboardingWorkspace({ apiRoot, token, role, onChanged }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [drafts, setDrafts] = useState<Drafts>(() => buildDrafts({}))
  const [active, setActive] = useState<StepKey>('company_profile')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState('')
  const [blocked, setBlocked] = useState<{ message: string; missing: string[] }>({ message: '', missing: [] })
  const [reviewTab, setReviewTab] = useState<'summary' | 'outstanding'>('summary')
  const [checklistOpen, setChecklistOpen] = useState(false)

  const isAdmin = role === 'admin'

  const applySnapshot = useCallback((next: Snapshot) => {
    setSnapshot(next)
    setDrafts(buildDrafts(next.data || {}))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await request<Snapshot>(apiRoot, token, '/onboarding')
      applySnapshot(data)
      setActive((current) => {
        const preferred = data.currentStep && stepOrder.includes(data.currentStep) ? data.currentStep : null
        return preferred && current === 'company_profile' ? preferred : current
      })
    } catch (reason) {
      setError(messageOf(reason, 'Could not load the onboarding checklist'))
    } finally {
      setLoading(false)
    }
  }, [apiRoot, applySnapshot, token])

  useEffect(() => { void load() }, [load])

  const steps = useMemo<OnboardingStep[]>(() => {
    const fromApi = snapshot?.steps || []
    return stepOrder.map((key) => {
      const found = fromApi.find((step) => step.key === key)
      return {
        key,
        title: found?.title || stepMeta[key].title,
        description: found?.description || stepMeta[key].description,
        required: found ? found.required : key !== 'holidays',
        complete: found?.complete === true,
        skipped: found?.skipped === true,
        missing: found?.missing || [],
        summary: found?.summary || '',
      }
    })
  }, [snapshot])

  const activeStep = useMemo(() => steps.find((step) => step.key === active) || steps[0], [steps, active])
  const activeIndex = stepOrder.indexOf(active)
  const outstanding = useMemo(() => steps
    .filter((step) => step.required && !step.complete && step.key !== 'review')
    .flatMap((step) => (step.missing.length ? step.missing.map((item) => `${step.title}: ${item}`) : [`${step.title} is incomplete`])),
  [steps])

  // Departments typed in this session have no id yet. They used to be filtered
  // out, which left the designation dropdown empty. Unsaved rows are now offered
  // under a `name:` reference that the backend resolves when both lists are saved
  // together.
  const departmentOptions = useMemo<Option[]>(() => drafts.departments
    .filter((row) => row.name.trim())
    .map((row) => ({
      value: row._id || `name:${row.name.trim()}`,
      label: row.name.trim(),
      hint: row._id ? (row.code || undefined) : 'Saves with this step',
    })),
  [drafts.departments])

  const locked = adminOnlySteps.includes(active) && !isAdmin
  const progress = snapshot?.progress || { completedRequired: 0, totalRequired: stepOrder.length - 1, percent: 0 }
  const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)))

  function advance(from: StepKey) {
    const fromIndex = stepOrder.indexOf(from)
    const nextIncomplete = steps.find((step, index) => index > fromIndex && step.key !== 'review' && !step.complete && !step.skipped)
    setActive(nextIncomplete ? nextIncomplete.key : stepOrder[Math.min(fromIndex + 1, stepOrder.length - 1)])
  }

  async function saveStep(step: StepKey) {
    const problem = validate(step, drafts)
    setFormError(problem)
    if (problem) return
    setBusy(`save:${step}`)
    setError('')
    try {
      const { data, message } = await request<Snapshot>(apiRoot, token, `/onboarding/${step}`, {
        method: 'PATCH',
        body: JSON.stringify(buildPayload(step, drafts)),
      })
      applySnapshot(data)
      setBlocked({ message: '', missing: [] })
      await onChanged(message || `${stepMeta[step].title} saved`)
      advance(step)
    } catch (reason) {
      setFormError(messageOf(reason, `Could not save ${stepMeta[step].title.toLowerCase()}`))
    } finally {
      setBusy('')
    }
  }

  async function skipStep(step: StepKey) {
    setBusy(`skip:${step}`)
    setFormError('')
    try {
      const { data, message } = await request<Snapshot>(apiRoot, token, `/onboarding/skip/${step}`, { method: 'POST' })
      applySnapshot(data)
      await onChanged(message || `${stepMeta[step].title} skipped`)
      advance(step)
    } catch (reason) {
      setFormError(messageOf(reason, `Could not skip ${stepMeta[step].title.toLowerCase()}`))
    } finally {
      setBusy('')
    }
  }

  async function goLive() {
    setBusy('complete')
    setBlocked({ message: '', missing: [] })
    try {
      const { data, message } = await request<Snapshot>(apiRoot, token, '/onboarding/complete', { method: 'POST' })
      applySnapshot(data)
      await onChanged(message || 'Workspace setup completed')
    } catch (reason) {
      const failure = reason as ApiError
      setBlocked({ message: messageOf(reason, 'Setup is not complete yet'), missing: failure.missing || [] })
      setActive('review')
      setReviewTab('outstanding')
    } finally {
      setBusy('')
    }
  }

  async function reopen() {
    setBusy('reopen')
    try {
      const { data, message } = await request<Snapshot>(apiRoot, token, '/onboarding/reopen', { method: 'POST' })
      applySnapshot(data)
      await onChanged(message || 'Setup reopened')
    } catch (reason) {
      setError(messageOf(reason, 'Could not reopen setup'))
    } finally {
      setBusy('')
    }
  }

  function updateProfile(patch: Partial<ProfileForm>) {
    setDrafts((current) => ({ ...current, profile: { ...current.profile, ...patch } }))
  }

  function updateIdentity(patch: Partial<IdentityForm>) {
    setDrafts((current) => ({ ...current, identity: { ...current.identity, ...patch } }))
  }

  function updateStatutory(patch: Partial<StatutoryForm>) {
    setDrafts((current) => ({ ...current, statutory: { ...current.statutory, ...patch } }))
  }

  function updateAttendance(patch: Partial<AttendanceForm>) {
    setDrafts((current) => ({ ...current, attendance: { ...current.attendance, ...patch } }))
  }

  function updateRow<K extends 'locations' | 'departments' | 'designations' | 'areas' | 'leaveTypes' | 'holidays'>(
    key: K, index: number, patch: Partial<Drafts[K][number]>,
  ) {
    setDrafts((current) => {
      const rows = current[key].slice() as Drafts[K]
      rows[index] = { ...rows[index], ...patch }
      return { ...current, [key]: rows }
    })
  }

  function removeRow(key: 'locations' | 'departments' | 'designations' | 'areas' | 'leaveTypes' | 'holidays', index: number) {
    setDrafts((current) => ({ ...current, [key]: current[key].filter((_, position) => position !== index) }))
  }

  function addRow(key: 'locations' | 'departments' | 'designations' | 'areas' | 'leaveTypes' | 'holidays') {
    setDrafts((current) => {
      if (key === 'locations') {
        const row: LocationRow = {
          name: '', code: '', addressLine: '', city: '', state: current.profile.state, pincode: '',
          timezone: current.profile.timezone || 'Asia/Kolkata', isPayrollAddress: !current.locations.length,
          pfEstablishmentCode: '', esiEmployerCode: '', status: 'active',
        }
        return { ...current, locations: [...current.locations, row] }
      }
      if (key === 'departments') {
        const row: DepartmentRow = { name: '', code: '', parentDepartmentId: '', headEmployeeId: '', status: 'active' }
        return { ...current, departments: [...current.departments, row] }
      }
      if (key === 'designations') {
        const row: DesignationRow = { name: '', code: '', level: '1', departmentId: '', status: 'active' }
        return { ...current, designations: [...current.designations, row] }
      }
      if (key === 'areas') {
        const row: AreaRow = { name: '', address: '', latitude: '', longitude: '', radiusMeters: '150', active: true }
        return { ...current, areas: [...current.areas, row] }
      }
      if (key === 'leaveTypes') {
        const row: LeaveTypeRow = { code: '', name: '', annualAllowance: '0', paid: true, payrollTreatment: 'paid' }
        return { ...current, leaveTypes: [...current.leaveTypes, row] }
      }
      const holiday: HolidayRow = { date: '', name: '', paid: true }
      return { ...current, holidays: [...current.holidays, holiday] }
    })
  }

  function stepActions(step: OnboardingStep) {
    const saving = busy === `save:${step.key}`
    const skipping = busy === `skip:${step.key}`
    const savable = step.key !== 'team' && step.key !== 'review'
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {savable && (
          <button
            type="button" onClick={() => void saveStep(step.key)} disabled={locked || saving || skipping}
            className="gradient-button flex items-center gap-2 rounded-md px-4 py-2 text-sm disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
            Save &amp; continue
          </button>
        )}
        {!savable && (
          <button
            type="button" onClick={() => advance(step.key)}
            className="gradient-button flex items-center gap-2 rounded-md px-4 py-2 text-sm"
          >
            <ChevronRight className="h-4 w-4" /> Continue
          </button>
        )}
        {!step.required && step.key !== 'review' && (
          <button
            type="button" onClick={() => void skipStep(step.key)} disabled={locked || saving || skipping}
            className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm disabled:cursor-not-allowed"
          >
            {skipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <MinusCircle className="h-4 w-4" />}
            Skip for now
          </button>
        )}
        <span className="text-xs text-ink-muted">Step {stepOrder.indexOf(step.key) + 1} of {stepOrder.length}</span>
      </div>
    )
  }

  function renderCompanyProfile() {
    const form = drafts.profile
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company name" required>
          <input value={form.name} disabled={locked} onChange={(event) => updateProfile({ name: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Contact email" required>
          <input type="email" value={form.email} disabled={locked} onChange={(event) => updateProfile({ email: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Phone">
          <input value={form.phone} disabled={locked} onChange={(event) => updateProfile({ phone: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Email domain" hint="Used to auto-match employee sign-ups, e.g. acme.com">
          <input value={form.domain} disabled={locked} onChange={(event) => updateProfile({ domain: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Registered address">
          <textarea rows={2} value={form.registeredAddress} disabled={locked} onChange={(event) => updateProfile({ registeredAddress: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="City">
          <input value={form.city} disabled={locked} onChange={(event) => updateProfile({ city: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="State">
          <SearchableSelect options={stateOptions} value={form.state} onChange={(value) => updateProfile({ state: value })} placeholder="Search states" allowEmpty emptyLabel="Not set" />
        </Field>
        <Field label="Pincode">
          <input value={form.pincode} disabled={locked} onChange={(event) => updateProfile({ pincode: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Industry">
          <SearchableSelect options={industryOptions} value={form.industry} onChange={(value) => updateProfile({ industry: value })} placeholder="Search industries" allowEmpty emptyLabel="Not set" />
        </Field>
        <Field label="Founded on" hint="Incorporation or founding date. Drives the company anniversary on the shared calendar.">
          <input type="date" value={form.foundedOn} disabled={locked} onChange={(event) => updateProfile({ foundedOn: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Timezone" required>
          <SearchableSelect options={timezoneOptions} value={form.timezone} onChange={(value) => updateProfile({ timezone: value })} placeholder="Search timezones" required />
        </Field>
        <Field label="Office start" required>
          <input type="time" value={form.officeStart} disabled={locked} onChange={(event) => updateProfile({ officeStart: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Office end" required>
          <input type="time" value={form.officeEnd} disabled={locked} onChange={(event) => updateProfile({ officeEnd: event.target.value })} className={fieldClass} />
        </Field>
      </div>
    )
  }

  function renderPayrollIdentity() {
    const form = drafts.identity
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Legal company name" required>
          <input value={form.legalName} disabled={locked} onChange={(event) => updateIdentity({ legalName: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Registered office address" required>
          <textarea rows={2} value={form.registeredAddress} disabled={locked} onChange={(event) => updateIdentity({ registeredAddress: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Registered state" required>
          <SearchableSelect options={stateOptions} value={form.state} onChange={(value) => updateIdentity({ state: value })} placeholder="Search states" required disabled={locked} />
        </Field>
        <Field label="Company PAN">
          <input value={form.pan} disabled={locked} onChange={(event) => updateIdentity({ pan: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Company TAN" hint="Needed when TDS on salary applies.">
          <input value={form.tan} disabled={locked} onChange={(event) => updateIdentity({ tan: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="GSTIN">
          <input value={form.gstin} disabled={locked} onChange={(event) => updateIdentity({ gstin: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="PF establishment code">
          <input value={form.pfEstablishmentCode} disabled={locked} onChange={(event) => updateIdentity({ pfEstablishmentCode: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="ESI employer code">
          <input value={form.esiEmployerCode} disabled={locked} onChange={(event) => updateIdentity({ esiEmployerCode: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Payslip footer" hint="Printed at the bottom of every payslip.">
          <input value={form.payslipFooter} disabled={locked} onChange={(event) => updateIdentity({ payslipFooter: event.target.value })} className={fieldClass} />
        </Field>
        <Field label="Currency" required>
          <SearchableSelect options={currencyOptions} value={form.currency} onChange={(value) => updateIdentity({ currency: value })} placeholder="Search currencies" required disabled={locked} />
        </Field>
        <Field label="Pay frequency" required>
          <SearchableSelect options={payFrequencyOptions} value={form.payFrequency} onChange={(value) => updateIdentity({ payFrequency: value })} placeholder="Search frequency" required disabled={locked} />
        </Field>
        <Field label="Payment day" hint="Day of the month salaries are released (1-28).">
          <input type="number" min={1} max={28} value={form.paymentDay} disabled={locked} onChange={(event) => updateIdentity({ paymentDay: event.target.value })} className={fieldClass} />
        </Field>
      </div>
    )
  }

  function renderWorkLocations() {
    return (
      <div className="space-y-3">
        {!drafts.locations.length && (
          <EmptyState label="No work locations yet" hint="Add the offices or sites your employees check in from." />
        )}
        {drafts.locations.map((row, index) => (
          <EditableRow
            key={row._id || `location-${index}`}
            label={row.name.trim() || `Location ${index + 1}`}
            error={!row.name.trim() ? 'Name is required.' : !row.city.trim() ? 'City is required.' : ''}
            disabled={locked}
            onRemove={() => removeRow('locations', index)}
          >
            <Field label="Name" required>
              <input value={row.name} disabled={locked} onChange={(event) => updateRow('locations', index, { name: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Code">
              <input value={row.code} disabled={locked} onChange={(event) => updateRow('locations', index, { code: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Address line">
              <input value={row.addressLine} disabled={locked} onChange={(event) => updateRow('locations', index, { addressLine: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="City" required>
              <input value={row.city} disabled={locked} onChange={(event) => updateRow('locations', index, { city: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="State">
              <SearchableSelect options={stateOptions} value={row.state} onChange={(value) => updateRow('locations', index, { state: value })} placeholder="Search states" allowEmpty emptyLabel="Not set" disabled={locked} />
            </Field>
            <Field label="Pincode">
              <input value={row.pincode} disabled={locked} onChange={(event) => updateRow('locations', index, { pincode: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Timezone">
              <SearchableSelect options={timezoneOptions} value={row.timezone} onChange={(value) => updateRow('locations', index, { timezone: value })} placeholder="Search timezones" required disabled={locked} />
            </Field>
            <Field label="PF establishment code">
              <input value={row.pfEstablishmentCode} disabled={locked} onChange={(event) => updateRow('locations', index, { pfEstablishmentCode: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="ESI employer code">
              <input value={row.esiEmployerCode} disabled={locked} onChange={(event) => updateRow('locations', index, { esiEmployerCode: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Status">
              <SearchableSelect options={statusOptions} value={row.status} onChange={(value) => updateRow('locations', index, { status: value })} required disabled={locked} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-2">
              <Toggle
                label="Payroll address" hint="Use this address on payslips and statutory filings."
                checked={row.isPayrollAddress} disabled={locked}
                onChange={(value) => updateRow('locations', index, { isPayrollAddress: value })}
              />
            </div>
          </EditableRow>
        ))}
        <AddRowButton label="Add work location" disabled={locked} onClick={() => addRow('locations')} />
      </div>
    )
  }

  function renderOrgStructure() {
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <p className="text-sm font-bold">Departments</p>
          {!drafts.departments.length && <EmptyState label="No departments yet" hint="Start with the teams you already run, e.g. Engineering or Operations." />}
          {drafts.departments.map((row, index) => (
            <EditableRow
              key={row._id || `department-${index}`}
              label={row.name.trim() || `Department ${index + 1}`}
              error={!row.name.trim() ? 'Name is required.' : ''}
              disabled={locked}
              onRemove={() => removeRow('departments', index)}
            >
              <Field label="Name" required>
                <input value={row.name} disabled={locked} onChange={(event) => updateRow('departments', index, { name: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Code">
                <input value={row.code} disabled={locked} onChange={(event) => updateRow('departments', index, { code: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Parent department">
                <SearchableSelect
                  options={departmentOptions.filter((option) => option.value !== row._id)}
                  value={row.parentDepartmentId}
                  onChange={(value) => updateRow('departments', index, { parentDepartmentId: value })}
                  placeholder="Search departments" allowEmpty emptyLabel="Top level" disabled={locked}
                />
              </Field>
              <Field label="Status">
                <SearchableSelect options={statusOptions} value={row.status} onChange={(value) => updateRow('departments', index, { status: value })} required disabled={locked} />
              </Field>
            </EditableRow>
          ))}
          <AddRowButton label="Add department" disabled={locked} onClick={() => addRow('departments')} />
        </div>
        <div className="space-y-3 border-t border-line pt-4">
          <p className="text-sm font-bold">Designations</p>
          {!drafts.designations.length && <EmptyState label="No designations yet" hint="Job titles help with approvals and payslips." />}
          {drafts.designations.map((row, index) => (
            <EditableRow
              key={row._id || `designation-${index}`}
              label={row.name.trim() || `Designation ${index + 1}`}
              error={!row.name.trim() ? 'Name is required.' : ''}
              disabled={locked}
              onRemove={() => removeRow('designations', index)}
            >
              <Field label="Name" required>
                <input value={row.name} disabled={locked} onChange={(event) => updateRow('designations', index, { name: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Code">
                <input value={row.code} disabled={locked} onChange={(event) => updateRow('designations', index, { code: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Level" hint="1 is the most junior band.">
                <input type="number" min={1} value={row.level} disabled={locked} onChange={(event) => updateRow('designations', index, { level: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Department">
                <SearchableSelect
                  options={departmentOptions} value={row.departmentId}
                  onChange={(value) => updateRow('designations', index, { departmentId: value })}
                  placeholder="Search departments" allowEmpty emptyLabel="Any department" disabled={locked}
                />
              </Field>
              <Field label="Status">
                <SearchableSelect options={statusOptions} value={row.status} onChange={(value) => updateRow('designations', index, { status: value })} required disabled={locked} />
              </Field>
            </EditableRow>
          ))}
          <AddRowButton label="Add designation" disabled={locked} onClick={() => addRow('designations')} />
          <p className="text-xs text-ink-soft">Department heads are assigned later from the Organisation workspace, once employees exist.</p>
        </div>
      </div>
    )
  }

  function renderStatutory() {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {statutoryFields.map((item) => (
          <Toggle
            key={item.key} label={item.label} hint={item.hint}
            checked={drafts.statutory[item.key]} disabled={locked}
            onChange={(value) => updateStatutory({ [item.key]: value } as Partial<StatutoryForm>)}
          />
        ))}
      </div>
    )
  }

  function renderAttendancePolicy() {
    const form = drafts.attendance
    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Payroll impact" required>
            <SearchableSelect options={payrollImpactOptions} value={form.payrollImpact} onChange={(value) => updateAttendance({ payrollImpact: value })} placeholder="Search options" required disabled={locked} />
          </Field>
          <Field label="Full day minutes" required hint="Minutes of tracked work that count as a full day.">
            <input type="number" min={1} value={form.fullDayMinutes} disabled={locked} onChange={(event) => updateAttendance({ fullDayMinutes: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Half day minutes" required>
            <input type="number" min={1} value={form.halfDayMinutes} disabled={locked} onChange={(event) => updateAttendance({ halfDayMinutes: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Late grace minutes">
            <input type="number" min={0} value={form.lateGraceMinutes} disabled={locked} onChange={(event) => updateAttendance({ lateGraceMinutes: event.target.value })} className={fieldClass} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Toggle label="GPS tracking" hint="Capture location on check-in." checked={form.gpsTracking} disabled={locked} onChange={(value) => updateAttendance({ gpsTracking: value })} />
          <Toggle label="Auto check-in" hint="Check in automatically inside a geofence." checked={form.autoCheckIn} disabled={locked} onChange={(value) => updateAttendance({ autoCheckIn: value })} />
          <Toggle label="Photo attendance" hint="Require a selfie with each check-in." checked={form.requirePhotoAttendance} disabled={locked} onChange={(value) => updateAttendance({ requirePhotoAttendance: value })} />
        </div>
        <div className="space-y-3 border-t border-line pt-4">
          <p className="text-sm font-bold">Geofenced areas</p>
          {!drafts.areas.length && <EmptyState label="No geofenced areas yet" hint="Add an area to allow location-verified attendance." />}
          {drafts.areas.map((row, index) => (
            <EditableRow
              key={row._id || `area-${index}`}
              label={row.name.trim() || `Area ${index + 1}`}
              error={!row.name.trim() ? 'Name is required.' : (row.latitude === '' || row.longitude === '') ? 'Latitude and longitude are required.' : ''}
              disabled={locked}
              onRemove={() => removeRow('areas', index)}
            >
              <Field label="Name" required>
                <input value={row.name} disabled={locked} onChange={(event) => updateRow('areas', index, { name: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Address">
                <input value={row.address} disabled={locked} onChange={(event) => updateRow('areas', index, { address: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Radius (metres)">
                <input type="number" min={25} value={row.radiusMeters} disabled={locked} onChange={(event) => updateRow('areas', index, { radiusMeters: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Latitude" required>
                <input type="number" step="any" value={row.latitude} disabled={locked} onChange={(event) => updateRow('areas', index, { latitude: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Longitude" required>
                <input type="number" step="any" value={row.longitude} disabled={locked} onChange={(event) => updateRow('areas', index, { longitude: event.target.value })} className={fieldClass} />
              </Field>
              <Toggle label="Active" checked={row.active} disabled={locked} onChange={(value) => updateRow('areas', index, { active: value })} />
            </EditableRow>
          ))}
          <AddRowButton label="Add area" disabled={locked} onClick={() => addRow('areas')} />
        </div>
      </div>
    )
  }

  function renderLeavePolicy() {
    return (
      <div className="space-y-3">
        {!drafts.leaveTypes.length && <EmptyState label="No leave types yet" hint="Casual, sick, and earned leave are a common starting set." />}
        {drafts.leaveTypes.map((row, index) => (
          <EditableRow
            key={`leave-${index}`}
            label={row.name.trim() || `Leave type ${index + 1}`}
            error={!row.code.trim() || !row.name.trim() ? 'Code and name are required.' : ''}
            disabled={locked}
            onRemove={() => removeRow('leaveTypes', index)}
          >
            <Field label="Code" required hint="Short unique key, e.g. casual">
              <input value={row.code} disabled={locked} onChange={(event) => updateRow('leaveTypes', index, { code: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Name" required>
              <input value={row.name} disabled={locked} onChange={(event) => updateRow('leaveTypes', index, { name: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Annual allowance">
              <input type="number" min={0} value={row.annualAllowance} disabled={locked} onChange={(event) => updateRow('leaveTypes', index, { annualAllowance: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Payroll treatment">
              <SearchableSelect
                options={payrollTreatmentOptions} value={row.payrollTreatment}
                onChange={(value) => updateRow('leaveTypes', index, { payrollTreatment: value, paid: value === 'paid' })}
                required disabled={locked}
              />
            </Field>
            <Toggle label="Paid leave" checked={row.paid} disabled={locked} onChange={(value) => updateRow('leaveTypes', index, { paid: value, payrollTreatment: value ? 'paid' : 'unpaid' })} />
          </EditableRow>
        ))}
        <AddRowButton label="Add leave type" disabled={locked} onClick={() => addRow('leaveTypes')} />
      </div>
    )
  }

  function renderHolidays() {
    return (
      <div className="space-y-3">
        {!drafts.holidays.length && <EmptyState label="No holidays yet" hint="You can skip this and publish the calendar later." />}
        {drafts.holidays.map((row, index) => (
          <EditableRow
            key={`holiday-${index}`}
            label={row.name.trim() || `Holiday ${index + 1}`}
            error={!row.date || !row.name.trim() ? 'Date and name are required.' : ''}
            disabled={locked}
            onRemove={() => removeRow('holidays', index)}
          >
            <Field label="Date" required>
              <input type="date" value={row.date} disabled={locked} onChange={(event) => updateRow('holidays', index, { date: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Name" required>
              <input value={row.name} disabled={locked} onChange={(event) => updateRow('holidays', index, { name: event.target.value })} className={fieldClass} />
            </Field>
            <Toggle label="Paid holiday" checked={row.paid} disabled={locked} onChange={(value) => updateRow('holidays', index, { paid: value })} />
          </EditableRow>
        ))}
        <AddRowButton label="Add holiday" disabled={locked} onClick={() => addRow('holidays')} />
      </div>
    )
  }

  function renderTeam() {
    const count = snapshot?.data.employeeCount || 0
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <KeyValue label="Employees added" value={String(count)} />
          <KeyValue label="Departments" value={String(drafts.departments.length)} />
          <KeyValue label="Work locations" value={String(drafts.locations.length)} />
        </div>
        <p className="text-sm text-ink-soft">
          People are added from the Employees workspace. Create at least one employee so attendance, leave, and payroll have someone to run for.
        </p>
        <button
          type="button" onClick={() => void load()} disabled={busy !== ''}
          className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm disabled:cursor-not-allowed"
        >
          <RefreshCw className="h-4 w-4" /> Recheck team
        </button>
      </div>
    )
  }

  function renderReview() {
    const profile = drafts.profile
    const identity = drafts.identity
    const attendance = drafts.attendance
    const statutoryOn = statutoryFields.filter((item) => drafts.statutory[item.key]).map((item) => item.label)
    return (
      <div className="space-y-4">
        <TabBar
          tabs={[{ key: 'summary', label: 'Summary' }, { key: 'outstanding', label: 'Outstanding', count: outstanding.length }]}
          value={reviewTab}
          onChange={setReviewTab}
        />
        {reviewTab === 'summary' ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KeyValue label="Company" value={profile.name || '-'} />
              <KeyValue label="Contact" value={profile.email || '-'} />
              <KeyValue label="Timezone" value={profile.timezone || '-'} />
              <KeyValue label="Office hours" value={`${profile.officeStart || '-'} - ${profile.officeEnd || '-'}`} />
              <KeyValue label="Legal name" value={identity.legalName || '-'} />
              <KeyValue label="Payroll" value={`${identity.currency} - ${humanize(identity.payFrequency)}`} />
              <KeyValue label="Payment day" value={identity.paymentDay || '-'} />
              <KeyValue label="Statutory enabled" value={statutoryOn.length ? String(statutoryOn.length) : 'None'} />
              <KeyValue label="Work locations" value={String(drafts.locations.length)} />
              <KeyValue label="Departments" value={String(drafts.departments.length)} />
              <KeyValue label="Designations" value={String(drafts.designations.length)} />
              <KeyValue label="Geofenced areas" value={String(drafts.areas.length)} />
              <KeyValue label="Attendance impact" value={humanize(attendance.payrollImpact)} />
              <KeyValue label="Full day" value={`${attendance.fullDayMinutes} min`} />
              <KeyValue label="Leave types" value={String(drafts.leaveTypes.length)} />
              <KeyValue label="Holidays" value={String(drafts.holidays.length)} />
            </div>
            <DataTable
              headers={['Step', 'Required', 'State', 'Summary']}
              rows={steps.filter((step) => step.key !== 'review').map((step) => [
                <span key={`${step.key}-title`} className="font-semibold">{step.title}</span>,
                step.required ? 'Required' : 'Optional',
                <Badge key={`${step.key}-state`} tone={step.complete ? 'positive' : step.skipped ? 'neutral' : 'warning'}>
                  {step.complete ? 'complete' : step.skipped ? 'skipped' : 'pending'}
                </Badge>,
                <span key={`${step.key}-summary`} className="text-ink-soft">{step.summary || (step.complete ? 'Ready' : step.missing.join(', ') || 'Not configured yet')}</span>,
              ])}
              defaultPageSize={10}
              empty="No steps to review"
            />
          </div>
        ) : outstanding.length ? (
          <BlockedPanel items={outstanding} message="These required items are still open." />
        ) : (
          <EmptyState label="Nothing outstanding" hint="Every required step is complete. You are ready to go live." />
        )}
      </div>
    )
  }

  function renderStep(step: OnboardingStep) {
    if (step.key === 'company_profile') return renderCompanyProfile()
    if (step.key === 'payroll_identity') return renderPayrollIdentity()
    if (step.key === 'work_locations') return renderWorkLocations()
    if (step.key === 'org_structure') return renderOrgStructure()
    if (step.key === 'statutory') return renderStatutory()
    if (step.key === 'attendance_policy') return renderAttendancePolicy()
    if (step.key === 'leave_policy') return renderLeavePolicy()
    if (step.key === 'holidays') return renderHolidays()
    if (step.key === 'team') return renderTeam()
    return renderReview()
  }

  if (loading) {
    return (
      <SectionCard title="Workspace setup" description="Loading your onboarding checklist">
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading setup status
        </div>
      </SectionCard>
    )
  }

  const completed = snapshot?.status === 'completed'
  const goLiveReason = completed
    ? 'Setup is already complete.'
    : snapshot?.canComplete
      ? 'Switch the workspace on for everyone.'
      : outstanding.length
        ? `Still required: ${outstanding.slice(0, 4).join('; ')}${outstanding.length > 4 ? ` and ${outstanding.length - 4} more` : ''}`
        : 'Complete every required step first.'

  return (
    <div className="space-y-4">
      <SectionCard
        title="Workspace setup"
        description="Finish these steps to switch QHR on for your company. You can jump between steps in any order."
        actions={
          <>
            <button
              type="button" onClick={() => setChecklistOpen(true)}
              className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            >
              <ListChecks className="h-4 w-4" /> Checklist
            </button>
            <button
              type="button" onClick={() => void load()} disabled={busy !== ''}
              className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            {isAdmin && !completed && (
              <button
                type="button" onClick={() => void goLive()} title={goLiveReason}
                disabled={!snapshot?.canComplete || busy !== ''}
                className="gradient-button flex items-center gap-2 rounded-md px-4 py-2 text-sm disabled:cursor-not-allowed"
              >
                {busy === 'complete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Go live
              </button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-ink">
                  {progress.completedRequired} of {progress.totalRequired} required steps complete
                </p>
                <p className="shrink-0 text-sm font-bold tabular-nums text-primary-700">{percent}%</p>
              </div>
              <div
                role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
                aria-label="Workspace setup progress"
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line"
              >
                <div className="h-full rounded-full bg-primary-500 transition-all duration-300 ease-enter" style={{ width: `${percent}%` }} />
              </div>
            </div>
            <dl className="flex gap-2 sm:gap-3">
              {[
                { label: 'Done', value: steps.filter((step) => step.complete).length, tone: 'text-success' },
                { label: 'Open', value: steps.filter((step) => !step.complete && !step.skipped).length, tone: 'text-warning' },
                { label: 'Skipped', value: steps.filter((step) => step.skipped).length, tone: 'text-ink-soft' },
              ].map((tile) => (
                <div key={tile.label} className="min-w-[4.5rem] rounded-lg border border-line bg-surface-subtle px-3 py-2 text-center">
                  <dd className={`text-lg font-bold tabular-nums leading-none ${tile.tone}`}>{tile.value}</dd>
                  <dt className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">{tile.label}</dt>
                </div>
              ))}
            </dl>
          </div>
          {completed ? (
            <div className="rounded-lg border border-emerald-200 bg-success-soft px-3 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" /> Workspace is live since {formatDate(snapshot?.completedAt)}
              </p>
              <p className="mt-1 text-sm text-ink-soft">Employees can use attendance, leave, and payroll. Settings stay editable from their own workspaces.</p>
              {isAdmin && (
                <button
                  type="button" onClick={() => void reopen()} disabled={busy !== ''}
                  className="neu-button mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm disabled:cursor-not-allowed"
                >
                  {busy === 'reopen' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Reopen setup
                </button>
              )}
            </div>
          ) : (
            <BlockedPanel items={blocked.missing} message={blocked.message} />
          )}
          {!isAdmin && (
            <p className="text-xs text-ink-soft">Payroll identity and statutory setup are completed by a Company Admin. Going live is an admin action.</p>
          )}
          <InlineError message={error} />
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Setup steps" className="neu-card h-fit rounded-lg lg:sticky lg:top-[68px]">
          <p className="border-b border-line px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            Setup steps
          </p>
          <ul className="p-1.5">
            {steps.map((step, index) => {
              const current = step.key === active
              return (
                <li key={step.key}>
                  <button
                    type="button" onClick={() => { setActive(step.key); setFormError('') }}
                    aria-current={current ? 'step' : undefined}
                    className="rail-item"
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                      step.complete ? 'bg-success-soft text-success' : current ? 'bg-primary-500 text-white' : 'bg-surface-hover text-ink-soft'
                    }`}>
                      {index + 1}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${current ? 'font-bold' : 'font-medium'}`}>
                      {step.title}
                    </span>
                    {/* Only optional steps need a label; "required" is the default and
                        repeating it on every row was pure noise. */}
                    {!step.required && !step.skipped && !step.complete && (
                      <span className="chip shrink-0 bg-surface-hover text-ink-muted">Optional</span>
                    )}
                    <StepStateIcon step={step} />
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <SectionCard
          title={activeStep.title}
          description={activeStep.description}
          actions={<Badge tone={activeStep.complete ? 'positive' : activeStep.skipped ? 'neutral' : 'warning'}>{activeStep.complete ? 'complete' : activeStep.skipped ? 'skipped' : 'pending'}</Badge>}
        >
          {locked && (
            <div className="mb-4 rounded-lg border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink-soft">
              A Company Admin must complete this step. You can review the values but not change them.
            </div>
          )}
          {!activeStep.complete && activeStep.key !== 'review' && (
            <MissingPanel items={activeStep.missing} title="Still needed for this step" />
          )}
          {renderStep(activeStep)}
          <InlineError message={formError} />
          {activeStep.key === 'review'
            ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                {isAdmin && !completed && (
                  <button
                    type="button" onClick={() => void goLive()} title={goLiveReason}
                    disabled={!snapshot?.canComplete || busy !== ''}
                    className="gradient-button flex items-center gap-2 rounded-md px-4 py-2 text-sm disabled:cursor-not-allowed"
                  >
                    {busy === 'complete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    Go live
                  </button>
                )}
                {activeIndex > 0 && (
                  <button
                    type="button" onClick={() => setActive(stepOrder[activeIndex - 1])}
                    className="neu-button rounded-md px-3 py-2 text-sm"
                  >
                    Back
                  </button>
                )}
                <span className="text-xs text-ink-muted">{goLiveReason}</span>
              </div>
            )
            : stepActions(activeStep)}
        </SectionCard>
      </div>

      {checklistOpen && (
        <Drawer title="Setup checklist" subtitle={`${progress.completedRequired}/${progress.totalRequired} required steps complete`} close={() => setChecklistOpen(false)}>
          <ul className="space-y-2">
            {steps.map((step, index) => (
              <li key={step.key} className="rounded-lg border border-line bg-surface-subtle px-3 py-2.5 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{index + 1}. {step.title}</p>
                  <StepStateIcon step={step} />
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">{step.summary || step.description}</p>
                {!step.complete && step.missing.length > 0 && (
                  <ul className="mt-1.5 list-inside list-disc text-xs text-warning">
                    {step.missing.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Drawer>
      )}
    </div>
  )
}
