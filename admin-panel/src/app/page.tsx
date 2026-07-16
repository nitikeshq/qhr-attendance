'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive, ArrowLeft, BarChart3, Bell, Briefcase, Building2, Calendar, CheckCircle2, Clock, CreditCard, Download,
  ChevronLeft, ChevronRight, FileText, History, Inbox, Loader2, LogOut, MapPin, Menu, Monitor, Pencil, Plus, RefreshCw, Search, Settings,
  ShieldCheck, UserCheck, UserX, Wallet, TrendingUp, Users, X, XCircle, type LucideIcon,
} from 'lucide-react'

type UserRole = 'manager' | 'hr' | 'admin' | 'super_admin'
type BillingMode = 'automatic' | 'manual_online' | 'manual_offline' | 'custom'
type PageKey = 'dashboard' | 'employees' | 'companies' | 'company-detail' | 'leads' | 'audit' | 'attendance' | 'leaves' | 'wfh' | 'grievances' | 'payroll' | 'work' | 'desktop' | 'geofences' | 'subscriptions' | 'settings'
type Employee = { _id: string; companyId: string; employeeId: string; firstName?: string; lastName?: string; name: string; email: string; phone?: string | null; department: string; designation: string; role: string; status: string; company?: { _id: string; code: string; name: string } | null }
type CompanySettings = { gpsTracking?: boolean; autoCheckIn?: boolean; leaveApproval?: boolean; desktopMonitoring?: boolean }
type Subscription = { plan: string; pricePerUser: number; annualDiscountPercent: number; billingCycle: 'monthly' | 'yearly'; billingMode: BillingMode; paymentGateway?: string | null; status: string; paidSeats: number; freeAdminSeats: number; activeUsers: number; renewalAmount: number; nextRenewalAt?: string | null; graceEndsAt?: string | null; automaticSuspensionEnabled: boolean; customRenewalAmount?: number | null; customTerms?: string | null }
type CompanyBillingSummary = { collectedAmount: number; outstandingAmount: number; pendingVerificationAmount: number; creditBalance: number; upcomingRenewalAmount: number; nextRenewalAt?: string | null }
type Company = { _id: string; code: string; name: string; email: string; phone?: string | null; domain?: string | null; isVerified: boolean; status?: string; employeeCount?: number; monthlyRevenue?: number; subscription?: Subscription; billingSummary?: CompanyBillingSummary; settings?: CompanySettings; updatedAt?: string }
type AttendanceRow = { employee: { _id: string; employeeId: string; firstName: string; lastName: string }; attendance: { checkIn?: { time: string }; checkOut?: { time: string }; workDuration?: number; status?: string; isLate?: boolean } | null }
type Leave = { _id: string; employee: { firstName: string; lastName: string; employeeId: string }; leaveType: string; startDate: string; endDate: string; days: number; status: string; reason?: string }
type WfhRequest = { _id: string; employee: { firstName: string; lastName: string; employeeId: string }; startDate: string; endDate: string; reason: string; workFromLocation?: string; status: string }
type Grievance = { _id: string; ticketNumber: string; employee?: { firstName: string; lastName: string; employeeId: string } | null; subject: string; description: string; category: string; priority: string; status: string; createdAt: string }
type Area = { _id: string; name: string; address: string; latitude: number; longitude: number; radiusMeters: number; active?: boolean }
type Summary = { employees: number; presentToday: number; pendingLeaves: number; activeGeofences: number; monthlyRevenue: number }
type Payroll = { _id: string; period: string; basic: number; gross: number; deductions: number; net: number; status: string; employee: { employeeId: string; firstName: string; lastName: string } }
type Project = { _id: string; name: string; description: string; status: string; members: string[] }
type Task = { _id: string; title: string; projectId: string | null; assignedTo: string; status: string; priority: string; dueDate?: string }
type DesktopMember = { employee: { employeeId: string; firstName: string; lastName: string }; activity: { summary?: { totalActiveSeconds: number; totalIdleSeconds: number; snapshots: number }; topApps?: Array<{ name?: string; app?: string; duration?: number }> } | null; states: Array<{ status: string; lastHeartbeatAt?: string }> }
type PlatformSummary = { companies: number; activeCompanies: number; pendingCompanies: number; suspendedCompanies: number; employees: number; monthlyRevenue: number; collectedAmount: number; pendingAmount: number; upcomingAmount: number; renewalAmount: number; openLeads: number }
type Lead = { _id: string; kind: 'demo' | 'contact'; name: string; email: string; company?: string | null; employees?: string | null; message?: string | null; status: string; createdAt: string }
type TenantSubscription = Subscription & { companyId: string; companyCode: string; companyName: string; monthlyRevenue: number; outstandingAmount: number; collectedAmount: number; pendingVerificationAmount: number }
type SubscriptionPlan = { _id?: string; name: string; pricePerUser: number | null; annualDiscountPercent?: number; freeAdminSeats?: number; userLimit: number | null; status: string }
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
const menuItems: Array<{ key: PageKey; label: string; description: string; icon: LucideIcon; roles: UserRole[] }> = [
  { key: 'dashboard', label: 'Dashboard', description: 'Live operations overview', icon: BarChart3, roles: allRoles },
  { key: 'companies', label: 'Companies', description: 'Tenant operations and access', icon: Building2, roles: ['super_admin'] },
  { key: 'leads', label: 'Sales Leads', description: 'Demo and contact enquiries', icon: Inbox, roles: ['super_admin'] },
  { key: 'audit', label: 'Audit Log', description: 'Platform administration history', icon: History, roles: ['super_admin'] },
  { key: 'employees', label: 'Employees', description: 'People directory and access', icon: Users, roles: allRoles },
  { key: 'attendance', label: 'Attendance', description: 'Today\'s attendance records', icon: Calendar, roles: tenantRoles },
  { key: 'leaves', label: 'Leave Requests', description: 'Pending approval queue', icon: FileText, roles: tenantRoles },
  { key: 'wfh', label: 'WFH Requests', description: 'Remote-work approval queue', icon: Monitor, roles: tenantRoles },
  { key: 'grievances', label: 'Grievances', description: 'Employee support and resolution', icon: Inbox, roles: tenantRoles },
  { key: 'payroll', label: 'Payroll', description: 'Payslips shared with employees', icon: Wallet, roles: ['hr', 'admin'] },
  { key: 'work', label: 'Projects & Tasks', description: 'Team work assignments', icon: Briefcase, roles: tenantRoles },
  { key: 'desktop', label: 'Desktop Activity', description: 'Employee desktop activity', icon: Monitor, roles: tenantRoles },
  { key: 'geofences', label: 'Geofences', description: 'Authorized attendance locations', icon: MapPin, roles: ['hr', 'admin'] },
  { key: 'subscriptions', label: 'Subscriptions', description: 'Plans and current billing', icon: CreditCard, roles: ['admin', 'super_admin'] },
  { key: 'settings', label: 'Settings', description: 'Workspace behavior', icon: Settings, roles: ['admin'] },
]

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

function statusClass(status: string) {
  const value = status.toLowerCase()
  if (['active', 'present', 'approved', 'complete', 'verified', 'resolved', 'contacted'].some((item) => value.includes(item))) return 'bg-emerald-100 text-emerald-700'
  if (['pending', 'trial', 'late', 'draft', 'new', 'partial'].some((item) => value.includes(item))) return 'bg-amber-100 text-amber-700'
  if (['reject', 'inactive', 'absent', 'suspended', 'overdue', 'paused', 'reversed'].some((item) => value.includes(item))) return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-700'
}

