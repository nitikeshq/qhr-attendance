import type { ComponentType } from 'react'
import {
  Banknote,
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
  Fingerprint,
  KanbanSquare,
  Laptop,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  ScrollText,
  ShieldCheck,
  Smartphone,
  UserCog,
  Users,
} from 'lucide-react'

export type IconType = ComponentType<{ className?: string }>

export const navLinks = [
  { label: 'Platform', href: '#platform' },
  { label: 'Teams', href: '#teams' },
  { label: 'Security', href: '#security' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

/** Honest, checkable claims only — no certifications we do not hold. */
export const heroProof = [
  { value: '8', label: 'Operational modules' },
  { value: '3', label: 'Employee surfaces' },
  { value: '5 min', label: 'Self-serve setup' },
]

export const modules: Array<{
  icon: IconType
  name: string
  summary: string
  points: string[]
}> = [
  {
    icon: MapPin,
    name: 'Attendance and geofencing',
    summary:
      'Location-aware check-in for field and office teams, with multiple work locations and an offline queue.',
    points: ['Per-location geofences', 'Matched location on every record', 'Manual review and correction'],
  },
  {
    icon: CalendarCheck,
    name: 'Leave and WFH',
    summary:
      'Multi-level approval that escalates to HR for long or unpaid absence, with balances restored on cancellation.',
    points: ['Manager then HR escalation', 'Overlap detection', 'Balance and holiday calendars'],
  },
  {
    icon: Banknote,
    name: 'Payroll inputs and payslips',
    summary:
      'Salary structures, statutory bases, adjustments, and loss-of-pay driven by the attendance record itself.',
    points: ['PF and ESI bases with overrides', 'Manual TDS and reimbursements', 'Publish, pay, and download'],
  },
  {
    icon: Building2,
    name: 'Org structure',
    summary:
      'Departments with hierarchy, designations, and reporting lines so approvals and reports follow the real org.',
    points: ['Department hierarchy', 'Designations', 'Reporting manager chains'],
  },
  {
    icon: UserCog,
    name: 'Roles and permissions',
    summary:
      'Role defaults for admin, HR, manager, and employee, plus per-user grants and revokes on a 22-key catalogue.',
    points: ['Role-based defaults', 'Custom per-user overrides', 'Tenant-scoped boundaries'],
  },
  {
    icon: KanbanSquare,
    name: 'Work management',
    summary:
      'Projects gate tasks, tasks move across a ranked board, and every task carries threaded comments and watchers.',
    points: ['Kanban board with ranking', 'Comments, mentions, watchers', 'Activity history'],
  },
  {
    icon: Package,
    name: 'Asset register',
    summary:
      'Assign hardware to employees, capture acknowledgement, and record returns without pulling in finance.',
    points: ['Assign and return', 'Employee acknowledgement', 'Custody history'],
  },
  {
    icon: Laptop,
    name: 'Desktop work hours',
    summary:
      'Productive and idle time for desk and remote staff, under explicit user control and with no content capture.',
    points: ['Start and stop by the employee', 'Idle detection', 'No keystroke or screen content'],
  },
]

export const surfaces: Array<{ icon: IconType; name: string; copy: string }> = [
  {
    icon: Smartphone,
    name: 'Employee mobile app',
    copy: 'Check in and out, request leave or WFH, raise grievances, and read payslips.',
  },
  {
    icon: BarChart3,
    name: 'Admin and HR console',
    copy: 'Dashboards, approvals, payroll runs, org masters, permissions, and exports.',
  },
  {
    icon: Laptop,
    name: 'Desktop companion',
    copy: 'Work-hour tracking for remote and desk teams, started and stopped by the employee.',
  },
]

export const personas: Array<{
  icon: IconType
  role: string
  headline: string
  outcomes: string[]
}> = [
  {
    icon: Users,
    role: 'HR leads',
    headline: 'One record instead of four spreadsheets',
    outcomes: [
      'Attendance, leave, and payroll inputs stay in sync',
      'Policies, shifts, and holidays configured once',
      'Guided onboarding checklist for every new company',
    ],
  },
  {
    icon: ClipboardList,
    role: 'Managers',
    headline: 'Approvals that do not need chasing',
    outcomes: [
      'Team attendance and pending requests in one queue',
      'Escalation rules handle long and unpaid leave',
      'Project boards show who is working on what',
    ],
  },
  {
    icon: FileSpreadsheet,
    role: 'Finance and payroll',
    headline: 'Payroll inputs that reconcile',
    outcomes: [
      'Loss of pay derived from the attendance record',
      'Statutory bases, caps, and per-employee overrides',
      'Reimbursements kept out of salary gross and PF or ESI',
    ],
  },
  {
    icon: Smartphone,
    role: 'Employees',
    headline: 'Self-service, not email requests',
    outcomes: [
      'Check in from the field or the office',
      'Apply for leave and WFH and track the decision',
      'Download payslips and acknowledge assets',
    ],
  },
]

export const rollout: Array<{ step: string; title: string; copy: string }> = [
  {
    step: '01',
    title: 'Register and activate',
    copy: 'Create the tenant and admin account in six guided steps, then confirm the emailed activation code.',
  },
  {
    step: '02',
    title: 'Complete guided setup',
    copy: 'The console opens a checklist covering departments, designations, shifts, holidays, and leave types.',
  },
  {
    step: '03',
    title: 'Add people and permissions',
    copy: 'Invite HR and managers, set reporting lines, and grant or revoke individual permissions.',
  },
  {
    step: '04',
    title: 'Configure locations and payroll',
    copy: 'Define work locations with geofences, then set salary structures and statutory policy.',
  },
  {
    step: '05',
    title: 'Go live',
    copy: 'Employees start checking in from mobile while HR reviews dashboards and runs payroll.',
  },
]

export const securityPoints: Array<{ icon: IconType; title: string; copy: string }> = [
  {
    icon: ShieldCheck,
    title: 'Tenant isolation',
    copy: 'Every request is scoped to the signed-in company. Cross-tenant reads are rejected, not filtered client-side.',
  },
  {
    icon: Fingerprint,
    title: 'Hardened sessions',
    copy: 'Session tokens are stored hashed, refresh tokens rotate, and configurable TTLs bound how long access lives.',
  },
  {
    icon: UserCog,
    title: 'Least privilege',
    copy: 'Role defaults plus per-user grants and revokes, so a manager never inherits payroll or billing access.',
  },
  {
    icon: ScrollText,
    title: 'Audit trail',
    copy: 'Administrative actions are recorded with request IDs so a change can be traced back to a person and a call.',
  },
  {
    icon: Laptop,
    title: 'Privacy-first tracking',
    copy: 'Desktop monitoring records time and application names only. No keystrokes, no screenshots, no content.',
  },
  {
    icon: ShieldCheck,
    title: 'Abuse controls',
    copy: 'A strict password policy, reuse rejection, rate limiting, and an origin allow-list that fails closed.',
  },
]

export const pricingPlans: Array<{
  name: string
  price: string
  cadence: string
  audience: string
  description: string
  features: string[]
  cta: string
  href: string
  highlighted: boolean
}> = [
  {
    name: 'Starter',
    price: 'Free',
    cadence: 'per employee / month',
    audience: 'Up to 5 employees',
    description: 'Prove out attendance and leave without a rollout project.',
    features: ['Geofenced attendance', 'Employee mobile app', 'Leave and WFH requests', 'Email support'],
    cta: 'Register company',
    href: '/register',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: 'INR 19',
    cadence: 'per employee / month',
    audience: 'Growing teams',
    description: 'Add payroll inputs, desktop hours, and the full approval chain.',
    features: [
      'Everything in Starter',
      'Payroll inputs and payslips',
      'Desktop work-hour tracking',
      'Org structure and permissions',
      'Priority support',
    ],
    cta: 'Request a demo',
    href: '/demo',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    audience: '200+ employees',
    description: 'Tailored rollout, integrations, and deployment support.',
    features: [
      'Everything in Professional',
      'Custom integrations',
      'Dedicated rollout support',
      'SLA and policy planning',
      'Migration assistance',
    ],
    cta: 'Contact sales',
    href: '/contact',
    highlighted: false,
  },
]

export const planIncludes = [
  'Unlimited work locations',
  'Role-based access control',
  'Multi-level approvals',
  'Audit trail',
  'CSV exports',
  'No card to start',
]

export const faqs: Array<{ question: string; answer: string }> = [
  {
    question: 'How long does it take to get a company running?',
    answer:
      'Registration takes about five minutes and activates immediately after email confirmation. Configuring departments, shifts, leave policies, payroll settings, and work locations is a guided checklist in the console; most teams finish it in a single session.',
  },
  {
    question: 'Does it work for field employees with no fixed office?',
    answer:
      'Yes. You can define multiple work locations, each with its own geofence radius. Attendance records store the location that was matched and the distance from it, and check-ins captured without connectivity are queued and synced later.',
  },
  {
    question: 'How does the leave approval chain work?',
    answer:
      'A request goes to the reporting manager first. Long absences and unpaid leave escalate to HR automatically. The full approval history is kept on the request, overlapping dates are flagged, and cancelling an approved leave restores the balance.',
  },
  {
    question: 'What exactly does desktop tracking record?',
    answer:
      'Active time, idle time, and application names. It does not capture keystrokes, screen contents, or file contents, and the employee starts and stops it. It is positioned as work-hour visibility, not surveillance.',
  },
  {
    question: 'Can we control who sees payroll?',
    answer:
      'Yes. Roles set sensible defaults and you can then grant or revoke individual permissions per user across a 22-key catalogue. Payroll and billing are separable from general HR access, so a manager can approve leave without seeing salaries.',
  },
  {
    question: 'One company address or many?',
    answer:
      'Many work locations for attendance and geofencing, and a single designated payroll address, so statutory reporting has one unambiguous registered address.',
  },
]

export const entryPoints: Array<{
  icon: IconType
  title: string
  description: string
  meta: string
  steps: string[]
  cta: string
  href: string
  featured: boolean
}> = [
  {
    icon: Building2,
    title: 'Register your company',
    description: 'Create your tenant and admin account, then finish setup inside the console.',
    meta: 'About 5 minutes',
    steps: ['Company profile and sign-in code', 'Administrator account', 'Review and activate by email'],
    cta: 'Start registration',
    href: '/register',
    featured: true,
  },
  {
    icon: MessageCircle,
    title: 'See it on your workflows',
    description: 'A 30-minute walkthrough using your shifts, locations, and approval chains.',
    meta: 'Reply in 1 business day',
    steps: ['Share your team context', 'Pick a preferred date', 'Leave with a rollout outline'],
    cta: 'Request a demo',
    href: '/demo',
    featured: false,
  },
  {
    icon: Mail,
    title: 'Talk to a human first',
    description: 'Implementation questions, partnerships, or a security and privacy review.',
    meta: 'Reply in 1 business day',
    steps: ['Tell us what you need', 'We route it internally', 'Answer by email'],
    cta: 'Contact the team',
    href: '/contact',
    featured: false,
  },
]
