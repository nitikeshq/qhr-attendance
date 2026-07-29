'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle,
  CheckCircle2,
  Lock,
  Mail,
  MapPin,
  Pencil,
  RotateCcw,
  ShieldCheck,
  UserCog,
  X,
} from 'lucide-react'

import OtpInput from '@/components/OtpInput'
import WizardRail, { type RailStep } from '@/components/WizardRail'
import {
  FormMessage,
  PasswordInput,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  StrengthMeter,
  TextInput,
  idleStatus,
  type FormStatus,
} from '@/components/forms'
import { adminUrl, postJson } from '@/lib/api'

const steps: RailStep[] = [
  { key: 'company', title: 'Company profile', summary: 'Legal name, sign-in code, and registered address.' },
  { key: 'admin', title: 'Administrator', summary: 'The person who will own this workspace.' },
  { key: 'security', title: 'Security', summary: 'Admin password and authorisation to register.' },
  { key: 'review', title: 'Review', summary: 'Confirm before the tenant is created.' },
  { key: 'verify', title: 'Activate', summary: 'Enter the 6-digit code we email you.' },
  { key: 'done', title: 'Workspace ready', summary: 'Sign in and start guided onboarding.' },
]

const industries = [
  'IT services',
  'Manufacturing',
  'Retail',
  'Healthcare',
  'Education',
  'Logistics',
  'Construction',
  'Financial services',
  'Hospitality',
  'Other',
]

const companySizes = ['1-10', '11-50', '51-200', '201-500', '500+']

type FormState = {
  companyName: string
  companyCode: string
  industry: string
  employeeCount: string
  addressLine: string
  city: string
  region: string
  postalCode: string
  adminFirstName: string
  adminLastName: string
  adminEmail: string
  adminPhone: string
  adminPassword: string
  confirmPassword: string
  termsAccepted: boolean
}

const emptyForm: FormState = {
  companyName: '',
  companyCode: '',
  industry: '',
  employeeCount: '',
  addressLine: '',
  city: '',
  region: '',
  postalCode: '',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPhone: '',
  adminPassword: '',
  confirmPassword: '',
  termsAccepted: false,
}

type Errors = Partial<Record<keyof FormState, string>>

