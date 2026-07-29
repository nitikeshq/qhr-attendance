'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Headphones, Lock, Workflow } from 'lucide-react'

import PageShell from '@/components/PageShell'
import {
  FormMessage,
  PrimaryButton,
  TextAreaInput,
  TextInput,
  idleStatus,
  type FormStatus,
} from '@/components/forms'
import { postJson } from '@/lib/api'

type ContactForm = {
  name: string
  email: string
  phone: string
  company: string
  message: string
}

const emptyForm: ContactForm = {
  name: '',
  email: '',
  phone: '',
  company: '',
  message: '',
}

type Errors = Partial<Record<keyof ContactForm, string>>

function validate(form: ContactForm): Errors {
  const errors: Errors = {}
  if (form.name.trim().length < 2) errors.name = 'Enter your name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  if (form.message.trim().length < 10) errors.message = 'Tell us a little more so we can route this correctly.'
  return errors
}

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<FormStatus>(idleStatus)
  const [submitted, setSubmitted] = useState(false)

  const setField = (key: keyof ContactForm, value: string) => {
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

    setStatus({ state: 'loading', message: 'Sending your message...' })
    const result = await postJson('/contact', {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      message: form.message.trim(),
      source: 'contact-page',
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
      <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Where this goes</h2>
      <ul className="mt-4 grid gap-4">
        {[
          { icon: Headphones, title: 'Support', copy: 'Existing workspace issues and how-to questions.' },
          { icon: Workflow, title: 'Implementation', copy: 'Rollout planning, integrations, and data migration.' },
          { icon: Lock, title: 'Security and privacy', copy: 'Data handling, access controls, and compliance reviews.' },
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
          Evaluating QHR?{' '}
          <Link className="font-semibold text-blue-700 underline" href="/demo">
            Book a demo
          </Link>{' '}
          for a faster answer.
        </p>
      </div>
    </aside>
  )

  return (
    <PageShell
      aside={aside}
      description="Support, partnerships, security reviews, or implementation questions. One form, routed by our team."
      eyebrow="Contact"
      title="Talk to the QHR team"
    >
      {submitted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-xl font-bold tracking-tight text-emerald-900">Message sent</h2>
          <p className="mx-auto mt-2.5 max-w-md text-sm leading-6 text-emerald-800">
            We will reply to {form.email} within one business day.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              href="/"
            >
              Back to site <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <form className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7" onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput
              autoComplete="name"
              error={errors.name}
              label="Name"
              name="name"
              onChange={(value) => setField('name', value)}
              placeholder="Your name"
              value={form.name}
            />
            <TextInput
              autoComplete="email"
              error={errors.email}
              inputMode="email"
              label="Email"
              name="email"
              onChange={(value) => setField('email', value)}
              placeholder="you@company.com"
              type="email"
              value={form.email}
            />
            <TextInput
              autoComplete="tel"
              inputMode="tel"
              label="Phone"
              name="phone"
              onChange={(value) => setField('phone', value)}
              placeholder="+91 98765 43210"
              required={false}
              type="tel"
              value={form.phone}
            />
            <TextInput
              autoComplete="organization"
              label="Company"
              name="company"
              onChange={(value) => setField('company', value)}
              placeholder="Company name"
              required={false}
              value={form.company}
            />
            <div className="sm:col-span-2">
              <TextAreaInput
                error={errors.message}
                label="Message"
                name="message"
                onChange={(value) => setField('message', value)}
                placeholder="How can the QHR team help?"
                rows={5}
                value={form.message}
              />
            </div>
          </div>

          <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
            <FormMessage status={status} />
            <div className="sm:w-56">
              <PrimaryButton loading={status.state === 'loading'}>
                Send message <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </div>
          </div>
        </form>
      )}
    </PageShell>
  )
}
