import Link from 'next/link'
import { ArrowRight, Check, ChevronDown, Lock, ShieldCheck } from 'lucide-react'

import ConsolePreview from '@/components/ConsolePreview'
import SiteFooter from '@/components/SiteFooter'
import SiteHeader from '@/components/SiteHeader'
import {
  entryPoints,
  faqs,
  heroProof,
  modules,
  personas,
  planIncludes,
  pricingPlans,
  rollout,
  securityPoints,
  surfaces,
} from '@/content/landing'
import { adminUrl } from '@/lib/api'

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main className="bg-white text-slate-950" id="main-content">
        <Hero />
        <SurfaceBand />
        <Platform />
        <Teams />
        <Rollout />
        <Security />
        <Pricing />
        <GetStarted />
        <Faq />
        <ClosingCta />
      </main>

      <SiteFooter />
    </>
  )
}

/* ---------------------------------------------------------------- shared bits */

function SectionHeading({
  eyebrow,
  title,
  copy,
  align = 'left',
  tone = 'light',
}: {
  eyebrow: string
  title: string
  copy?: string
  align?: 'left' | 'center'
  tone?: 'light' | 'dark'
}) {
  const isDark = tone === 'dark'

  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className={`text-xs font-bold uppercase tracking-[0.2em] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
        {eyebrow}
      </p>
      <h2
        className={`mt-3 text-[clamp(1.6rem,3.2vw,2.35rem)] font-bold leading-[1.15] tracking-tight ${
          isDark ? 'text-white' : 'text-slate-950'
        }`}
      >
        {title}
      </h2>
      {copy && (
        <p className={`mt-4 text-base leading-7 sm:text-lg sm:leading-8 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {copy}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200" id="top">
      <div aria-hidden="true" className="absolute inset-0 bg-hero-grid opacity-60" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:px-8 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Multi-tenant HRMS with role-based access
          </p>

          <h1 className="mt-6 text-[clamp(2.1rem,5vw,3.4rem)] font-bold leading-[1.08] tracking-tight text-slate-950">
            One system of record for attendance, leave, and payroll inputs.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            QHR connects geofenced check-in, multi-level approvals, org structure, and payroll
            calculation so the number on the payslip traces back to a real attendance record.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700"
              href="/register"
            >
              Register your company <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              href="/demo"
            >
              Request a demo
            </Link>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Free for up to 5 employees. No card required to start.
          </p>

          <dl className="mt-10 grid max-w-lg grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-5">
            {heroProof.map((item) => (
              <div className="px-4 first:pl-0 last:pr-0" key={item.label}>
                <dt className="text-2xl font-bold tracking-tight text-slate-950">{item.value}</dt>
                <dd className="mt-1 text-xs font-medium leading-5 text-slate-500">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:pl-4">
          <ConsolePreview />
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- surface band */

function SurfaceBand() {
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Three surfaces, one record
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {surfaces.map((surface) => {
            const Icon = surface.icon
            return (
              <div className="flex gap-3.5" key={surface.name}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">{surface.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{surface.copy}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------- platform */

function Platform() {
  return (
    <section className="border-b border-slate-200 py-20 lg:py-24" id="platform">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          copy="Every module writes to the same tenant, so approvals follow your org chart and payroll reads the attendance it actually depends on."
          eyebrow="Platform"
          title="Eight modules that share one data model"
        />

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => {
            const Icon = module.icon
            return (
              <article className="flex flex-col bg-white p-6 transition hover:bg-slate-50" key={module.name}>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-base font-bold leading-6 tracking-tight text-slate-950">
                  {module.name}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{module.summary}</p>
                <ul className="mt-5 space-y-1.5 border-t border-slate-100 pt-4">
                  {module.points.map((point) => (
                    <li className="flex gap-2 text-xs leading-5 text-slate-600" key={point}>
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------- teams */

function Teams() {
  return (
    <section className="border-b border-slate-200 bg-slate-50 py-20 lg:py-24" id="teams">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          copy="The same record serves four different jobs. Nobody has to re-key data for the next team downstream."
          eyebrow="For each team"
          title="What every group actually gets"
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {personas.map((persona) => {
            const Icon = persona.icon
            return (
              <article className="rounded-xl border border-slate-200 bg-white p-6" key={persona.role}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{persona.role}</p>
                </div>
                <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-950">{persona.headline}</h3>
                <ul className="mt-4 space-y-2.5">
                  {persona.outcomes.map((outcome) => (
                    <li className="flex gap-2.5 text-sm leading-6 text-slate-600" key={outcome}>
                      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-blue-600" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------- rollout */

function Rollout() {
  return (
    <section className="border-b border-slate-200 py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          copy="Self-serve from the first click. There is no implementation call standing between you and a working attendance record."
          eyebrow="Rollout"
          title="Live in five steps, not five weeks"
        />

        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-5">
          {rollout.map((item, index) => (
            <li className="relative bg-white p-6" key={item.step}>
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                    index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.step}
                </span>
                {index < rollout.length - 1 && (
                  <span aria-hidden="true" className="hidden h-px flex-1 bg-slate-200 md:block" />
                )}
              </div>
              <h3 className="mt-4 text-sm font-bold leading-6 text-slate-950">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------- security */

function Security() {
  return (
    <section className="border-b border-slate-800 bg-slate-950 py-20 text-white lg:py-24" id="security">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <SectionHeading
              copy="You are handing over salary and location data. These are the controls that are actually implemented, not a certification wish list."
              eyebrow="Security and governance"
              title="Built for data you cannot afford to leak"
              tone="dark"
            />
            <Link
              className="mt-8 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700 px-5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-white/5"
              href="/contact"
            >
              Request a security review <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 sm:grid-cols-2">
            {securityPoints.map((point) => {
              const Icon = point.icon
              return (
                <div className="bg-slate-900 p-5" key={point.title}>
                  <Icon className="h-5 w-5 text-blue-400" />
                  <h3 className="mt-4 text-sm font-bold text-white">{point.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-400">{point.copy}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------- pricing */

function Pricing() {
  return (
    <section className="border-b border-slate-200 py-20 lg:py-24" id="pricing">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            copy="Per employee, per month. Start free, move up when you need payroll inputs and desktop hours."
            eyebrow="Pricing"
            title="Transparent tiers, no seat minimums"
          />
          <Link
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
            href="/demo"
          >
            Compare in a demo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <article
              className={`relative flex flex-col rounded-xl border p-6 ${
                plan.highlighted ? 'border-blue-600 bg-white ring-1 ring-blue-600' : 'border-slate-200 bg-white'
              }`}
              key={plan.name}
            >
              {plan.highlighted && (
                <p className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  Most chosen
                </p>
              )}

              <h3 className="text-lg font-bold tracking-tight text-slate-950">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{plan.audience}</p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight text-slate-950">{plan.price}</span>
                {plan.cadence && <span className="text-xs text-slate-500">{plan.cadence}</span>}
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">{plan.description}</p>

              <ul className="mt-6 flex-1 space-y-2.5 border-t border-slate-100 pt-5">
                {plan.features.map((feature) => (
                  <li className="flex gap-2.5 text-sm leading-6 text-slate-700" key={feature}>
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-blue-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                className={`mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition ${
                  plan.highlighted
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50'
                }`}
                href={plan.href}
              >
                {plan.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Every plan includes</p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {planIncludes.map((item) => (
              <li className="flex gap-2.5 text-sm text-slate-700" key={item}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- get started */

function GetStarted() {
  return (
    <section className="border-b border-slate-200 bg-slate-50 py-20 lg:py-24" id="forms">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          copy="Each route is a short, focused flow. Nothing is submitted until you have reviewed it."
          eyebrow="Get started"
          title="Pick the path that matches where you are"
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {entryPoints.map((entry) => {
            const Icon = entry.icon
            return (
              <article
                className={`flex flex-col rounded-xl border bg-white p-6 ${
                  entry.featured ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'
                }`}
                key={entry.href}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      entry.featured ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                    {entry.meta}
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-950">{entry.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{entry.description}</p>

                <ol className="mt-5 flex-1 space-y-2.5 border-t border-slate-100 pt-5">
                  {entry.steps.map((step, index) => (
                    <li className="flex gap-2.5 text-sm leading-6 text-slate-700" key={step}>
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <Link
                  className={`mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition ${
                    entry.featured
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                  href={entry.href}
                >
                  {entry.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            )
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 text-sm text-slate-600">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
            Already registered? Sign in to continue guided onboarding.
          </p>
          <a
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
            href={adminUrl}
          >
            Company login <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------------ faq */

function Faq() {
  return (
    <section className="border-b border-slate-200 py-20 lg:py-24" id="faq">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <SectionHeading
            copy="Still unsure about something? Ask us directly and we will answer in one business day."
            eyebrow="FAQ"
            title="The questions buyers actually ask"
          />
          <Link
            className="mt-8 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
            href="/contact"
          >
            Ask a question <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {faqs.map((faq) => (
            <details className="group py-5" key={faq.question}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-semibold text-slate-950">
                <span>{faq.question}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- closing cta */

function ClosingCta() {
  return (
    <section className="py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-14 text-center sm:px-14">
          <div aria-hidden="true" className="absolute inset-0 bg-hero-grid opacity-[0.35]" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-[clamp(1.6rem,3.2vw,2.35rem)] font-bold leading-[1.15] tracking-tight text-white">
              Start with attendance today. Add payroll when you are ready.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
              Free for the first five employees, and setup is guided end to end. You can always talk
              to us first.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
                href="/register"
              >
                Register your company <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-6 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-white/5 sm:w-auto"
                href="/demo"
              >
                Request a demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