function Status({ children }: { children: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(children)}`}>{children}</span>
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
  const [modal, setModal] = useState<'company' | 'employee' | 'employee-edit' | 'area' | 'project' | 'task' | 'payment' | 'invoice' | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedCompanyEmployees, setSelectedCompanyEmployees] = useState<Employee[]>([])
  const [selectedCompanyAudit, setSelectedCompanyAudit] = useState<AuditLog[]>([])
  const [selectedCompanyBilling, setSelectedCompanyBilling] = useState<CompanyBilling | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [companyLoading, setCompanyLoading] = useState(false)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [wfhRequests, setWfhRequests] = useState<WfhRequest[]>([])
  const [grievances, setGrievances] = useState<Grievance[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [payroll, setPayroll] = useState<Payroll[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [desktopTeam, setDesktopTeam] = useState<DesktopMember[]>([])
  const [summary, setSummary] = useState<Summary>({ employees: 0, presentToday: 0, pendingLeaves: 0, activeGeofences: 0, monthlyRevenue: 0 })
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
    if (window.innerWidth < 768) setSidebarOpen(false)
    setSidebarReady(true)
  }, [])

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const isSuper = userRole === 'super_admin'
      const canManagePeople = ['hr', 'admin'].includes(userRole)
      const canManageCompany = userRole === 'admin'
      const [platformData, dashboardData, employeeData, companyData, attendanceData, leaveData, wfhData, grievanceData, areaData, subscriptionData, tenantSubscriptionData, payrollData, projectData, taskData, desktopData, leadData, auditData] = await Promise.all([
        isSuper ? api<{ summary: PlatformSummary; companies: Company[] }>('/admin/platform-dashboard', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ summary: Summary }>('/admin/dashboard', {}, token) : Promise.resolve(null),
        api<{ employees: Employee[] }>('/employees?limit=100', {}, token),
        userRole === 'admin' ? api<{ companies: Company[] }>('/companies', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ attendances: AttendanceRow[] }>('/attendance/team', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ leaves: Leave[] }>('/leaves/approvals/pending', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ wfhRequests: WfhRequest[] }>('/wfh/pending', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ grievances: Grievance[] }>('/grievances/all', {}, token) : Promise.resolve(null),
        canManagePeople ? api<{ areas: Area[] }>('/attendance-areas', {}, token) : Promise.resolve(null),
        canManageCompany ? api<{ plans: SubscriptionPlan[]; current: Subscription; summary: CompanyBillingSummary; invoices: BillingInvoice[]; payments: BillingPayment[] }>('/subscriptions', {}, token) : Promise.resolve(null),
        isSuper ? api<{ plans: SubscriptionPlan[]; subscriptions: TenantSubscription[]; summary: PlatformBillingSummary; invoices: BillingInvoice[]; payments: BillingPayment[]; paymentGateways: PaymentGateway[] }>('/admin/tenant-subscriptions', {}, token) : Promise.resolve(null),
        canManagePeople ? api<{ payroll: Payroll[] }>('/payroll', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ projects: Project[] }>('/projects', {}, token) : Promise.resolve(null),
        !isSuper ? api<{ tasks: Task[] }>('/tasks', {}, token) : Promise.resolve(null),
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
      setLeaves(leaveData?.leaves || [])
      setWfhRequests(wfhData?.wfhRequests || [])
      setGrievances(grievanceData?.grievances || [])
      setAreas(areaData?.areas || [])
      setPlans(tenantSubscriptionData?.plans || subscriptionData?.plans || [])
      setCurrentPlan(subscriptionData?.current || null)
      setCurrentBillingSummary(subscriptionData?.summary || null)
      setCurrentInvoices(subscriptionData?.invoices || [])
      setCurrentPayments(subscriptionData?.payments || [])
      setTenantSubscriptions(tenantSubscriptionData?.subscriptions || [])
      setBillingSummary(tenantSubscriptionData?.summary || { collectedAmount: 0, pendingAmount: 0, pendingVerificationAmount: 0, renewalAmount: 0, upcomingAmount: 0, overdueInvoices: 0, partiallyPaidInvoices: 0 })
      setBillingInvoices(tenantSubscriptionData?.invoices || [])
      setBillingPayments(tenantSubscriptionData?.payments || [])
      setPaymentGateways(tenantSubscriptionData?.paymentGateways || [])
      setPayroll(payrollData?.payroll || [])
      setProjects(projectData?.projects || [])
      setTasks(taskData?.tasks || [])
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

  async function generatePayroll() {
    try {
      const period = new Date().toISOString().slice(0, 7)
      const result = await api<{ payroll: Payroll[]; message: string }>('/payroll/generate', { method: 'POST', body: JSON.stringify({ period }) }, token)
      setNotice(result.message || `Payroll generated for ${result.payroll.length} employee(s).`)
      await loadData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Payroll generation failed') }
  }

  async function approvePayroll(id: string) {
    try {
      await api(`/payroll/${id}/approve`, { method: 'PATCH' }, token)
      setNotice('Payroll approved and published to the employee application.')
      await loadData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Payroll approval failed') }
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
    if (!companyDetailAllowed && !visibleMenuItems.some((item) => item.key === activePage)) setActivePage('dashboard')
  }, [activePage, selectedCompany, userRole, visibleMenuItems])

  if (!token) return <Login onAuthenticated={(nextToken, user) => { setToken(nextToken); setUserName(user.name); setUserRole(user.role); setUserCompany(user.company?.name || '') }} />

  const page = activePage === 'company-detail'
    ? { label: selectedCompany?.name || 'Company details', description: 'Tenant information, access, and employees' }
    : visibleMenuItems.find((item) => item.key === activePage) || visibleMenuItems[0]
  function openPage(nextPage: PageKey) {
    setActivePage(nextPage)
    setNotificationsOpen(false)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-neu-bg text-slate-800">
      {sidebarReady && sidebarOpen && <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 md:hidden" />}
      <aside className={`neu-sidebar fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200/70 p-4 transition-[transform,width] md:sticky md:top-0 ${sidebarReady ? '' : 'max-md:hidden'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-20 md:translate-x-0'}`}>
        <div className="mb-7 flex h-11 items-center gap-3 px-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500 font-bold text-white">Q</span>
          {sidebarOpen && <div className="min-w-0"><p className="truncate font-bold">{userRole === 'super_admin' ? 'QHR Platform' : 'QHR Admin'}</p><p className="truncate text-[10px] font-semibold uppercase text-primary-600">{userRole === 'super_admin' ? 'Super Admin Console' : userCompany || 'Company Workspace'}</p></div>}
          {sidebarOpen && <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="neu-button ml-auto rounded-lg p-2 md:hidden"><X className="h-4 w-4" /></button>}
        </div>
        <nav className="-mx-2 min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2">
          {visibleMenuItems.map((item) => (
            <button key={item.key} title={item.label} onClick={() => openPage(item.key)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium ${activePage === item.key || (activePage === 'company-detail' && item.key === 'companies') ? 'gradient-button' : 'neu-button text-slate-600'}`}>
              <item.icon className="h-5 w-5 shrink-0" />{sidebarOpen && item.label}
            </button>
          ))}
        </nav>
        <button onClick={() => void logout()} title="Logout" className="neu-button mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-red-600">
          <LogOut className="h-5 w-5 shrink-0" />{sidebarOpen && 'Logout'}
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6">
        <header className="mb-4 flex items-center gap-3 sm:mb-6">
          <button aria-label="Toggle sidebar" onClick={() => setSidebarOpen((value) => !value)} className="neu-button shrink-0 rounded-lg p-2.5"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><h1 className="truncate text-xl font-bold sm:text-2xl">{page.label}</h1><span className="hidden rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold capitalize text-primary-600 md:inline-flex">{userRole === 'super_admin' ? 'Platform owner' : userRole.replace('_', ' ')}</span></div><p className="hidden truncate text-sm text-slate-500 sm:block">{userRole === 'super_admin' ? `${page.description} - QHR Platform` : `${page.description}${userCompany ? ` - ${userCompany}` : ''}`}</p></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {activePage === 'employees' && <label className="relative hidden w-72 lg:block"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" className="neu-input w-full py-2.5 pl-10 pr-3" /></label>}
            <button aria-label="Refresh data" onClick={() => void loadData()} className="neu-button hidden rounded-lg p-2.5 sm:inline-flex"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
            <div className="relative"><button aria-label="Notifications" onClick={() => setNotificationsOpen((value) => !value)} className="neu-button relative rounded-lg p-2.5"><Bell className="h-5 w-5" />{(userRole === 'super_admin' ? platformSummary.openLeads + billingPayments.filter((item) => item.status === 'pending_verification').length : leaves.length + wfhRequests.length + grievances.filter((item) => !['resolved', 'closed'].includes(item.status)).length) > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}</button>{notificationsOpen && <div className="neu-card fixed left-3 right-3 top-16 z-50 w-auto rounded-lg p-4 text-sm sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:z-20 sm:mt-2 sm:w-72"><p className="font-bold">Notifications</p><p className="mt-2 text-slate-600">{userRole === 'super_admin' ? `${billingPayments.filter((item) => item.status === 'pending_verification').length} payment(s) await verification and ${platformSummary.openLeads} sales lead(s) need attention.` : `${leaves.length} leave, ${wfhRequests.length} WFH, and ${grievances.filter((item) => !['resolved', 'closed'].includes(item.status)).length} grievance item(s) need attention.`}</p></div>}</div>
            {userRole === 'admin' ? <button onClick={() => openPage('settings')} title="Open profile settings" className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500 font-bold text-white">{userName.charAt(0).toUpperCase()}</button> : <span title={userName} className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500 font-bold text-white">{userName.charAt(0).toUpperCase()}</span>}
          </div>
        </header>
        {activePage === 'employees' && <label className="relative mb-4 block sm:hidden"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" className="neu-input w-full py-2.5 pl-10 pr-3" /></label>}

        {(notice || error) && <div className={`mb-5 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><span>{error || notice}</span><button aria-label="Dismiss message" onClick={() => { setError(''); setNotice('') }} className="shrink-0"><X className="h-4 w-4" /></button></div>}
        {loading && !employees.length ? <div className="flex min-h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div> : (
          <>
            {activePage === 'dashboard' && (userRole === 'super_admin' ? <PlatformDashboard summary={platformSummary} companies={companies} openPage={openPage} onManage={(company) => void openCompany(company)} /> : <Dashboard summary={summary} attendance={attendance} leaves={leaves} openPage={openPage} canViewBilling={userRole === 'admin'} />)}
            {activePage === 'employees' && <Employees employees={filteredEmployees} showCompany={userRole === 'super_admin'} onAdd={['manager', 'super_admin'].includes(userRole) ? undefined : () => setModal('employee')} />}
            {activePage === 'companies' && <Companies companies={companies} onAdd={() => setModal('company')} onManage={(company) => void openCompany(company)} onStatus={(company, status) => void updateCompany(company, status)} />}
            {activePage === 'company-detail' && selectedCompany && (companyLoading ? <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div> : <CompanyDetail company={selectedCompany} billing={selectedCompanyBilling} employees={selectedCompanyEmployees} auditLogs={selectedCompanyAudit} onBack={() => openPage('companies')} onSave={(values) => void saveCompany(selectedCompany._id, values)} onStatus={(status) => void updateCompany(selectedCompany, status)} onArchive={() => void archiveCompany(selectedCompany)} onAddEmployee={() => setModal('employee')} onEditEmployee={(employee) => { setSelectedEmployee(employee); setModal('employee-edit') }} onEmployeeStatus={(employee, status) => void setEmployeeStatus(employee, status)} onRecordPayment={openPayment} onCreateInvoice={() => setModal('invoice')} />)}
            {activePage === 'leads' && <Leads leads={leads} update={(lead, status) => void updateLead(lead, status)} />}
            {activePage === 'audit' && <PlatformAudit auditLogs={platformAudit} />}
            {activePage === 'attendance' && <Attendance rows={attendance} />}
            {activePage === 'leaves' && <Leaves leaves={leaves} review={reviewLeave} />}
            {activePage === 'wfh' && <WfhRequests requests={wfhRequests} review={reviewWfh} />}
            {activePage === 'grievances' && <Grievances grievances={grievances} resolve={(id) => void resolveGrievance(id)} />}
            {activePage === 'payroll' && <PayrollView payroll={payroll} generate={() => void generatePayroll()} approve={(id) => void approvePayroll(id)} />}
            {activePage === 'work' && <WorkView projects={projects} tasks={tasks} addProject={() => setModal('project')} addTask={() => setModal('task')} />}
            {activePage === 'desktop' && <DesktopView team={desktopTeam} />}
            {activePage === 'geofences' && <Areas areas={areas} onAdd={() => setModal('area')} />}
            {activePage === 'subscriptions' && (userRole === 'super_admin' ? <PlatformSubscriptions plans={plans} subscriptions={tenantSubscriptions} summary={billingSummary} invoices={billingInvoices} payments={billingPayments} gateways={paymentGateways} onManage={(subscription) => { const company = companies.find((item) => item._id === subscription.companyId); if (company) void openCompany(company) }} onRecordPayment={openPayment} onPaymentStatus={(payment, status) => void updatePaymentStatus(payment, status)} onGatewayUpdate={(gateway, values) => void updateGateway(gateway, values)} /> : <Subscriptions token={token} plans={plans} current={currentPlan} summary={currentBillingSummary} invoices={currentInvoices} payments={currentPayments} onSubmitted={async (message) => { setNotice(message); await loadData() }} />)}
            {activePage === 'settings' && <SettingsView userName={userName} apiRoot={API_ROOT} company={companies[0]} token={token} onSaved={async () => { setNotice('Workspace settings saved.'); await loadData() }} />}
          </>
        )}
      </main>
      {modal === 'company' && <CompanyModal close={() => setModal(null)} done={async (message) => { setModal(null); setNotice(message); await loadData() }} />}
      {modal === 'employee' && <EmployeeModal token={token} userRole={userRole} companyId={userRole === 'super_admin' ? selectedCompany?._id : undefined} close={() => setModal(null)} done={async (message) => { setModal(null); setNotice(message); await loadData(); if (selectedCompany) await loadCompanyDetails(selectedCompany._id, false) }} />}
      {modal === 'employee-edit' && selectedEmployee && <EmployeeEditModal token={token} employee={selectedEmployee} close={() => { setModal(null); setSelectedEmployee(null) }} done={async (message) => { setModal(null); setSelectedEmployee(null); setNotice(message); await loadData(); if (selectedCompany) await loadCompanyDetails(selectedCompany._id, false) }} />}
      {modal === 'area' && <AreaModal token={token} close={() => setModal(null)} done={async () => { setModal(null); setNotice('Geofence created successfully.'); await loadData() }} />}
      {modal === 'project' && <ProjectModal token={token} close={() => setModal(null)} done={async () => { setModal(null); setNotice('Project created successfully.'); await loadData() }} />}
      {modal === 'task' && <TaskModal token={token} projects={projects} employees={employees} close={() => setModal(null)} done={async () => { setModal(null); setNotice('Task created successfully.'); await loadData() }} />}
      {modal === 'payment' && selectedInvoice && <PaymentModal token={token} invoice={selectedInvoice} close={() => { setModal(null); setSelectedInvoice(null) }} done={async (message) => { setModal(null); setSelectedInvoice(null); setNotice(message); await loadData(); if (selectedCompany) await loadCompanyDetails(selectedCompany._id, false) }} />}
      {modal === 'invoice' && selectedCompany && <InvoiceModal token={token} company={selectedCompany} subscription={selectedCompanyBilling?.subscription || selectedCompany.subscription || null} close={() => setModal(null)} done={async (message) => { setModal(null); setNotice(message); await loadData(); await loadCompanyDetails(selectedCompany._id, false) }} />}
    </div>
  )
}

function Login({ onAuthenticated }: { onAuthenticated: (token: string, user: { name: string; role: UserRole; company?: { name?: string } }) => void }) {
  const [email, setEmail] = useState('company@example.com')
  const [password, setPassword] = useState('password123')
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
  return <main className="grid min-h-screen place-items-center bg-neu-bg p-4"><form onSubmit={submit} className="neu-card w-full max-w-md rounded-lg p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-500 text-xl font-bold text-white">Q</span><div><h1 className="text-xl font-bold">QHR Administration</h1><p className="text-sm text-slate-500">Company and platform access</p></div></div>{error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<label className="mb-4 block text-sm font-semibold">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="neu-input mt-2 w-full px-4 py-3 font-normal" required /></label><label className="mb-6 block text-sm font-semibold">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="neu-input mt-2 w-full px-4 py-3 font-normal" required /></label><button disabled={loading} className="gradient-button flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold">{loading && <Loader2 className="h-4 w-4 animate-spin" />}Sign in</button><p className="mt-4 text-center text-xs text-slate-500">Your role opens the correct administration console.</p></form></main>
}

function Toolbar({ title, action, onAction, exportRows }: { title: string; action?: string; onAction?: () => void; exportRows?: Array<Record<string, unknown>> }) {
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5"><h2 className="text-lg font-bold">{title}</h2><div className="flex flex-wrap gap-2">{exportRows && <button onClick={() => downloadCsv(title.toLowerCase().replaceAll(' ', '-'), exportRows)} className="neu-button flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"><Download className="h-4 w-4" />Export</button>}{action && onAction && <button onClick={onAction} className="gradient-button flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" />{action}</button>}</div></div>
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`neu-card rounded-lg p-4 sm:p-5 ${className}`}>{children}</section> }

function Dashboard({ summary, attendance, leaves, openPage, canViewBilling }: { summary: Summary; attendance: AttendanceRow[]; leaves: Leave[]; openPage: (page: PageKey) => void; canViewBilling: boolean }) {
  const cards = [
    ['Employees', summary.employees, Users, 'employees'], ['Present today', summary.presentToday, Clock, 'attendance'],
    ['Pending leaves', summary.pendingLeaves, Calendar, 'leaves'], ['Monthly revenue', `Rs.${summary.monthlyRevenue.toLocaleString()}`, TrendingUp, canViewBilling ? 'subscriptions' : 'employees'],
  ] as const
  return <><div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-4">{cards.map(([label, value, Icon, target]) => <button key={label} onClick={() => openPage(target)} className="neu-card rounded-lg p-3 text-left sm:p-5"><div className="mb-3 flex items-center justify-between sm:mb-4"><span className="rounded-lg bg-primary-50 p-1.5 text-primary-500 sm:p-2"><Icon className="h-5 w-5" /></span><span className="text-[11px] font-semibold text-emerald-600 sm:text-xs">Live</span></div><p className="text-2xl font-bold sm:text-3xl">{value}</p><p className="mt-1 text-xs text-slate-500 sm:text-sm">{label}</p></button>)}</div><div className="grid items-start gap-4 sm:gap-5 xl:grid-cols-3"><Card className="xl:col-span-2"><Toolbar title="Today's attendance" /><AttendanceTable rows={attendance} /></Card><Card className="self-start"><Toolbar title="Approval queue" /><div className="space-y-3">{leaves.slice(0, 5).map((leave) => <button key={leave._id} onClick={() => openPage('leaves')} className="neu-inset w-full rounded-lg p-3 text-left"><p className="font-semibold">{leave.employee.firstName} {leave.employee.lastName}</p><p className="text-sm text-slate-500">{leave.leaveType} - {leave.days} day(s)</p></button>)}{!leaves.length && <Empty label="No pending approvals" />}</div></Card></div></>
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

function Employees({ employees, onAdd, showCompany = false }: { employees: Employee[]; onAdd?: () => void; showCompany?: boolean }) {
  const headers = showCompany ? ['Employee', 'Company', 'Department', 'Role', 'Status'] : ['Employee', 'Department', 'Role', 'Status']
  const rows = employees.map((employee) => {
    const base = [<div key="name"><p className="font-semibold">{employee.name}</p><p className="text-xs text-slate-500">{employee.employeeId} - {employee.email}</p></div>]
    if (showCompany) base.push(<div key="company"><p className="font-medium">{employee.company?.name || 'Platform'}</p><p className="text-xs text-slate-500">{employee.company?.code || '-'}</p></div>)
    return [...base, employee.department, employee.role.replace('_', ' '), <Status key="status">{employee.status}</Status>]
  })
  return <Card><Toolbar title={showCompany ? 'Platform employees' : 'Employees'} action={onAdd ? 'Add employee' : undefined} onAction={onAdd} exportRows={employees.map(({ employeeId, name, email, department, designation, status, company }) => ({ employeeId, name, email, company: company?.name || '', companyCode: company?.code || '', department, designation, status }))} /><Table headers={headers} rows={rows} /></Card>
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
function Attendance({ rows }: { rows: AttendanceRow[] }) { return <Card><Toolbar title="Attendance" exportRows={rows.map((row) => ({ employeeId: row.employee.employeeId, employee: `${row.employee.firstName} ${row.employee.lastName}`, checkIn: formatTime(row.attendance?.checkIn?.time), checkOut: formatTime(row.attendance?.checkOut?.time), minutes: row.attendance?.workDuration || 0, status: row.attendance?.status || 'Not checked in' }))} /><AttendanceTable rows={rows} /></Card> }
function AttendanceTable({ rows }: { rows: AttendanceRow[] }) { return <Table headers={['Employee', 'Check in', 'Check out', 'Hours', 'Status']} rows={rows.map((row) => [<div key="employee"><p className="font-semibold">{row.employee.firstName} {row.employee.lastName}</p><p className="text-xs text-slate-500">{row.employee.employeeId}</p></div>, formatTime(row.attendance?.checkIn?.time), formatTime(row.attendance?.checkOut?.time), row.attendance?.workDuration ? `${(row.attendance.workDuration / 60).toFixed(1)}h` : '-', <Status key="status">{row.attendance?.isLate ? 'Late' : row.attendance?.status || 'Not checked in'}</Status>])} /> }

function Leaves({ leaves, review }: { leaves: Leave[]; review: (id: string, action: 'approve' | 'reject') => void }) {
  return <Card><Toolbar title="Leave requests" exportRows={leaves.map((leave) => ({ employee: `${leave.employee.firstName} ${leave.employee.lastName}`, type: leave.leaveType, start: leave.startDate, end: leave.endDate, days: leave.days, status: leave.status }))} /><Table headers={['Employee', 'Type', 'Dates', 'Days', 'Status', 'Actions']} rows={leaves.map((leave) => [<div key="employee"><p className="font-semibold">{leave.employee.firstName} {leave.employee.lastName}</p><p className="text-xs text-slate-500">{leave.employee.employeeId}</p></div>, <div key="type"><p className="capitalize">{leave.leaveType}</p>{leave.reason && <p className="max-w-56 truncate text-xs text-slate-500" title={leave.reason}>{leave.reason}</p>}</div>, `${leave.startDate.slice(0, 10)} to ${leave.endDate.slice(0, 10)}`, leave.days, <Status key="status">{leave.status}</Status>, <div key="actions" className="flex gap-2"><button aria-label="Approve leave" title="Approve" onClick={() => review(leave._id, 'approve')} className="neu-button rounded-lg p-2.5 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></button><button aria-label="Reject leave" title="Reject" onClick={() => review(leave._id, 'reject')} className="neu-button rounded-lg p-2.5 text-red-600"><XCircle className="h-5 w-5" /></button></div>])} /></Card>
}

function WfhRequests({ requests, review }: { requests: WfhRequest[]; review: (id: string, action: 'approve' | 'reject') => void }) { return <Card><Toolbar title="WFH requests" exportRows={requests.map((request) => ({ employee: `${request.employee.firstName} ${request.employee.lastName}`, start: request.startDate, end: request.endDate, location: request.workFromLocation, reason: request.reason, status: request.status }))} /><Table headers={['Employee', 'Dates', 'Location', 'Reason', 'Status', 'Actions']} rows={requests.map((request) => [<div key="employee"><p className="font-semibold">{request.employee.firstName} {request.employee.lastName}</p><p className="text-xs text-slate-500">{request.employee.employeeId}</p></div>, `${String(request.startDate).slice(0, 10)} to ${String(request.endDate).slice(0, 10)}`, request.workFromLocation || '-', <p key="reason" className="max-w-56 truncate" title={request.reason}>{request.reason}</p>, <Status key="status">{request.status}</Status>, <div key="actions" className="flex gap-2"><button aria-label="Approve WFH" title="Approve" onClick={() => review(request._id, 'approve')} className="neu-button rounded-lg p-2.5 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></button><button aria-label="Reject WFH" title="Reject" onClick={() => review(request._id, 'reject')} className="neu-button rounded-lg p-2.5 text-red-600"><XCircle className="h-5 w-5" /></button></div>])} /></Card> }

function Grievances({ grievances, resolve }: { grievances: Grievance[]; resolve: (id: string) => void }) { return <Card><Toolbar title="Grievances" exportRows={grievances.map(({ ticketNumber, employee, subject, category, priority, status, createdAt }) => ({ ticketNumber, employee: employee ? `${employee.firstName} ${employee.lastName}` : 'Anonymous', subject, category, priority, status, createdAt }))} />{grievances.length ? <Table headers={['Ticket', 'Employee', 'Subject', 'Priority', 'Status', 'Action']} rows={grievances.map((grievance) => [<div key="ticket"><p className="font-semibold">{grievance.ticketNumber}</p><p className="text-xs text-slate-500">{new Date(grievance.createdAt).toLocaleDateString()}</p></div>, grievance.employee ? `${grievance.employee.firstName} ${grievance.employee.lastName}` : 'Anonymous', <div key="subject"><p className="font-semibold">{grievance.subject}</p><p className="text-xs text-slate-500">{grievance.category}</p></div>, grievance.priority, <Status key="status">{grievance.status}</Status>, ['resolved', 'closed'].includes(grievance.status) ? <span key="done" className="text-xs text-slate-500">Complete</span> : <button key="resolve" onClick={() => resolve(grievance._id)} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold">Resolve</button>])} /> : <Empty label="No grievances require attention" />}</Card> }

function PayrollView({ payroll, generate, approve }: { payroll: Payroll[]; generate: () => void; approve: (id: string) => void }) {
  return <Card><Toolbar title="Payroll" action="Generate payroll" onAction={generate} exportRows={payroll.map((item) => ({ employeeId: item.employee?.employeeId, employee: `${item.employee?.firstName || ''} ${item.employee?.lastName || ''}`.trim(), period: item.period, gross: item.gross, deductions: item.deductions, net: item.net, status: item.status }))} /><Table headers={['Employee', 'Period', 'Gross', 'Deductions', 'Net pay', 'Status', 'Action']} rows={payroll.map((item) => [<div key="employee"><p className="font-semibold">{item.employee?.firstName} {item.employee?.lastName}</p><p className="text-xs text-slate-500">{item.employee?.employeeId}</p></div>, item.period, `Rs.${item.gross.toLocaleString()}`, `Rs.${item.deductions.toLocaleString()}`, `Rs.${item.net.toLocaleString()}`, <Status key="status">{item.status}</Status>, item.status === 'draft' ? <button key="approve" onClick={() => approve(item._id)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Approve</button> : <span key="published" className="text-xs text-slate-500">Published</span>])} /></Card>
}

function WorkView({ projects, tasks, addProject, addTask }: { projects: Project[]; tasks: Task[]; addProject: () => void; addTask: () => void }) {
  const projectNames = new Map(projects.map((project) => [project._id, project.name]))
  return <div className="grid gap-5 xl:grid-cols-2"><Card><Toolbar title="Projects" action="Add project" onAction={addProject} exportRows={projects.map(({ name, description, status }) => ({ name, description, status }))} /><Table headers={['Project', 'Description', 'Status']} rows={projects.map((project) => [project.name, project.description || '-', <Status key="status">{project.status}</Status>])} /></Card><Card><Toolbar title="Tasks" action="Add task" onAction={addTask} exportRows={tasks.map(({ title, projectId, status, priority, dueDate }) => ({ title, project: projectNames.get(projectId || '') || '', status, priority, dueDate }))} /><Table headers={['Task', 'Project', 'Priority', 'Status']} rows={tasks.map((task) => [task.title, projectNames.get(task.projectId || '') || 'No project', task.priority, <Status key="status">{task.status}</Status>])} /></Card></div>
}

function DesktopView({ team }: { team: DesktopMember[] }) {
  return <Card><Toolbar title="Desktop activity" exportRows={team.map((item) => ({ employeeId: item.employee.employeeId, employee: `${item.employee.firstName} ${item.employee.lastName}`, activeMinutes: Math.round((item.activity?.summary?.totalActiveSeconds || 0) / 60), idleMinutes: Math.round((item.activity?.summary?.totalIdleSeconds || 0) / 60), snapshots: item.activity?.summary?.snapshots || 0, deviceStatus: item.states[0]?.status || 'offline' }))} /><Table headers={['Employee', 'Active', 'Idle', 'Snapshots', 'Device']} rows={team.map((item) => [<div key="employee"><p className="font-semibold">{item.employee.firstName} {item.employee.lastName}</p><p className="text-xs text-slate-500">{item.employee.employeeId}</p></div>, `${Math.round((item.activity?.summary?.totalActiveSeconds || 0) / 60)} min`, `${Math.round((item.activity?.summary?.totalIdleSeconds || 0) / 60)} min`, item.activity?.summary?.snapshots || 0, <Status key="status">{item.states[0]?.status || 'offline'}</Status>])} /></Card>
}

function Areas({ areas, onAdd }: { areas: Area[]; onAdd: () => void }) { return <Card><Toolbar title="Geofences" action="Add geofence" onAction={onAdd} exportRows={areas.map(({ name, address, latitude, longitude, radiusMeters }) => ({ name, address, latitude, longitude, radiusMeters }))} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{areas.map((area) => <div key={area._id} className="neu-inset rounded-lg p-4"><MapPin className="mb-3 h-6 w-6 text-primary-500" /><p className="font-bold">{area.name}</p><p className="mt-1 min-h-10 text-sm text-slate-500">{area.address || `${area.latitude}, ${area.longitude}`}</p><div className="mt-3 flex justify-between text-sm"><span>{area.radiusMeters}m radius</span><Status>{area.active === false ? 'Inactive' : 'Active'}</Status></div></div>)}</div></Card> }

function Subscriptions({ token, plans, current, summary, invoices, payments, onSubmitted }: { token: string; plans: SubscriptionPlan[]; current: Subscription | null; summary: CompanyBillingSummary | null; invoices: BillingInvoice[]; payments: BillingPayment[]; onSubmitted: (message: string) => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const openInvoices = invoices.filter((invoice) => invoice.amountDue > 0)
  const manualMode = current && current.billingMode !== 'automatic'
  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setFormError('')
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const result = await api<{ message: string }>('/subscriptions/manual-payments', { method: 'POST', body: JSON.stringify({ ...values, amount: Number(values.amount) }) }, token)
      form.reset()
      await onSubmitted(result.message)
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Payment could not be submitted') } finally { setSubmitting(false) }
  }
  return <div className="space-y-5">
    <Card><Toolbar title="Current subscription" />{current && <><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Plan" value={current.plan} /><Metric label="Billing mode" value={billingModeLabel(current.billingMode)} /><Metric label="Paid seats" value={`${current.paidSeats} + 1 free admin`} /><Metric label="Next renewal" value={formatCurrency(current.renewalAmount)} /></div><div className="mt-4 rounded-lg border border-slate-200 bg-white/40 p-3 text-sm"><strong>{current.automaticSuspensionEnabled ? 'Automatic renewal protection:' : 'Manual billing:'}</strong> {current.automaticSuspensionEnabled ? `Payment failure receives 15 days of grace before paid users pause. Next renewal: ${formatDate(current.nextRenewalAt)}.` : 'Invoices and reminders are tracked, but billing never automatically pauses your account.'}</div></>}</Card>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5"><Metric label="Collected" value={formatCurrency(summary?.collectedAmount || 0)} /><Metric label="Outstanding" value={formatCurrency(summary?.outstandingAmount || 0)} /><Metric label="Awaiting verification" value={formatCurrency(summary?.pendingVerificationAmount || 0)} /><Metric label="Account credit" value={formatCurrency(summary?.creditBalance || 0)} /><Metric label="Renewal date" value={formatDate(summary?.nextRenewalAt)} /></div>
    {manualMode && openInvoices.length > 0 && <Card><Toolbar title="Submit manual payment" /><form onSubmit={submitPayment} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{formError && <p className="text-sm text-red-600 md:col-span-2 xl:col-span-4">{formError}</p>}<label className="text-sm font-semibold">Invoice<select name="invoiceId" required className={`${fieldClass} mt-1`}>{openInvoices.map((invoice) => <option key={invoice._id} value={invoice._id}>{invoice.invoiceNumber} - {formatCurrency(invoice.amountDue)} due</option>)}</select></label><label className="text-sm font-semibold">Amount paid<input name="amount" type="number" min="0.01" step="0.01" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Method<select name="method" defaultValue="bank_transfer" className={`${fieldClass} mt-1`}><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="manual_gateway">Manual online gateway</option></select></label><label className="text-sm font-semibold">UTR / reference<input name="reference" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold md:col-span-2 xl:col-span-4">Proof link or notes<input name="proofUrl" placeholder="Optional payment proof URL" className={`${fieldClass} mt-1`} /></label><button disabled={submitting} className="gradient-button rounded-lg px-4 py-3 font-semibold md:col-span-2 xl:col-span-4">{submitting ? 'Submitting...' : 'Submit for verification'}</button></form></Card>}
    <Card><Toolbar title="Invoices" exportRows={invoices.map(({ invoiceNumber, issueDate, dueDate, total, amountPaid, amountDue, status }) => ({ invoiceNumber, issueDate, dueDate, total, amountPaid, amountDue, status }))} /><Table headers={['Invoice', 'Issued', 'Due', 'Total', 'Paid', 'Balance', 'Status']} rows={invoices.map((invoice) => [invoice.invoiceNumber, formatDate(invoice.issueDate), formatDate(invoice.dueDate), formatCurrency(invoice.total), formatCurrency(invoice.amountPaid), formatCurrency(invoice.amountDue), <Status key="status">{invoice.status}</Status>])} /></Card>
    <Card><Toolbar title="Payment history" /><Table headers={['Date', 'Invoice', 'Method', 'Reference', 'Amount', 'Status']} rows={payments.map((payment) => [formatDate(payment.createdAt), payment.invoiceNumber, payment.method.replaceAll('_', ' '), payment.reference || '-', formatCurrency(payment.amount), <Status key="status">{payment.status.replaceAll('_', ' ')}</Status>])} /></Card>
    <div className="grid gap-4 md:grid-cols-3">{plans.map((plan) => <Card key={plan.name}><p className="text-lg font-bold">{plan.name}</p><p className="my-4 text-3xl font-bold text-primary-500">{plan.pricePerUser === null ? 'Custom' : formatCurrency(plan.pricePerUser)}<span className="text-sm font-normal text-slate-500">{plan.pricePerUser !== null ? '/paid user/month' : ''}</span></p><p className="text-sm text-slate-500">One Company Admin is free. {plan.annualDiscountPercent ? `${plan.annualDiscountPercent}% yearly discount.` : 'Monthly or yearly billing.'}</p></Card>)}</div>
  </div>
}

function PlatformSubscriptions({ plans, subscriptions, summary, invoices, payments, gateways, onManage, onRecordPayment, onPaymentStatus, onGatewayUpdate }: { plans: SubscriptionPlan[]; subscriptions: TenantSubscription[]; summary: PlatformBillingSummary; invoices: BillingInvoice[]; payments: BillingPayment[]; gateways: PaymentGateway[]; onManage: (subscription: TenantSubscription) => void; onRecordPayment: (invoice: BillingInvoice) => void; onPaymentStatus: (payment: BillingPayment, status: 'cleared' | 'rejected' | 'reversed') => void; onGatewayUpdate: (gateway: PaymentGateway, values: Partial<Pick<PaymentGateway, 'enabled' | 'isDefault' | 'mode'>>) => void }) {
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5"><Metric label="Collected" value={formatCurrency(summary.collectedAmount)} /><Metric label="Outstanding" value={formatCurrency(summary.pendingAmount)} /><Metric label="Awaiting verification" value={formatCurrency(summary.pendingVerificationAmount)} /><Metric label="Upcoming 30 days" value={formatCurrency(summary.upcomingAmount)} /><Metric label="Renewal book" value={formatCurrency(summary.renewalAmount)} /></div>
    <Card><Toolbar title="Payment gateways" /><Table headers={['Gateway', 'Environment', 'Enabled', 'Default']} rows={gateways.map((gateway) => [<div key="gateway"><p className="font-semibold">{gateway.name}</p><p className="text-xs text-slate-500">Credentials are stored server-side</p></div>, <select key="mode" aria-label={`${gateway.name} environment`} value={gateway.mode} onChange={(event) => onGatewayUpdate(gateway, { mode: event.target.value as 'test' | 'live' })} className="neu-input rounded-lg px-3 py-2 text-sm"><option value="test">Test</option><option value="live">Live</option></select>, <label key="enabled" className="inline-flex items-center gap-2"><input type="checkbox" checked={gateway.enabled} onChange={(event) => onGatewayUpdate(gateway, { enabled: event.target.checked })} className="h-4 w-4 accent-orange-600" /><span>{gateway.enabled ? 'Enabled' : 'Disabled'}</span></label>, <label key="default" className="inline-flex items-center gap-2"><input type="radio" name="defaultGateway" checked={gateway.isDefault} disabled={!gateway.enabled} onChange={() => onGatewayUpdate(gateway, { isDefault: true })} className="h-4 w-4 accent-orange-600" /><span>{gateway.isDefault ? 'Default' : 'Available'}</span></label>])} /></Card>
    <Card><Toolbar title="Company billing" exportRows={subscriptions.map(({ companyCode, companyName, billingMode, paidSeats, renewalAmount, nextRenewalAt, outstandingAmount, status }) => ({ companyCode, companyName, billingMode, paidSeats, renewalAmount, nextRenewalAt, outstandingAmount, status }))} /><Table headers={['Company', 'Billing', 'Seats', 'Next renewal', 'Renewal amount', 'Outstanding', 'Status', 'Action']} rows={subscriptions.map((subscription) => [<div key="company"><p className="font-semibold">{subscription.companyName}</p><p className="text-xs text-slate-500">{subscription.companyCode} - {subscription.plan}</p></div>, <div key="mode"><p>{billingModeLabel(subscription.billingMode)}</p><p className="text-xs text-slate-500">{subscription.billingMode === 'automatic' ? subscription.paymentGateway || 'Gateway required' : 'No automatic pause'}</p></div>, `${subscription.paidSeats} + 1`, <div key="renewal"><p>{formatDate(subscription.nextRenewalAt)}</p><p className="text-xs capitalize text-slate-500">{subscription.billingCycle}</p></div>, formatCurrency(subscription.renewalAmount), formatCurrency(subscription.outstandingAmount), <Status key="status">{subscription.status}</Status>, <button key="action" onClick={() => onManage(subscription)} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold">Manage</button>])} /></Card>
    <Card><Toolbar title="Invoice ledger" exportRows={invoices.map(({ companyCode, companyName, invoiceNumber, dueDate, total, amountPaid, amountDue, status }) => ({ companyCode, companyName, invoiceNumber, dueDate, total, amountPaid, amountDue, status }))} /><Table headers={['Company', 'Invoice', 'Due', 'Total', 'Paid', 'Balance', 'Status', 'Action']} rows={invoices.map((invoice) => [<div key="company"><p className="font-semibold">{invoice.companyName}</p><p className="text-xs text-slate-500">{invoice.companyCode}</p></div>, invoice.invoiceNumber, formatDate(invoice.dueDate), formatCurrency(invoice.total), formatCurrency(invoice.amountPaid), formatCurrency(invoice.amountDue), <Status key="status">{invoice.status}</Status>, invoice.amountDue > 0 ? <button key="payment" onClick={() => onRecordPayment(invoice)} className="gradient-button rounded-lg px-3 py-2 text-xs font-semibold">Record payment</button> : <span key="settled" className="text-xs text-slate-500">Settled</span>])} /></Card>
    <Card><Toolbar title="Payment confirmations" exportRows={payments.map(({ companyCode, companyName, invoiceNumber, amount, method, reference, status, createdAt }) => ({ companyCode, companyName, invoiceNumber, amount, method, reference, status, createdAt }))} /><Table headers={['Company', 'Invoice', 'Submitted', 'Method', 'Reference', 'Amount', 'Status', 'Action']} rows={payments.map((payment) => [<div key="company"><p className="font-semibold">{payment.companyName}</p><p className="text-xs text-slate-500">{payment.companyCode}</p></div>, payment.invoiceNumber, formatDate(payment.createdAt), payment.method.replaceAll('_', ' '), payment.reference || '-', formatCurrency(payment.amount), <Status key="status">{payment.status.replaceAll('_', ' ')}</Status>, payment.status === 'pending_verification' ? <div key="actions" className="flex gap-2"><button onClick={() => onPaymentStatus(payment, 'cleared')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Confirm</button><button onClick={() => onPaymentStatus(payment, 'rejected')} className="neu-button rounded-lg px-3 py-2 text-xs font-semibold text-red-600">Reject</button></div> : payment.status === 'cleared' ? <button key="reverse" onClick={() => window.confirm('Reverse this cleared payment and reopen the invoice balance?') && onPaymentStatus(payment, 'reversed')} className="neu-button rounded-lg px-3 py-2 text-xs font-semibold text-red-600">Reverse</button> : <span key="done" className="text-xs text-slate-500">Complete</span>])} /></Card>
    <div className="grid gap-4 md:grid-cols-3">{plans.map((plan) => <Card key={plan.name}><div className="flex items-center justify-between"><p className="text-lg font-bold">{plan.name}</p><Status>{plan.status}</Status></div><p className="my-4 text-3xl font-bold text-primary-500">{plan.pricePerUser === null ? 'Custom' : formatCurrency(plan.pricePerUser)}<span className="text-sm font-normal text-slate-500">{plan.pricePerUser !== null ? '/paid user/month' : ''}</span></p><p className="text-sm text-slate-500">1 free Company Admin{plan.annualDiscountPercent ? ` - ${plan.annualDiscountPercent}% yearly discount` : ''}</p></Card>)}</div>
  </div>
}

function SettingsView({ userName, apiRoot, company, token, onSaved }: { userName: string; apiRoot: string; company?: Company; token: string; onSaved: () => Promise<void> }) { const [settings, setSettings] = useState({ gpsTracking: company?.settings?.gpsTracking ?? true, autoCheckIn: company?.settings?.autoCheckIn ?? true, leaveApproval: company?.settings?.leaveApproval ?? true, desktopMonitoring: company?.settings?.desktopMonitoring ?? true }); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); async function save() { setSaving(true); setError(''); try { await api('/companies/settings', { method: 'PATCH', body: JSON.stringify(settings) }, token); await onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save settings') } finally { setSaving(false) } } return <Card><Toolbar title="Workspace settings" /><div className="mb-5 rounded-lg border border-slate-200 p-4"><p className="font-semibold">{company?.name || 'Company workspace'} - signed in as {userName}</p><p className="mt-1 break-all text-sm text-slate-500">API: {apiRoot}</p></div>{error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="grid gap-3 md:grid-cols-2">{Object.entries(settings).map(([key, enabled]) => <label key={key} className="neu-inset flex cursor-pointer items-center justify-between rounded-lg p-4"><span className="font-semibold">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())}</span><input type="checkbox" checked={enabled} onChange={() => setSettings((current) => ({ ...current, [key]: !enabled }))} className="h-5 w-5 accent-orange-600" /></label>)}</div><button disabled={saving} onClick={() => void save()} className="gradient-button mt-5 rounded-lg px-5 py-3 font-semibold disabled:opacity-60">{saving ? 'Saving...' : 'Save settings'}</button></Card> }

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const firstRecord = (page - 1) * pageSize
  const visibleRows = rows.slice(firstRecord, firstRecord + pageSize)

  useEffect(() => { setPage((current) => Math.min(current, totalPages)) }, [totalPages])

  if (!rows.length) return <Empty label="No records found" />
  return <div>
    <div className="-mx-2 overflow-x-auto px-2 pb-2">
      <table className="w-full min-w-[680px] text-left text-xs sm:text-sm">
        <thead><tr className="border-b border-slate-300/70 text-slate-500">{headers.map((header, index) => <th key={header} className={`whitespace-nowrap px-3 py-3 font-semibold ${index === 0 ? 'sticky left-0 z-10 bg-neu-bg shadow-[7px_0_9px_-9px_rgba(61,50,41,0.65)]' : ''}`}>{header}</th>)}</tr></thead>
        <tbody>{visibleRows.map((row, rowIndex) => <tr key={firstRecord + rowIndex} className="border-b border-slate-200/70 last:border-0">{row.map((cell, index) => <td key={index} className={`whitespace-nowrap px-3 py-4 align-middle ${index === 0 ? 'sticky left-0 z-[1] bg-neu-bg shadow-[7px_0_9px_-9px_rgba(61,50,41,0.65)]' : ''}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-300/60 pt-4 text-xs text-slate-500 sm:text-sm">
      <div className="flex items-center gap-2"><span>Rows</span><select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="neu-input rounded-lg px-2 py-1.5 text-sm text-slate-700"><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select><span>{firstRecord + 1}-{Math.min(firstRecord + pageSize, rows.length)} of {rows.length}</span></div>
      <div className="flex items-center gap-2"><button aria-label="Previous page" title="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="neu-button rounded-lg p-2 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-20 text-center font-semibold text-slate-700">Page {page} of {totalPages}</span><button aria-label="Next page" title="Next page" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="neu-button rounded-lg p-2 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div>
    </div>
  </div>
}
function Empty({ label }: { label: string }) { return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{label}</div> }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="neu-inset rounded-lg p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div> }

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/40 p-3 sm:p-4"><div className="w-full max-w-lg rounded-lg bg-neu-bg p-4 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><button aria-label="Close dialog" onClick={close}><X className="h-5 w-5" /></button></div>{children}</div></div> }
const fieldClass = 'neu-input w-full px-3 py-2.5'

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

function EmployeeModal({ token, userRole, companyId, close, done }: { token: string; userRole: UserRole; companyId?: string; close: () => void; done: (message: string) => Promise<void> }) { const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const roleOptions = userRole === 'super_admin' ? (companyId ? ['employee', 'manager', 'hr', 'admin'] : ['employee', 'manager', 'hr', 'admin', 'super_admin']) : userRole === 'admin' ? ['employee', 'manager', 'hr', 'admin'] : ['employee', 'manager', 'hr']; async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); const form = new FormData(event.currentTarget); const passcode = String(form.get('passcode') || ''); const values = { ...Object.fromEntries(form), ...(companyId ? { companyId } : {}) }; try { const result = await api<{ employee: Employee }>('/employees', { method: 'POST', body: JSON.stringify(values) }, token); await done(`${result.employee.name} created. Mobile login: ${result.employee.employeeId} / ${passcode}`) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create employee') } finally { setSaving(false) } } return <Modal title="Add employee" close={close}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}<label className="text-sm font-semibold">Employee ID<input name="employeeId" placeholder="EMP002" required className={`${fieldClass} mt-1 uppercase`} /></label><label className="text-sm font-semibold">Mobile passcode<input name="passcode" inputMode="numeric" minLength={4} defaultValue="1234" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">First name<input name="firstName" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Last name<input name="lastName" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Email<input name="email" type="email" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Role<select name="role" defaultValue="employee" className={`${fieldClass} mt-1 capitalize`}>{roleOptions.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select></label><label className="text-sm font-semibold">Department<input name="department" defaultValue="Operations" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Designation<input name="designation" defaultValue="Employee" className={`${fieldClass} mt-1`} /></label><button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2">{saving ? 'Creating...' : 'Create employee'}</button></form></Modal> }

function EmployeeEditModal({ token, employee, close, done }: { token: string; employee: Employee; close: () => void; done: (message: string) => Promise<void> }) { const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const roles = employee.role === 'super_admin' ? ['employee', 'manager', 'hr', 'admin', 'super_admin'] : ['employee', 'manager', 'hr', 'admin']; async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); try { const result = await api<{ employee: Employee }>(`/employees/${employee._id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }, token); await done(`${result.employee.name} updated successfully.`) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update employee') } finally { setSaving(false) } } return <Modal title={`Edit ${employee.name}`} close={close}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}<label className="text-sm font-semibold">First name<input name="firstName" defaultValue={employee.firstName || ''} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Last name<input name="lastName" defaultValue={employee.lastName || ''} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Email<input name="email" type="email" defaultValue={employee.email} required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Role<select name="role" defaultValue={employee.role} className={`${fieldClass} mt-1 capitalize`}>{roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select></label><label className="text-sm font-semibold">Status<select name="status" defaultValue={employee.status} className={`${fieldClass} mt-1`}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label className="text-sm font-semibold">Department<input name="department" defaultValue={employee.department} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Designation<input name="designation" defaultValue={employee.designation} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">New passcode <span className="font-normal text-slate-500">(leave blank to keep current)</span><input name="passcode" minLength={4} className={`${fieldClass} mt-1`} /></label><button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2">{saving ? 'Saving...' : 'Save employee'}</button></form></Modal> }

function ProjectModal({ token, close, done }: { token: string; close: () => void; done: () => Promise<void> }) { const [error, setError] = useState(''); const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); try { await api('/projects', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }, token); await done() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create project') } finally { setSaving(false) } } return <Modal title="Add project" close={close}><form onSubmit={submit} className="grid gap-4">{error && <p className="text-sm text-red-600">{error}</p>}<label className="text-sm font-semibold">Project name<input name="name" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Description<textarea name="description" rows={4} className={`${fieldClass} mt-1`} /></label><button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold">{saving ? 'Creating...' : 'Create project'}</button></form></Modal> }

function TaskModal({ token, projects, employees, close, done }: { token: string; projects: Project[]; employees: Employee[]; close: () => void; done: () => Promise<void> }) { const [error, setError] = useState(''); const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); try { await api('/tasks', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }, token); await done() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create task') } finally { setSaving(false) } } return <Modal title="Add task" close={close}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}<label className="text-sm font-semibold sm:col-span-2">Task title<input name="title" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Project<select name="projectId" className={`${fieldClass} mt-1`}><option value="">No project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label><label className="text-sm font-semibold">Assign to<select name="assignedTo" className={`${fieldClass} mt-1`}>{employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.name}</option>)}</select></label><label className="text-sm font-semibold">Priority<select name="priority" defaultValue="medium" className={`${fieldClass} mt-1`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label className="text-sm font-semibold">Due date<input name="dueDate" type="date" className={`${fieldClass} mt-1`} /></label><button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2">{saving ? 'Creating...' : 'Create task'}</button></form></Modal> }

function AreaModal({ token, close, done }: { token: string; close: () => void; done: () => void }) { const [error, setError] = useState(''); const [saving, setSaving] = useState(false); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); const form = Object.fromEntries(new FormData(event.currentTarget)); try { await api('/attendance-areas', { method: 'POST', body: JSON.stringify({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), radiusMeters: Number(form.radiusMeters) }) }, token); await done() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create geofence') } finally { setSaving(false) } } return <Modal title="Add geofence" close={close}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}<label className="text-sm font-semibold sm:col-span-2">Name<input name="name" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Address<input name="address" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Latitude<input name="latitude" type="number" step="any" defaultValue="19.076" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold">Longitude<input name="longitude" type="number" step="any" defaultValue="72.8777" required className={`${fieldClass} mt-1`} /></label><label className="text-sm font-semibold sm:col-span-2">Radius (metres)<input name="radiusMeters" type="number" min="25" defaultValue="150" required className={`${fieldClass} mt-1`} /></label><button disabled={saving} className="gradient-button rounded-lg py-3 font-semibold sm:col-span-2">{saving ? 'Creating...' : 'Create geofence'}</button></form></Modal> }
