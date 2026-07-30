'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive, ArrowLeft, BarChart3, Bell, Briefcase, Building2, Calendar, CheckCircle2, Clock, CreditCard, Download,
  CalendarDays, Check, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, History, Inbox, KeyRound, Laptop, Loader2, LogOut, MapPin, Menu, Monitor, Network, Pencil, Plus, RefreshCw, Search, Settings, Upload,
  Receipt, Rocket, ShieldCheck, Star, Trash2, UserCheck, UserX, Wallet, TrendingUp, Users, X, XCircle, type LucideIcon,
} from 'lucide-react'
import { SearchableSelect, humanize, type Option } from './components/ui'
import AssetsWorkspace from './components/AssetsWorkspace'
import OnboardingWorkspace from './components/OnboardingWorkspace'
import ImportWorkspace from './components/ImportWorkspace'
import PlanCatalogue from './components/PlanCatalogue'
import CalendarWorkspace from './components/CalendarWorkspace'
import NotificationCentre from './components/NotificationCentre'
import CompanyProfileCard from './components/CompanyProfileCard'
import WorkWeekCard from './components/WorkWeekCard'
import EmployeeFormFields, { FormSection, Labelled, useEmployeeFormState, type OrgPickerProps } from './components/EmployeeForm'
import AttendanceWorkspace from './components/AttendanceWorkspace'
import OrgWorkspace from './components/OrgWorkspace'
import WorkWorkspace from './components/WorkWorkspace'
import PayrollWorkspace, {
  type PayrollRecord,
  type PayrollAuditLog,
  type PayrollRun,
  type PayrollSettings,
  type PayrollSummary,
  type SalaryStructureRecord,
} from './components/PayrollWorkspace'

type UserRole = 'manager' | 'hr' | 'admin' | 'super_admin'
type BillingMode = 'automatic' | 'manual_online' | 'manual_offline' | 'custom'
type PageKey = 'dashboard' | 'onboarding' | 'employees' | 'org' | 'calendar' | 'imports' | 'plans' | 'companies' | 'company-detail' | 'leads' | 'audit' | 'attendance' | 'leaves' | 'wfh' | 'grievances' | 'reimbursements' | 'payroll' | 'work' | 'assets' | 'desktop' | 'geofences' | 'subscriptions' | 'settings'
type EmployeeSalary = Partial<SalaryStructureRecord['structure']> & { earningOverrides?: Array<{ code: string; name: string; calculation: string; value: number; taxable?: boolean; prorate?: boolean }> }
type Employee = { _id: string; companyId: string; employeeId: string; firstName?: string; lastName?: string; name: string; email: string; phone?: string | null; department: string; designation: string; role: string; status: string; managerId?: string | null; departmentId?: string | null; designationId?: string | null; workLocationId?: string | null; employmentType?: string; dateOfBirth?: string | null; profile?: Record<string, string>; permissionGrants?: string[]; permissionRevokes?: string[]; dateOfJoining?: string; lastWorkingDate?: string | null; salary?: EmployeeSalary; company?: { _id: string; code: string; name: string } | null }
type AttendancePolicy = {
  payrollImpact: 'none' | 'leave_only' | 'attendance_and_leave';
  fullDayMinutes: number;
  halfDayMinutes: number;
  lateGraceMinutes: number;
  requireCheckoutForFullDay: boolean;
  deductUnpaidLeave: boolean;
  deductUnnoticedAbsence: boolean;
  deductHalfDay: boolean;
  holidaysPaid: boolean;
  paidLeavePayableDays: number;
  unpaidLeavePayableDays: number;
  halfDayPayableDays: number;
  unnoticedAbsencePayableDays: number;
  wfhPayableDays: number;
  wfhRequiresCheckIn: boolean;
  untrackedWfhPayableDays: number;
  countApprovedWfhAsPresent: boolean;
}
type CompanySettings = { gpsTracking?: boolean; autoCheckIn?: boolean; leaveApproval?: boolean; desktopMonitoring?: boolean; requirePhotoAttendance?: boolean; officeStart?: string; officeEnd?: string; timezone?: string; attendancePolicy?: Partial<AttendancePolicy> }
type WorkspaceSettingsState = { gpsTracking: boolean; autoCheckIn: boolean; leaveApproval: boolean; desktopMonitoring: boolean; requirePhotoAttendance: boolean; officeStart: string; officeEnd: string; timezone: string; attendancePolicy: AttendancePolicy }
type LeaveType = { code: string; name: string; annualAllowance: number; color?: string; paid?: boolean; payrollTreatment?: 'paid' | 'unpaid' }
type Holiday = { date: string; name: string; paid?: boolean }
type Subscription = { plan: string; pricePerUser: number; annualDiscountPercent: number; billingCycle: 'monthly' | 'yearly'; billingMode: BillingMode; paymentGateway?: string | null; status: string; paidSeats: number; includedSeats: number; totalSeats: number; seatsRemaining: number; activeUsers: number; renewalAmount: number; nextRenewalAt?: string | null; graceEndsAt?: string | null; automaticSuspensionEnabled: boolean; customRenewalAmount?: number | null; customTerms?: string | null }
type CompanyBillingSummary = { collectedAmount: number; outstandingAmount: number; pendingVerificationAmount: number; creditBalance: number; upcomingRenewalAmount: number; nextRenewalAt?: string | null }
type Company = { _id: string; code: string; name: string; email: string; phone?: string | null; domain?: string | null; isVerified: boolean; status?: string; employeeCount?: number; monthlyRevenue?: number; subscription?: Subscription; billingSummary?: CompanyBillingSummary; settings?: CompanySettings; leaveTypes?: LeaveType[]; holidays?: Holiday[]; updatedAt?: string }
type AttendanceDay = { date: string; status: string; source: string; payableDays: number; lossOfPayDays: number; workDuration: number; isLate: boolean; lateByMinutes: number }
type AttendanceSummary = { eligibleDays: number; presentDays: number; fullPresentDays: number; halfDayDays: number; workFromHomeDays: number; paidLeaveDays: number; unpaidLeaveDays: number; unnoticedAbsenceDays: number; lossOfPayDays: number; payableDays: number; payrollImpact: AttendancePolicy['payrollImpact'] }
type AttendanceRow = { employee: { _id: string; employeeId: string; firstName: string; lastName: string }; attendance: { checkIn?: { time: string }; checkOut?: { time: string }; workDuration?: number; status?: string; isLate?: boolean } | null; day?: AttendanceDay | null; summary?: AttendanceSummary }
type Leave = { _id: string; employee: { firstName: string; lastName: string; employeeId: string }; leaveType: string; startDate: string; endDate: string; days: number; status: string; reason?: string; currentLevel?: number; pendingApprover?: { level: number; approverRole: string; approver?: { firstName?: string; lastName?: string; employeeId?: string } | null } | null }
type WfhRequest = { _id: string; employee: { firstName: string; lastName: string; employeeId: string }; startDate: string; endDate: string; reason: string; workFromLocation?: string; status: string }
type Grievance = { _id: string; ticketNumber: string; employee?: { firstName: string; lastName: string; employeeId: string } | null; subject: string; description: string; category: string; priority: string; status: string; createdAt: string }
type ReimbursementAttachment = { _id?: string; name: string; url?: string; kind?: 'https_url' | 'protected_file'; mimeType?: string; size?: number }
type Reimbursement = { _id: string; claimNumber: string; employee: { _id: string; firstName: string; lastName: string; employeeId: string }; category: string; expenseDate: string; amount: number; approvedAmount?: number | null; description: string; merchant?: string; projectOrCostCenter?: string; attachments?: ReimbursementAttachment[]; status: string; paymentMethod?: 'through_payroll' | 'separate_payment' | null; payrollPeriod?: string | null; linkedPayrollId?: string | null; paymentReference?: string | null; paidAt?: string | null; createdAt: string }
type Area = { _id: string; name: string; address: string; latitude: number; longitude: number; radiusMeters: number; active?: boolean; workLocationId?: string | null; workLocation?: { _id: string; name: string; code?: string } | null }
type WorkLocation = { _id: string; name: string; code?: string; city?: string; status?: string; address?: string; isPayrollAddress?: boolean; geofence?: { _id: string; radiusMeters: number; latitude: number; longitude: number } | null }
type OrgMaster = { _id: string; name: string; code?: string; status?: string; departmentId?: string | null }
type Summary = { employees: number; presentToday: number; pendingLeaves: number; activeGeofences: number; totalSeats?: number; monthlySubscription?: number; nextRenewalAt?: string | null; billingCycle?: string; planName?: string }
type Payroll = PayrollRecord
type DesktopMember = { employee: { employeeId: string; firstName: string; lastName: string }; activity: { summary?: { totalActiveSeconds: number; totalIdleSeconds: number; snapshots: number }; topApps?: Array<{ name?: string; app?: string; duration?: number }> } | null; states: Array<{ status: string; lastHeartbeatAt?: string }> }
type PlatformSummary = { companies: number; activeCompanies: number; pendingCompanies: number; suspendedCompanies: number; employees: number; monthlyRevenue: number; collectedAmount: number; pendingAmount: number; upcomingAmount: number; renewalAmount: number; openLeads: number }
type Lead = { _id: string; kind: 'demo' | 'contact'; name: string; email: string; company?: string | null; employees?: string | null; message?: string | null; status: string; createdAt: string }
type TenantSubscription = Subscription & { companyId: string; companyCode: string; companyName: string; monthlyRevenue: number; outstandingAmount: number; collectedAmount: number; pendingVerificationAmount: number }
type SubscriptionPlan = { _id?: string; name: string; code?: string; pricePerUser: number | null; annualDiscountPercent?: number; includedSeats?: number; userLimit: number | null; status: string; description?: string; features?: string[]; sortOrder?: number; highlighted?: boolean; isFree?: boolean }
type BillingInvoice = { _id: string; invoiceNumber: string; companyId: string; companyName: string; companyCode: string; kind: string; billingCycle: string; seatCount: number; issueDate: string; dueDate: string; periodStart?: string; periodEnd?: string | null; total: number; amountPaid: number; amountDue: number; status: string }
type BillingPayment = { _id: string; companyId: string; companyName: string; companyCode: string; invoiceId: string; invoiceNumber: string; amount: number; method: string; reference?: string | null; notes?: string | null; status: string; createdAt: string }
type PaymentGateway = { code: 'cashfree' | 'payu'; name: string; enabled: boolean; isDefault: boolean; mode: 'test' | 'live' }
type PlatformBillingSummary = { collectedAmount: number; pendingAmount: number; pendingVerificationAmount: number; renewalAmount: number; upcomingAmount: number; overdueInvoices: number; partiallyPaidInvoices: number }
type CompanyBilling = { subscription: Subscription; summary: CompanyBillingSummary; invoices: BillingInvoice[]; payments: BillingPayment[] }
type AuditLog = { _id: string; actorName: string; action: string; companyName?: string; companyCode?: string; employeeName?: string | null; details?: Record<string, unknown>; createdAt: string }
type ApiData = Record<string, unknown>

const API_ROOT = (() => {
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001').replace(/\/+$/, '')
  return /\/api\/v\d+$/i.test(raw) ? raw : `${raw}/api/v1`
})()

const allRoles: UserRole[] = ['manager', 'hr', 'admin', 'super_admin']
const tenantRoles: UserRole[] = ['manager', 'hr', 'admin']
const menuGroups = ['Overview', 'People', 'Money', 'Work', 'Platform', 'Configuration'] as const
type MenuGroup = (typeof menuGroups)[number]
const menuItems: Array<{ key: PageKey; label: string; description: string; icon: LucideIcon; roles: UserRole[]; group: MenuGroup }> = [
  // `description` renders as the one-line subtitle in the page band. It is the
  // only explanation each page gets, so it says what the page is for rather than
  // restating its own name.
  { key: 'dashboard', label: 'Dashboard', description: 'Who is present, what is waiting on you, and where the month stands', icon: BarChart3, roles: allRoles, group: 'Overview' },
  { key: 'onboarding', label: 'Getting started', description: 'Complete your company setup', icon: Rocket, roles: ['hr', 'admin'], group: 'Overview' },
  { key: 'employees', label: 'Employees', description: 'Everyone on your payroll, with their department, work location, and access', icon: Users, roles: allRoles, group: 'People' },
  { key: 'org', label: 'Organisation', description: 'Departments group people, work locations are the sites they sit at', icon: Network, roles: ['hr', 'admin'], group: 'People' },
  { key: 'attendance', label: 'Attendance', description: 'Check-in and check-out records, and how they map onto your policy', icon: Calendar, roles: tenantRoles, group: 'People' },
  { key: 'calendar', label: 'Calendar', description: 'Holidays and events you add, birthdays and anniversaries from employee records', icon: CalendarDays, roles: tenantRoles, group: 'People' },
  { key: 'leaves', label: 'Leave Requests', description: 'Time off waiting for a decision, oldest first', icon: FileText, roles: tenantRoles, group: 'People' },
  { key: 'wfh', label: 'WFH Requests', description: 'Remote-work approval queue', icon: Monitor, roles: tenantRoles, group: 'People' },
  { key: 'grievances', label: 'Grievances', description: 'Employee support and resolution', icon: Inbox, roles: tenantRoles, group: 'People' },
  { key: 'payroll', label: 'Payroll', description: 'Salary structures, payroll runs, and the payslips your team receives', icon: Wallet, roles: ['hr', 'admin'], group: 'Money' },
  { key: 'reimbursements', label: 'Reimbursements', description: 'Expense claims, approvals, and payments', icon: Receipt, roles: tenantRoles, group: 'Money' },
  { key: 'subscriptions', label: 'Subscriptions', description: 'Plans and current billing', icon: CreditCard, roles: ['admin', 'super_admin'], group: 'Money' },
  { key: 'work', label: 'Projects & Tasks', description: 'Team work assignments', icon: Briefcase, roles: tenantRoles, group: 'Work' },
  { key: 'desktop', label: 'Desktop Activity', description: 'Employee desktop activity', icon: Monitor, roles: tenantRoles, group: 'Work' },
  { key: 'assets', label: 'Assets', description: 'Company asset register and custody', icon: Laptop, roles: ['manager', 'hr', 'admin'], group: 'Work' },
  { key: 'geofences', label: 'Geofences', description: 'The map boundaries that decide where mobile check-in is accepted', icon: MapPin, roles: ['hr', 'admin'], group: 'Work' },
  { key: 'companies', label: 'Companies', description: 'Tenant operations and access', icon: Building2, roles: ['super_admin'], group: 'Platform' },
  { key: 'leads', label: 'Sales Leads', description: 'Demo and contact enquiries', icon: Inbox, roles: ['super_admin'], group: 'Platform' },
  { key: 'audit', label: 'Audit Log', description: 'Platform administration history', icon: History, roles: ['super_admin'], group: 'Platform' },
  { key: 'imports', label: 'Data migration', description: 'Download a template, validate your file, then commit. Re-uploading updates rather than duplicates', icon: FileSpreadsheet, roles: ['hr', 'admin'], group: 'Configuration' },
  { key: 'plans', label: 'Plans & pricing', description: 'Subscription plans, seats, and features', icon: Star, roles: ['super_admin'], group: 'Platform' },
  { key: 'settings', label: 'Company & settings', description: 'Company details, address, and workspace behaviour', icon: Settings, roles: ['hr', 'admin'], group: 'Configuration' },
]

const pageKeys = menuItems.map((item) => item.key)

/**
 * The console is one route with the current page held in React state, so a
 * reload used to drop you back on the Dashboard. The page now lives in the URL
 * as `?page=`, which survives a refresh, makes Back and Forward work, and lets a
 * screen be linked to or bookmarked.
 */
function pageFromLocation(): PageKey | null {
  if (typeof window === 'undefined') return null
  const requested = new URLSearchParams(window.location.search).get('page')
  if (!requested) return null
  // `company-detail` needs a company loaded in memory, so it is not restorable.
  if (requested === 'company-detail') return 'companies'
  return pageKeys.includes(requested as PageKey) ? (requested as PageKey) : null
}

function writePageToLocation(page: PageKey, replace = false) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  // The detail view has no restorable URL of its own; keep its parent in the bar.
  url.searchParams.set('page', page === 'company-detail' ? 'companies' : page)
  const next = `${url.pathname}${url.search}`
  if (replace) window.history.replaceState(null, '', next)
  else window.history.pushState(null, '', next)
}

const platformMenuLabels: Partial<Record<PageKey, { label: string; description: string }>> = {
  dashboard: { label: 'Platform Overview', description: 'SaaS health, tenants, users, and revenue' },
  companies: { label: 'Tenant Companies', description: 'Onboarding, access, plans, and tenant records' },
  leads: { label: 'Sales Pipeline', description: 'Demo requests and platform enquiries' },
  employees: { label: 'Tenant Users', description: 'Cross-company user accounts and access' },
  subscriptions: { label: 'Billing & Plans', description: 'Tenant subscriptions and platform revenue' },
  audit: { label: 'Platform Audit', description: 'Audited Super Admin account and tenant changes' },
}

async function api<T extends ApiData>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`)
  return payload.data as T
}

async function loadAllEmployees(token: string) {
  type EmployeePage = { employees: Employee[]; pagination: { page: number; pages: number } }
  const first = await api<EmployeePage>('/employees?limit=100&page=1', {}, token)
  if (first.pagination.pages <= 1) return first
  const remaining = await Promise.all(Array.from({ length: first.pagination.pages - 1 }, (_, index) => api<EmployeePage>(`/employees?limit=100&page=${index + 2}`, {}, token)))
  return { ...first, employees: [first, ...remaining].flatMap((page) => page.employees) }
}

function statusClass(status: string) {
  const value = status.toLowerCase()
  if (['active', 'present', 'approved', 'complete', 'verified', 'resolved', 'contacted', 'paid'].some((item) => value.includes(item))) return 'bg-success-soft text-success ring-emerald-200'
  if (['pending', 'trial', 'late', 'draft', 'new', 'partial', 'progress'].some((item) => value.includes(item))) return 'bg-warning-soft text-warning ring-amber-200'
  if (['reject', 'inactive', 'absent', 'suspended', 'overdue', 'paused', 'reversed', 'lost'].some((item) => value.includes(item))) return 'bg-danger-soft text-danger ring-red-200'
  return 'bg-slate-100 text-ink-soft ring-slate-200'
}

function Status({ children }: { children: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${statusClass(children)}`}>{String(children).replaceAll('_', ' ')}</span>
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0)
}

function billingModeLabel(mode: BillingMode) {
  return ({ automatic: 'Automatic', manual_online: 'Manual online', manual_offline: 'Manual offline', custom: 'Custom agreement' })[mode]
}

const defaultClientAttendancePolicy: AttendancePolicy = {
  payrollImpact: 'leave_only',
  fullDayMinutes: 480,
  halfDayMinutes: 240,
  lateGraceMinutes: 0,
  requireCheckoutForFullDay: false,
  deductUnpaidLeave: true,
  deductUnnoticedAbsence: true,
  deductHalfDay: true,
  holidaysPaid: true,
  paidLeavePayableDays: 1,
  unpaidLeavePayableDays: 0,
  halfDayPayableDays: 0.5,
  unnoticedAbsencePayableDays: 0,
  wfhPayableDays: 1,
  wfhRequiresCheckIn: false,
  untrackedWfhPayableDays: 1,
  countApprovedWfhAsPresent: true,
}

function normalizeClientAttendancePolicy(input?: Partial<AttendancePolicy>): AttendancePolicy {
  return {
    ...defaultClientAttendancePolicy,
    ...(input || {}),
    payrollImpact: input?.payrollImpact || defaultClientAttendancePolicy.payrollImpact,
    fullDayMinutes: Number(input?.fullDayMinutes ?? defaultClientAttendancePolicy.fullDayMinutes),
    halfDayMinutes: Number(input?.halfDayMinutes ?? defaultClientAttendancePolicy.halfDayMinutes),
    lateGraceMinutes: Number(input?.lateGraceMinutes ?? defaultClientAttendancePolicy.lateGraceMinutes),
    paidLeavePayableDays: Number(input?.paidLeavePayableDays ?? defaultClientAttendancePolicy.paidLeavePayableDays),
    unpaidLeavePayableDays: Number(input?.unpaidLeavePayableDays ?? defaultClientAttendancePolicy.unpaidLeavePayableDays),
    halfDayPayableDays: Number(input?.halfDayPayableDays ?? defaultClientAttendancePolicy.halfDayPayableDays),
    unnoticedAbsencePayableDays: Number(input?.unnoticedAbsencePayableDays ?? defaultClientAttendancePolicy.unnoticedAbsencePayableDays),
    wfhPayableDays: Number(input?.wfhPayableDays ?? defaultClientAttendancePolicy.wfhPayableDays),
    untrackedWfhPayableDays: Number(input?.untrackedWfhPayableDays ?? defaultClientAttendancePolicy.untrackedWfhPayableDays),
    requireCheckoutForFullDay: Boolean(input?.requireCheckoutForFullDay),
    deductUnpaidLeave: input?.deductUnpaidLeave ?? true,
    deductUnnoticedAbsence: input?.deductUnnoticedAbsence ?? true,
    deductHalfDay: input?.deductHalfDay ?? true,
    holidaysPaid: input?.holidaysPaid ?? true,
    wfhRequiresCheckIn: Boolean(input?.wfhRequiresCheckIn),
    countApprovedWfhAsPresent: input?.countApprovedWfhAsPresent ?? true,
  }
}

