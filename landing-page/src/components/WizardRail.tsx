'use client'

import Link from 'next/link'
import { Check, CheckCircle, Lock, ShieldCheck, Users } from 'lucide-react'

export type RailStep = {
  key: string
  title: string
  summary: string
}

const assurances = [
  { icon: Lock, label: 'Encrypted in transit' },
  { icon: ShieldCheck, label: 'Role-based access from day one' },
  { icon: Users, label: 'No card required to start' },
]

/**
 * Dark brand rail for the registration wizard: identity, step progress, and the
 * trust signals an enterprise buyer looks for before handing over payroll data.
 * Desktop only — small screens get the compact progress header instead.
 */
export default function WizardRail({
  steps,
  activeIndex,
  onSelect,
}: {
  steps: RailStep[]
  activeIndex: number
  onSelect?: (index: number) => void
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-10 bg-slate-900 px-8 py-9 text-slate-300">
      <div>
        <Link aria-label="QHR home" className="flex items-center gap-3" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <CheckCircle className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-bold leading-none tracking-tight text-white">QHR</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-400">Attendance</span>
          </span>
        </Link>

        <p className="mt-10 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Account setup
        </p>

        <ol className="mt-5">
          {steps.map((step, index) => {
            const isDone = index < activeIndex
            const isActive = index === activeIndex
            const canJump = Boolean(onSelect) && isDone
            const isLast = index === steps.length - 1

            return (
              <li className="relative flex gap-4 pb-7 last:pb-0" key={step.key}>
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[13px] top-8 h-[calc(100%-2rem)] w-px ${isDone ? 'bg-blue-500' : 'bg-slate-700'}`}
                  />
                )}
                <span
                  aria-hidden="true"
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                    isDone
                      ? 'bg-blue-500 text-white'
                      : isActive
                        ? 'bg-white text-slate-900 ring-4 ring-blue-500/25'
                        : 'border border-slate-700 bg-slate-900 text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  {canJump ? (
                    <button
                      className="text-left text-sm font-semibold text-slate-200 underline-offset-4 transition hover:text-white hover:underline"
                      onClick={() => onSelect?.(index)}
                      type="button"
                    >
                      {step.title}
                    </button>
                  ) : (
                    <p
                      aria-current={isActive ? 'step' : undefined}
                      className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-400'}`}
                    >
                      {step.title}
                    </p>
                  )}
                  <p className={`mt-1 text-xs leading-5 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                    {step.summary}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="border-t border-slate-800 pt-6">
        <ul className="grid gap-2.5">
          {assurances.map((item) => {
            const Icon = item.icon
            return (
              <li className="flex items-center gap-2.5 text-xs text-slate-400" key={item.label}>
                <Icon className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                {item.label}
              </li>
            )
          })}
        </ul>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          Prefer a walkthrough first?{' '}
          <Link className="font-semibold text-blue-400 underline-offset-4 hover:underline" href="/demo">
            Book a demo
          </Link>
        </p>
      </div>
    </div>
  )
}
