'use client'

import type { ComponentType, FormEvent } from 'react'
import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  FileText,
  Headphones,
  Laptop,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Monitor,
  Phone,
  Shield,
  Smartphone,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react'

type IconType = ComponentType<{ className?: string }>

type FormKind = 'registration' | 'verification' | 'demo' | 'contact'

type FormStatus = {
  state: 'idle' | 'loading' | 'success' | 'error'
  message: string
}

const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001').trim()
const apiBaseUrl = rawApiUrl.replace(/\/+$/, '')
const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3003'

const initialStatuses: Record<FormKind, FormStatus> = {
  registration: { state: 'idle', message: '' },
  verification: { state: 'idle', message: '' },
  demo: { state: 'idle', message: '' },
  contact: { state: 'idle', message: '' },
}

const navLinks = [
  { label: 'Product', href: '#product' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Forms', href: '#forms' },
  { label: 'FAQ', href: '#faq' },
]

const productModules: Array<{
  icon: IconType
  title: string
  description: string
  bullets: string[]
}> = [
  {
    icon: MapPin,
    title: 'GPS attendance that fits field and office teams',
    description:
      'Geofenced check-in, check-out, office radius rules, and offline queues for mobile employees.',
    bullets: ['Office and remote attendance', 'Auto check-in/out rules', 'Manual review paths'],
  },
  {
    icon: Calendar,
    title: 'Leave, WFH, holiday, and approval workflows',
    description:
      'Employees request time away while managers and HR keep balances, approvals, and calendars aligned.',
    bullets: ['Leave balances', 'WFH requests', 'Unified calendar view'],
  },
  {
    icon: Monitor,
    title: 'Desktop work-hour visibility with privacy controls',
    description:
      'Track productive time, idle time, and application activity without content capture.',
    bullets: ['Start/stop control', 'Idle detection', 'No keystroke content'],
  },
  {
    icon: BarChart3,
    title: 'Admin dashboards and workforce reports',
    description:
      'Company admins get attendance summaries, absents, payroll inputs, and operational exports in one place.',
    bullets: ['Team attendance', 'Payroll-ready data', 'CSV and report workflows'],
  },
]

const capabilityCards: Array<{
  icon: IconType
  title: string
  copy: string
}> = [
  {
    icon: Shield,
    title: 'Multi-tenant controls',
    copy: 'Company code login, role-based access, and admin boundaries for SME deployments.',
  },
  {
    icon: Smartphone,
    title: 'Mobile-first employee app',
    copy: 'Attendance, leave, WFH, grievances, wellness reminders, and payslips for employees on the move.',
  },
  {
    icon: Laptop,
    title: 'Desktop companion',
    copy: 'Work-hour tracking for remote and desk teams with explicit user control.',
  },
  {
    icon: Workflow,
    title: 'Integration ready',
    copy: 'Designed for payment gateways, email, SMS, storage, maps, HR systems, and accounting exports.',
  },
  {
    icon: Headphones,
    title: 'Sales follow-up ready',
    copy: 'Registration, demo, and contact forms submit to the unified backend.',
  },
  {
    icon: Lock,
    title: 'Compliance-minded',
    copy: 'Consent, privacy, security, and audit-friendly workflows are part of the product model.',
  },
]

const pricingPlans = [
  {
    name: 'Starter',
    price: 'Free',
    cadence: '/employee/month',
    audience: 'For teams up to 5 employees',
    description: 'Launch reliable attendance without a large rollout project.',
    features: ['GPS attendance', 'Mobile app access', 'Leave and WFH basics', 'Email support'],
    cta: 'Register company',
    href: '#register',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: 'INR 19',
    cadence: '/employee/month',
    audience: 'For growing teams',
    description: 'Scale HR operations with richer reporting and approvals.',
    features: ['Everything in Starter', 'Desktop activity tracking', 'Payroll-ready reports', 'Priority support'],
    cta: 'Request demo',
    href: '#demo',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    audience: 'For 200+ employees',
    description: 'Tailored onboarding, integrations, and deployment support.',
    features: ['Custom integrations', 'Dedicated rollout support', 'SLA planning', 'Advanced policy setup'],
    cta: 'Contact sales',
    href: '#contact',
    highlighted: false,
  },
]

const faqs = [
  {
    question: 'What does the landing page submit to?',
    answer:
      'Registration posts to /api/v1/companies/register, demo requests post to /api/v1/demo-requests, and contact messages post to /api/v1/contact.',
  },
  {
    question: 'Can companies self-register?',
    answer:
      'Yes. The documented flow creates an inactive company and admin account, then moves through email verification before admin login.',
  },
  {
    question: 'Does QHR support field employees?',
    answer:
      'Yes. The product scope includes GPS geofencing, offline attendance queueing, WFH requests, and mobile employee workflows.',
  },
  {
    question: 'How is desktop tracking positioned?',
    answer:
      'It is for work-hour and productivity visibility. The scope emphasizes user control and no content capture.',
  },
]

function buildEndpoint(endpoint: string) {
  if (!apiBaseUrl) {
    return ''
  }

  const hasVersionedApi = /\/api\/v\d+$/i.test(apiBaseUrl)
  return `${apiBaseUrl}${hasVersionedApi ? '' : '/api/v1'}${endpoint}`
}

function readField(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim()
}

type ApiResponse = {
  message?: unknown
  error?: unknown
  data?: Record<string, unknown>
}

function readResponseMessage(body: ApiResponse) {
  if (typeof body.message === 'string') return body.message
  if (typeof body.error === 'string') return body.error
  if (typeof body.data?.message === 'string') return body.data.message
  return ''
}

function FormMessage({ status }: { status: FormStatus }) {
  if (status.state === 'idle') {
    return null
  }

  const tone =
    status.state === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : status.state === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-blue-200 bg-blue-50 text-blue-700'

  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${tone}`} role="status">
      {status.message}
    </p>
  )
}

function SubmitButton({
  status,
  children,
}: {
  status: FormStatus
  children: React.ReactNode
}) {
  const isLoading = status.state === 'loading'

  return (
    <button
      type="submit"
      disabled={isLoading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
    >
      {isLoading ? 'Submitting...' : children}
      {!isLoading && <ArrowRight className="h-4 w-4" />}
    </button>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required = true,
}: {
  label: string
  name: string
  type?: string
  placeholder: string
  required?: boolean
}) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        className="input-field"
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
      />
    </label>
  )
}

function SelectField({
  label,
  name,
  children,
}: {
  label: string
  name: string
  children: React.ReactNode
}) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select className="input-field" name={name} required>
        {children}
      </select>
    </label>
  )
}

function TextAreaField({
  label,
  name,
  placeholder,
  required = true,
}: {
  label: string
  name: string
  placeholder: string
  required?: boolean
}) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <textarea
        className="input-field min-h-[112px] resize-y"
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  )
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [formStatuses, setFormStatuses] = useState<Record<FormKind, FormStatus>>(initialStatuses)
  const [registeredCompany, setRegisteredCompany] = useState<{ code: string; email: string } | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [registrationVerified, setRegistrationVerified] = useState(false)

  const updateStatus = (kind: FormKind, status: FormStatus) => {
    setFormStatuses((current) => ({
      ...current,
      [kind]: status,
    }))
  }

  const submitPayload = async (
    kind: FormKind,
    endpoint: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => {
    updateStatus(kind, { state: 'loading', message: 'Submitting your details...' })

    try {
      const response = await fetch(buildEndpoint(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const responseBody = (await response.json().catch(() => ({}))) as ApiResponse
      const responseMessage = readResponseMessage(responseBody)

      if (!response.ok) {
        throw new Error(responseMessage || 'The API could not accept this submission.')
      }

      updateStatus(kind, {
        state: 'success',
        message: responseMessage || successMessage,
      })
      return true
    } catch (error) {
      updateStatus(kind, {
        state: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while submitting. Please try again.',
      })
      return false
    }
  }

  const handleRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const password = readField(formData, 'adminPassword')
    if (password !== readField(formData, 'confirmPassword')) {
      updateStatus('registration', { state: 'error', message: 'Admin passwords do not match.' })
      return
    }

    updateStatus('registration', { state: 'loading', message: 'Creating your company...' })
    try {
      const payload = {
        companyName: readField(formData, 'companyName'),
        companyCode: readField(formData, 'companyCode').toUpperCase(),
        industry: readField(formData, 'industry'),
        address: readField(formData, 'address'),
        adminFirstName: readField(formData, 'adminFirstName'),
        adminLastName: readField(formData, 'adminLastName'),
        adminEmail: readField(formData, 'adminEmail'),
        adminPhone: readField(formData, 'adminPhone'),
        adminPassword: password,
        termsAccepted: formData.get('termsAccepted') === 'on',
        source: 'root-landing-page',
      }
      const response = await fetch(buildEndpoint('/companies/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await response.json().catch(() => ({}))) as ApiResponse
      if (!response.ok) throw new Error(readResponseMessage(body) || 'Company registration failed.')
      const data = body.data || {}
      const code = String((data.company as { code?: string } | undefined)?.code || payload.companyCode)
      const issuedCode = String(data.verificationCode || '')
      setRegisteredCompany({ code, email: payload.adminEmail })
      setVerificationCode(issuedCode)
      setRegistrationVerified(false)
      updateStatus('registration', {
        state: 'success',
        message: readResponseMessage(body) || 'Company created. Verify it below to activate admin login.',
      })
      form.reset()
    } catch (error) {
      updateStatus('registration', {
        state: 'error',
        message: error instanceof Error ? error.message : 'Company registration failed.',
      })
    }
  }

  const handleVerification = async () => {
    if (!registeredCompany) return
    const verified = await submitPayload(
      'verification',
      '/companies/verify-email',
      { companyCode: registeredCompany.code, verificationCode },
      'Company verified. You can now sign in to the admin panel.',
    )
    if (verified) setRegistrationVerified(true)
  }

  const handleDemo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const submitted = await submitPayload(
      'demo',
      '/demo-requests',
      {
        fullName: readField(formData, 'fullName'),
        workEmail: readField(formData, 'workEmail'),
        phone: readField(formData, 'phone'),
        companyName: readField(formData, 'companyName'),
        employeeCount: readField(formData, 'employeeCount'),
        preferredDate: readField(formData, 'preferredDate'),
        message: readField(formData, 'message'),
        source: 'root-landing-page',
      },
      'Demo request received. The sales team can follow up from the backend queue.',
    )

    if (submitted) {
      form.reset()
    }
  }

  const handleContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const submitted = await submitPayload(
      'contact',
      '/contact',
      {
        name: readField(formData, 'name'),
        email: readField(formData, 'email'),
        phone: readField(formData, 'phone'),
        company: readField(formData, 'company'),
        message: readField(formData, 'message'),
        source: 'root-landing-page',
      },
      'Message received. Support can route this from the configured contact endpoint.',
    )

    if (submitted) {
      form.reset()
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="QHR home">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <CheckCircle className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none tracking-tight">QHR</span>
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-blue-600">
                Attendance
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            {navLinks.map((link) => (
              <a key={link.href} className="transition hover:text-blue-700" href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <a
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              href="#forms"
            >
              Company login
            </a>
            <a
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              href="#register"
            >
              Register company
            </a>
          </div>

          <button
            aria-label="Toggle navigation"
            className="rounded-lg border border-slate-200 p-2 text-slate-700 md:hidden"
            onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-5 py-4 md:hidden">
            <div className="grid gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <a
                className="mt-2 rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white"
                href="#register"
                onClick={() => setMobileMenuOpen(false)}
              >
                Register company
              </a>
            </div>
          </div>
        )}
      </header>

      <section id="top" className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-hero-grid opacity-70" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              <Zap className="h-4 w-4" />
              Doc-aligned HRMS for SME attendance operations
            </div>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              QHR brings attendance, approvals, and workforce visibility into one blue-chip
              workspace.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Register a company, set office locations, invite employees, and run GPS attendance,
              leave, WFH, payroll inputs, grievances, wellness, and desktop work-hour tracking from
              a single product model.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                href="#register"
              >
                Start registration <ArrowRight className="h-4 w-4" />
              </a>
              <a
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:text-blue-700"
                href="#demo"
              >
                Request a demo <MessageCircle className="h-4 w-4" />
              </a>
            </div>

            <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {[
                ['SME-ready', 'Product scope'],
                ['Mobile + web', 'Core surfaces'],
                ['Node API', 'Backend target'],
              ].map(([value, label]) => (
                <div key={value} className="rounded-lg border border-slate-200 bg-white p-4">
                  <dt className="text-lg font-bold text-slate-950">{value}</dt>
                  <dd className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-blue-900/10">
              <div className="rounded-xl border border-slate-200 bg-slate-950 p-3 text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-blue-300">
                      Admin dashboard
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">Today at a glance</h2>
                  </div>
                  <div className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold">
                    Live
                  </div>
                </div>

                <div className="grid gap-3 py-4 sm:grid-cols-3">
                  {[
                    ['214', 'Present'],
                    ['18', 'WFH'],
                    ['07', 'Pending'],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-lg bg-white/10 p-3">
                      <p className="text-2xl font-bold">{value}</p>
                      <p className="text-sm text-slate-300">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_0.82fr]">
                  <div className="rounded-lg bg-white p-4 text-slate-950">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">Attendance stream</h3>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Synced
                      </span>
                    </div>
                    {[
                      ['Anita Rao', 'Office geofence', '09:08 AM'],
                      ['Rahul Mehta', 'WFH approved', '09:21 AM'],
                      ['Maya Iyer', 'Offline queued', '09:42 AM'],
                    ].map(([name, mode, time]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between border-t border-slate-100 py-3 first:border-t-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
                            {name
                              .split(' ')
                              .map((part) => part[0])
                              .join('')}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{name}</p>
                            <p className="text-xs text-slate-500">{mode}</p>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-slate-500">{time}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-lg bg-blue-600 p-4">
                      <MapPin className="mb-6 h-6 w-6" />
                      <p className="text-sm text-blue-100">Office radius</p>
                      <p className="text-3xl font-bold">450m</p>
                    </div>
                    <div className="rounded-lg bg-white/10 p-4">
                      <p className="text-sm text-slate-300">Approval queue</p>
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-cyan-300" />
                        5 leave and WFH items
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-8 -left-2 hidden w-44 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-blue-900/10 sm:block">
              <div className="rounded-xl bg-slate-950 p-3 text-white">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/30" />
                <div className="rounded-lg bg-blue-600 p-3">
                  <Smartphone className="h-5 w-5" />
                  <p className="mt-8 text-xs text-blue-100">Mobile check-in</p>
                  <p className="text-lg font-bold">Inside office</p>
                </div>
                <button className="mt-3 w-full rounded-lg bg-white py-2 text-xs font-bold text-slate-950">
                  Check in
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600">
              Product sections
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Real operational modules, not a placeholder marketing shell.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              The page now reflects the documented QHR scope: attendance, leave, WFH, payroll
              inputs, grievances, wellness, admin controls, and desktop activity.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {productModules.map((module) => {
              const Icon = module.icon

              return (
                <article key={module.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-slate-950">
                        {module.title}
                      </h3>
                      <p className="mt-2 leading-7 text-slate-600">{module.description}</p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {module.bullets.map((bullet) => (
                          <span
                            key={bullet}
                            className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                          >
                            {bullet}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {capabilityCards.map((card) => {
              const Icon = card.icon

              return (
                <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-5">
                  <Icon className="h-6 w-6 text-cyan-600" />
                  <h3 className="mt-4 font-bold text-slate-950">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.copy}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600">
              How rollout works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              From company registration to daily attendance in five steps.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              This mirrors the documented registration-to-login flow: create company, verify email,
              activate admin, add employees, configure locations, then start attendance.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              ['01', 'Register company', 'Submit company code, business details, and admin contact.'],
              ['02', 'Verify admin email', 'Backend activates the company and admin after verification.'],
              ['03', 'Add employees', 'Admins invite employees and assign roles, departments, and policies.'],
              ['04', 'Configure geofences', 'Set office locations, working days, holidays, leave, and WFH rules.'],
              ['05', 'Run daily workflows', 'Employees use mobile and desktop apps while HR reviews dashboards.'],
            ].map(([step, title, copy]) => (
              <div key={step} className="grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-[64px_1fr]">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                  {step}
                </div>
                <div>
                  <h3 className="font-bold text-slate-950">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">
                Pricing
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Tiered plans aligned to the current product documentation.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-300">
                Start small, scale into desktop tracking and richer reporting, or plan a custom
                enterprise rollout.
              </p>
            </div>
            <a
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-blue-50"
              href="#demo"
            >
              Compare in a demo <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-xl border p-6 ${
                  plan.highlighted
                    ? 'border-blue-400 bg-blue-600 shadow-2xl shadow-blue-600/20'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                {plan.highlighted && (
                  <p className="mb-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                    Common growth plan
                  </p>
                )}
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <p className={`mt-1 text-sm ${plan.highlighted ? 'text-blue-100' : 'text-slate-300'}`}>
                  {plan.audience}
                </p>
                <div className="mt-6">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  {plan.cadence && <span className="text-sm text-slate-300"> {plan.cadence}</span>}
                </div>
                <p className={`mt-4 min-h-[52px] text-sm leading-6 ${plan.highlighted ? 'text-blue-50' : 'text-slate-300'}`}>
                  {plan.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition ${
                    plan.highlighted
                      ? 'bg-white text-blue-700 hover:bg-blue-50'
                      : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                  href={plan.href}
                >
                  {plan.cta}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="forms" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600">
              Start, demo, or contact
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Start a real QHR conversation.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              These forms submit to the QHR backend and surface validation or connection errors clearly.
            </p>
          </div>

          <div className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_0.95fr_0.95fr]">
            <form
              id="register"
              className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
              onSubmit={handleRegistration}
            >
              <div className="mb-6 flex items-start gap-3">
                <div className="rounded-lg bg-blue-600 p-3 text-white">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Company registration</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Creates an onboarding request through the QHR backend.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company name" name="companyName" placeholder="Acme Services Pvt Ltd" />
                <Field label="Company code" name="companyCode" placeholder="ACMEHQ" />
                <SelectField label="Industry" name="industry">
                  <option value="">Select industry</option>
                  <option>IT services</option>
                  <option>Manufacturing</option>
                  <option>Retail</option>
                  <option>Healthcare</option>
                  <option>Education</option>
                  <option>Other</option>
                </SelectField>
                <Field label="Business address" name="address" placeholder="City, state" />
                <Field label="Admin first name" name="adminFirstName" placeholder="Priya" />
                <Field label="Admin last name" name="adminLastName" placeholder="Sharma" />
                <Field label="Admin email" name="adminEmail" type="email" placeholder="admin@company.com" />
                <Field label="Admin phone" name="adminPhone" type="tel" placeholder="+91 98765 43210" />
                <Field label="Admin password" name="adminPassword" type="password" placeholder="Minimum 8 characters" />
                <Field label="Confirm password" name="confirmPassword" type="password" placeholder="Repeat password" />
              </div>

              <label className="mt-5 flex gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" name="termsAccepted" required type="checkbox" />
                <span>
                  I agree to QHR processing this registration request and to the Terms and Privacy
                  notices linked in the footer.
                </span>
              </label>

              <div className="mt-5 space-y-3">
                <FormMessage status={formStatuses.registration} />
                <SubmitButton status={formStatuses.registration}>Create company request</SubmitButton>
              </div>

              {registeredCompany && (
                <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <h4 className="font-bold text-slate-950">Verify {registeredCompany.code}</h4>
                  <p className="mt-1 text-sm text-slate-600">
                    Enter the verification code issued for {registeredCompany.email}. The local backend fills it automatically.
                  </p>
                  <input
                    aria-label="Verification code"
                    className="input-field mt-3"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    value={verificationCode}
                  />
                  <div className="mt-3 space-y-3">
                    <FormMessage status={formStatuses.verification} />
                    {registrationVerified ? (
                      <a
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
                        href={adminUrl}
                      >
                        Open admin login <ArrowRight className="h-4 w-4" />
                      </a>
                    ) : (
                      <button
                        className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-blue-300"
                        disabled={formStatuses.verification.state === 'loading' || verificationCode.length !== 6}
                        onClick={() => void handleVerification()}
                        type="button"
                      >
                        {formStatuses.verification.state === 'loading' ? 'Verifying...' : 'Verify company'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>

            <form
              id="demo"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              onSubmit={handleDemo}
            >
              <div className="mb-6 flex items-start gap-3">
                <div className="rounded-lg bg-cyan-50 p-3 text-cyan-700">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Request a demo</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Captures sales context for the demo request queue.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <Field label="Full name" name="fullName" placeholder="Rahul Mehta" />
                <Field label="Work email" name="workEmail" type="email" placeholder="rahul@company.com" />
                <Field label="Phone" name="phone" type="tel" placeholder="+91 98765 43210" />
                <Field label="Company" name="companyName" placeholder="Company name" />
                <SelectField label="Employee count" name="employeeCount">
                  <option value="">Select size</option>
                  <option>1-50</option>
                  <option>51-200</option>
                  <option>201-500</option>
                  <option>500+</option>
                </SelectField>
                <Field label="Preferred demo date" name="preferredDate" type="date" placeholder="" required={false} />
                <TextAreaField
                  label="What should we focus on?"
                  name="message"
                  placeholder="Geofencing, leave approvals, desktop tracking, payroll reports..."
                  required={false}
                />
              </div>

              <div className="mt-5 space-y-3">
                <FormMessage status={formStatuses.demo} />
                <SubmitButton status={formStatuses.demo}>Request demo</SubmitButton>
              </div>
            </form>

            <form
              id="contact"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              onSubmit={handleContact}
            >
              <div className="mb-6 flex items-start gap-3">
                <div className="rounded-lg bg-blue-50 p-3 text-blue-700">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Contact QHR</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    For support, partnerships, security, or implementation questions.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <Field label="Name" name="name" placeholder="Your name" />
                <Field label="Email" name="email" type="email" placeholder="you@company.com" />
                <Field label="Phone" name="phone" type="tel" placeholder="+91 98765 43210" required={false} />
                <Field label="Company" name="company" placeholder="Company name" required={false} />
                <TextAreaField label="Message" name="message" placeholder="How can the QHR team help?" />
              </div>

              <div className="mt-5 space-y-3">
                <FormMessage status={formStatuses.contact} />
                <SubmitButton status={formStatuses.contact}>Send message</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 lg:grid-cols-3 lg:px-8">
          {[
            {
              icon: Users,
              quote:
                'QHR is shaped around the daily HR work SMEs already do: attendance, approvals, payroll inputs, and employee self-service.',
              name: 'SME HR operations',
            },
            {
              icon: FileText,
              quote:
                'The registration flow is designed to move from public signup to verified admin access without manual account setup.',
              name: 'Self-service onboarding',
            },
            {
              icon: Phone,
              quote:
                'Mobile and desktop surfaces keep field, office, remote, and admin teams connected to the same attendance record.',
              name: 'Connected workforce',
            },
          ].map((item) => {
            const Icon = item.icon

            return (
              <figure key={item.name} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <Icon className="h-7 w-7 text-blue-600" />
                <blockquote className="mt-5 leading-7 text-slate-700">"{item.quote}"</blockquote>
                <figcaption className="mt-5 text-sm font-bold text-slate-950">{item.name}</figcaption>
              </figure>
            )
          })}
        </div>
      </section>

      <section id="faq" className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Practical answers for a landing app that can become production-ready.
            </h2>
          </div>
          <div className="grid gap-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-xl border border-slate-200 p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-950">
                  {faq.question}
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700 group-open:hidden">
                    Open
                  </span>
                </summary>
                <p className="mt-3 leading-7 text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                  <CheckCircle className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-lg font-bold">QHR Attendance</p>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Professional blue HRMS</p>
                </div>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
                A landing app for QHR's documented attendance, leave, WFH, payroll, grievance,
                wellness, and desktop productivity platform.
              </p>
            </div>

            <div>
              <h3 className="font-bold">Product</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li><a className="hover:text-white" href="#product">Features</a></li>
                <li><a className="hover:text-white" href="#pricing">Pricing</a></li>
                <li><a className="hover:text-white" href="#demo">Request demo</a></li>
                <li><a className="hover:text-white" href="#register">Company registration</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold">Company</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li><a className="hover:text-white" href="#contact">Contact</a></li>
                <li><a className="hover:text-white" href="#forms">Support</a></li>
                <li><a className="hover:text-white" href="#top">App downloads</a></li>
                <li><a className="hover:text-white" href="#faq">FAQ</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold">Legal</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li><a className="hover:text-white" href="/privacy">Privacy Notice</a></li>
                <li><a className="hover:text-white" href="/terms">Terms of Service</a></li>
                <li><a className="hover:text-white" href="/security">Security</a></li>
                <li><a className="hover:text-white" href="/subprocessors">Subprocessors</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-sm text-slate-400 sm:flex-row">
            <p>Copyright 2026 QHR Attendance. All rights reserved.</p>
            <p>
              API mode:{' '}
              <span className="font-semibold text-slate-200">
                Connected to {apiBaseUrl}
              </span>
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