function workspaceSettingsFromCompany(company?: Company): WorkspaceSettingsState {
  return {
    gpsTracking: company?.settings?.gpsTracking ?? true,
    autoCheckIn: company?.settings?.autoCheckIn ?? true,
    leaveApproval: company?.settings?.leaveApproval ?? true,
    desktopMonitoring: company?.settings?.desktopMonitoring ?? true,
    requirePhotoAttendance: company?.settings?.requirePhotoAttendance ?? false,
    officeStart: company?.settings?.officeStart || '09:30',
    officeEnd: company?.settings?.officeEnd || '18:30',
    timezone: company?.settings?.timezone || 'Asia/Kolkata',
    attendancePolicy: normalizeClientAttendancePolicy(company?.settings?.attendancePolicy),
  }
}

function attendanceStatusLabel(value?: string | null) {
  return (value || 'not_checked_in').replaceAll('_', ' ')
}

function attendancePolicyLabel(value?: AttendancePolicy['payrollImpact']) {
  if (value === 'attendance_and_leave') return 'Attendance + leave deductions'
  if (value === 'none') return 'No payroll deduction'
  return 'Leave-only payroll deduction'
}

function formatDays(value?: number) {
  return Number(value || 0).toFixed(1)
}

function downloadCsv(name: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const content = [headers.map(quote).join(','), ...rows.map((row) => headers.map((key) => quote(row[key])).join(','))].join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  link.download = `${name}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function AdminPortal() {
  const [token, setToken] = useState('')
  const [userName, setUserName] = useState('Admin')
  const [userRole, setUserRole] = useState<UserRole>('admin')
  const [userCompany, setUserCompany] = useState('')
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarReady, setSidebarReady] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [modal, setModal] = useState<'company' | 'employee' | 'employee-edit' | 'area' | 'payment' | 'invoice' | 'wfh-assign' | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedCompanyEmployees, setSelectedCompanyEmployees] = useState<Employee[]>([])
  const [selectedCompanyAudit, setSelectedCompanyAudit] = useState<AuditLog[]>([])
  const [selectedCompanyBilling, setSelectedCompanyBilling] = useState<CompanyBilling | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [payrollEmployeeToEdit, setPayrollEmployeeToEdit] = useState<string | null>(null)
  const [companyLoading, setCompanyLoading] = useState(false)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [attendancePolicy, setAttendancePolicy] = useState<AttendancePolicy>(defaultClientAttendancePolicy)
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [wfhRequests, setWfhRequests] = useState<WfhRequest[]>([])
  const [grievances, setGrievances] = useState<Grievance[]>([])
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([])
  const [issuedCredentials, setIssuedCredentials] = useState<{ name: string; employeeId: string; companyCode: string; oneTimePassword: string } | null>(null)
  const [departments, setDepartments] = useState<OrgMaster[]>([])
  const [designations, setDesignations] = useState<OrgMaster[]>([])
  const [onboardingState, setOnboardingState] = useState<{ status: string; percent: number; completedRequired: number; totalRequired: number } | null>(null)
  const [payroll, setPayroll] = useState<Payroll[]>([])
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings | null>(null)
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructureRecord[]>([])
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([])
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null)
  const [payrollAuditLogs, setPayrollAuditLogs] = useState<PayrollAuditLog[]>([])
  const [desktopTeam, setDesktopTeam] = useState<DesktopMember[]>([])
  const [summary, setSummary] = useState<Summary>({ employees: 0, presentToday: 0, pendingLeaves: 0, activeGeofences: 0 })
  const [platformSummary, setPlatformSummary] = useState<PlatformSummary>({ companies: 0, activeCompanies: 0, pendingCompanies: 0, suspendedCompanies: 0, employees: 0, monthlyRevenue: 0, collectedAmount: 0, pendingAmount: 0, upcomingAmount: 0, renewalAmount: 0, openLeads: 0 })
  const [leads, setLeads] = useState<Lead[]>([])
  const [platformAudit, setPlatformAudit] = useState<AuditLog[]>([])
  const [tenantSubscriptions, setTenantSubscriptions] = useState<TenantSubscription[]>([])
  const [billingSummary, setBillingSummary] = useState<PlatformBillingSummary>({ collectedAmount: 0, pendingAmount: 0, pendingVerificationAmount: 0, renewalAmount: 0, upcomingAmount: 0, overdueInvoices: 0, partiallyPaidInvoices: 0 })
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([])
  const [billingPayments, setBillingPayments] = useState<BillingPayment[]>([])
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentPlan, setCurrentPlan] = useState<Subscription | null>(null)
  const [currentBillingSummary, setCurrentBillingSummary] = useState<CompanyBillingSummary | null>(null)
  const [currentInvoices, setCurrentInvoices] = useState<BillingInvoice[]>([])
  const [currentPayments, setCurrentPayments] = useState<BillingPayment[]>([])

  useEffect(() => {
    const saved = sessionStorage.getItem('qhr-admin-token')
    const name = sessionStorage.getItem('qhr-admin-name')
    const role = sessionStorage.getItem('qhr-admin-role') as UserRole | null
    const company = sessionStorage.getItem('qhr-admin-company')
    if (role && allRoles.includes(role)) setUserRole(role)
    if (company) setUserCompany(company)
    if (saved) setToken(saved)
    if (name) setUserName(name)
    if (saved && !role) {
      void api<{ user: { name: string; role: UserRole; company?: { name?: string } } }>('/auth/me', {}, saved).then((data) => {
        setUserName(data.user.name)
        setUserRole(data.user.role)
        setUserCompany(data.user.company?.name || '')
        sessionStorage.setItem('qhr-admin-name', data.user.name)
        sessionStorage.setItem('qhr-admin-role', data.user.role)
        sessionStorage.setItem('qhr-admin-company', data.user.company?.name || '')
      }).catch(() => undefined)
    }
    // Restore the page from the URL so a refresh, however deep, stays put.
    const requested = pageFromLocation()
    if (requested) setActivePage(requested)
    else writePageToLocation('dashboard', true)

    if (window.innerWidth < 768) setSidebarOpen(false)
    setSidebarReady(true)
  }, [])

  // Browser Back and Forward move between pages instead of leaving the console.
  useEffect(() => {
    function onPopState() {
      const requested = pageFromLocation()
      setActivePage(requested || 'dashboard')
      setSelectedCompany(null)
      setNotificationsOpen(false)
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const isSuper = userRole === 'super_admin'
      const canManagePeople = ['hr', 'admin'].includes(userRole)
      const canManageCompany = userRole === 'admin'
      const [platformData, dashboardData, employeeData, companyData, attendanceData, leaveData, wfhData, grievanceData, reimbursementData, areaData, orgData, onboardingData, subscriptionData, tenantSubscriptionData, payrollData, desktopData, leadData, auditData] = await Promise.all([
        isSuper ? api<{ summary: PlatformSummary; companies: Company[] }>('/admin/platform-dashboard', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ summary: Summary }>('/admin/dashboard', {}, token) : Promise.resolve(null),
        loadAllEmployees(token),
        userRole === 'admin' ? api<{ companies: Company[] }>('/companies', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ attendances: AttendanceRow[]; policy: AttendancePolicy }>('/attendance/team', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ leaves: Leave[] }>('/leaves/approvals/pending', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ wfhRequests: WfhRequest[] }>('/wfh/pending', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ grievances: Grievance[] }>('/grievances/all', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ reimbursements: Reimbursement[] }>('/reimbursements?limit=100', {}, token) : Promise.resolve(null),
        canManagePeople ? api<{ areas: Area[] }>('/attendance-areas', {}, token) : Promise.resolve(null),
        canManagePeople ? api<{ workLocations: WorkLocation[]; departments: OrgMaster[]; designations: OrgMaster[] }>('/org', {}, token).catch(() => ({ workLocations: [] as WorkLocation[], departments: [] as OrgMaster[], designations: [] as OrgMaster[] })) : Promise.resolve(null),
        canManagePeople ? api<{ status: string; progress: { completedRequired: number; totalRequired: number; percent: number } }>('/onboarding', {}, token).catch(() => null) : Promise.resolve(null),
        canManageCompany ? api<{ plans: SubscriptionPlan[]; current: Subscription; summary: CompanyBillingSummary; invoices: BillingInvoice[]; payments: BillingPayment[]; paymentGateways: PaymentGateway[] }>('/subscriptions', {}, token) : Promise.resolve(null),
        isSuper ? api<{ plans: SubscriptionPlan[]; subscriptions: TenantSubscription[]; summary: PlatformBillingSummary; invoices: BillingInvoice[]; payments: BillingPayment[]; paymentGateways: PaymentGateway[] }>('/admin/tenant-subscriptions', {}, token) : Promise.resolve(null),
        canManagePeople ? api<{ payroll: Payroll[]; settings: PayrollSettings; salaryStructures: SalaryStructureRecord[]; runs: PayrollRun[]; auditLogs: PayrollAuditLog[]; summary: PayrollSummary }>('/payroll', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ team: DesktopMember[] }>('/desktop-activity/team', {}, token) : Promise.resolve(null),
        isSuper ? api<{ demoRequests: Omit<Lead, 'kind'>[]; contactMessages: Omit<Lead, 'kind'>[] }>('/admin/leads', {}, token) : Promise.resolve(null),
        isSuper ? api<{ auditLogs: AuditLog[] }>('/admin/audit-logs', {}, token) : Promise.resolve(null),
      ])
      if (platformData) {
        setPlatformSummary(platformData.summary)
        setCompanies(platformData.companies)
      } else if (dashboardData) {
        setSummary(dashboardData.summary)
        setCompanies(companyData?.companies || [])
      }
      setEmployees(employeeData.employees)
      setAttendance(attendanceData?.attendances || [])
      setAttendancePolicy(normalizeClientAttendancePolicy(attendanceData?.policy))
      setLeaves(leaveData?.leaves || [])
      setWfhRequests(wfhData?.wfhRequests || [])
      setGrievances(grievanceData?.grievances || [])
      setReimbursements(reimbursementData?.reimbursements || [])
      setAreas(areaData?.areas || [])
      setWorkLocations(orgData?.workLocations || [])
      // Departments and designations were previously fetched and then thrown
      // away, which is why the employee dropdowns were always empty.
      setDepartments(orgData?.departments || [])
      setDesignations(orgData?.designations || [])
      setOnboardingState(onboardingData ? {
        status: onboardingData.status,
        percent: onboardingData.progress?.percent ?? 0,
        completedRequired: onboardingData.progress?.completedRequired ?? 0,
        totalRequired: onboardingData.progress?.totalRequired ?? 0,
      } : null)
      setPlans(tenantSubscriptionData?.plans || subscriptionData?.plans || [])
      setCurrentPlan(subscriptionData?.current || null)
      setCurrentBillingSummary(subscriptionData?.summary || null)
      setCurrentInvoices(subscriptionData?.invoices || [])
      setCurrentPayments(subscriptionData?.payments || [])
      setTenantSubscriptions(tenantSubscriptionData?.subscriptions || [])
      setBillingSummary(tenantSubscriptionData?.summary || { collectedAmount: 0, pendingAmount: 0, pendingVerificationAmount: 0, renewalAmount: 0, upcomingAmount: 0, overdueInvoices: 0, partiallyPaidInvoices: 0 })
      setBillingInvoices(tenantSubscriptionData?.invoices || [])
      setBillingPayments(tenantSubscriptionData?.payments || [])
      setPaymentGateways(tenantSubscriptionData?.paymentGateways || subscriptionData?.paymentGateways || [])
      setPayroll(payrollData?.payroll || [])
      setPayrollSettings(payrollData?.settings || null)
      setSalaryStructures(payrollData?.salaryStructures || [])
      setPayrollRuns(payrollData?.runs || [])
      setPayrollSummary(payrollData?.summary || null)
      setPayrollAuditLogs(payrollData?.auditLogs || [])
      setDesktopTeam(desktopData?.team || [])
      setLeads(leadData ? [
        ...leadData.demoRequests.map((lead) => ({ ...lead, kind: 'demo' as const })),
        ...leadData.contactMessages.map((lead) => ({ ...lead, kind: 'contact' as const })),
      ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) : [])
      setPlatformAudit(auditData?.auditLogs || [])
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not load the portal'
      setError(message)
      if (/session|token|authentication/i.test(message)) await logout(false)
    } finally {
      setLoading(false)
    }
  }, [token, userRole])

  useEffect(() => { void loadData() }, [loadData])

  async function logout(callApi = true) {
    if (callApi && token) await api('/auth/logout', { method: 'POST' }, token).catch(() => undefined)
    sessionStorage.removeItem('qhr-admin-token')
    sessionStorage.removeItem('qhr-admin-name')
    sessionStorage.removeItem('qhr-admin-role')
    sessionStorage.removeItem('qhr-admin-company')
    // Clear the page from the URL, so signing in again does not land on whatever
    // the previous person was looking at.
    setActivePage('dashboard')
    writePageToLocation('dashboard', true)
    setToken('')
    setUserName('Admin')
    setUserRole('admin')
    setUserCompany('')
  }

  async function reviewLeave(id: string, action: 'approve' | 'reject') {
    try {
      await api(`/leaves/${id}/approve`, { method: 'POST', body: JSON.stringify({ action }) }, token)
      setNotice(`Leave request ${action === 'approve' ? 'approved' : 'rejected'}.`)
      await loadData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Review failed') }
  }

  async function reviewWfh(id: string, action: 'approve' | 'reject') {
    try {
      await api(`/wfh/${id}/review`, { method: 'PATCH', body: JSON.stringify({ action }) }, token)
      setNotice(`WFH request ${action === 'approve' ? 'approved' : 'rejected'}.`)
      await loadData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'WFH review failed') }
  }

  async function resolveGrievance(id: string) {
    try {
      await api(`/grievances/${id}/resolve`, { method: 'PATCH', body: JSON.stringify({ resolution: 'Resolved from the administration portal' }) }, token)
      setNotice('Grievance resolved successfully.')
      await loadData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Grievance update failed') }
  }

  async function reviewReimbursement(id: string, values: Record<string, unknown>) {
    try {
      const result = await api<{ message: string }>(`/reimbursements/${id}/review`, { method: 'PATCH', body: JSON.stringify(values) }, token)
      setNotice(result.message)
      await loadData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Reimbursement review failed') }
  }

  async function markReimbursementPaid(id: string, paymentReference: string, paidAt: string) {
    try {
      const result = await api<{ message: string }>(`/reimbursements/${id}/mark-paid`, { method: 'POST', body: JSON.stringify({ paymentReference, paidAt }) }, token)
      setNotice(result.message)
      await loadData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Reimbursement payment could not be recorded') }
  }

  async function updateCompany(company: Company, status: string) {
    try {
      const result = await api<{ company: Company }>(`/admin/companies/${company._id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token)
      if (selectedCompany?._id === company._id) setSelectedCompany(result.company)
      setNotice(`${company.name} is now ${status}.`)
      await loadData()
      if (selectedCompany?._id === company._id) await loadCompanyDetails(company._id, false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Company update failed') }
  }

  async function loadCompanyDetails(companyId: string, showLoader = true) {
    if (showLoader) setCompanyLoading(true)
    try {
      const data = await api<{ company: Company; employees: Employee[]; auditLogs: AuditLog[]; billing: CompanyBilling }>(`/admin/companies/${companyId}`, {}, token)
      setSelectedCompany(data.company)
      setSelectedCompanyEmployees(data.employees)
      setSelectedCompanyAudit(data.auditLogs)
      setSelectedCompanyBilling(data.billing)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load company details')
    } finally {
      if (showLoader) setCompanyLoading(false)
    }
  }

  async function openCompany(company: Company) {
    setSelectedCompany(company)
    setActivePage('company-detail')
    setNotificationsOpen(false)
    writePageToLocation('company-detail')
    window.scrollTo({ top: 0 })
    if (window.innerWidth < 768) setSidebarOpen(false)
    await loadCompanyDetails(company._id)
  }

  async function saveCompany(companyId: string, values: Record<string, unknown>) {
    try {
      const result = await api<{ company: Company }>(`/admin/companies/${companyId}`, { method: 'PATCH', body: JSON.stringify(values) }, token)
      setSelectedCompany(result.company)
      setNotice(`${result.company.name} details saved.`)
      await loadData()
      await loadCompanyDetails(companyId, false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Company details could not be saved') }
  }

  async function archiveCompany(company: Company) {
    if (!window.confirm(`Archive ${company.name}? Its users will be signed out and future logins will be blocked.`)) return
    try {
      const result = await api<{ company: Company }>(`/admin/companies/${company._id}`, { method: 'DELETE' }, token)
      setSelectedCompany(result.company)
      setNotice(`${company.name} archived successfully.`)
      await loadData()
      await loadCompanyDetails(company._id, false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Company could not be archived') }
  }

  /**
   * Issues a fresh one-time password. Surfaced through a prompt-free notice so
   * the admin can copy it; it is only shown once because only the hash is kept.
   */
  async function resetEmployeePassword(employee: Employee) {
    if (!window.confirm(`Issue a new one-time password for ${employee.name}? Their current sessions will be signed out.`)) return
    setError(''); setNotice('')
    try {
      const result = await api<{ credentials: { oneTimePassword: string; employeeId: string; companyCode: string } }>(
        `/employees/${employee._id}/reset-password`, { method: 'POST' }, token,
      )
      setIssuedCredentials({ ...result.credentials, name: employee.name })
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reset the password')
    }
  }

  /**
   * Removes a geofence. The work location and its address stay: only the
   * check-in boundary goes, which is why the confirmation says so.
   */
  async function deleteArea(area: Area) {
    const belongsTo = area.workLocation ? ` Employees at ${area.workLocation.name} will no longer be able to check in by location.` : ''
    if (!window.confirm(`Delete the ${area.name} geofence?${belongsTo} The work location and its address are kept.`)) return
    setError(''); setNotice('')
    try {
      await api(`/attendance-areas/${area._id}`, { method: 'DELETE' }, token)
      setNotice(`${area.name} geofence removed.`)
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove the geofence')
    }
  }

  async function setEmployeeStatus(employee: Employee, status: 'active' | 'inactive') {
    if (status === 'inactive' && !window.confirm(`Deactivate ${employee.name}? Their active sessions will be closed.`)) return
    try {
      if (status === 'inactive') await api(`/employees/${employee._id}`, { method: 'DELETE' }, token)
      else await api(`/employees/${employee._id}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) }, token)
      setNotice(`${employee.name} ${status === 'active' ? 'reactivated' : 'deactivated'}.`)
      await loadData()
      if (selectedCompany) await loadCompanyDetails(selectedCompany._id, false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Employee status could not be changed') }
  }

  async function updateLead(lead: Lead, status: string) {
    try {
      await api(`/admin/leads/${lead.kind}/${lead._id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token)
      setNotice(`Lead marked ${status}.`)
      await loadData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Lead update failed') }
  }

  async function updatePaymentStatus(payment: BillingPayment, status: 'cleared' | 'rejected' | 'reversed') {
    try {
      await api(`/admin/billing/payments/${payment._id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token)
      setNotice(`Payment ${payment.reference || payment.invoiceNumber} marked ${status}.`)
      await loadData()
      if (selectedCompany?._id === payment.companyId) await loadCompanyDetails(payment.companyId, false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Payment could not be updated') }
  }

  async function updateGateway(gateway: PaymentGateway, values: Partial<Pick<PaymentGateway, 'enabled' | 'isDefault' | 'mode'>>) {
    try {
      const result = await api<{ message: string }>(`/admin/billing/gateways/${gateway.code}`, { method: 'PATCH', body: JSON.stringify(values) }, token)
      setNotice(result.message)
      await loadData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Gateway configuration could not be updated') }
  }

  function openPayment(invoice: BillingInvoice) {
    setSelectedInvoice(invoice)
    setModal('payment')
  }

  async function changeTenantPlan(subscription: TenantSubscription) {
    const planOrder = ['Starter', 'Professional', 'Enterprise']
    const nextPlan = planOrder[(planOrder.indexOf(subscription.plan) + 1) % planOrder.length]
    const pricePerUser = nextPlan === 'Starter' ? 0 : nextPlan === 'Professional' ? 19 : 49
    try {
      await api(`/admin/companies/${subscription.companyId}`, { method: 'PATCH', body: JSON.stringify({ plan: nextPlan, pricePerUser, subscriptionStatus: 'active' }) }, token)
      setNotice(`${subscription.companyName} moved to ${nextPlan}.`)
      await loadData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Plan update failed') }
  }

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return employees
    return employees.filter((employee) => `${Object.values(employee).join(' ')} ${employee.company?.name || ''} ${employee.company?.code || ''}`.toLowerCase().includes(query))
  }, [employees, search])

  const visibleMenuItems = useMemo(() => menuItems.filter((item) => item.roles.includes(userRole)).map((item) => (
    userRole === 'super_admin' && platformMenuLabels[item.key] ? { ...item, ...platformMenuLabels[item.key] } : item
  )), [userRole])

  useEffect(() => {
    const companyDetailAllowed = activePage === 'company-detail' && userRole === 'super_admin' && selectedCompany
    if (!companyDetailAllowed && !visibleMenuItems.some((item) => item.key === activePage)) {
      setActivePage('dashboard')
      // Correct the URL too. Leaving `?page=plans` on a page this role cannot see
      // would show the Dashboard under the wrong address, and the next refresh
      // would try the same page again.
      writePageToLocation('dashboard', true)
    }
  }, [activePage, selectedCompany, userRole, visibleMenuItems])

  if (!token) return <Login onAuthenticated={(nextToken, user) => { setToken(nextToken); setUserName(user.name); setUserRole(user.role); setUserCompany(user.company?.name || '') }} />

  const page = activePage === 'company-detail'
    ? { label: selectedCompany?.name || 'Company details', description: 'Tenant information, access, and employees' }
    : visibleMenuItems.find((item) => item.key === activePage) || visibleMenuItems[0]
  const activeGroup: MenuGroup = activePage === 'company-detail'
    ? 'Platform'
    : (visibleMenuItems.find((item) => item.key === activePage) || visibleMenuItems[0])?.group || 'Overview'
  // Setup is unfinished. Drives the dashboard banner, the count on the Getting
  // started nav item, and the in-place notes on Payroll and Attendance.
  const setupPending = onboardingState?.status === 'in_progress'

  function openPage(nextPage: PageKey) {
    setActivePage(nextPage)
    setNotificationsOpen(false)
    if (nextPage !== 'company-detail') setSelectedCompany(null)
    writePageToLocation(nextPage)
    // Each page is a fresh document, so it starts at the top. Without this the
    // window keeps the previous page's offset and the next page opens
    // mid-content, or below it entirely when the new page is shorter.
    window.scrollTo({ top: 0 })
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-neu-bg text-slate-800">
      {sidebarReady && sidebarOpen && <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 md:hidden" />}
      <aside className={`neu-sidebar fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col p-3 transition-[transform,width] duration-150 ease-enter md:sticky md:top-0 ${sidebarReady ? '' : 'max-md:hidden'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-[68px] md:translate-x-0'}`}>
        <div className={`mb-5 flex h-10 items-center gap-2.5 ${sidebarOpen ? 'px-1.5' : 'justify-center'}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-[15px] font-bold text-white">Q</span>
          {sidebarOpen && <div className="min-w-0 flex-1"><p className="nav-brand-name truncate text-sm font-bold leading-tight">{userRole === 'super_admin' ? 'QHR Platform' : 'QHR'}</p><p className="nav-brand-meta truncate text-xs leading-tight">{userRole === 'super_admin' ? 'Super Admin console' : userCompany || 'Company workspace'}</p></div>}
          {sidebarOpen && <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="nav-icon-button p-1.5 md:hidden"><X className="h-4 w-4" /></button>}
        </div>
        <nav aria-label="Main" className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-2">
          {menuGroups.map((group) => {
            const groupItems = visibleMenuItems.filter((item) => item.group === group)
            if (!groupItems.length) return null
            return (
              <div key={group} className="space-y-0.5">
                {sidebarOpen && <p className="nav-group-label">{group}</p>}
                {groupItems.map((item) => {
                  const current = activePage === item.key || (activePage === 'company-detail' && item.key === 'companies')
                  // Setup progress lives on its own nav item. It is then visible
                  // from every page without a banner having to repeat itself on
                  // every page.
                  const progress = item.key === 'onboarding' && setupPending
                    ? `${onboardingState?.completedRequired ?? 0}/${onboardingState?.totalRequired ?? 0}`
                    : ''
                  return (
                    <button
                      key={item.key}
                      title={progress ? `${item.label} - ${progress} required steps done` : item.label}
                      onClick={() => openPage(item.key)}
                      aria-current={current ? 'page' : undefined}
                      className={`nav-item ${sidebarOpen ? '' : 'justify-center'}`}
                    >
                      <span className="relative flex shrink-0">
                        <item.icon className="h-[18px] w-[18px]" />
                        {/* Collapsed rail has no room for the count, so a dot carries it. */}
                        {progress && !sidebarOpen && <span aria-hidden className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary-400 ring-2 ring-[color:var(--nav-bg)]" />}
                      </span>
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                      {sidebarOpen && progress && (
                        <span className="ml-auto shrink-0 rounded-full bg-primary-500 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">{progress}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>
        <div className="mt-3 space-y-3 pt-3">
          <div className="nav-divider" />
          {sidebarOpen && (
            <div className="flex items-center gap-2.5 px-1.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">{userName.charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="nav-brand-name truncate text-xs font-semibold leading-tight">{userName}</p>
                <p className="nav-brand-meta truncate text-[11px] capitalize leading-tight">{userRole === 'super_admin' ? 'Platform owner' : userRole.replace('_', ' ')}</p>
              </div>
            </div>
          )}
          <button onClick={() => void logout()} title="Logout" className={`nav-item nav-item-danger ${sidebarOpen ? '' : 'justify-center'}`}>
            <LogOut className="h-[18px] w-[18px]" />{sidebarOpen && 'Sign out'}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="app-bar">
          <div className="shell-width flex items-center gap-3">
            <button aria-label="Toggle sidebar" onClick={() => setSidebarOpen((value) => !value)} className="ghost-button shrink-0 p-2"><Menu className="h-[18px] w-[18px]" /></button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink-muted">
              <span className="hidden sm:inline">{activeGroup}</span>
              <ChevronRight className="hidden h-3 w-3 shrink-0 sm:inline" />
              <span className="truncate text-ink">{page.label}</span>
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {activePage === 'employees' && <label className="relative hidden w-60 lg:block"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" aria-label="Search employees" className="neu-input w-full py-1.5 pl-8 pr-3 text-sm" /></label>}
              <button aria-label="Refresh data" title="Refresh" onClick={() => void loadData()} className="ghost-button hidden p-2 sm:inline-flex"><RefreshCw className={`h-[18px] w-[18px] ${loading ? 'animate-spin' : ''}`} /></button>
              <NotificationCentre apiRoot={API_ROOT} token={token} onNavigate={(page, id) => { if (page === 'leaves' && id) { /* deep link lands on the queue */ } openPage(page as PageKey) }} />
              <span aria-hidden="true" className="mx-0.5 hidden h-6 w-px bg-line sm:block" />
              {userRole === 'admin' ? <button onClick={() => openPage('settings')} title="Open profile settings" aria-label="Open profile settings" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white transition-colors hover:bg-primary-600">{userName.charAt(0).toUpperCase()}</button> : <span title={userName} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">{userName.charAt(0).toUpperCase()}</span>}
            </div>
          </div>
        </div>

        <div className="page-band">
          <div className="shell-width flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-[22px] font-bold leading-tight sm:text-2xl">{page.label}</h1>
                <span className="chip hidden bg-primary-50 capitalize text-primary-700 ring-1 ring-inset ring-primary-200 md:inline-flex">{userRole === 'super_admin' ? 'Platform owner' : userRole.replace('_', ' ')}</span>
              </div>
              <p className="mt-0.5 text-sm text-ink-soft">{userRole === 'super_admin' ? `${page.description} · QHR Platform` : `${page.description}${userCompany ? ` · ${userCompany}` : ''}`}</p>
            </div>
          </div>
        </div>

        <div className="page-content">
          <div className="shell-width">
        {activePage === 'employees' && <label className="relative mb-4 block sm:hidden"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" className="neu-input w-full py-2.5 pl-10 pr-3" /></label>}

        {(notice || error) && <div role={error ? 'alert' : 'status'} className={`animate-in mb-4 flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium ${error ? 'border-red-200 bg-danger-soft text-danger' : 'border-emerald-200 bg-success-soft text-success'}`}><span className="min-w-0">{error || notice}</span><button aria-label="Dismiss message" onClick={() => { setError(''); setNotice('') }} className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"><X className="h-4 w-4" /></button></div>}
        {/* Dashboard only. This used to render on all 21 other pages, so every
            screen opened with a banner asking for the same thing. Progress is
            still visible everywhere through the count on the Getting started nav
            item, and pages whose own work is blocked say so themselves. */}
        {setupPending && activePage === 'dashboard' && (
          <div role="status" className="animate-in mb-4 flex flex-col gap-3 rounded-lg border border-primary-200 bg-primary-50 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-500 text-white"><Rocket className="h-[18px] w-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-primary-800">Finish setting up {userCompany || 'your company'}</p>
              <p className="mt-0.5 text-xs text-primary-700">{onboardingState?.completedRequired} of {onboardingState?.totalRequired} required setup steps done. Payroll and attendance need the remaining details.</p>
              <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-primary-200"><div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${onboardingState?.percent || 0}%` }} /></div>
            </div>
            <button onClick={() => openPage('onboarding')} className="gradient-button shrink-0 rounded-md px-3.5 py-2 text-sm font-semibold">Continue setup</button>
          </div>
        )}

        {/* Payroll and Attendance genuinely cannot produce correct output until
            setup is done, so those two say it in place rather than every page
            carrying the warning. */}
        {setupPending && (activePage === 'payroll' || activePage === 'attendance') && (
          <p role="status" className="animate-in mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs font-semibold text-primary-800">
            <Rocket className="h-3.5 w-3.5 shrink-0" />
            {activePage === 'payroll'
              ? 'Payslips need your statutory details before they will be correct.'
              : 'Attendance needs your office hours and policy before it will be correct.'}
            <button onClick={() => openPage('onboarding')} className="underline underline-offset-2">Finish setup ({onboardingState?.completedRequired}/{onboardingState?.totalRequired})</button>
          </p>
        )}
        {loading && !employees.length ? <div className="flex min-h-96 flex-col items-center justify-center gap-3 text-sm text-ink-soft"><Loader2 className="h-7 w-7 animate-spin text-primary-500" /><span>Loading your workspace…</span></div> : (
          <>
            {activePage === 'dashboard' && (userRole === 'super_admin' ? <PlatformDashboard summary={platformSummary} companies={companies} openPage={openPage} onManage={(company) => void openCompany(company)} /> : <Dashboard summary={summary} attendance={attendance} leaves={leaves} openPage={openPage} canViewBilling={userRole === 'admin'} />)}
            {activePage === 'employees' && <Employees employees={filteredEmployees} salaryStructures={salaryStructures} workLocations={workLocations} showCompany={userRole === 'super_admin'} onAdd={['manager', 'super_admin'].includes(userRole) ? undefined : () => setModal('employee')} onImport={['hr', 'admin'].includes(userRole) ? () => openPage('imports') : undefined} onEdit={['hr', 'admin'].includes(userRole) ? (employee) => { setSelectedEmployee(employee); setModal('employee-edit') } : undefined} onPayroll={['hr', 'admin'].includes(userRole) ? (employee) => { setPayrollEmployeeToEdit(employee._id); openPage('payroll') } : undefined} onResetPassword={['hr', 'admin'].includes(userRole) ? (employee) => void resetEmployeePassword(employee) : undefined} onStatus={userRole === 'admin' ? (employee, status) => void setEmployeeStatus(employee, status) : undefined} />}
            {activePage === 'onboarding' && <OnboardingWorkspace apiRoot={API_ROOT} token={token} role={userRole as 'hr' | 'admin'} onChanged={async (message) => { setNotice(message); await loadData() }} />}
            {activePage === 'org' && <OrgWorkspace apiRoot={API_ROOT} token={token} role={userRole as 'manager' | 'hr' | 'admin'} employees={employees} onChanged={async (message) => { setNotice(message); await loadData() }} />}
            {activePage === 'imports' && <ImportWorkspace apiRoot={API_ROOT} token={token} employees={employees.map((item) => ({ _id: item._id, name: item.name, employeeId: item.employeeId, workLocationId: item.workLocationId }))} onChanged={async (message) => { setNotice(message); await loadData() }} />}
            {activePage === 'plans' && <PlanCatalogue apiRoot={API_ROOT} token={token} onChanged={async (message) => { setNotice(message); await loadData() }} />}
            {activePage === 'calendar' && <CalendarWorkspace apiRoot={API_ROOT} token={token} canManage={userRole === 'admin' || userRole === 'hr'} onChanged={async (message) => { setNotice(message); await loadData() }} />}
            {activePage === 'companies' && <Companies companies={companies} onAdd={() => setModal('company')} onManage={(company) => void openCompany(company)} onStatus={(company, status) => void updateCompany(company, status)} />}
            {activePage === 'company-detail' && selectedCompany && (companyLoading ? <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div> : <CompanyDetail company={selectedCompany} billing={selectedCompanyBilling} employees={selectedCompanyEmployees} auditLogs={selectedCompanyAudit} onBack={() => openPage('companies')} onSave={(values) => void saveCompany(selectedCompany._id, values)} onStatus={(status) => void updateCompany(selectedCompany, status)} onArchive={() => void archiveCompany(selectedCompany)} onAddEmployee={() => setModal('employee')} onEditEmployee={(employee) => { setSelectedEmployee(employee); setModal('employee-edit') }} onEmployeeStatus={(employee, status) => void setEmployeeStatus(employee, status)} onRecordPayment={openPayment} onCreateInvoice={() => setModal('invoice')} />)}
            {activePage === 'leads' && <Leads leads={leads} update={(lead, status) => void updateLead(lead, status)} />}
            {activePage === 'audit' && <PlatformAudit auditLogs={platformAudit} />}
            {activePage === 'attendance' && <AttendanceWorkspace apiRoot={API_ROOT} token={token} policyLabel={attendancePolicyLabel(attendancePolicy.payrollImpact)} areas={areas} workLocations={workLocations} onError={setError} />}
            {activePage === 'leaves' && <Leaves leaves={leaves} review={reviewLeave} />}
            {activePage === 'wfh' && <WfhRequests requests={wfhRequests} review={reviewWfh} onAssign={() => setModal('wfh-assign')} />}
            {activePage === 'grievances' && <Grievances grievances={grievances} resolve={(id) => void resolveGrievance(id)} />}
            {activePage === 'reimbursements' && <Reimbursements token={token} reimbursements={reimbursements} role={userRole} review={(id, values) => void reviewReimbursement(id, values)} markPaid={(id, reference, paidAt) => void markReimbursementPaid(id, reference, paidAt)} />}
            {activePage === 'payroll' && <PayrollWorkspace apiRoot={API_ROOT} token={token} role={userRole as 'hr' | 'admin'} payroll={payroll} settings={payrollSettings} salaryStructures={salaryStructures} runs={payrollRuns} summary={payrollSummary} auditLogs={payrollAuditLogs} initialSalaryEmployeeId={payrollEmployeeToEdit} onInitialSalaryConsumed={() => setPayrollEmployeeToEdit(null)} onOpenPage={(page) => openPage(page as PageKey)} onChanged={async (message) => { setNotice(message); await loadData() }} />}
            {activePage === 'work' && <WorkWorkspace apiRoot={API_ROOT} token={token} role={userRole as 'manager' | 'hr' | 'admin'} employees={employees} onChanged={async (message) => { setNotice(message); await loadData() }} />}
            {activePage === 'assets' && <AssetsWorkspace apiRoot={API_ROOT} token={token} role={userRole as 'manager' | 'hr' | 'admin'} employees={employees} workLocations={workLocations} onChanged={async (message) => { setNotice(message); await loadData() }} />}
            {activePage === 'desktop' && <DesktopView team={desktopTeam} />}
            {activePage === 'geofences' && <Areas areas={areas} workLocations={workLocations} canManage={userRole === 'hr' || userRole === 'admin'} onAdd={() => { setSelectedArea(null); setModal('area') }} onEdit={(area) => { setSelectedArea(area); setModal('area') }} onDelete={(area) => void deleteArea(area)} onOpenLocations={() => openPage('org')} />}
            {activePage === 'subscriptions' && (userRole === 'super_admin' ? <PlatformSubscriptions plans={plans} subscriptions={tenantSubscriptions} summary={billingSummary} invoices={billingInvoices} payments={billingPayments} gateways={paymentGateways} onManage={(subscription) => { const company = companies.find((item) => item._id === subscription.companyId); if (company) void openCompany(company) }} onRecordPayment={openPayment} onPaymentStatus={(payment, status) => void updatePaymentStatus(payment, status)} onGatewayUpdate={(gateway, values) => void updateGateway(gateway, values)} /> : <Subscriptions token={token} plans={plans} current={currentPlan} summary={currentBillingSummary} invoices={currentInvoices} payments={currentPayments} gateways={paymentGateways} onSubmitted={async (message) => { setNotice(message); await loadData() }} />)}
            {activePage === 'settings' && <SettingsView userName={userName} apiRoot={API_ROOT} company={companies[0]} token={token} canEditCompany={userRole === 'admin'} onOpenPage={(page) => openPage(page as PageKey)} onCompanySaved={async (message) => { setNotice(message); await loadData() }} onSaved={async () => { setNotice('Workspace settings saved.'); await loadData() }} />}
          </>
        )}
          </div>
        </div>
      </main>
      {modal === 'company' && <CompanyModal close={() => setModal(null)} done={async (message) => { setModal(null); setNotice(message); await loadData() }} />}
      {modal === 'employee' && <EmployeeSalaryModal token={token} userRole={userRole} employees={employees} companyId={userRole === 'super_admin' ? selectedCompany?._id : undefined} departments={departments} designations={designations} workLocations={workLocations} close={() => setModal(null)} onCreated={async (employee, openPayroll) => { await loadData(); if (selectedCompany) await loadCompanyDetails(selectedCompany._id, false); if (openPayroll && employee && userRole !== 'super_admin') { setPayrollEmployeeToEdit(employee._id) } }} done={async (message, employee, openPayroll) => { setModal(null); setNotice(message); await loadData(); if (selectedCompany) await loadCompanyDetails(selectedCompany._id, false); if (openPayroll && employee && userRole !== 'super_admin') { setPayrollEmployeeToEdit(employee._id); openPage('payroll') } }} />}
      {modal === 'employee-edit' && selectedEmployee && <EmployeeSalaryEditModal token={token} userRole={userRole} employees={employees} employee={selectedEmployee} departments={departments} designations={designations} workLocations={workLocations} close={() => { setModal(null); setSelectedEmployee(null) }} done={async (message) => { setModal(null); setSelectedEmployee(null); setNotice(message); await loadData(); if (selectedCompany) await loadCompanyDetails(selectedCompany._id, false) }} />}
      {issuedCredentials && <Modal title="New one-time password" close={() => setIssuedCredentials(null)}><IssuedCredentials issued={issuedCredentials} onDone={() => setIssuedCredentials(null)} /></Modal>}
      {modal === 'area' && <AreaModal token={token} workLocations={workLocations} area={selectedArea} close={() => { setModal(null); setSelectedArea(null) }} done={async (message) => { setModal(null); setSelectedArea(null); setNotice(message); await loadData() }} />}
      {modal === 'payment' && selectedInvoice && <PaymentModal token={token} invoice={selectedInvoice} close={() => { setModal(null); setSelectedInvoice(null) }} done={async (message) => { setModal(null); setSelectedInvoice(null); setNotice(message); await loadData(); if (selectedCompany) await loadCompanyDetails(selectedCompany._id, false) }} />}
      {modal === 'invoice' && selectedCompany && <InvoiceModal token={token} company={selectedCompany} subscription={selectedCompanyBilling?.subscription || selectedCompany.subscription || null} close={() => setModal(null)} done={async (message) => { setModal(null); setNotice(message); await loadData(); await loadCompanyDetails(selectedCompany._id, false) }} />}
      {modal === 'wfh-assign' && <WfhAssignModal token={token} employees={employees} close={() => setModal(null)} done={async (message) => { setModal(null); setNotice(message); await loadData() }} />}
    </div>
  )
}

function Login({ onAuthenticated }: { onAuthenticated: (token: string, user: { name: string; role: UserRole; company?: { name?: string } }) => void }) {
  // Not pre-filled: this console is reachable over the public internet, and
  // shipping working admin credentials in the form is a live vulnerability.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const data = await api<{ accessToken: string; user: { name: string; role: UserRole; company?: { name?: string } } }>('/auth/admin-login', { method: 'POST', body: JSON.stringify({ email, password }) })
      sessionStorage.setItem('qhr-admin-token', data.accessToken); sessionStorage.setItem('qhr-admin-name', data.user.name); sessionStorage.setItem('qhr-admin-role', data.user.role); sessionStorage.setItem('qhr-admin-company', data.user.company?.name || '')
      onAuthenticated(data.accessToken, data.user)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Login failed') } finally { setLoading(false) }
  }
  return <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,26rem)_1fr]">
    {/* Brand panel matches the dark navigation rail, so signing in already looks
        like the application the user is about to enter. */}
    <aside className="neu-sidebar hidden flex-col justify-between p-9 lg:flex">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-500 text-sm font-bold text-white">Q</span>
        <div>
          <p className="nav-brand-name text-base font-bold leading-none">QHR</p>
          <p className="nav-brand-meta text-[10px] font-semibold uppercase tracking-[0.22em]">Attendance</p>
        </div>
      </div>
      <div>
        <h2 className="nav-brand-name text-2xl font-bold leading-tight">One console for attendance, approvals, and payroll.</h2>
        <ul className="mt-7 space-y-3">
          {[
            ['Role-based access', 'Admin, HR, manager, and employee see only their own scope.'],
            ['Approvals that escalate', 'Manager first, HR for long or unpaid absence.'],
            ['Payroll from real data', 'Loss of pay derived from the attendance record.'],
          ].map(([title, copy]) => (
            <li key={title} className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" />
              <div>
                <p className="nav-brand-name text-sm font-semibold leading-tight">{title}</p>
                <p className="nav-brand-meta mt-0.5 text-xs leading-5">{copy}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="nav-brand-meta text-xs">Employees sign in through the employee portal.</p>
    </aside>

    <main className="grid min-h-screen place-items-center bg-neu-bg p-5">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 lg:hidden">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-500 text-lg font-bold text-white">Q</span>
        </div>
        <h1 className="text-[22px] font-bold tracking-tight">Sign in to QHR</h1>
        <p className="mt-1 text-sm text-ink-soft">Your role opens the matching console.</p>
        <form onSubmit={submit} className="neu-card mt-6 rounded-lg p-5 sm:p-6">
          {error && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}
          <label className="mb-4 block text-sm font-semibold">Work email<input type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} className="neu-input mt-1.5 w-full px-3 py-2.5 font-normal" required /></label>
          <label className="mb-5 block text-sm font-semibold">Password<input type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} className="neu-input mt-1.5 w-full px-3 py-2.5 font-normal" required /></label>
          <button disabled={loading} className="gradient-button flex w-full items-center justify-center gap-2 rounded-md py-2.5">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="mt-5 text-xs text-ink-muted lg:hidden">Employees sign in through the employee portal.</p>
      </div>
    </main>
  </div>
}

function Toolbar({ title, action, onAction, onImport, exportRows }: { title: string; action?: string; onAction?: () => void; onImport?: () => void; exportRows?: Array<Record<string, unknown>> }) {
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-bold tracking-tight">{title}</h2><div className="flex flex-wrap gap-2">{exportRows && <button onClick={() => downloadCsv(title.toLowerCase().replaceAll(' ', '-'), exportRows)} className="neu-button flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm"><Download className="h-4 w-4" />Export</button>}{onImport && <button onClick={onImport} className="neu-button flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm"><Upload className="h-4 w-4" />Import</button>}{action && onAction && <button onClick={onAction} className="gradient-button flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm"><Plus className="h-4 w-4" />{action}</button>}</div></div>
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`neu-card rounded-lg p-4 sm:p-5 ${className}`}>{children}</section> }

function Dashboard({ summary, attendance, leaves, openPage, canViewBilling }: { summary: Summary; attendance: AttendanceRow[]; leaves: Leave[]; openPage: (page: PageKey) => void; canViewBilling: boolean }) {
  // Each tile carries the context that makes its number mean something. A "Live"
  // badge on all four said nothing, and a bare zero left people guessing whether
  // nobody had checked in or attendance simply was not set up yet.
  const seats = summary.totalSeats || 0
  const cards: Array<readonly [string, string | number, LucideIcon, PageKey, string]> = [
    ['Employees', summary.employees, Users, 'employees',
      seats ? `${summary.employees} of ${seats} seats used` : 'On your payroll'],
    ['Present today', summary.presentToday, Clock, 'attendance',
      summary.employees === 0 ? 'No employees yet'
        : summary.presentToday === 0 ? 'Nobody has checked in yet'
          : `of ${summary.employees} on the payroll`],
    ['Waiting on you', summary.pendingLeaves, Calendar, 'leaves',
      summary.pendingLeaves === 0 ? 'Nothing to approve' : 'Leave requests to review'],
    ...(canViewBilling && summary.monthlySubscription !== undefined
      // A tenant sees what they pay, not "revenue". The figure comes from their
      // own plan and seat count.
      ? [['Monthly subscription', formatCurrency(summary.monthlySubscription), TrendingUp, 'subscriptions' as PageKey,
        [summary.planName, summary.nextRenewalAt ? `renews ${formatDate(summary.nextRenewalAt)}` : ''].filter(Boolean).join(' · ') || 'Current plan'] as const]
      : []),
  ]
  return <><div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map(([label, value, Icon, target, context]) => <button key={label} onClick={() => openPage(target)} className="neu-card group rounded-lg p-4 text-left transition-all duration-150 ease-enter hover:-translate-y-px hover:border-primary-200 hover:shadow-raised"><span className="mb-3 inline-flex rounded-md bg-primary-50 p-1.5 text-primary-600 ring-1 ring-inset ring-primary-100"><Icon className="h-[18px] w-[18px]" /></span><p className="text-2xl font-bold tracking-tight sm:text-[28px]">{value}</p><p className="mt-0.5 text-sm font-semibold text-ink-soft">{label}</p><p className="mt-1 text-xs leading-4 text-ink-muted">{context}</p></button>)}</div><div className="grid items-start gap-4 xl:grid-cols-3"><Card className="xl:col-span-2"><Toolbar title="Today's attendance" /><AttendanceTable rows={attendance} /></Card><Card className="self-start"><Toolbar title="Approval queue" /><div className="space-y-2">{leaves.slice(0, 5).map((leave) => <button key={leave._id} onClick={() => openPage('leaves')} className="neu-inset flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:border-primary-200 hover:bg-primary-50/40"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{leave.employee.firstName} {leave.employee.lastName}</span><span className="block truncate text-xs text-ink-soft"><span className="capitalize">{leave.leaveType}</span> leave · {leave.days} {leave.days === 1 ? 'day' : 'days'}</span><span className="block truncate text-xs text-ink-muted">{formatDate(leave.startDate)}{leave.endDate && leave.endDate !== leave.startDate ? ` to ${formatDate(leave.endDate)}` : ''}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" /></button>)}{!leaves.length && <Empty label="No pending approvals" />}</div></Card></div></>
}

function PlatformDashboard({ summary, companies, openPage, onManage }: { summary: PlatformSummary; companies: Company[]; openPage: (page: PageKey) => void; onManage: (company: Company) => void }) {
  const cards = [
    ['Companies', summary.companies, Building2, 'companies'],
    ['Active tenants', summary.activeCompanies, ShieldCheck, 'companies'],
    ['Collected', formatCurrency(summary.collectedAmount), Wallet, 'subscriptions'],
    ['Outstanding', formatCurrency(summary.pendingAmount), TrendingUp, 'subscriptions'],
  ] as const
  return <><div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-4">{cards.map(([label, value, Icon, target]) => <button key={label} onClick={() => openPage(target)} className="neu-card rounded-lg p-3 text-left sm:p-5"><div className="mb-3 flex items-center justify-between sm:mb-4"><span className="rounded-lg bg-primary-50 p-1.5 text-primary-500 sm:p-2"><Icon className="h-5 w-5" /></span><span className="text-[11px] font-semibold text-emerald-600 sm:text-xs">Platform</span></div><p className="text-2xl font-bold sm:text-3xl">{value}</p><p className="mt-1 text-xs text-slate-500 sm:text-sm">{label}</p></button>)}</div><div className="grid items-start gap-4 sm:gap-5 xl:grid-cols-3"><Card className="xl:col-span-2"><Toolbar title="Tenant overview" /><Table headers={['Company', 'Users', 'Plan', 'Renewal', 'Outstanding', 'Status', 'Action']} rows={companies.map((company) => [<div key="company"><p className="font-semibold">{company.name}</p><p className="text-xs text-slate-500">{company.code}</p></div>, company.employeeCount || 0, company.subscription?.plan || 'Professional', formatCurrency(company.subscription?.renewalAmount || 0), formatCurrency(company.billingSummary?.outstandingAmount || 0), <Status key="status">{company.status || (company.isVerified ? 'active' : 'pending')}</Status>, <button key="manage" onClick={() => onManage(company)} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold">Manage</button>])} /></Card><Card className="self-start"><Toolbar title="Platform queue" /><div className="space-y-3"><button onClick={() => openPage('subscriptions')} className="neu-inset flex w-full items-center justify-between rounded-lg p-3 text-left"><span>Upcoming renewals</span><strong>{formatCurrency(summary.upcomingAmount)}</strong></button><button onClick={() => openPage('subscriptions')} className="neu-inset flex w-full items-center justify-between rounded-lg p-3 text-left"><span>Renewal book</span><strong>{formatCurrency(summary.renewalAmount)}</strong></button><button onClick={() => openPage('leads')} className="neu-inset flex w-full items-center justify-between rounded-lg p-3 text-left"><span>Open sales leads</span><strong>{summary.openLeads}</strong></button></div></Card></div></>
}

function Employees({ employees, salaryStructures, workLocations = [], onAdd, onImport, onEdit, onPayroll, onStatus, onResetPassword, showCompany = false }: { employees: Employee[]; salaryStructures: SalaryStructureRecord[]; workLocations?: WorkLocation[]; onAdd?: () => void; onImport?: () => void; onEdit?: (employee: Employee) => void; onPayroll?: (employee: Employee) => void; onStatus?: (employee: Employee, status: 'active' | 'inactive') => void; onResetPassword?: (employee: Employee) => void; showCompany?: boolean }) {
  const locationNames = new Map(workLocations.map((item) => [item._id, item.name]))
  const showActions = Boolean(onEdit || onPayroll || onStatus || onResetPassword)
  const showPayroll = Boolean(onPayroll)
  const salaryByEmployee = new Map(salaryStructures.map((item) => [item.employee._id, item.structure]))
  const headers = showCompany ? ['Employee', 'Company', 'Department', 'Role', 'Status'] : ['Employee', 'Department', 'Work location', 'Role', ...(showPayroll ? ['Payroll'] : []), 'Status', ...(showActions ? ['Actions'] : [])]
  const rows = employees.map((employee) => {
    const base = [<div key="name"><p className="font-semibold">{employee.name}</p><p className="text-xs text-slate-500">{employee.employeeId} - {employee.email}</p></div>]
    if (showCompany) base.push(<div key="company"><p className="font-medium">{employee.company?.name || 'Platform'}</p><p className="text-xs text-slate-500">{employee.company?.code || '-'}</p></div>)
    const row: ReactNode[] = showCompany
      ? [...base, employee.department, employee.role.replace('_', ' ')]
      : [
        ...base,
        employee.department,
        <span key="location" className={employee.workLocationId ? '' : 'text-ink-muted'}>{locationNames.get(employee.workLocationId || '') || 'Payroll address'}</span>,
        employee.role.replace('_', ' '),
      ]
    if (showPayroll) {
      const structure = salaryByEmployee.get(employee._id)
      row.push(<Status key="payroll">{structure?.payrollEnabled ? 'active' : 'setup required'}</Status>)
    }
    row.push(<Status key="status">{employee.status}</Status>)
    if (showActions) row.push(<div key="actions" className="flex flex-wrap gap-2">{onEdit && <button title="Edit employee" onClick={() => onEdit(employee)} className="neu-button rounded-lg p-2"><Pencil className="h-4 w-4" /></button>}{onPayroll && <button title="Configure payroll" onClick={() => onPayroll(employee)} className="neu-button flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold"><Wallet className="h-4 w-4" />Payroll</button>}{onResetPassword && <button title="Issue a new one-time password" onClick={() => onResetPassword(employee)} className="neu-button flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold"><KeyRound className="h-4 w-4" />Reset password</button>}{onStatus && <button onClick={() => onStatus(employee, employee.status === 'inactive' ? 'active' : 'inactive')} className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${employee.status === 'inactive' ? 'bg-emerald-600 text-white' : 'neu-button text-red-600'}`}>{employee.status === 'inactive' ? 'Activate' : 'Deactivate'}</button>}</div>)
    return row
  })
  return <Card><Toolbar title={showCompany ? 'Platform employees' : 'Employees'} action={onAdd ? 'Add employee' : undefined} onAction={onAdd} onImport={onImport} exportRows={employees.map(({ employeeId, name, email, department, designation, status, company, workLocationId }) => ({ employeeId, name, email, company: company?.name || '', companyCode: company?.code || '', department, designation, workLocation: locationNames.get(workLocationId || '') || '', status }))} /><Table headers={headers} rows={rows} /></Card>
}

function Companies({ companies, onAdd, onManage, onStatus }: { companies: Company[]; onAdd: () => void; onManage: (company: Company) => void; onStatus: (company: Company, status: string) => void }) { return <Card><Toolbar title="Companies" action="Add company" onAction={onAdd} exportRows={companies.map((item) => ({ code: item.code, name: item.name, email: item.email, employees: item.employeeCount || 0, plan: item.subscription?.plan || '', status: item.status || 'active' }))} /><Table headers={['Company', 'Employees', 'Plan', 'Revenue', 'Status', 'Actions']} rows={companies.map((company) => { const inactive = ['suspended', 'archived'].includes(company.status || ''); return [<div key="company"><p className="font-semibold">{company.name}</p><p className="text-xs text-slate-500">{company.code} - {company.email}</p></div>, company.employeeCount || 0, company.subscription?.plan || 'Professional', `Rs.${company.monthlyRevenue || 0}`, <Status key="status">{company.status || (company.isVerified ? 'active' : 'pending')}</Status>, <div key="actions" className="flex gap-2"><button onClick={() => onManage(company)} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold">Manage</button><button onClick={() => onStatus(company, inactive ? 'active' : 'suspended')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${inactive ? 'bg-emerald-600 text-white' : 'neu-button text-red-600'}`}>{inactive ? 'Reactivate' : 'Suspend'}</button></div>] })} /></Card> }

