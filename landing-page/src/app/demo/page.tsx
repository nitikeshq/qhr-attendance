'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarClock, CheckCircle2, Clock, Users } from 'lucide-react'

import PageShell from '@/components/PageShell'
import {
  FormMessage,
  PrimaryButton,
  SelectInput,
  TextAreaInput,
  TextInput,
  idleStatus,
  type FormStatus,
} from '@/components/forms'
import { postJson } from '@/lib/api'

const employeeCounts = ['1-50', '51-200', '201-500', '500+']

type DemoForm = {
  fullName: string
  workEmail: string
  phone: string
  companyName: string
  employeeCount: string
  preferredDate: string
  message: string
}

const emptyForm: DemoForm = {
  fullName: '',
  workEmail: '',
  phone: '',
  companyName: '',
  employeeCount: '',
  preferredDate: '',
  message: '',
}

type Errors = Partial<Record<keyof DemoForm, string>>

function validate(form: DemoForm): Errors {
  const errors: Errors = {}
  if (form.fullName.trim().length < 2) errors.fullName = 'Enter your full name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.workEmail.trim())) errors.workEmail = 'Enter a valid work email.'
  if (form.phone.replace(/\D/g, '').length < 8) errors.phone = 'Enter a reachable phone number.'
  if (form.companyName.trim().length < 2) errors.companyName = 'Enter your company name.'
  if (!form.employeeCount) errors.employeeCount = 'Select your team size.'
  return errors
}

export default function DemoPage() {
  const [form, setForm] = useState<DemoForm>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<FormStatus>(idleStatus)
  const [submitted, setSubmitted] = useState(false)

  const setField = (key: keyof DemoForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validate(form)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setStatus({ state: 'error', message: 'Please correct the highlighted fields.' })
      return
    }

    setStatus({ state: 'loading', message: 'Sending your request...' })
    const result = await postJson('/demo-requests', {
      fullName: form.fullName.trim(),
      workEmail: form.workEmail.trim().toLowerCase(),
      phone: form.phone.trim(),
      companyName: form.companyName.trim(),
      employeeCount: form.employeeCount,
      preferredDate: form.preferredDate,
      message: form.message.trim(),
      source: 'demo-page',
    })

    if (!result.ok) {
      setStatus({ state: 'error', message: result.message })
      return
    }

    setSubmitted(true)
    setStatus(idleStatus)
  }

  const aside = (
    <aside className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">What to expect</h2>
      <ul className="mt-4 grid gap-4">
        {[
          { icon: Clock, title: '30 minutes', copy: 'A focused walkthrough, no slide deck marathon.' },
          { icon: Users, title: 'Your scenarios', copy: 'We use your team structure, shifts, and locations.' },
          { icon: CalendarClock, title: 'Follow-up plan', copy: 'You leave with a rollout outline and pricing fit.' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <li className="flex gap-3" key={item.title}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">{item.copy}</p>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="text-xs leading-5 text-slate-600">
          Ready to start on your own instead?{' '}
          <Link className="font-semibold text-blue-700 underline" href="/register">
            Register your company
          </Link>
          .
        </p>
      </div>
    </aside>
  )

  return (
    <PageShell
      aside={aside}
      description="Tell us about your team and we will tailor the session to your attendance, leave, payroll, and reporting workflows."
      eyebrow="Request a demo"
      title="See QHR against your own workflows"
    >
      {submitted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-xl font-bold tracking-tight text-emerald-900">Request received</h2>
          <p className="mx-auto mt-2.5 max-w-md text-sm leading-6 text-emerald-800">
            Our team will confirm a slot with {form.workEmail} within one business day.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
              href="/register"
            >
              Start registration <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-emerald-300 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 sm:w-auto"
              href="/"
            >
              Back to site
            </Link>
          </div>
        </div>
      ) : (
        <form className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7" onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput
              autoComplete="name"
              error={errors.fullName}
              label="Full name"
              name="fullName"
              onChange={(value) => setField('fullName', value)}
              placeholder="Rahul Mehta"
              value={form.fullName}
            />
            <TextInput
              autoComplete="organization"
              error={errors.companyName}
              label="Company"
              name="companyName"
              onChange={(value) => setField('companyName', value)}
              placeholder="Acme Services Pvt Ltd"
              value={form.companyName}
            />
            <TextInput
              autoComplete="email"
              error={errors.workEmail}
              inputMode="email"
              label="Work email"
              name="workEmail"
              onChange={(value) => setField('workEmail', value)}
              placeholder="rahul@acme.com"
              type="email"
              value={form.workEmail}
            />
            <TextInput
              autoComplete="tel"
              error={errors.phone}
              inputMode="tel"
              label="Phone"
              name="phone"
              onChange={(value) => setField('phone', value)}
              placeholder="+91 98765 43210"
              type="tel"
              value={form.phone}
            />
            <SelectInput
              error={errors.employeeCount}
              label="Team size"
              name="employeeCount"
              onChange={(value) => setField('employeeCount', value)}
              options={employeeCounts}
              placeholder="Select size"
              value={form.employeeCount}
            />
            <TextInput
              label="Preferred date"
              name="preferredDate"
              onChange={(value) => setField('preferredDate', value)}
              required={false}
              type="date"
              value={form.preferredDate}
            />
            <div className="sm:col-span-2">
              <TextAreaInput
                label="What should we focus on?"
                name="message"
                onChange={(value) => setField('message', value)}
                placeholder="Geofenced attendance, leave approvals, desktop tracking, payroll reports..."
                required={false}
                value={form.message}
              />
            </div>
          </div>

          <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
            <FormMessage status={status} />
            <div className="sm:w-56">
              <PrimaryButton loading={status.state === 'loading'}>
                Request demo <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </div>
          </div>
        </form>
      )}
    </PageShell>
  )
}
