'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'

export type StatusState = 'idle' | 'loading' | 'success' | 'error'

export type FormStatus = {
  state: StatusState
  message: string
}

export const idleStatus: FormStatus = { state: 'idle', message: '' }

export function FormMessage({ status }: { status: FormStatus }) {
  if (status.state === 'idle' || !status.message) return null

  const isError = status.state === 'error'
  const isSuccess = status.state === 'success'
  const tone = isError
    ? 'border-red-200 bg-red-50 text-red-800'
    : isSuccess
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-blue-200 bg-blue-50 text-blue-800'

  const Icon = isError ? AlertCircle : isSuccess ? CheckCircle2 : Loader2

  return (
    <p
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium ${tone}`}
      role={isError ? 'alert' : 'status'}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${status.state === 'loading' ? 'animate-spin' : ''}`} />
      <span>{status.message}</span>
    </p>
  )
}

type BaseFieldProps = {
  label: string
  name: string
  hint?: string
  error?: string
  required?: boolean
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

function FieldShell({ label, name, hint, error, required = true, children }: BaseFieldProps) {
  const id = `field-${name}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1.5">
      <label className="flex items-baseline gap-1.5 text-sm font-semibold text-slate-800" htmlFor={id}>
        <span>{label}</span>
        {!required && <span className="text-xs font-medium text-slate-400">Optional</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-red-700" id={errorId}>
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p className="text-xs text-slate-500" id={hintId}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}

function controlClass(invalid: boolean) {
  return `w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] text-slate-950 outline-none transition placeholder:text-slate-400 ${
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100'
      : 'border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
  }`
}

export function TextInput({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  error,
  required = true,
  autoComplete,
  inputMode,
  maxLength,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  hint?: string
  error?: string
  required?: boolean
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
  maxLength?: number
}) {
  return (
    <FieldShell label={label} name={name} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <input
          aria-describedby={describedBy}
          aria-invalid={invalid}
          autoComplete={autoComplete}
          className={controlClass(invalid)}
          id={id}
          inputMode={inputMode}
          maxLength={maxLength}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
      )}
    </FieldShell>
  )
}

export function SelectInput({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  hint,
  error,
  required = true,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  hint?: string
  error?: string
  required?: boolean
}) {
  return (
    <FieldShell label={label} name={name} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <select
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={controlClass(invalid)}
          id={id}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  )
}

export function TextAreaInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  hint,
  error,
  required = true,
  rows = 4,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  error?: string
  required?: boolean
  rows?: number
}) {
  return (
    <FieldShell label={label} name={name} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`${controlClass(invalid)} resize-y`}
          id={id}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          value={value}
        />
      )}
    </FieldShell>
  )
}

export function PrimaryButton({
  children,
  loading = false,
  disabled = false,
  type = 'submit',
  onClick,
}: {
  children: ReactNode
  loading?: boolean
  disabled?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
}) {
  return (
    <button
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  disabled = false,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

export function PasswordInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  hint,
  error,
  autoComplete = 'new-password',
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  error?: string
  autoComplete?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <FieldShell error={error} hint={hint} label={label} name={name}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoComplete={autoComplete}
            className={`${controlClass(invalid)} pr-12`}
            id={id}
            name={name}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            type={visible ? 'text' : 'password'}
            value={value}
          />
          <button
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 transition hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            onClick={() => setVisible((current) => !current)}
            type="button"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      )}
    </FieldShell>
  )
}

const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'] as const

/** Segmented strength bar driven by how many policy rules a password satisfies. */
export function StrengthMeter({ satisfied, total }: { satisfied: number; total: number }) {
  const score = total === 0 ? 0 : Math.round((satisfied / total) * 4)
  const label = strengthLabels[Math.min(score, strengthLabels.length - 1)]
  const tone =
    score >= 4
      ? 'bg-emerald-500'
      : score === 3
        ? 'bg-blue-500'
        : score === 2
          ? 'bg-amber-500'
          : 'bg-red-500'

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600">Password strength</span>
        <span
          aria-live="polite"
          className={`text-xs font-bold ${
            score >= 4 ? 'text-emerald-700' : score === 3 ? 'text-blue-700' : score === 2 ? 'text-amber-700' : 'text-red-700'
          }`}
        >
          {satisfied === 0 ? '—' : label}
        </span>
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((segment) => (
          <span
            className={`h-1.5 flex-1 rounded-full transition-colors ${segment < score ? tone : 'bg-slate-200'}`}
            key={segment}
          />
        ))}
      </div>
    </div>
  )
}
