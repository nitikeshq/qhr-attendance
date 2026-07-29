import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'

/**
 * Chrome shared by the standalone form routes (/register, /demo, /contact).
 * Deliberately quieter than the marketing header so the form stays the focus.
 */
export default function PageShell({
  eyebrow,
  title,
  description,
  children,
  aside,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link aria-label="QHR home" className="flex items-center gap-3" href="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <CheckCircle className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-bold leading-none tracking-tight">QHR</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-600">
                Attendance
              </span>
            </span>
          </Link>
          <Link
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to site</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 lg:px-8 lg:py-14" id="main-content">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">{eyebrow}</p>
          <h1 className="mt-2.5 text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight tracking-tight">
            {title}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
        </div>

        <div className={`mt-8 ${aside ? 'grid gap-8 lg:grid-cols-[1fr_20rem] lg:gap-10' : ''}`}>
          <div className="min-w-0">{children}</div>
          {aside && <div className="min-w-0">{aside}</div>}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>Copyright 2026 QHR Attendance.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-1">
            <Link className="transition hover:text-slate-800" href="/privacy">
              Privacy
            </Link>
            <Link className="transition hover:text-slate-800" href="/terms">
              Terms
            </Link>
            <Link className="transition hover:text-slate-800" href="/security">
              Security
            </Link>
            <Link className="transition hover:text-slate-800" href="/contact">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
