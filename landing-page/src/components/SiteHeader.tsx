'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle, Menu, Smartphone, X } from 'lucide-react'

import { navLinks } from '@/content/landing'
import { adminUrl } from '@/lib/api'

export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="sticky top-0 z-50">
      {/* Utility strip: quiet links that a buyer needs but that must not compete
          with the primary calls to action. */}
      <div className="hidden border-b border-slate-800 bg-slate-900 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-1.5 text-xs text-slate-400">
          <p>Workforce attendance, leave, and payroll inputs for growing companies</p>
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="h-3 w-3" />
              Employee apps for iOS, Android, and web
            </span>
            <a className="font-semibold text-slate-200 transition hover:text-white" href={adminUrl}>
              Company login
            </a>
          </div>
        </div>
      </div>

      <div
        className={`border-b bg-white/90 backdrop-blur transition-colors ${
          scrolled ? 'border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.06)]' : 'border-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3.5 lg:px-8">
          <Link aria-label="QHR home" className="flex items-center gap-2.5" href="/">
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

          <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
            {navLinks.map((link) => (
              <a className="transition hover:text-slate-950" href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              href="/demo"
            >
              Request a demo
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              href="/register"
            >
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <button
            aria-controls="mobile-nav"
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="rounded-lg border border-slate-200 p-2 text-slate-700 lg:hidden"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-slate-200 bg-white px-5 py-4 lg:hidden" id="mobile-nav">
            <nav aria-label="Mobile" className="grid gap-1">
              {navLinks.map((link) => (
                <a
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  href={link.href}
                  key={link.href}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
              <Link
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                href="/register"
                onClick={() => setOpen(false)}
              >
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"
                href="/demo"
                onClick={() => setOpen(false)}
              >
                Request a demo
              </Link>
              <a
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600"
                href={adminUrl}
              >
                Company login
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