function CompanyDetail({ company, billing, employees, auditLogs, onBack, onSave, onStatus, onArchive, onAddEmployee, onEditEmployee, onEmployeeStatus, onRecordPayment, onCreateInvoice }: { company: Company; billing: CompanyBilling | null; employees: Employee[]; auditLogs: AuditLog[]; onBack: () => void; onSave: (values: Record<string, unknown>) => void; onStatus: (status: string) => void; onArchive: () => void; onAddEmployee: () => void; onEditEmployee: (employee: Employee) => void; onEmployeeStatus: (employee: Employee, status: 'active' | 'inactive') => void; onRecordPayment: (invoice: BillingInvoice) => void; onCreateInvoice: () => void }) {
  const activeEmployees = employees.filter((employee) => employee.status !== 'inactive').length
  const subscription = billing?.subscription || company.subscription
  const [billingMode, setBillingMode] = useState<BillingMode>(subscription?.billingMode || 'manual_offline')
  useEffect(() => { setBillingMode(subscription?.billingMode || 'manual_offline') }, [company._id, subscription?.billingMode])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    onSave({
      ...values,
      pricePerUser: Number(values.pricePerUser || 0),
      paidSeats: Number(values.paidSeats || 0),
      annualDiscountPercent: Number(values.annualDiscountPercent || 0),
      customRenewalAmount: values.customRenewalAmount === '' ? null : Number(values.customRenewalAmount),
    })
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><button onClick={onBack} className="neu-button flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Companies</button><div className="flex flex-wrap gap-2">{company.status !== 'active' && <button onClick={() => onStatus('active')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"><UserCheck className="mr-2 inline h-4 w-4" />Reactivate</button>}{company.status === 'active' && <button onClick={() => onStatus('suspended')} className="neu-button rounded-lg px-3 py-2 text-sm font-semibold text-red-600"><UserX className="mr-2 inline h-4 w-4" />Suspend</button>}{company.status !== 'archived' && <button onClick={onArchive} className="neu-button rounded-lg px-3 py-2 text-sm font-semibold text-red-700"><Archive className="mr-2 inline h-4 w-4" />Archive</button>}</div></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Active employees" value={activeEmployees} /><Metric label="Paid seats" value={subscription?.paidSeats || 0} /><Metric label="Outstanding" value={formatCurrency(billing?.summary.outstandingAmount || 0)} /><Metric label="Next renewal" value={formatCurrency(subscription?.renewalAmount || 0)} /></div>
    <Card><Toolbar title="Company and billing settings" /><form key={`${company._id}-${company.updatedAt || ''}`} onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <label className="text-sm font-semibold">Company name<input name="name" defaultValue={company.name} required className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Company code<input name="code" defaultValue={company.code} required className={`${fieldClass} mt-1 uppercase`} /></label>
      <label className="text-sm font-semibold">Company email<input name="email" type="email" defaultValue={company.email} required className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Phone<input name="phone" defaultValue={company.phone || ''} className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Domain<input name="domain" defaultValue={company.domain || ''} className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Plan<select name="plan" defaultValue={subscription?.plan || 'Starter'} className={`${fieldClass} mt-1`}><option>Starter</option><option>Professional</option><option>Enterprise</option></select></label>
      <label className="text-sm font-semibold">Billing mode<select name="billingMode" value={billingMode} onChange={(event) => setBillingMode(event.target.value as BillingMode)} className={`${fieldClass} mt-1`}><option value="automatic">Automatic renewal</option><option value="manual_online">Manual online</option><option value="manual_offline">Manual offline</option><option value="custom">Custom agreement</option></select></label>
      <label className="text-sm font-semibold">Billing cycle<select name="billingCycle" defaultValue={subscription?.billingCycle || 'monthly'} className={`${fieldClass} mt-1`}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
      <label className="text-sm font-semibold">Automatic gateway<select name="paymentGateway" defaultValue={subscription?.paymentGateway || 'cashfree'} disabled={billingMode !== 'automatic'} className={`${fieldClass} mt-1 disabled:opacity-60`}><option value="cashfree">Cashfree</option><option value="payu">PayU</option></select></label>
      <label className="text-sm font-semibold">Paid seats <span className="font-normal text-slate-500">(+1 free admin)</span><input name="paidSeats" type="number" min="0" step="1" defaultValue={subscription?.paidSeats || 0} className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Price per paid user<input name="pricePerUser" type="number" min="0" step="0.01" defaultValue={subscription?.pricePerUser ?? 0} className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Annual discount (%)<input name="annualDiscountPercent" type="number" min="0" max="100" defaultValue={subscription?.annualDiscountPercent || 0} className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Custom renewal total<input name="customRenewalAmount" type="number" min="0" step="0.01" defaultValue={subscription?.customRenewalAmount ?? ''} placeholder="Calculated automatically" className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Next renewal date<input name="nextRenewalAt" type="date" defaultValue={subscription?.nextRenewalAt?.slice(0, 10) || ''} className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Subscription status<select name="subscriptionStatus" defaultValue={subscription?.status || 'active'} className={`${fieldClass} mt-1`}><option value="trial">Trial</option><option value="active">Active</option>{billingMode === 'automatic' && <><option value="past_due">Past due</option><option value="grace">Grace</option><option value="paused">Paused</option></>}<option value="cancelled">Cancelled</option></select></label>
      <label className="text-sm font-semibold md:col-span-2 xl:col-span-3">Custom terms<textarea name="customTerms" rows={3} defaultValue={subscription?.customTerms || ''} className={`${fieldClass} mt-1`} /></label>
      <div className="rounded-lg border border-slate-200 bg-white/40 p-3 text-sm md:col-span-2 xl:col-span-3"><strong>Billing access:</strong> {billingMode === 'automatic' ? '15-day grace and automatic paid-user pause are enabled.' : 'No billing-based suspension. Overdue balances remain visible for manual follow-up.'}</div>
      <button className="gradient-button rounded-lg px-4 py-3 font-semibold md:col-span-2 xl:col-span-3">Save company and billing</button>
    </form></Card>
    <Card><Toolbar title="Invoices" action="Create invoice" onAction={onCreateInvoice} exportRows={(billing?.invoices || []).map(({ invoiceNumber, issueDate, dueDate, total, amountPaid, amountDue, status }) => ({ invoiceNumber, issueDate, dueDate, total, amountPaid, amountDue, status }))} /><Table headers={['Invoice', 'Issued', 'Due', 'Total', 'Paid', 'Balance', 'Status', 'Action']} rows={(billing?.invoices || []).map((invoice) => [invoice.invoiceNumber, formatDate(invoice.issueDate), formatDate(invoice.dueDate), formatCurrency(invoice.total), formatCurrency(invoice.amountPaid), formatCurrency(invoice.amountDue), <Status key="status">{invoice.status}</Status>, invoice.amountDue > 0 ? <button key="payment" onClick={() => onRecordPayment(invoice)} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold">Record payment</button> : <span key="settled" className="text-xs text-slate-500">Settled</span>])} /></Card>
    <Card><Toolbar title={`${company.name} employees`} action={company.status === 'active' ? 'Add employee' : undefined} onAction={company.status === 'active' ? onAddEmployee : undefined} exportRows={employees.map(({ employeeId, name, email, department, designation, role, status }) => ({ employeeId, name, email, department, designation, role, status }))} /><Table headers={['Employee', 'Department', 'Role', 'Status', 'Actions']} rows={employees.map((employee) => [<div key="employee"><p className="font-semibold">{employee.name}</p><p className="text-xs text-slate-500">{employee.employeeId} - {employee.email}</p></div>, <div key="department"><p>{employee.department}</p><p className="text-xs text-slate-500">{employee.designation}</p></div>, employee.role.replace('_', ' '), <Status key="status">{employee.status}</Status>, <div key="actions" className="flex gap-2"><button onClick={() => onEditEmployee(employee)} title="Edit employee" aria-label={`Edit ${employee.name}`} className="neu-button rounded-lg p-2.5 text-primary-600"><Pencil className="h-4 w-4" /></button><button onClick={() => onEmployeeStatus(employee, employee.status === 'inactive' ? 'active' : 'inactive')} title={employee.status === 'inactive' ? 'Reactivate employee' : 'Deactivate employee'} aria-label={`${employee.status === 'inactive' ? 'Reactivate' : 'Deactivate'} ${employee.name}`} className={`neu-button rounded-lg p-2.5 ${employee.status === 'inactive' ? 'text-emerald-600' : 'text-red-600'}`}>{employee.status === 'inactive' ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}</button></div>])} /></Card>
    <Card><Toolbar title="Audit history" /><Table headers={['Date', 'Action', 'Performed by']} rows={auditLogs.map((entry) => [new Date(entry.createdAt).toLocaleString(), entry.action.replaceAll('.', ' '), entry.actorName || 'System'])} /></Card>
  </div>
}

function Leads({ leads, update }: { leads: Lead[]; update: (lead: Lead, status: string) => void }) { return <Card><Toolbar title="Sales leads" exportRows={leads.map(({ kind, name, email, company, employees, status, createdAt }) => ({ kind, name, email, company, employees, status, createdAt }))} />{leads.length ? <Table headers={['Contact', 'Source', 'Company', 'Received', 'Status', 'Action']} rows={leads.map((lead) => [<div key="contact"><p className="font-semibold">{lead.name}</p><p className="text-xs text-slate-500">{lead.email}</p></div>, lead.kind === 'demo' ? 'Demo request' : 'Contact', lead.company || '-', new Date(lead.createdAt).toLocaleDateString(), <Status key="status">{lead.status}</Status>, <button key="action" onClick={() => update(lead, lead.status === 'new' ? 'contacted' : 'resolved')} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold">{lead.status === 'new' ? 'Mark contacted' : 'Resolve'}</button>])} /> : <Empty label="No sales leads yet" />}</Card> }
function PlatformAudit({ auditLogs }: { auditLogs: AuditLog[] }) { return <Card><Toolbar title="Platform audit log" exportRows={auditLogs.map(({ createdAt, actorName, action, companyName, companyCode, employeeName }) => ({ createdAt, actorName, action, companyName, companyCode, employeeName }))} /><Table headers={['Date', 'Tenant', 'Action', 'Performed by', 'Affected user']} rows={auditLogs.map((entry) => [new Date(entry.createdAt).toLocaleString(), <div key="tenant"><p className="font-semibold">{entry.companyName || 'Platform'}</p><p className="text-xs text-slate-500">{entry.companyCode || '-'}</p></div>, entry.action.replaceAll('.', ' '), entry.actorName || 'System', entry.employeeName || '-'])} /></Card> }
function AttendanceTable({ rows }: { rows: AttendanceRow[] }) {
  return <Table headers={['Employee', 'Today status', 'Check in', 'Check out', 'Hours', 'Payable', 'Month LOP', 'Payroll mode']} rows={rows.map((row) => {
    const status = row.attendance?.isLate ? 'late' : row.day?.status || row.attendance?.status || 'not_checked_in'
    return [
      <div key="employee"><p className="font-semibold">{row.employee.firstName} {row.employee.lastName}</p><p className="text-xs text-slate-500">{row.employee.employeeId}</p></div>,
      <Status key="status">{attendanceStatusLabel(status)}</Status>,
      formatTime(row.attendance?.checkIn?.time),
      formatTime(row.attendance?.checkOut?.time),
      row.attendance?.workDuration ? `${(row.attendance.workDuration / 60).toFixed(1)}h` : '-',
      row.day ? `${formatDays(row.day.payableDays)} day` : '-',
      row.summary ? `${formatDays(row.summary.lossOfPayDays)} day` : '-',
      attendancePolicyLabel(row.summary?.payrollImpact),
    ]
  })} />
}

const approverRoleLabels: Record<string, string> = { manager: 'Manager', hr: 'HR', admin: 'Admin', super_admin: 'Super Admin' }

function leaveApprovalStage(leave: Leave) {
  const level = leave.pendingApprover?.level || leave.currentLevel || 1
  const role = leave.pendingApprover?.approverRole || (level > 1 ? 'hr' : 'manager')
  const approver = leave.pendingApprover?.approver
  const name = `${approver?.firstName || ''} ${approver?.lastName || ''}`.trim()
  return {
    stage: `Level ${level} \u00b7 ${approverRoleLabels[role] || humanize(role)}`,
    approver: name ? `${name}${approver?.employeeId ? ` (${approver.employeeId})` : ''}` : '',
  }
}

function Leaves({ leaves, review }: { leaves: Leave[]; review: (id: string, action: 'approve' | 'reject') => void }) {
  return <Card><Toolbar title="Leave requests" exportRows={leaves.map((leave) => ({ employee: `${leave.employee.firstName} ${leave.employee.lastName}`, type: leave.leaveType, start: leave.startDate, end: leave.endDate, days: leave.days, approvalStage: leaveApprovalStage(leave).stage, pendingApprover: leaveApprovalStage(leave).approver, status: leave.status }))} /><Table headers={['Employee', 'Type', 'Dates', 'Days', 'Approval stage', 'Status', 'Actions']} rows={leaves.map((leave) => { const approval = leaveApprovalStage(leave); return [<div key="employee"><p className="font-semibold">{leave.employee.firstName} {leave.employee.lastName}</p><p className="text-xs text-slate-500">{leave.employee.employeeId}</p></div>, <div key="type"><p className="capitalize">{leave.leaveType}</p>{leave.reason && <p className="max-w-56 truncate text-xs text-slate-500" title={leave.reason}>{leave.reason}</p>}</div>, `${leave.startDate.slice(0, 10)} to ${leave.endDate.slice(0, 10)}`, leave.days, <div key="stage"><p className="whitespace-nowrap font-semibold">{approval.stage}</p>{approval.approver && <p className="text-xs text-slate-500">{approval.approver}</p>}</div>, <Status key="status">{leave.status}</Status>, <div key="actions" className="flex gap-2"><button aria-label="Approve leave" title="Approve" onClick={() => review(leave._id, 'approve')} className="neu-button rounded-lg p-2.5 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></button><button aria-label="Reject leave" title="Reject" onClick={() => review(leave._id, 'reject')} className="neu-button rounded-lg p-2.5 text-red-600"><XCircle className="h-5 w-5" /></button></div>] })} /></Card>
}

function WfhRequests({ requests, review, onAssign }: { requests: WfhRequest[]; review: (id: string, action: 'approve' | 'reject') => void; onAssign: () => void }) {
  return <Card><Toolbar title="WFH requests" action="Assign WFH" onAction={onAssign} exportRows={requests.map((request) => ({ employee: `${request.employee.firstName} ${request.employee.lastName}`, start: request.startDate, end: request.endDate, location: request.workFromLocation, reason: request.reason, status: request.status }))} /><Table headers={['Employee', 'Dates', 'Location', 'Reason', 'Status', 'Actions']} rows={requests.map((request) => [<div key="employee"><p className="font-semibold">{request.employee.firstName} {request.employee.lastName}</p><p className="text-xs text-slate-500">{request.employee.employeeId}</p></div>, `${String(request.startDate).slice(0, 10)} to ${String(request.endDate).slice(0, 10)}`, request.workFromLocation || '-', <p key="reason" className="max-w-56 truncate" title={request.reason}>{request.reason}</p>, <Status key="status">{request.status}</Status>, <div key="actions" className="flex gap-2"><button aria-label="Approve WFH" title="Approve" onClick={() => review(request._id, 'approve')} className="neu-button rounded-lg p-2.5 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></button><button aria-label="Reject WFH" title="Reject" onClick={() => review(request._id, 'reject')} className="neu-button rounded-lg p-2.5 text-red-600"><XCircle className="h-5 w-5" /></button></div>])} /></Card>
}

function Grievances({ grievances, resolve }: { grievances: Grievance[]; resolve: (id: string) => void }) { return <Card><Toolbar title="Grievances" exportRows={grievances.map(({ ticketNumber, employee, subject, category, priority, status, createdAt }) => ({ ticketNumber, employee: employee ? `${employee.firstName} ${employee.lastName}` : 'Anonymous', subject, category, priority, status, createdAt }))} />{grievances.length ? <Table headers={['Ticket', 'Employee', 'Subject', 'Priority', 'Status', 'Action']} rows={grievances.map((grievance) => [<div key="ticket"><p className="font-semibold">{grievance.ticketNumber}</p><p className="text-xs text-slate-500">{new Date(grievance.createdAt).toLocaleDateString()}</p></div>, grievance.employee ? `${grievance.employee.firstName} ${grievance.employee.lastName}` : 'Anonymous', <div key="subject"><p className="font-semibold">{grievance.subject}</p><p className="text-xs text-slate-500">{grievance.category}</p></div>, grievance.priority, <Status key="status">{grievance.status}</Status>, ['resolved', 'closed'].includes(grievance.status) ? <span key="done" className="text-xs text-slate-500">Complete</span> : <button key="resolve" onClick={() => resolve(grievance._id)} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold">Resolve</button>])} /> : <Empty label="No grievances require attention" />}</Card> }

function Reimbursements({ token, reimbursements, role, review, markPaid }: { token: string; reimbursements: Reimbursement[]; role: UserRole; review: (id: string, values: Record<string, unknown>) => void; markPaid: (id: string, reference: string, paidAt: string) => void }) {
  async function downloadReceipt(claim: Reimbursement, attachment: ReimbursementAttachment) {
    if (attachment.kind !== 'protected_file' || !attachment._id) {
      if (attachment.url) window.open(attachment.url, '_blank', 'noopener,noreferrer')
      return
    }
    try {
      const response = await fetch(`${API_ROOT}/reimbursements/${claim._id}/attachments/${attachment._id}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('Could not download receipt')
      const link = document.createElement('a')
      link.href = URL.createObjectURL(await response.blob())
      link.download = attachment.name || 'receipt'
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : 'Could not download receipt')
    }
  }
  const pending = reimbursements.filter((item) => ['pending_manager', 'pending_finance'].includes(item.status)).length
  const queued = reimbursements.filter((item) => item.status === 'queued_for_payroll').length
  const unpaidSeparate = reimbursements.filter((item) => item.status === 'approved' && item.paymentMethod === 'separate_payment').length
  const totalPaid = reimbursements.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.approvedAmount || item.amount), 0)
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Awaiting review" value={pending} /><Metric label="Queued in payroll" value={queued} /><Metric label="Separate payment due" value={unpaidSeparate} /><Metric label="Paid claims" value={formatCurrency(totalPaid)} /></div>
    <Card>
      <Toolbar title="Expense reimbursements" exportRows={reimbursements.map(({ claimNumber, employee, category, expenseDate, amount, approvedAmount, status, paymentMethod, payrollPeriod, paymentReference }) => ({ claimNumber, employee: `${employee.firstName} ${employee.lastName}`, employeeId: employee.employeeId, category, expenseDate, claimed: amount, approved: approvedAmount, status, paymentMethod, payrollPeriod, paymentReference }))} />
      <div className="mb-4 rounded-lg border border-slate-200 bg-white/40 p-3 text-sm text-slate-600">Approved payroll claims are added once as paid-after-gross reimbursements. Separate payments remain outside salary and require a payment reference.</div>
      <Table headers={['Claim', 'Employee', 'Expense', 'Claimed', 'Approved', 'Status', 'Payment', 'Action']} rows={reimbursements.map((item) => [
        <div key="claim"><p className="font-semibold">{item.claimNumber}</p><p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p></div>,
        <div key="employee"><p className="font-semibold">{item.employee.firstName} {item.employee.lastName}</p><p className="text-xs text-slate-500">{item.employee.employeeId}</p></div>,
        <div key="expense" className="max-w-64 whitespace-normal"><p className="font-semibold capitalize">{item.category.replaceAll('_', ' ')}</p><p className="text-xs text-slate-500">{formatDate(item.expenseDate)}{item.merchant ? ` - ${item.merchant}` : ''}</p><p className="line-clamp-2 text-xs text-slate-500" title={item.description}>{item.description}</p>{item.attachments?.length ? <div className="mt-1 flex flex-wrap gap-2">{item.attachments.map((attachment, index) => <button key={attachment._id || `${attachment.name}-${index}`} type="button" onClick={() => void downloadReceipt(item, attachment)} className="text-xs font-semibold text-primary-600">View {attachment.name || `receipt ${index + 1}`}</button>)}</div> : null}</div>,
        formatCurrency(item.amount),
        item.approvedAmount ? formatCurrency(item.approvedAmount) : '-',
        <Status key="status">{item.status.replaceAll('_', ' ')}</Status>,
        <div key="payment"><p className="capitalize">{item.paymentMethod?.replaceAll('_', ' ') || '-'}</p><p className="text-xs text-slate-500">{item.payrollPeriod || item.paymentReference || ''}</p></div>,
        <ReimbursementAction key="action" item={item} role={role} review={review} markPaid={markPaid} />,
      ])} />
    </Card>
  </div>
}

function ReimbursementAction({ item, role, review, markPaid }: { item: Reimbursement; role: UserRole; review: (id: string, values: Record<string, unknown>) => void; markPaid: (id: string, reference: string, paidAt: string) => void }) {
  const [approvedAmount, setApprovedAmount] = useState(String(item.approvedAmount || item.amount))
  const [paymentMethod, setPaymentMethod] = useState<'through_payroll' | 'separate_payment'>(item.paymentMethod || 'through_payroll')
  const [payrollPeriod, setPayrollPeriod] = useState(item.payrollPeriod || new Date().toISOString().slice(0, 7))
  const [paymentReference, setPaymentReference] = useState(item.paymentReference || '')
  const [paidDate, setPaidDate] = useState(item.paidAt?.slice(0, 10) || '')
  if (['pending_manager', 'pending_finance'].includes(item.status)) {
    if (role === 'manager') return item.status === 'pending_manager' ? <div className="flex gap-2"><button onClick={() => review(item._id, { action: 'approve' })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Manager approve</button><button onClick={() => review(item._id, { action: 'reject' })} className="neu-button rounded-lg px-3 py-2 text-xs font-semibold text-red-600">Reject</button></div> : <span className="text-xs text-slate-500">Finance review pending</span>
    return <div className="flex min-w-[510px] items-end gap-2"><label className="text-xs font-semibold">Approved amount<input type="number" min="0.01" max={item.amount} step="0.01" value={approvedAmount} onChange={(event) => setApprovedAmount(event.target.value)} className="neu-input mt-1 w-28 px-2 py-2" /></label><label className="text-xs font-semibold">Pay using<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'through_payroll' | 'separate_payment')} className="neu-input mt-1 w-40 px-2 py-2"><option value="through_payroll">Through payroll</option><option value="separate_payment">Separate payment</option></select></label>{paymentMethod === 'through_payroll' && <label className="text-xs font-semibold">Payroll month<input type="month" value={payrollPeriod} onChange={(event) => setPayrollPeriod(event.target.value)} className="neu-input mt-1 w-36 px-2 py-2" /></label>}<button onClick={() => review(item._id, { action: 'approve', approvedAmount: Number(approvedAmount), paymentMethod, payrollPeriod })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Approve</button><button onClick={() => review(item._id, { action: 'reject' })} className="neu-button rounded-lg px-3 py-2 text-xs font-semibold text-red-600">Reject</button></div>
  }
  if (item.status === 'approved' && item.paymentMethod === 'separate_payment') return <div className="flex min-w-[470px] items-end gap-2"><label className="text-xs font-semibold">Payment reference<input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="UTR / voucher" className="neu-input mt-1 w-40 px-2 py-2" /></label><label className="text-xs font-semibold">Paid date<input type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} className="neu-input mt-1 w-36 px-2 py-2" /></label><button disabled={!paymentReference.trim() || !paidDate} onClick={() => markPaid(item._id, paymentReference.trim(), paidDate)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Mark paid</button></div>
  if (item.status === 'queued_for_payroll') return <span className="text-xs font-semibold text-primary-600">Included in {item.payrollPeriod}</span>
  return <span className="text-xs text-slate-500">No action</span>
}

function DesktopView({ team }: { team: DesktopMember[] }) {
  return <Card><Toolbar title="Desktop activity" exportRows={team.map((item) => ({ employeeId: item.employee.employeeId, employee: `${item.employee.firstName} ${item.employee.lastName}`, activeMinutes: Math.round((item.activity?.summary?.totalActiveSeconds || 0) / 60), idleMinutes: Math.round((item.activity?.summary?.totalIdleSeconds || 0) / 60), snapshots: item.activity?.summary?.snapshots || 0, deviceStatus: item.states[0]?.status || 'offline' }))} /><Table headers={['Employee', 'Active', 'Idle', 'Snapshots', 'Device']} rows={team.map((item) => [<div key="employee"><p className="font-semibold">{item.employee.firstName} {item.employee.lastName}</p><p className="text-xs text-slate-500">{item.employee.employeeId}</p></div>, `${Math.round((item.activity?.summary?.totalActiveSeconds || 0) / 60)} min`, `${Math.round((item.activity?.summary?.totalIdleSeconds || 0) / 60)} min`, item.activity?.summary?.snapshots || 0, <Status key="status">{item.states[0]?.status || 'offline'}</Status>])} /></Card>
}

function Areas({ areas, workLocations, canManage, onAdd, onEdit, onDelete, onOpenLocations }: { areas: Area[]; workLocations: WorkLocation[]; canManage: boolean; onAdd: () => void; onEdit: (area: Area) => void; onDelete: (area: Area) => void; onOpenLocations: () => void }) {
  const withoutGeofence = workLocations.filter((location) => location.status !== 'inactive' && !location.geofence)
  return <div className="space-y-4">
    <Card>
      <Toolbar title="Geofences" action={canManage ? 'Add geofence' : undefined} onAction={canManage ? onAdd : undefined} exportRows={areas.map(({ name, address, latitude, longitude, radiusMeters, workLocation }) => ({ name, workLocation: workLocation?.name || '', address, latitude, longitude, radiusMeters }))} />
      {areas.length === 0
        ? <Empty label="No geofences yet. Add coordinates to a work location, or create one here." />
        : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{areas.map((area) => <div key={area._id} className="neu-inset rounded-lg p-4">
          <div className="flex items-start justify-between gap-2"><MapPin className="h-5 w-5 text-primary-500" /><Status>{area.active === false ? 'Inactive' : 'Active'}</Status></div>
          <p className="mt-3 font-bold">{area.name}</p>
          {/* The owning site, so a geofence is never an address with no home. */}
          {area.workLocation
            ? <p className="mt-0.5 text-xs font-semibold text-primary-700">Work location · {area.workLocation.name}</p>
            : <p className="mt-0.5 text-xs text-warning">Not linked to a work location</p>}
          <p className="mt-1.5 min-h-10 text-sm text-ink-soft">{area.address || `${area.latitude}, ${area.longitude}`}</p>
          <p className="mt-2 text-sm">{area.radiusMeters}m radius</p>
          <p className="mt-0.5 text-xs text-ink-soft">{Number(area.latitude).toFixed(5)}, {Number(area.longitude).toFixed(5)}</p>
          {canManage && (
            <div className="mt-3 flex gap-2 border-t border-line pt-3">
              <button type="button" onClick={() => onEdit(area)} className="ghost-button inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button type="button" onClick={() => onDelete(area)} className="ghost-button inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-danger">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>)}</div>}
    </Card>

    {withoutGeofence.length > 0 && (
      <Card>
        <Toolbar title="Work locations without a geofence" />
        <p className="mb-3 text-sm text-ink-soft">
          These sites have an address but no attendance radius, so employees there cannot check in by location.
          Add coordinates to the location and the geofence is created and kept in step automatically.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {withoutGeofence.map((location) => (
            <li key={location._id} className="rounded-lg border border-line bg-surface-subtle px-3.5 py-2.5">
              <p className="text-sm font-semibold">{location.name}{location.code ? <span className="ml-1.5 text-xs font-normal text-ink-soft">{location.code}</span> : null}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{location.address || 'No address recorded'}</p>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onOpenLocations} className="neu-button mt-4 rounded-md px-3.5 py-2 text-sm">Open work locations</button>
      </Card>
    )}
  </div>
}

function Subscriptions({ token, plans, current, summary, invoices, payments, gateways, onSubmitted }: { token: string; plans: SubscriptionPlan[]; current: Subscription | null; summary: CompanyBillingSummary | null; invoices: BillingInvoice[]; payments: BillingPayment[]; gateways: PaymentGateway[]; onSubmitted: (message: string) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [paidSeats, setPaidSeats] = useState(0)
  const [manualInvoiceId, setManualInvoiceId] = useState('')
  const activePlans = plans.filter((plan) => plan.status === 'active')
  const openInvoices = invoices.filter((invoice) => invoice.amountDue > 0 && ['issued', 'partially_paid', 'overdue'].includes(invoice.status))
  const invoiceOptions: Option[] = openInvoices.map((invoice) => ({ value: invoice._id, label: `${invoice.invoiceNumber} - ${formatCurrency(invoice.amountDue)} due`, hint: `Due ${formatDate(invoice.dueDate)}` }))
  const automaticMode = current?.billingMode === 'automatic'
  const manualMode = Boolean(current && current.billingMode !== 'automatic')
  const selectedPlan = activePlans.find((plan) => plan._id === selectedPlanId)
  const minimumPaidSeats = Math.max(0, (current?.activeUsers || 0) - Number(selectedPlan?.includedSeats ?? current?.includedSeats ?? 0))
  const annualDiscount = billingCycle === 'yearly' ? Number(selectedPlan?.annualDiscountPercent || 0) : 0
  const orderAmount = selectedPlan?.pricePerUser === null || selectedPlan?.pricePerUser === undefined
    ? null
    : selectedPlan.pricePerUser * paidSeats * (billingCycle === 'yearly' ? 12 : 1) * (1 - annualDiscount / 100)
  const assignedGateway = gateways.find((gateway) => gateway.code === current?.paymentGateway) || gateways.find((gateway) => gateway.isDefault) || gateways[0]
  const selectedManualInvoice = openInvoices.find((invoice) => invoice._id === manualInvoiceId) || openInvoices[0]
  const pendingPlanOrder = openInvoices.find((invoice) => invoice.kind === 'subscription_purchase')

  useEffect(() => {
    if (!current) return
    const matchingPlan = activePlans.find((plan) => plan.name === current.plan && plan.pricePerUser !== null) || activePlans.find((plan) => plan.pricePerUser !== null)
    setSelectedPlanId(matchingPlan?._id || '')
    setBillingCycle(current.billingCycle)
    setPaidSeats(Math.max(current.paidSeats, minimumPaidSeats))
  }, [current?.plan, current?.billingCycle, current?.paidSeats, current?.activeUsers, plans])

  useEffect(() => {
    if (!openInvoices.length) setManualInvoiceId('')
    else if (!openInvoices.some((invoice) => invoice._id === manualInvoiceId)) setManualInvoiceId(openInvoices[0]._id)
  }, [invoices, manualInvoiceId])

  async function checkout(invoiceId: string) {
    setBusy(`checkout-${invoiceId}`); setFormError('')
    try {
      const result = await api<{ message: string }>('/subscriptions/checkout', { method: 'POST', body: JSON.stringify({ invoiceId }) }, token)
      await onSubmitted(result.message)
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Checkout could not be started') } finally { setBusy(null) }
  }

  async function createPlanOrder() {
    if (!selectedPlan || orderAmount === null) return
    setBusy('plan-order'); setFormError('')
    try {
      const order = await api<{ invoice: BillingInvoice; message: string }>('/subscriptions/plan-change', { method: 'POST', body: JSON.stringify({ planId: selectedPlan._id, billingCycle, paidSeats }) }, token)
      if (automaticMode) {
        try {
          const payment = await api<{ message: string }>('/subscriptions/checkout', { method: 'POST', body: JSON.stringify({ invoiceId: order.invoice._id }) }, token)
          await onSubmitted(payment.message)
        } catch (reason) {
          await onSubmitted(order.message)
          setFormError(reason instanceof Error ? reason.message : 'The order was created but checkout could not be started')
        }
      } else await onSubmitted(order.message)
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Plan order could not be created') } finally { setBusy(null) }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('manual-payment'); setFormError('')
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    try {
      const result = await api<{ message: string }>('/subscriptions/manual-payments', { method: 'POST', body: JSON.stringify({ ...values, amount: Number(values.amount) }) }, token)
      form.reset()
      await onSubmitted(result.message)
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Payment could not be submitted') } finally { setBusy(null) }
  }

  if (!current) return <Card><Empty label="Subscription details are not available" /></Card>
  const coveredUsers = current.totalSeats
  const seatUsage = coveredUsers ? Math.min(100, (current.activeUsers / coveredUsers) * 100) : 0

  return <div className="space-y-5">
    {formError && <div role="alert" className="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{formError}</span><button type="button" aria-label="Dismiss error" onClick={() => setFormError('')}><X className="h-4 w-4" /></button></div>}
    <Card>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-primary-600">Current subscription</p><h3 className="mt-1 text-2xl font-bold">{current.plan}</h3><p className="mt-1 text-sm text-slate-500">{billingModeLabel(current.billingMode)} - {current.billingCycle} prepaid billing</p></div><Status>{current.status}</Status></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Renewal amount" value={formatCurrency(current.renewalAmount)} /><Metric label="Next renewal" value={formatDate(current.nextRenewalAt)} /><Metric label="Covered users" value={`${coveredUsers} total`} /><Metric label={automaticMode ? 'Payment gateway' : 'Payment terms'} value={automaticMode ? assignedGateway ? `${assignedGateway.name}${assignedGateway.mode === 'test' ? ' (test)' : ''}` : 'Unavailable' : 'Invoice based'} /></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]"><div className="neu-inset rounded-lg p-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">Seat usage</span><span>{current.activeUsers} active / {coveredUsers} covered</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-primary-500" style={{ width: `${seatUsage}%` }} /></div><p className="mt-2 text-xs text-slate-500">{current.paidSeats} purchased seat{current.paidSeats === 1 ? '' : 's'}{current.includedSeats > 0 ? ` plus ${current.includedSeats} included with the ${current.plan} plan` : ''}. Every seat is billable unless the plan includes it.</p></div><div className={`rounded-lg border p-4 text-sm ${automaticMode ? 'border-amber-200 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/60'}`}><p className="font-bold">{automaticMode ? 'Automatic renewal and grace' : 'Manual or negotiated billing'}</p><p className="mt-1 text-slate-600">{automaticMode ? current.status === 'grace' ? `Payment is overdue. Paid-user access pauses after ${formatDate(current.graceEndsAt)} if renewal remains unpaid.` : 'Renewal is charged in advance. A failed renewal receives 15 days of reminders before paid-user access pauses.' : 'Invoices and reminders remain visible, but billing does not automatically pause your company or employees.'}</p>{current.customTerms && <p className="mt-2 font-medium">Terms: {current.customTerms}</p>}</div></div>
    </Card>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5"><Metric label="Collected" value={formatCurrency(summary?.collectedAmount || 0)} /><Metric label="Outstanding" value={formatCurrency(summary?.outstandingAmount || 0)} /><Metric label="Awaiting verification" value={formatCurrency(summary?.pendingVerificationAmount || 0)} /><Metric label="Account credit" value={formatCurrency(summary?.creditBalance || 0)} /><Metric label="Upcoming renewal" value={formatCurrency(summary?.upcomingRenewalAmount || 0)} /></div>

    <Card>
      <Toolbar title="Choose your plan" />
      <div className="grid gap-3 md:grid-cols-3">{activePlans.map((plan) => {
        const selected = selectedPlanId === plan._id
        const isCustom = plan.pricePerUser === null
        return <button key={plan._id || plan.name} type="button" disabled={isCustom || current.billingMode === 'custom' || Boolean(pendingPlanOrder)} onClick={() => setSelectedPlanId(plan._id || '')} className={`rounded-lg border p-4 text-left transition ${selected ? 'border-primary-500 bg-orange-50/70 shadow-sm' : 'border-slate-200 bg-white/40 hover:border-primary-300'} disabled:cursor-not-allowed disabled:opacity-65`}><div className="flex items-start justify-between gap-2"><span className="font-bold">{plan.name}</span>{selected && !isCustom ? <CheckCircle2 className="h-5 w-5 text-primary-500" /> : null}</div><p className="mt-3 text-2xl font-bold text-primary-600">{isCustom ? 'Custom' : formatCurrency(Number(plan.pricePerUser))}{!isCustom && <span className="text-xs font-normal text-slate-500"> / paid user / month</span>}</p><p className="mt-2 text-xs text-slate-500">{Number(plan.includedSeats || 0) > 0 ? `${plan.includedSeats} seat${Number(plan.includedSeats) === 1 ? '' : 's'} included` : 'Seats billed as purchased'}{plan.annualDiscountPercent ? ` · ${plan.annualDiscountPercent}% yearly discount` : ''}</p>{plan.features?.length ? <ul className="mt-3 space-y-1">{plan.features.slice(0, 4).map((feature) => <li key={feature} className="flex gap-1.5 text-xs text-ink-soft"><Check className="mt-0.5 h-3 w-3 shrink-0 text-primary-600" />{feature}</li>)}</ul> : null}</button>
      })}</div>
      <div className="mt-5 grid gap-4 rounded-lg border border-slate-200 bg-white/35 p-4 lg:grid-cols-[1fr_1fr_1.2fr]"><div><p className="text-sm font-semibold">Billing cycle</p><div className="mt-2 grid grid-cols-2 rounded-lg bg-slate-100 p-1"><button type="button" onClick={() => setBillingCycle('monthly')} className={`rounded-md px-3 py-2 text-sm font-semibold ${billingCycle === 'monthly' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}>Monthly</button><button type="button" onClick={() => setBillingCycle('yearly')} className={`rounded-md px-3 py-2 text-sm font-semibold ${billingCycle === 'yearly' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}>Yearly</button></div></div><label className="text-sm font-semibold">Paid employee seats<input type="number" min={minimumPaidSeats} step="1" value={paidSeats} onChange={(event) => setPaidSeats(Math.max(minimumPaidSeats, Math.floor(Number(event.target.value) || 0)))} className={`${fieldClass} mt-2`} /><span className="mt-1 block text-xs font-normal text-slate-500">Minimum {minimumPaidSeats} for your {current.activeUsers} active user{current.activeUsers === 1 ? '' : 's'}. You get exactly what you buy.</span></label><div className="flex flex-col justify-between gap-3"><div><p className="text-sm text-slate-500">Pay now for {billingCycle === 'yearly' ? '12 months' : '1 month'}</p><p className="text-2xl font-bold">{orderAmount === null ? 'Contact Super Admin' : formatCurrency(orderAmount)}</p>{annualDiscount > 0 && <p className="text-xs font-semibold text-emerald-700">Includes {annualDiscount}% annual discount</p>}</div><button type="button" disabled={!selectedPlan || orderAmount === null || paidSeats < minimumPaidSeats || current.billingMode === 'custom' || openInvoices.length > 0 || busy !== null} onClick={() => void createPlanOrder()} className="gradient-button rounded-lg px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-55">{busy === 'plan-order' ? 'Processing...' : automaticMode ? assignedGateway?.mode === 'test' ? `Complete ${assignedGateway.name} test payment` : `Continue with ${assignedGateway?.name || 'gateway'}` : 'Create plan invoice'}</button></div></div>
      {openInvoices.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-800">Settle the open invoice balance before creating a new plan order.</p>}
      <p className="mt-3 text-xs text-slate-500">Super Admin controls your billing mode, negotiated pricing, and gateway availability. Standard plan changes become active only after full payment clears.</p>
    </Card>

    {manualMode && openInvoices.length > 0 && <Card><Toolbar title="Submit a payment" /><form onSubmit={submitPayment} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="text-sm font-semibold"><label htmlFor="manual-payment-invoice">Invoice</label><div className="mt-1"><SearchableSelect id="manual-payment-invoice" name="invoiceId" options={invoiceOptions} value={manualInvoiceId} onChange={setManualInvoiceId} placeholder="Search invoices" required /></div></div><label className="text-sm font-semibold">Amount paid<input key={selectedManualInvoice?._id} name="amount" type="number" min="0.01" max={selectedManualInvoice?.amountDue} step="0.01" defaultValue={selectedManualInvoice?.amountDue} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Payment method<select name="method" defaultValue={current.billingMode === 'manual_online' ? 'manual_gateway' : 'bank_transfer'} className={`${fieldClass} mt-1`}><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="manual_gateway">Manual online gateway</option></select></label><label className="text-sm font-semibold">UTR / reference<input name="reference" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold md:col-span-2 xl:col-span-4">Payment proof URL<input name="proofUrl" type="url" placeholder="Optional secure proof link" className={`${fieldClass} mt-1`} /></label><button disabled={busy !== null} className="gradient-button rounded-lg px-4 py-3 font-semibold md:col-span-2 xl:col-span-4">{busy === 'manual-payment' ? 'Submitting...' : 'Submit for Super Admin verification'}</button></form></Card>}

    <Card><Toolbar title="Invoices" exportRows={invoices.map(({ invoiceNumber, kind, issueDate, dueDate, total, amountPaid, amountDue, status }) => ({ invoiceNumber, kind, issueDate, dueDate, total, amountPaid, amountDue, status }))} /><Table headers={['Invoice', 'Purpose', 'Due', 'Total', 'Paid', 'Balance', 'Status', 'Action']} rows={invoices.map((invoice) => [<div key="invoice"><p className="font-semibold">{invoice.invoiceNumber}</p><p className="text-xs text-slate-500">Issued {formatDate(invoice.issueDate)}</p></div>, invoice.kind.replaceAll('_', ' '), formatDate(invoice.dueDate), formatCurrency(invoice.total), formatCurrency(invoice.amountPaid), formatCurrency(invoice.amountDue), <Status key="status">{invoice.status}</Status>, automaticMode && invoice.amountDue > 0 ? <button key="pay" type="button" disabled={busy !== null} onClick={() => void checkout(invoice._id)} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-55">{busy === `checkout-${invoice._id}` ? 'Processing...' : assignedGateway?.mode === 'test' ? `Test pay ${assignedGateway.name}` : `Pay ${assignedGateway?.name || 'now'}`}</button> : <span key="state" className="text-xs text-slate-500">{invoice.amountDue > 0 ? 'Use payment form' : 'Settled'}</span>])} /></Card>
    <Card><Toolbar title="Payment history" exportRows={payments.map(({ invoiceNumber, createdAt, method, reference, amount, status }) => ({ invoiceNumber, createdAt, method, reference, amount, status }))} /><Table headers={['Date', 'Invoice', 'Method', 'Reference', 'Amount', 'Status']} rows={payments.map((payment) => [formatDate(payment.createdAt), payment.invoiceNumber, payment.method.replaceAll('_', ' '), payment.reference || '-', formatCurrency(payment.amount), <Status key="status">{payment.status.replaceAll('_', ' ')}</Status>])} /></Card>
  </div>
}

function PlatformSubscriptions({ plans, subscriptions, summary, invoices, payments, gateways, onManage, onRecordPayment, onPaymentStatus, onGatewayUpdate }: { plans: SubscriptionPlan[]; subscriptions: TenantSubscription[]; summary: PlatformBillingSummary; invoices: BillingInvoice[]; payments: BillingPayment[]; gateways: PaymentGateway[]; onManage: (subscription: TenantSubscription) => void; onRecordPayment: (invoice: BillingInvoice) => void; onPaymentStatus: (payment: BillingPayment, status: 'cleared' | 'rejected' | 'reversed') => void; onGatewayUpdate: (gateway: PaymentGateway, values: Partial<Pick<PaymentGateway, 'enabled' | 'isDefault' | 'mode'>>) => void }) {
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5"><Metric label="Collected" value={formatCurrency(summary.collectedAmount)} /><Metric label="Outstanding" value={formatCurrency(summary.pendingAmount)} /><Metric label="Awaiting verification" value={formatCurrency(summary.pendingVerificationAmount)} /><Metric label="Upcoming 30 days" value={formatCurrency(summary.upcomingAmount)} /><Metric label="Renewal book" value={formatCurrency(summary.renewalAmount)} /></div>
    <Card><Toolbar title="Payment gateways" /><Table headers={['Gateway', 'Environment', 'Enabled', 'Default']} rows={gateways.map((gateway) => [<div key="gateway"><p className="font-semibold">{gateway.name}</p><p className="text-xs text-slate-500">Credentials are stored server-side</p></div>, <select key="mode" aria-label={`${gateway.name} environment`} value={gateway.mode} onChange={(event) => onGatewayUpdate(gateway, { mode: event.target.value as 'test' | 'live' })} className="neu-input rounded-lg px-3 py-2 text-sm"><option value="test">Test</option><option value="live">Live</option></select>, <label key="enabled" className="inline-flex items-center gap-2"><input type="checkbox" checked={gateway.enabled} onChange={(event) => onGatewayUpdate(gateway, { enabled: event.target.checked })} className="h-4 w-4 accent-orange-600" /><span>{gateway.enabled ? 'Enabled' : 'Disabled'}</span></label>, <label key="default" className="inline-flex items-center gap-2"><input type="radio" name="defaultGateway" checked={gateway.isDefault} disabled={!gateway.enabled} onChange={() => onGatewayUpdate(gateway, { isDefault: true })} className="h-4 w-4 accent-orange-600" /><span>{gateway.isDefault ? 'Default' : 'Available'}</span></label>])} /></Card>
    <Card><Toolbar title="Company billing" exportRows={subscriptions.map(({ companyCode, companyName, billingMode, paidSeats, renewalAmount, nextRenewalAt, outstandingAmount, status }) => ({ companyCode, companyName, billingMode, paidSeats, renewalAmount, nextRenewalAt, outstandingAmount, status }))} /><Table headers={['Company', 'Billing', 'Seats', 'Next renewal', 'Renewal amount', 'Outstanding', 'Status', 'Action']} rows={subscriptions.map((subscription) => [<div key="company"><p className="font-semibold">{subscription.companyName}</p><p className="text-xs text-slate-500">{subscription.companyCode} - {subscription.plan}</p></div>, <div key="mode"><p>{billingModeLabel(subscription.billingMode)}</p><p className="text-xs text-slate-500">{subscription.billingMode === 'automatic' ? subscription.paymentGateway || 'Gateway required' : 'No automatic pause'}</p></div>, `${subscription.totalSeats} total`, <div key="renewal"><p>{formatDate(subscription.nextRenewalAt)}</p><p className="text-xs capitalize text-slate-500">{subscription.billingCycle}</p></div>, formatCurrency(subscription.renewalAmount), formatCurrency(subscription.outstandingAmount), <Status key="status">{subscription.status}</Status>, <button key="action" onClick={() => onManage(subscription)} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold">Manage</button>])} /></Card>
    <Card><Toolbar title="Invoice ledger" exportRows={invoices.map(({ companyCode, companyName, invoiceNumber, dueDate, total, amountPaid, amountDue, status }) => ({ companyCode, companyName, invoiceNumber, dueDate, total, amountPaid, amountDue, status }))} /><Table headers={['Company', 'Invoice', 'Due', 'Total', 'Paid', 'Balance', 'Status', 'Action']} rows={invoices.map((invoice) => [<div key="company"><p className="font-semibold">{invoice.companyName}</p><p className="text-xs text-slate-500">{invoice.companyCode}</p></div>, invoice.invoiceNumber, formatDate(invoice.dueDate), formatCurrency(invoice.total), formatCurrency(invoice.amountPaid), formatCurrency(invoice.amountDue), <Status key="status">{invoice.status}</Status>, invoice.amountDue > 0 ? <button key="payment" onClick={() => onRecordPayment(invoice)} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold">Record payment</button> : <span key="settled" className="text-xs text-slate-500">Settled</span>])} /></Card>
    <Card><Toolbar title="Payment confirmations" exportRows={payments.map(({ companyCode, companyName, invoiceNumber, amount, method, reference, status, createdAt }) => ({ companyCode, companyName, invoiceNumber, amount, method, reference, status, createdAt }))} /><Table headers={['Company', 'Invoice', 'Submitted', 'Method', 'Reference', 'Amount', 'Status', 'Action']} rows={payments.map((payment) => [<div key="company"><p className="font-semibold">{payment.companyName}</p><p className="text-xs text-slate-500">{payment.companyCode}</p></div>, payment.invoiceNumber, formatDate(payment.createdAt), payment.method.replaceAll('_', ' '), payment.reference || '-', formatCurrency(payment.amount), <Status key="status">{payment.status.replaceAll('_', ' ')}</Status>, payment.status === 'pending_verification' ? <div key="actions" className="flex gap-2"><button onClick={() => onPaymentStatus(payment, 'cleared')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Confirm</button><button onClick={() => onPaymentStatus(payment, 'rejected')} className="neu-button rounded-lg px-3 py-2 text-xs font-semibold text-red-600">Reject</button></div> : payment.status === 'cleared' ? <button key="reverse" onClick={() => window.confirm('Reverse this cleared payment and reopen the invoice balance?') && onPaymentStatus(payment, 'reversed')} className="neu-button rounded-lg px-3 py-2 text-xs font-semibold text-red-600">Reverse</button> : <span key="done" className="text-xs text-slate-500">Complete</span>])} /></Card>
    <div className="grid gap-4 md:grid-cols-3">{plans.map((plan) => <Card key={plan.name}><div className="flex items-center justify-between"><p className="text-lg font-bold">{plan.name}</p><Status>{plan.status}</Status></div><p className="my-4 text-3xl font-bold text-primary-500">{plan.pricePerUser === null ? 'Custom' : formatCurrency(plan.pricePerUser)}<span className="text-sm font-normal text-slate-500">{plan.pricePerUser !== null ? '/paid user/month' : ''}</span></p><p className="text-sm text-slate-500">1 free Company Admin{plan.annualDiscountPercent ? ` - ${plan.annualDiscountPercent}% yearly discount` : ''}</p></Card>)}</div>
  </div>
}

function SettingsView({ userName, apiRoot, company, token, canEditCompany, onSaved, onCompanySaved, onOpenPage }: { userName: string; apiRoot: string; company?: Company; token: string; canEditCompany: boolean; onSaved: () => Promise<void>; onCompanySaved: (message: string) => Promise<void>; onOpenPage: (page: string) => void }) {
  const [settings, setSettings] = useState<WorkspaceSettingsState>(() => workspaceSettingsFromCompany(company))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const policy = settings.attendancePolicy

  useEffect(() => { setSettings(workspaceSettingsFromCompany(company)) }, [company])

  function updatePolicy<Key extends keyof AttendancePolicy>(key: Key, value: AttendancePolicy[Key]) {
    setSettings((current) => ({ ...current, attendancePolicy: { ...current.attendancePolicy, [key]: value } }))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await api('/companies/settings', { method: 'PATCH', body: JSON.stringify(settings) }, token)
      await onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return <div className="space-y-5">
    {/* Company identity lives here, not inside Payroll: it is company-level data
        that payslips, attendance and the calendar all read. */}
    <CompanyProfileCard apiRoot={apiRoot} token={token} canEdit={canEditCompany} onSaved={onCompanySaved} onOpenPage={onOpenPage} />

    <Card>
      <Toolbar title="Attendance and workspace behaviour" />
      <div className="mb-5 rounded-lg border border-line bg-surface-subtle p-4">
        <p className="font-semibold">{company?.name || 'Company workspace'} — signed in as {userName}</p>
        <p className="mt-1 break-all text-xs text-ink-soft">API: {apiRoot}</p>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold">Office start<input type="time" value={settings.officeStart} onChange={(event) => setSettings((current) => ({ ...current, officeStart: event.target.value }))} className={`${fieldClass} mt-1`} /></label>
        <label className="text-sm font-semibold">Office end<input type="time" value={settings.officeEnd} onChange={(event) => setSettings((current) => ({ ...current, officeEnd: event.target.value }))} className={`${fieldClass} mt-1`} /></label>
        <label className="text-sm font-semibold">Timezone<input value={settings.timezone} onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))} className={`${fieldClass} mt-1`} /></label>
        <label className="text-sm font-semibold">Late grace minutes<input type="number" min="0" max="180" value={policy.lateGraceMinutes} onChange={(event) => updatePolicy('lateGraceMinutes', Number(event.target.value))} className={`${fieldClass} mt-1`} /></label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Toggle label="GPS tracking" checked={settings.gpsTracking} change={(value) => setSettings((current) => ({ ...current, gpsTracking: value }))} />
        <Toggle label="Auto check-in" checked={settings.autoCheckIn} change={(value) => setSettings((current) => ({ ...current, autoCheckIn: value }))} />
        <Toggle label="Leave approval" checked={settings.leaveApproval} change={(value) => setSettings((current) => ({ ...current, leaveApproval: value }))} />
        <Toggle label="Desktop monitoring" checked={settings.desktopMonitoring} change={(value) => setSettings((current) => ({ ...current, desktopMonitoring: value }))} />
        <Toggle label="Photo attendance" checked={settings.requirePhotoAttendance} change={(value) => setSettings((current) => ({ ...current, requirePhotoAttendance: value }))} />
      </div>
    </Card>

    {/* The work week decides who is expected in, so it comes before the rules
        that decide what an absence costs. */}
    <WorkWeekCard apiRoot={apiRoot} token={token} canEdit={canEditCompany} onSaved={onCompanySaved} />

    <Card>
      <Toolbar title="Attendance and payroll rules" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold xl:col-span-2">Payroll deduction mode<select value={policy.payrollImpact} onChange={(event) => updatePolicy('payrollImpact', event.target.value as AttendancePolicy['payrollImpact'])} className={`${fieldClass} mt-1`}><option value="leave_only">Deduct only unpaid leave</option><option value="attendance_and_leave">Deduct attendance + leave loss</option><option value="none">Do not deduct from payroll</option></select><span className="mt-1 block text-xs font-normal leading-5 text-ink-soft">Weekly offs and holidays are never counted as absence in any mode.</span></label>
        <label className="text-sm font-semibold">Full day minutes<input type="number" min="1" max="1440" value={policy.fullDayMinutes} onChange={(event) => updatePolicy('fullDayMinutes', Number(event.target.value))} className={`${fieldClass} mt-1`} /></label>
        <label className="text-sm font-semibold">Half day minutes<input type="number" min="1" max={policy.fullDayMinutes} value={policy.halfDayMinutes} onChange={(event) => updatePolicy('halfDayMinutes', Number(event.target.value))} className={`${fieldClass} mt-1`} /></label>
        <label className="text-sm font-semibold">Paid leave payable<input type="number" min="0" max="1" step="0.5" value={policy.paidLeavePayableDays} onChange={(event) => updatePolicy('paidLeavePayableDays', Number(event.target.value))} className={`${fieldClass} mt-1`} /></label>
        <label className="text-sm font-semibold">Unpaid leave payable<input type="number" min="0" max="1" step="0.5" value={policy.unpaidLeavePayableDays} onChange={(event) => updatePolicy('unpaidLeavePayableDays', Number(event.target.value))} className={`${fieldClass} mt-1`} /></label>
        <label className="text-sm font-semibold">Half day payable<input type="number" min="0" max="1" step="0.5" value={policy.halfDayPayableDays} onChange={(event) => updatePolicy('halfDayPayableDays', Number(event.target.value))} className={`${fieldClass} mt-1`} /></label>
        <label className="text-sm font-semibold">Unnoticed absence payable<input type="number" min="0" max="1" step="0.5" value={policy.unnoticedAbsencePayableDays} onChange={(event) => updatePolicy('unnoticedAbsencePayableDays', Number(event.target.value))} className={`${fieldClass} mt-1`} /></label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Toggle label="Deduct unpaid leave" checked={policy.deductUnpaidLeave} change={(value) => updatePolicy('deductUnpaidLeave', value)} />
        <Toggle label="Deduct unnoticed absence" checked={policy.deductUnnoticedAbsence} change={(value) => updatePolicy('deductUnnoticedAbsence', value)} />
        <Toggle label="Deduct half day" checked={policy.deductHalfDay} change={(value) => updatePolicy('deductHalfDay', value)} />
        <Toggle label="Paid holidays" checked={policy.holidaysPaid} change={(value) => updatePolicy('holidaysPaid', value)} />
      </div>
    </Card>

    <Card>
      <Toolbar title="Work from home rules" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold">Approved WFH payable<input type="number" min="0" max="1" step="0.5" value={policy.wfhPayableDays} onChange={(event) => updatePolicy('wfhPayableDays', Number(event.target.value))} className={`${fieldClass} mt-1`} /></label>
        <label className="text-sm font-semibold">Untracked WFH payable<input type="number" min="0" max="1" step="0.5" value={policy.untrackedWfhPayableDays} onChange={(event) => updatePolicy('untrackedWfhPayableDays', Number(event.target.value))} className={`${fieldClass} mt-1`} /></label>
        <Toggle label="WFH requires check-in" checked={policy.wfhRequiresCheckIn} change={(value) => updatePolicy('wfhRequiresCheckIn', value)} />
        <Toggle label="Count WFH as present" checked={policy.countApprovedWfhAsPresent} change={(value) => updatePolicy('countApprovedWfhAsPresent', value)} />
      </div>
      <button disabled={saving} onClick={() => void save()} className="gradient-button mt-5 rounded-lg px-5 py-3 font-semibold disabled:opacity-60">{saving ? 'Saving...' : 'Save settings'}</button>
    </Card>
  </div>
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const firstRecord = (page - 1) * pageSize
  const visibleRows = rows.slice(firstRecord, firstRecord + pageSize)

  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  if (!rows.length) return <Empty label="No records found" />
  return <div>
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead><tr className="border-y border-line">{headers.map((header, index) => <th key={header} scope="col" className={`whitespace-nowrap px-3 py-2.5 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${index === 0 ? 'sticky left-0 z-10 bg-surface-subtle' : ''}`}>{header}</th>)}</tr></thead>
        <tbody>{visibleRows.map((row, rowIndex) => <tr key={firstRecord + rowIndex} className="border-b border-line last:border-0 hover:bg-neu-bg/70">{row.map((cell, index) => <td key={index} className={`whitespace-nowrap px-3 py-3 align-middle first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${index === 0 ? 'sticky left-0 z-[1] bg-white' : ''}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
      <div className="flex items-center gap-2"><span>Rows</span><select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="neu-input rounded-md px-2 py-1 text-xs"><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select><span className="tabular-nums">{firstRecord + 1}-{Math.min(firstRecord + pageSize, rows.length)} of {rows.length}</span></div>
      <div className="flex items-center gap-1.5"><button aria-label="Previous page" title="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="neu-button rounded-md p-1.5 disabled:cursor-not-allowed"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-24 text-center font-semibold tabular-nums text-ink">Page {page} of {totalPages}</span><button aria-label="Next page" title="Next page" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="neu-button rounded-md p-1.5 disabled:cursor-not-allowed"><ChevronRight className="h-4 w-4" /></button></div>
    </div>
  </div>
}
function Empty({ label }: { label: string }) { return <div className="rounded-lg border border-dashed border-line-strong bg-surface-subtle p-10 text-center text-sm font-medium text-ink-soft">{label}</div> }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="neu-card rounded-lg px-4 py-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label}</p><p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{value}</p></div> }
function Toggle({ label, checked, change }: { label: string; checked: boolean; change: (value: boolean) => void }) { return <label className="neu-inset flex cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors hover:border-line-input"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => change(event.target.checked)} className="h-4 w-4 accent-primary-600" /></label> }

/** `size` controls desktop width. Long data-entry forms use `wide`. */
function Modal({ title, close, children, size = 'default' }: { title: string; close: () => void; children: ReactNode; size?: 'default' | 'wide' }) {
  const width = size === 'wide' ? 'max-w-5xl' : 'max-w-lg'
  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-ink/40 p-3 backdrop-blur-[1px] sm:place-items-center sm:p-6"><div className={`animate-in my-auto w-full ${width} rounded-xl border border-line bg-white shadow-overlay`}><div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-xl border-b border-line bg-surface-subtle px-4 py-3.5 sm:px-5"><h2 className="text-base font-bold tracking-tight">{title}</h2><button aria-label="Close dialog" onClick={close} className="neu-button shrink-0 rounded-md p-1.5"><X className="h-4 w-4" /></button></div><div className="p-4 sm:p-6">{children}</div></div></div>
}
const fieldClass = 'neu-input w-full px-3 py-2.5'

const employeeSalaryFieldNames = [
  'payrollEnabled', 'salaryEffectiveFrom', 'monthlyGrossTarget', 'monthlyTds', 'paymentMode',
  'pan', 'uan', 'esiNumber', 'bankName', 'bankAccountLast4', 'bankIfsc',
  'recurringExtraName', 'recurringExtraAmount',
]

function employeeSalaryPayload(form: FormData, existing?: EmployeeSalary) {
  const monthlyGrossTarget = Number(form.get('monthlyGrossTarget') || 0)
  const extraAmount = Number(form.get('recurringExtraAmount') || 0)
  return {
    payrollEnabled: form.get('payrollEnabled') === 'on',
    effectiveFrom: String(form.get('salaryEffectiveFrom') || form.get('dateOfJoining') || new Date().toISOString().slice(0, 10)),
    monthlyGrossTarget,
    salaryMode: existing?.salaryMode || 'company_template',
    monthlyTds: Number(form.get('monthlyTds') || 0),
    paymentMode: String(form.get('paymentMode') || 'bank_transfer'),
    pan: String(form.get('pan') || ''),
    uan: String(form.get('uan') || ''),
    esiNumber: String(form.get('esiNumber') || ''),
    bankName: String(form.get('bankName') || ''),
    bankAccountLast4: String(form.get('bankAccountLast4') || ''),
    bankIfsc: String(form.get('bankIfsc') || ''),
    recurringExtra: {
      name: String(form.get('recurringExtraName') || 'Recurring addition'),
      amount: extraAmount,
      taxable: false,
      prorate: false,
    },
  }
}

function employeeDetailsPayload(form: FormData, existingSalary?: EmployeeSalary) {
  const values = Object.fromEntries(form)
  for (const key of employeeSalaryFieldNames) delete values[key]
  delete values.openPayroll
  return { values, salary: employeeSalaryPayload(form, existingSalary) }
}

function EmployeeSalaryFields({ salary, defaultDate }: { salary?: EmployeeSalary; defaultDate: string }) {
  const extra = salary?.earningOverrides?.find((item) => item.code === 'employee_recurring_extra')
    || salary?.earnings?.find((item) => item.code === 'employee_recurring_extra')
  const monthlyGross = Number(salary?.monthlyGrossTarget || salary?.monthlyGross || 0)
  return <section className="space-y-4 rounded-lg border border-slate-200 bg-white/35 p-4 sm:col-span-2">
    <div><h3 className="font-bold">Salary and payment</h3><p className="mt-1 text-xs text-slate-500">Monthly gross uses the company salary formula automatically. Enter only this employee&apos;s salary, manual TDS, and personal payment details here.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Monthly gross salary<input name="monthlyGrossTarget" type="number" min="0.01" step="0.01" defaultValue={monthlyGross || ''} placeholder="30000" required className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Salary effective from<input name="salaryEffectiveFrom" type="date" defaultValue={String(salary?.effectiveFrom || defaultDate).slice(0, 10)} required className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Manual monthly TDS<input name="monthlyTds" type="number" min="0" step="0.01" defaultValue={Number(salary?.monthlyTds || 0)} className={`${fieldClass} mt-1`} /><span className="mt-1 block text-xs font-normal text-slate-500">Deducted only when TDS is enabled in Company payroll settings.</span></label>
      <label className="text-sm font-semibold">Payment mode<select name="paymentMode" defaultValue={salary?.paymentMode || 'bank_transfer'} className={`${fieldClass} mt-1`}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option></select></label>
      <label className="text-sm font-semibold">Recurring addition after gross<input name="recurringExtraName" defaultValue={extra?.name || ''} placeholder="Travel or mobile reimbursement" className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Recurring addition amount<input name="recurringExtraAmount" type="number" min="0" step="0.01" defaultValue={Number(extra?.value || 0)} placeholder="0" className={`${fieldClass} mt-1`} /><span className="mt-1 block text-xs font-normal text-slate-500">Optional fixed amount paid above monthly gross.</span></label>
    </div>
    <details className="rounded-lg border border-slate-200 bg-white/35 p-3"><summary className="cursor-pointer text-sm font-bold">Bank and statutory details</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">PAN<input name="pan" defaultValue={salary?.pan || ''} className={`${fieldClass} mt-1 uppercase`} /></label>
      <label className="text-sm font-semibold">UAN<input name="uan" defaultValue={salary?.uan || ''} className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">ESI number<input name="esiNumber" defaultValue={salary?.esiNumber || ''} className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Bank name<input name="bankName" defaultValue={salary?.bankName || ''} className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Account last 4<input name="bankAccountLast4" inputMode="numeric" maxLength={4} defaultValue={salary?.bankAccountLast4 || ''} className={`${fieldClass} mt-1`} /></label>
      <label className="text-sm font-semibold">IFSC<input name="bankIfsc" defaultValue={salary?.bankIfsc || ''} className={`${fieldClass} mt-1 uppercase`} /></label>
    </div></details>
    <label className="flex items-center gap-2 text-sm font-semibold"><input name="payrollEnabled" type="checkbox" defaultChecked={salary?.payrollEnabled !== false} className="h-4 w-4 accent-orange-600" />Include this employee in payroll</label>
  </section>
}

/** Read-only panel for credentials that are only available once. */
function IssuedCredentials({ issued, onDone }: {
  issued: { name: string; employeeId: string; companyCode: string; oneTimePassword: string }
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)
  const text = ['Company code: ' + issued.companyCode, 'Employee ID: ' + issued.employeeId, 'One-time password: ' + issued.oneTimePassword].join('\n')
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-success-soft p-4">
        <p className="text-sm font-bold text-success">{issued.name} created</p>
        <p className="mt-1 text-xs leading-5 text-ink-soft">
          Share these once. The password is stored hashed and cannot be shown again — issue a new one from the
          employee row if it is lost. {issued.name} must change it at first sign-in.
        </p>
      </div>
      <dl className="grid gap-2.5 rounded-lg border border-line bg-surface-subtle p-4 sm:grid-cols-3">
        <div><dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">Company code</dt><dd className="mt-1 font-mono text-sm font-semibold">{issued.companyCode}</dd></div>
        <div><dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">Employee ID</dt><dd className="mt-1 font-mono text-sm font-semibold">{issued.employeeId}</dd></div>
        <div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">One-time password</dt><dd className="mt-1 break-all font-mono text-sm font-semibold text-primary-700">{issued.oneTimePassword}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => setCopied(false)) }} className="neu-button rounded-md px-3.5 py-2 text-sm">{copied ? 'Copied' : 'Copy credentials'}</button>
        <button type="button" onClick={onDone} className="gradient-button rounded-md px-3.5 py-2 text-sm">Done</button>
      </div>
    </div>
  )
}

function EmployeeSalaryModal({ token, userRole, employees, companyId, departments, designations, workLocations, close, done, onCreated }: {
  token: string; userRole: UserRole; employees: Employee[]; companyId?: string
  close: () => void
  done: (message: string, employee: Employee, openPayroll: boolean) => Promise<void>
  onCreated: (employee: Employee, openPayroll: boolean) => Promise<void>
} & OrgPickerProps) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [issued, setIssued] = useState<{ name: string; employeeId: string; companyCode: string; oneTimePassword: string } | null>(null)
  const form = useEmployeeFormState(undefined, workLocations)
  const roleOptions = userRole === 'super_admin' ? (companyId ? ['employee', 'manager', 'hr', 'admin'] : ['employee', 'manager', 'hr', 'admin', 'super_admin']) : userRole === 'admin' ? ['employee', 'manager', 'hr', 'admin'] : ['employee', 'manager', 'hr']
  const managers = employees.filter((item) => ['manager', 'hr', 'admin'].includes(item.role) && item.status !== 'inactive' && (!companyId || item.companyId === companyId))
  const managerOptions: Option[] = managers.map((manager) => ({ value: manager._id, label: manager.name, hint: manager.employeeId + ' - ' + manager.role.replace('_', ' ') }))
  const today = new Date().toISOString().slice(0, 10)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true); setError('')
    // Payload construction stays inside the try: a throw here used to leave the
    // button stuck on "Creating..." with no message.
    try {
      const data = new FormData(event.currentTarget)
      const openPayroll = data.get('openPayroll') === 'on'
      if (form.locationRequired && !form.workLocationId) throw new Error('Select the work location this employee reports to.')
      const { values, salary } = employeeDetailsPayload(data)
      const payload = {
        ...values,
        ...(companyId ? { companyId } : {}),
        ...(form.workLocationId ? { workLocationId: form.workLocationId } : {}),
        ...(form.departmentId ? { departmentId: form.departmentId } : {}),
        ...(form.designationId ? { designationId: form.designationId } : {}),
        salary,
      }
      const result = await api<{ employee: Employee; credentials?: { oneTimePassword: string; employeeId: string; companyCode: string } }>('/employees', { method: 'POST', body: JSON.stringify(payload) }, token)
      if (result.credentials) {
        setIssued({ ...result.credentials, name: result.employee.name })
        await onCreated(result.employee, openPayroll)
      } else {
        await done(result.employee.name + ' created.', result.employee, openPayroll)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create employee')
    } finally {
      setSaving(false)
    }
  }

  if (issued) return <Modal title="Employee created" close={close}><IssuedCredentials issued={issued} onDone={close} /></Modal>

  return <Modal title="Add employee" close={close} size="wide"><form onSubmit={submit} className="space-y-6">
    {error && <p role="alert" className="rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}
    <EmployeeFormFields mode="create" roleOptions={roleOptions} managerOptions={managerOptions} departments={departments} designations={designations} workLocations={workLocations} {...form} />
    <FormSection title="Sign-in">
      <Labelled label="Mobile passcode" hint="Short code for quick check-in. The sign-in password is generated automatically and shown once after saving."><input name="passcode" minLength={4} defaultValue="1234" required className={fieldClass} /></Labelled>
    </FormSection>
    <EmployeeSalaryFields defaultDate={today} />
    {userRole !== 'super_admin' && <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-subtle px-3.5 py-2.5 text-sm font-semibold"><input name="openPayroll" type="checkbox" className="h-4 w-4 accent-primary-600" />Open advanced salary formula after creation</label>}
    <button disabled={saving} className="gradient-button w-full rounded-lg py-3 font-semibold">{saving ? 'Creating...' : 'Create employee'}</button>
  </form></Modal>
}

function EmployeeSalaryEditModal({ token, userRole, employees, employee, departments, designations, workLocations, close, done }: {
  token: string; userRole: UserRole; employees: Employee[]; employee: Employee
  close: () => void; done: (message: string) => Promise<void>
} & OrgPickerProps) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const form = useEmployeeFormState(employee, workLocations)
  const roleOptions = userRole === 'super_admin' ? ['employee', 'manager', 'hr', 'admin', 'super_admin'] : userRole === 'admin' ? ['employee', 'manager', 'hr', 'admin'] : ['employee', 'manager', 'hr']
  const managers = employees.filter((item) => item._id !== employee._id && item.companyId === employee.companyId && ['manager', 'hr', 'admin'].includes(item.role) && item.status !== 'inactive')
  const managerOptions: Option[] = managers.map((manager) => ({ value: manager._id, label: manager.name, hint: manager.employeeId + ' - ' + manager.role.replace('_', ' ') }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true); setError('')
    try {
      const data = new FormData(event.currentTarget)
      const { values, salary } = employeeDetailsPayload(data, employee.salary)
      if (!values.passcode) delete values.passcode
      if (!values.lastWorkingDate) values.lastWorkingDate = ''
      const payload = {
        ...values,
        salary,
        workLocationId: form.workLocationId || null,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
      }
      const result = await api<{ employee: Employee }>('/employees/' + employee._id, { method: 'PATCH', body: JSON.stringify(payload) }, token)
      await done(result.employee.name + ' updated successfully.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update employee')
    } finally {
      setSaving(false)
    }
  }

  return <Modal title={'Edit ' + employee.name} close={close} size="wide"><form onSubmit={submit} className="space-y-6">
    {error && <p role="alert" className="rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}
    <p className="rounded-lg border border-line bg-surface-subtle px-3.5 py-2.5 text-xs leading-5 text-ink-soft">
      Every field is shown, including any left blank when this employee was added. Fill them in whenever you have the detail.
    </p>
    <EmployeeFormFields mode="edit" employee={employee} roleOptions={roleOptions} managerOptions={managerOptions} departments={departments} designations={designations} workLocations={workLocations} {...form} />
    <FormSection title="Sign-in">
      <Labelled label="New passcode" hint="Leave blank to keep the current one. Use Reset password on the employee row to issue a new sign-in password."><input name="passcode" minLength={4} className={fieldClass} /></Labelled>
    </FormSection>
    <EmployeeSalaryFields salary={employee.salary} defaultDate={String(employee.dateOfJoining || new Date().toISOString()).slice(0, 10)} />
    <button disabled={saving} className="gradient-button w-full rounded-lg py-3 font-semibold">{saving ? 'Saving...' : 'Save employee'}</button>
  </form></Modal>
}

function CompanyModal({ close, done }: { close: () => void; done: (message: string) => Promise<void> }) { const [error, setError] = useState(''); const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); const values = Object.fromEntries(new FormData(event.currentTarget)); try { const registration = await api<{ company: Company; verificationCode: string }>('/companies/register', { method: 'POST', body: JSON.stringify(values) }); await api('/companies/verify', { method: 'POST', body: JSON.stringify({ companyCode: registration.company.code, verificationCode: registration.verificationCode }) }); await done(`${registration.company.name} created and activated. Admin login: ${values.adminEmail}`) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create company') } finally { setSaving(false) } } return <Modal title="Add company" close={close}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}<label className="text-sm font-semibold sm:col-span-2">Company name<input name="companyName" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Company code<input name="companyCode" required className={`${fieldClass} mt-1 uppercase`} /></label><label className="text-sm font-semibold">Admin email<input name="adminEmail" type="email" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Admin first name<input name="adminFirstName" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Admin last name<input name="adminLastName" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Admin password<input name="adminPassword" type="password" minLength={8} required className={`${fieldClass} mt-1`} /></label><button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2">{saving ? 'Creating...' : 'Create and activate company'}</button></form></Modal> }

function PaymentModal({ token, invoice, close, done }: { token: string; invoice: BillingInvoice; close: () => void; done: (message: string) => Promise<void> }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const result = await api<{ message: string }>('/admin/billing/payments', { method: 'POST', body: JSON.stringify({ ...values, companyId: invoice.companyId, invoiceId: invoice._id, amount: Number(values.amount), status: 'cleared' }) }, token)
      await done(result.message)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Payment could not be recorded') } finally { setSaving(false) }
  }
  return <Modal title="Record cleared payment" close={close}><div className="mb-4 rounded-lg border border-slate-200 bg-white/40 p-3 text-sm"><p className="font-semibold">{invoice.companyName} - {invoice.invoiceNumber}</p><p className="mt-1 text-slate-500">Outstanding {formatCurrency(invoice.amountDue)}</p></div><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}<label className="text-sm font-semibold">Cleared amount<input name="amount" type="number" min="0.01" max={invoice.amountDue} step="0.01" defaultValue={invoice.amountDue} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Method<select name="method" defaultValue="bank_transfer" className={`${fieldClass} mt-1`}><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="cash">Cash</option><option value="manual_gateway">Manual online gateway</option></select></label><label className="text-sm font-semibold sm:col-span-2">UTR / reference<input name="reference" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Notes<textarea name="notes" rows={3} className={`${fieldClass} mt-1`} /></label><button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2">{saving ? 'Recording...' : 'Confirm cleared payment'}</button></form></Modal>
}

function InvoiceModal({ token, company, subscription, close, done }: { token: string; company: Company; subscription: Subscription | null; close: () => void; done: (message: string) => Promise<void> }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const periodStart = subscription?.nextRenewalAt ? new Date(subscription.nextRenewalAt) : new Date()
  const periodEnd = new Date(periodStart)
  if (subscription?.billingCycle === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  else periodEnd.setMonth(periodEnd.getMonth() + 1)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const result = await api<{ message: string }>('/admin/billing/invoices', { method: 'POST', body: JSON.stringify({ ...values, companyId: company._id, total: Number(values.total), subtotal: Number(values.total), seatCount: Number(values.seatCount), pricePerSeat: Number(values.pricePerSeat) }) }, token)
      await done(result.message)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invoice could not be created') } finally { setSaving(false) }
  }
  return <Modal title="Create invoice" close={close}><div className="mb-4 rounded-lg border border-slate-200 bg-white/40 p-3 text-sm"><p className="font-semibold">{company.name}</p><p className="mt-1 text-slate-500">{billingModeLabel(subscription?.billingMode || 'manual_offline')} - {subscription?.paidSeats || 0} paid seats</p></div><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}<label className="text-sm font-semibold">Invoice type<select name="kind" defaultValue="renewal" className={`${fieldClass} mt-1`}><option value="renewal">Renewal</option><option value="reactivation">Reactivation</option><option value="adjustment">Adjustment</option></select></label><label className="text-sm font-semibold">Cycle<select name="billingCycle" defaultValue={subscription?.billingCycle || 'monthly'} className={`${fieldClass} mt-1`}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label className="text-sm font-semibold">Paid seats<input name="seatCount" type="number" min="0" step="1" defaultValue={subscription?.paidSeats || 0} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Price per seat<input name="pricePerSeat" type="number" min="0" step="0.01" defaultValue={subscription?.pricePerUser || 0} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Invoice total<input name="total" type="number" min="0.01" step="0.01" defaultValue={subscription?.renewalAmount || 0} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Due date<input name="dueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Period start<input name="periodStart" type="date" defaultValue={periodStart.toISOString().slice(0, 10)} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Period end<input name="periodEnd" type="date" defaultValue={periodEnd.toISOString().slice(0, 10)} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Notes<textarea name="notes" rows={3} className={`${fieldClass} mt-1`} /></label><button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2">{saving ? 'Creating...' : 'Create invoice'}</button></form></Modal>
}

function WfhAssignModal({ token, employees, close, done }: { token: string; employees: Employee[]; close: () => void; done: (message: string) => Promise<void> }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const activeEmployees = employees.filter((employee) => employee.status !== 'inactive' && employee.role !== 'super_admin')
  const employeeOptions: Option[] = activeEmployees.map((employee) => ({ value: employee._id, label: employee.name, hint: `${employee.employeeId} - ${employee.department}` }))
  const [employeeId, setEmployeeId] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const result = await api<{ message: string }>('/wfh/assign', { method: 'POST', body: JSON.stringify(values) }, token)
      await done(result.message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'WFH assignment could not be saved')
    } finally {
      setSaving(false)
    }
  }
  return <Modal title="Assign work from home" close={close}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}<div className="text-sm font-semibold sm:col-span-2"><label htmlFor="wfh-assign-employee">Employee</label><div className="mt-1"><SearchableSelect id="wfh-assign-employee" name="employeeId" options={employeeOptions} value={employeeId} onChange={setEmployeeId} placeholder="Search employees" required /></div></div><label className="text-sm font-semibold">Start date<input name="startDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">End date<input name="endDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Work location<input name="workFromLocation" placeholder="Home, client site, or city" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Reason<textarea name="reason" rows={3} defaultValue="Assigned by admin" className={`${fieldClass} mt-1`} /></label><button disabled={saving || !employeeId || !activeEmployees.length} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2 disabled:opacity-60">{saving ? 'Saving...' : 'Assign WFH and mark attendance'}</button></form></Modal>
}

function EmployeeModal({ token, userRole, employees, companyId, close, done }: { token: string; userRole: UserRole; employees: Employee[]; companyId?: string; close: () => void; done: (message: string, employee: Employee, openPayroll: boolean) => Promise<void> }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const roleOptions = userRole === 'super_admin' ? (companyId ? ['employee', 'manager', 'hr', 'admin'] : ['employee', 'manager', 'hr', 'admin', 'super_admin']) : userRole === 'admin' ? ['employee', 'manager', 'hr', 'admin'] : ['employee', 'manager', 'hr']
  const managers = employees.filter((item) => ['manager', 'hr', 'admin'].includes(item.role) && item.status !== 'inactive' && (!companyId || item.companyId === companyId))
  const managerOptions: Option[] = managers.map((manager) => ({ value: manager._id, label: manager.name, hint: `${manager.employeeId} - ${manager.role.replace('_', ' ')}` }))
  const [managerId, setManagerId] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    const passcode = String(form.get('passcode') || '')
    const openPayroll = form.get('openPayroll') === 'on'
    const rawValues = Object.fromEntries(form)
    delete rawValues.openPayroll
    const values = { ...rawValues, ...(companyId ? { companyId } : {}), requiresPasswordChange: form.get('requiresPasswordChange') === 'on' }
    try {
      const result = await api<{ employee: Employee }>('/employees', { method: 'POST', body: JSON.stringify(values) }, token)
      await done(`${result.employee.name} created. Mobile login: ${result.employee.employeeId} / ${passcode}`, result.employee, openPayroll)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create employee') } finally { setSaving(false) }
  }
  return <Modal title="Add employee" close={close}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}<label className="text-sm font-semibold">Employee ID<input name="employeeId" placeholder="EMP002" required className={`${fieldClass} mt-1 uppercase`} /></label><label className="text-sm font-semibold">Mobile passcode<input name="passcode" minLength={4} defaultValue="1234" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">First name<input name="firstName" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Last name<input name="lastName" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Email<input name="email" type="email" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Phone<input name="phone" type="tel" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Joining date<input name="dateOfJoining" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Role<select name="role" defaultValue="employee" className={`${fieldClass} mt-1 capitalize`}>{roleOptions.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select></label><div className="text-sm font-semibold"><label htmlFor="employee-modal-manager">Reporting manager</label><div className="mt-1"><SearchableSelect id="employee-modal-manager" name="managerId" options={managerOptions} value={managerId} onChange={setManagerId} placeholder="Search managers" allowEmpty emptyLabel="No reporting manager" /></div></div><label className="text-sm font-semibold">Department<input name="department" defaultValue="Operations" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Designation<input name="designation" defaultValue="Employee" className={`${fieldClass} mt-1`} /></label><div className="space-y-3 rounded-lg border border-slate-200 p-3 sm:col-span-2"><label className="flex items-center gap-2 text-sm font-semibold"><input name="requiresPasswordChange" type="checkbox" defaultChecked className="h-4 w-4 accent-orange-600" />Require passcode change after first login</label>{userRole !== 'super_admin' && <label className="flex items-center gap-2 text-sm font-semibold"><input name="openPayroll" type="checkbox" defaultChecked className="h-4 w-4 accent-orange-600" />Open salary and payroll setup after creation</label>}</div><button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2">{saving ? 'Creating...' : 'Create employee'}</button></form></Modal>
}

function EmployeeEditModal({ token, userRole, employees, employee, close, done }: { token: string; userRole: UserRole; employees: Employee[]; employee: Employee; close: () => void; done: (message: string) => Promise<void> }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const roles = userRole === 'super_admin' ? ['employee', 'manager', 'hr', 'admin', 'super_admin'] : userRole === 'admin' ? ['employee', 'manager', 'hr', 'admin'] : ['employee', 'manager', 'hr']
  const managers = employees.filter((item) => item._id !== employee._id && item.companyId === employee.companyId && ['manager', 'hr', 'admin'].includes(item.role) && item.status !== 'inactive')
  const managerOptions: Option[] = managers.map((manager) => ({ value: manager._id, label: manager.name, hint: `${manager.employeeId} - ${manager.role.replace('_', ' ')}` }))
  const [managerId, setManagerId] = useState(employee.managerId || '')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    if (!values.passcode) delete values.passcode
    if (!values.lastWorkingDate) values.lastWorkingDate = ''
    try {
      const result = await api<{ employee: Employee }>(`/employees/${employee._id}`, { method: 'PATCH', body: JSON.stringify(values) }, token)
      await done(`${result.employee.name} updated successfully.`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update employee') } finally { setSaving(false) }
  }
  return <Modal title={`Edit ${employee.name}`} close={close}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}<label className="text-sm font-semibold">Employee ID<input name="employeeId" defaultValue={employee.employeeId} required className={`${fieldClass} mt-1 uppercase`} /></label><label className="text-sm font-semibold">Status<select name="status" defaultValue={employee.status} disabled={userRole === 'hr'} className={`${fieldClass} mt-1 disabled:opacity-60`}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label className="text-sm font-semibold">First name<input name="firstName" defaultValue={employee.firstName || ''} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Last name<input name="lastName" defaultValue={employee.lastName || ''} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Email<input name="email" type="email" defaultValue={employee.email} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Phone<input name="phone" type="tel" defaultValue={employee.phone || ''} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Role<select name="role" defaultValue={employee.role} className={`${fieldClass} mt-1 capitalize`}>{roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select></label><label className="text-sm font-semibold">Department<input name="department" defaultValue={employee.department} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Designation<input name="designation" defaultValue={employee.designation} className={`${fieldClass} mt-1`} /></label><div className="text-sm font-semibold"><label htmlFor="employee-edit-manager">Reporting manager</label><div className="mt-1"><SearchableSelect id="employee-edit-manager" name="managerId" options={managerOptions} value={managerId} onChange={setManagerId} placeholder="Search managers" allowEmpty emptyLabel="No reporting manager" /></div></div><label className="text-sm font-semibold">Joining date<input name="dateOfJoining" type="date" defaultValue={String(employee.dateOfJoining || '').slice(0, 10)} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Last working date<input name="lastWorkingDate" type="date" defaultValue={String(employee.lastWorkingDate || '').slice(0, 10)} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">New passcode <span className="font-normal text-slate-500">(leave blank to keep current)</span><input name="passcode" minLength={4} className={`${fieldClass} mt-1`} /></label><button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2">{saving ? 'Saving...' : 'Save employee details'}</button></form></Modal>
}

/** Creates a geofence, or edits an existing one when `area` is supplied. */
function AreaModal({ token, workLocations, area, close, done }: { token: string; workLocations: WorkLocation[]; area?: Area | null; close: () => void; done: (message: string) => void }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const editing = Boolean(area)
  const options = workLocations.filter((item) => item.status !== 'inactive')
  // When editing, keep the link the record already has. When creating, prefer a
  // site that has no geofence yet: that is almost always why this dialog is open.
  const [locationId, setLocationId] = useState(
    area ? (area.workLocationId || '') : (options.find((item) => !item.geofence)?._id || ''),
  )
  const [active, setActive] = useState(area ? area.active !== false : true)
  const selected = options.find((item) => item._id === locationId)
  const locationOptions: Option[] = options.map((item) => ({
    value: item._id,
    label: item.name,
    hint: item.address || item.city || undefined,
  }))
  // A linked geofence takes its name and address from the site, so those two
  // fields are read-only in that case rather than silently ignored on save.
  const inheritsFromSite = Boolean(selected)
  const nameValue = selected?.name || area?.name || ''
  const addressValue = selected?.address || area?.address || ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true); setError('')
    try {
      const form = Object.fromEntries(new FormData(event.currentTarget))
      const body = JSON.stringify({
        // Linking to a work location is what keeps one address in both places.
        workLocationId: locationId || '',
        name: String(form.name || '').trim() || selected?.name || 'Location',
        address: String(form.address || '').trim() || selected?.address || '',
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusMeters: Number(form.radiusMeters),
        active,
      })
      if (editing && area) await api(`/attendance-areas/${area._id}`, { method: 'PATCH', body }, token)
      else await api('/attendance-areas', { method: 'POST', body }, token)
      done(editing ? 'Geofence updated.' : 'Geofence created.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : editing ? 'Could not update geofence' : 'Could not create geofence')
    } finally {
      setSaving(false)
    }
  }

  return <Modal title={editing ? `Edit ${area?.name || 'geofence'}` : 'Add geofence'} close={close}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    {error && <p role="alert" className="sm:col-span-2 rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}
    <div className="text-sm font-semibold sm:col-span-2">
      <label htmlFor="geofence-location">Work location</label>
      <div className="mt-1 font-normal"><SearchableSelect id="geofence-location" options={locationOptions} value={locationId} onChange={setLocationId} placeholder="Search work locations" allowEmpty emptyLabel={locationOptions.length ? 'Standalone geofence' : 'No work locations yet'} /></div>
      <span className="mt-1 block text-xs font-normal leading-5 text-ink-soft">
        {selected?.address
          ? `Uses the address already on ${selected.name}: ${selected.address}`
          : 'Linking a site reuses its address and keeps the two in step. Leave empty for a standalone geofence.'}
      </span>
    </div>
    <label className="text-sm font-semibold sm:col-span-2">Name<input name="name" defaultValue={nameValue} key={`name-${locationId || 'none'}`} readOnly={inheritsFromSite} required className={`${fieldClass} mt-1 ${inheritsFromSite ? 'bg-surface-subtle text-ink-soft' : ''}`} />{inheritsFromSite && <span className="mt-1 block text-xs font-normal text-ink-soft">Taken from the linked work location. Rename the site to change it.</span>}</label>
    <label className="text-sm font-semibold sm:col-span-2">Address <span className="font-normal text-ink-soft">(optional when a site is linked)</span><input name="address" defaultValue={addressValue} key={`addr-${locationId || 'none'}`} readOnly={inheritsFromSite} className={`${fieldClass} mt-1 ${inheritsFromSite ? 'bg-surface-subtle text-ink-soft' : ''}`} /></label>
    <label className="text-sm font-semibold">Latitude<input name="latitude" type="number" step="any" defaultValue={area ? String(area.latitude) : '19.076'} required className={`${fieldClass} mt-1`} /></label>
    <label className="text-sm font-semibold">Longitude<input name="longitude" type="number" step="any" defaultValue={area ? String(area.longitude) : '72.8777'} required className={`${fieldClass} mt-1`} /></label>
    <label className="text-sm font-semibold sm:col-span-2">Radius (metres)<input name="radiusMeters" type="number" min="25" max="5000" defaultValue={area ? String(area.radiusMeters) : '150'} required className={`${fieldClass} mt-1`} /></label>
    <label className="flex items-start gap-3 rounded-lg border border-line bg-surface-subtle p-3 text-sm sm:col-span-2">
      <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="mt-0.5 h-4 w-4" />
      <span>
        <span className="font-semibold">Accept check-in here</span>
        <span className="mt-1 block text-xs text-ink-soft">Turn this off to keep the boundary on record without allowing attendance from it.</span>
      </span>
    </label>
    <button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2">{saving ? 'Saving...' : editing ? 'Save geofence' : 'Create geofence'}</button>
  </form></Modal>
}