// Mirrors the backend password policy so the client never accepts something the
// API will reject (see Backend/src/routes/auth.js passwordPolicyError).
const passwordRules = [
  { label: 'At least 10 characters', test: (value: string) => value.length >= 10 },
  { label: 'Upper and lower case', test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: 'A number', test: (value: string) => /\d/.test(value) },
  { label: 'A special character', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
]

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function validateCompany(form: FormState): Errors {
  const errors: Errors = {}
  if (form.companyName.trim().length < 2) errors.companyName = 'Enter the registered company name.'
  if (!/^[A-Za-z0-9]{3,12}$/.test(form.companyCode.trim())) {
    errors.companyCode = 'Use 3-12 letters or numbers, no spaces or symbols.'
  }
  if (!form.industry) errors.industry = 'Select the closest industry.'
  if (!form.employeeCount) errors.employeeCount = 'Select your current headcount range.'
  if (form.addressLine.trim().length < 4) errors.addressLine = 'Enter the street address.'
  if (form.city.trim().length < 2) errors.city = 'Enter the city.'
  if (form.region.trim().length < 2) errors.region = 'Enter the state or region.'
  return errors
}

function validateAdmin(form: FormState): Errors {
  const errors: Errors = {}
  if (form.adminFirstName.trim().length < 2) errors.adminFirstName = 'Enter the first name.'
  if (form.adminLastName.trim().length < 1) errors.adminLastName = 'Enter the last name.'
  if (!isEmail(form.adminEmail.trim())) errors.adminEmail = 'Enter a valid work email address.'
  if (digitsOnly(form.adminPhone).length < 8) errors.adminPhone = 'Enter a reachable phone number.'
  return errors
}

function validateSecurity(form: FormState): Errors {
  const errors: Errors = {}
  const failed = passwordRules.find((rule) => !rule.test(form.adminPassword))
  if (failed) errors.adminPassword = `Password requirement not met: ${failed.label.toLowerCase()}.`
  if (form.confirmPassword !== form.adminPassword) errors.confirmPassword = 'Both passwords must match.'
  if (!form.termsAccepted) errors.termsAccepted = 'Accept the terms to continue.'
  return errors
}

const validators = [validateCompany, validateAdmin, validateSecurity]

export default function RegisterPage() {
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<FormStatus>(idleStatus)
  const [verificationCode, setVerificationCode] = useState('')
  const [issuedCode, setIssuedCode] = useState('')
  const [createdCode, setCreatedCode] = useState('')

  const setField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const passwordChecks = useMemo(
    () => passwordRules.map((rule) => ({ label: rule.label, passed: rule.test(form.adminPassword) })),
    [form.adminPassword],
  )
  const satisfiedRules = passwordChecks.filter((check) => check.passed).length

  const goTo = (index: number) => {
    setStatus(idleStatus)
    setErrors({})
    setStepIndex(index)
  }

  const handleNext = () => {
    const validate = validators[stepIndex]
    if (validate) {
      const found = validate(form)
      if (Object.keys(found).length > 0) {
        setErrors(found)
        setStatus({ state: 'error', message: 'Please correct the highlighted fields to continue.' })
        return
      }
    }
    setErrors({})
    setStatus(idleStatus)
    setStepIndex((current) => Math.min(current + 1, steps.length - 1))
  }

  const handleBack = () => {
    setStatus(idleStatus)
    setStepIndex((current) => Math.max(current - 1, 0))
  }

  const handleCreate = async () => {
    for (let index = 0; index < validators.length; index += 1) {
      const found = validators[index](form)
      if (Object.keys(found).length > 0) {
        setErrors(found)
        setStepIndex(index)
        setStatus({ state: 'error', message: 'Some details need attention before we can create the workspace.' })
        return
      }
    }

    setStatus({ state: 'loading', message: 'Creating your workspace...' })
    const companyCode = form.companyCode.trim().toUpperCase()
    const address = [form.addressLine, form.city, form.region, form.postalCode]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ')

    const result = await postJson('/companies/register', {
      companyName: form.companyName.trim(),
      companyCode,
      industry: form.industry,
      employeeCount: form.employeeCount,
      address,
      city: form.city.trim(),
      state: form.region.trim(),
      postalCode: form.postalCode.trim(),
      adminFirstName: form.adminFirstName.trim(),
      adminLastName: form.adminLastName.trim(),
      adminEmail: form.adminEmail.trim().toLowerCase(),
      adminPhone: form.adminPhone.trim(),
      adminPassword: form.adminPassword,
      termsAccepted: form.termsAccepted,
      source: 'register-wizard',
    })

    if (!result.ok) {
      const lower = result.message.toLowerCase()
      if (lower.includes('code is already')) {
        setErrors({ companyCode: result.message })
        setStepIndex(0)
      } else if (lower.includes('email is already')) {
        setErrors({ adminEmail: result.message })
        setStepIndex(1)
      }
      setStatus({ state: 'error', message: result.message })
      return
    }

    const company = result.data.company as { code?: string } | undefined
    const returnedCode = String(result.data.verificationCode || '')
    setCreatedCode(String(company?.code || companyCode))
    setIssuedCode(returnedCode)
    setVerificationCode(returnedCode)
    setStatus({
      state: 'success',
      message: 'Workspace created. Confirm the activation code to enable admin sign-in.',
    })
    setStepIndex(4)
  }

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setStatus({ state: 'error', message: 'Enter all six digits of the activation code.' })
      return
    }

    setStatus({ state: 'loading', message: 'Verifying your workspace...' })
    const result = await postJson('/companies/verify-email', {
      companyCode: createdCode,
      verificationCode,
    })

    if (!result.ok) {
      setStatus({ state: 'error', message: result.message })
      return
    }

    setStatus(idleStatus)
    setStepIndex(5)
  }

  const reviewSections = [
    {
      title: 'Company profile',
      icon: Building2,
      target: 0,
      rows: [
        ['Registered name', form.companyName],
        ['Sign-in code', form.companyCode.toUpperCase()],
        ['Industry', form.industry],
        ['Headcount', form.employeeCount],
      ] as Array<[string, string]>,
    },
    {
      title: 'Registered address',
      icon: MapPin,
      target: 0,
      rows: [
        ['Street', form.addressLine],
        ['City', form.city],
        ['State or region', form.region],
        ['Postal code', form.postalCode],
      ] as Array<[string, string]>,
    },
    {
      title: 'Administrator',
      icon: UserCog,
      target: 1,
      rows: [
        ['Name', `${form.adminFirstName} ${form.adminLastName}`.trim()],
        ['Work email', form.adminEmail],
        ['Phone', form.adminPhone],
      ] as Array<[string, string]>,
    },
    {
      title: 'Security',
      icon: ShieldCheck,
      target: 2,
      rows: [
        ['Password', '••••••••••'],
        ['Terms accepted', form.termsAccepted ? 'Yes' : 'No'],
      ] as Array<[string, string]>,
    },
  ]

  const isDone = stepIndex === steps.length - 1
  const canNavigateRail = stepIndex < 4
  const percent = Math.round(((stepIndex + 1) / steps.length) * 100)

  return (
    <div className="min-h-screen bg-white text-slate-950 lg:grid lg:grid-cols-[21rem_1fr]">
      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen">
        <WizardRail activeIndex={stepIndex} onSelect={canNavigateRail ? goTo : undefined} steps={steps} />
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Compact progress header replaces the rail on small screens. */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <Link aria-label="QHR home" className="flex items-center gap-2.5" href="/">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <CheckCircle className="h-4 w-4" />
              </span>
              <span className="text-sm font-bold tracking-tight">QHR</span>
            </Link>
            <p className="text-xs font-semibold text-slate-500">
              Step {stepIndex + 1} of {steps.length}
            </p>
          </div>
          <div
            aria-label={`Registration progress, step ${stepIndex + 1} of ${steps.length}`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="h-1 w-full bg-slate-200"
            role="progressbar"
          >
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
        </header>

        <main className="flex-1 px-5 py-8 sm:px-8 sm:py-10 lg:px-14 lg:py-14" id="main-content">
          <div className="mx-auto w-full max-w-2xl">
            {stepIndex === 0 && (
              <StepPanel
                id="step-company"
                index={0}
                subtitle="This creates your tenant record. The sign-in code is what your employees type in the mobile and web apps, so keep it short and memorable."
                title="Company profile"
              >
                <FieldGrid>
                  <Span2>
                    <TextInput
                      autoComplete="organization"
                      error={errors.companyName}
                      label="Registered company name"
                      name="companyName"
                      onChange={(value) => setField('companyName', value)}
                      placeholder="Acme Services Pvt Ltd"
                      value={form.companyName}
                    />
                  </Span2>
                  <TextInput
                    error={errors.companyCode}
                    hint="Letters and numbers only, 3-12 characters."
                    label="Company sign-in code"
                    name="companyCode"
                    onChange={(value) => setField('companyCode', value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="ACMEHQ"
                    value={form.companyCode}
                  />
                  <SelectInput
                    error={errors.industry}
                    label="Industry"
                    name="industry"
                    onChange={(value) => setField('industry', value)}
                    options={industries}
                    placeholder="Select industry"
                    value={form.industry}
                  />
                  <SelectInput
                    error={errors.employeeCount}
                    label="Current headcount"
                    name="employeeCount"
                    onChange={(value) => setField('employeeCount', value)}
                    options={companySizes}
                    placeholder="Select range"
                    value={form.employeeCount}
                  />
                  <TextInput
                    error={errors.postalCode}
                    label="Postal code"
                    name="postalCode"
                    onChange={(value) => setField('postalCode', value)}
                    placeholder="560001"
                    required={false}
                    value={form.postalCode}
                  />
                </FieldGrid>

                <Divider label="Registered address" />

                <FieldGrid>
                  <Span2>
                    <TextInput
                      autoComplete="street-address"
                      error={errors.addressLine}
                      hint="Becomes the default payroll address. Extra work locations and geofences are added later in the console."
                      label="Street address"
                      name="addressLine"
                      onChange={(value) => setField('addressLine', value)}
                      placeholder="12 MG Road, Unit 4"
                      value={form.addressLine}
                    />
                  </Span2>
                  <TextInput
                    error={errors.city}
                    label="City"
                    name="city"
                    onChange={(value) => setField('city', value)}
                    placeholder="Bengaluru"
                    value={form.city}
                  />
                  <TextInput
                    error={errors.region}
                    label="State or region"
                    name="region"
                    onChange={(value) => setField('region', value)}
                    placeholder="Karnataka"
                    value={form.region}
                  />
                </FieldGrid>
              </StepPanel>
            )}

            {stepIndex === 1 && (
              <StepPanel
                id="step-admin"
                index={1}
                subtitle="This account gets full administrative rights over employees, payroll, policies, and billing. You can invite HR and managers with narrower permissions once you are inside."
                title="Administrator account"
              >
                <FieldGrid>
                  <TextInput
                    autoComplete="given-name"
                    error={errors.adminFirstName}
                    label="First name"
                    name="adminFirstName"
                    onChange={(value) => setField('adminFirstName', value)}
                    placeholder="Priya"
                    value={form.adminFirstName}
                  />
                  <TextInput
                    autoComplete="family-name"
                    error={errors.adminLastName}
                    label="Last name"
                    name="adminLastName"
                    onChange={(value) => setField('adminLastName', value)}
                    placeholder="Sharma"
                    value={form.adminLastName}
                  />
                  <Span2>
                    <TextInput
                      autoComplete="email"
                      error={errors.adminEmail}
                      hint="The activation code and all admin notifications are sent here."
                      inputMode="email"
                      label="Work email"
                      name="adminEmail"
                      onChange={(value) => setField('adminEmail', value)}
                      placeholder="priya@acme.com"
                      type="email"
                      value={form.adminEmail}
                    />
                  </Span2>
                  <Span2>
                    <TextInput
                      autoComplete="tel"
                      error={errors.adminPhone}
                      inputMode="tel"
                      label="Phone number"
                      name="adminPhone"
                      onChange={(value) => setField('adminPhone', value)}
                      placeholder="+91 98765 43210"
                      type="tel"
                      value={form.adminPhone}
                    />
                  </Span2>
                </FieldGrid>
              </StepPanel>
            )}

            {stepIndex === 2 && (
              <StepPanel
                id="step-security"
                index={2}
                subtitle="This workspace will hold salary and attendance records, so the admin password follows the same policy the product enforces internally."
                title="Secure the account"
              >
                <div className="grid gap-5">
                  <PasswordInput
                    error={errors.adminPassword}
                    label="Admin password"
                    name="adminPassword"
                    onChange={(value) => setField('adminPassword', value)}
                    placeholder="Create a strong password"
                    value={form.adminPassword}
                  />

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <StrengthMeter satisfied={satisfiedRules} total={passwordRules.length} />
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {passwordChecks.map((check) => (
                        <li
                          className={`flex items-center gap-2 text-xs font-medium ${check.passed ? 'text-emerald-700' : 'text-slate-500'}`}
                          key={check.label}
                        >
                          <span
                            aria-hidden="true"
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                              check.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                            }`}
                          >
                            {check.passed ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                          </span>
                          {check.label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <PasswordInput
                    error={errors.confirmPassword}
                    label="Confirm password"
                    name="confirmPassword"
                    onChange={(value) => setField('confirmPassword', value)}
                    placeholder="Repeat the password"
                    value={form.confirmPassword}
                  />

                  <div>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition ${
                        errors.termsAccepted
                          ? 'border-red-400 bg-red-50'
                          : form.termsAccepted
                            ? 'border-blue-300 bg-blue-50/60'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      htmlFor="termsAccepted"
                    >
                      <input
                        aria-invalid={Boolean(errors.termsAccepted)}
                        checked={form.termsAccepted}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600"
                        id="termsAccepted"
                        name="termsAccepted"
                        onChange={(event) => setField('termsAccepted', event.target.checked)}
                        type="checkbox"
                      />
                      <span className="text-slate-700">
                        I am authorised to register this company and I accept the{' '}
                        <Link className="font-semibold text-blue-700 underline underline-offset-2" href="/terms">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link className="font-semibold text-blue-700 underline underline-offset-2" href="/privacy">
                          Privacy Notice
                        </Link>
                        .
                      </span>
                    </label>
                    {errors.termsAccepted && (
                      <p className="mt-1.5 text-xs font-medium text-red-700" role="alert">
                        {errors.termsAccepted}
                      </p>
                    )}
                  </div>
                </div>
              </StepPanel>
            )}

            {stepIndex === 3 && (
              <StepPanel
                id="step-review"
                index={3}
                subtitle="Nothing has been created yet. Check each block and edit anything that looks wrong."
                title="Review and confirm"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {reviewSections.map((section) => {
                    const Icon = section.icon
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white" key={section.title}>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                          <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900">
                            <Icon className="h-4 w-4 shrink-0 text-blue-600" />
                            <span className="truncate">{section.title}</span>
                          </p>
                          <button
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                            onClick={() => goTo(section.target)}
                            type="button"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                        </div>
                        <dl className="grid gap-3 px-4 py-3.5">
                          {section.rows.map(([label, value]) => (
                            <div key={label}>
                              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
                              <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{value || '—'}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )
                  })}
                </div>

                <p className="mt-5 flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  Creating the workspace provisions an inactive tenant plus your admin account. It stays inactive until you
                  confirm the emailed activation code on the next step.
                </p>
              </StepPanel>
            )}

            {stepIndex === 4 && (
              <StepPanel
                id="step-verify"
                index={4}
                subtitle={`We sent a 6-digit activation code to ${form.adminEmail}. Entering it activates ${createdCode} and unlocks admin sign-in.`}
                title="Activate your workspace"
              >
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                  <p className="text-sm font-semibold text-slate-800">Activation code</p>
                  <p className="mt-1 text-xs text-slate-500">Paste the whole code or type one digit at a time.</p>
                  <div className="mt-4">
                    <OtpInput
                      invalid={status.state === 'error'}
                      label="Activation code"
                      onChange={setVerificationCode}
                      value={verificationCode}
                    />
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                    Code not arrived? Check spam, or{' '}
                    <Link className="font-semibold text-blue-700 underline underline-offset-2" href="/contact">
                      contact support
                    </Link>
                    .
                  </p>
                </div>

                {issuedCode && (
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                    <span className="font-bold">Non-production environment:</span> outbound email is not configured, so the
                    API returned the code directly and it has been filled in for you. In production the code is only
                    delivered by email.
                  </p>
                )}
              </StepPanel>
            )}

            {isDone && (
              <section aria-labelledby="step-done">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <h1 className="mt-6 text-[clamp(1.5rem,3.5vw,2rem)] font-bold leading-tight tracking-tight" id="step-done">
                  {createdCode} is live
                </h1>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Your tenant is active. Sign in with the credentials below and the console will open a guided onboarding
                  checklist for the rest of the configuration.
                </p>

                <dl className="mt-7 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Company code</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-slate-900">{createdCode}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Admin email</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{form.adminEmail}</dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                    href={adminUrl}
                  >
                    Open admin sign-in <ArrowRight className="h-4 w-4" />
                  </a>
                  <Link
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    href="/"
                  >
                    Back to site
                  </Link>
                </div>

                <h2 className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                  What onboarding covers next
                </h2>
                <ol className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    'Invite HR and managers, then grant role-based permissions.',
                    'Add departments, designations, and reporting hierarchy.',
                    'Define shifts, holidays, leave types, and approval rules.',
                    'Set payroll settings and geofenced work locations.',
                  ].map((item, index) => (
                    <li className="flex gap-3 rounded-xl border border-slate-200 p-4" key={item}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                        {index + 1}
                      </span>
                      <span className="text-sm leading-6 text-slate-700">{item}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </main>

        {!isDone && (
          <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto w-full max-w-2xl px-5 py-4 sm:px-8 lg:px-14">
              {status.state !== 'idle' && (
                <div className="mb-3">
                  <FormMessage status={status} />
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                {stepIndex > 0 && stepIndex < 4 ? (
                  <SecondaryButton onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Back</span>
                  </SecondaryButton>
                ) : (
                  <p className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    Questions?{' '}
                    <Link className="font-semibold text-blue-700 underline underline-offset-2" href="/contact">
                      Talk to us
                    </Link>
                  </p>
                )}

                <div className="w-full sm:w-60">
                  {stepIndex < 3 && (
                    <PrimaryButton onClick={handleNext} type="button">
                      Continue <ArrowRight className="h-4 w-4" />
                    </PrimaryButton>
                  )}
                  {stepIndex === 3 && (
                    <PrimaryButton loading={status.state === 'loading'} onClick={() => void handleCreate()} type="button">
                      Create workspace <ArrowRight className="h-4 w-4" />
                    </PrimaryButton>
                  )}
                  {stepIndex === 4 && (
                    <PrimaryButton
                      disabled={verificationCode.length !== 6}
                      loading={status.state === 'loading'}
                      onClick={() => void handleVerify()}
                      type="button"
                    >
                      Activate workspace <ArrowRight className="h-4 w-4" />
                    </PrimaryButton>
                  )}
                </div>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}

function StepPanel({
  id,
  index,
  title,
  subtitle,
  children,
}: {
  id: string
  index: number
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
        Step {index + 1} of {steps.length}
      </p>
      <h1 className="mt-2.5 text-[clamp(1.5rem,3.5vw,2rem)] font-bold leading-tight tracking-tight" id={id}>
        {title}
      </h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </section>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>
}

function Span2({ children }: { children: React.ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-7 flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
    </div>
  )
}
