import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

import { adminUrl } from '@/lib/api'

const columns: Array<{
  heading: string
  links: Array<{ label: string; href: string; external?: boolean }>
}> = [
  {
    heading: 'Product',
    links: [
      { label: 'Platform modules', href: '#platform' },
      { label: 'For each team', href: '#teams' },
      { label: 'Security', href: '#security' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    heading: 'Get started',
    links: [
      { label: 'Register a company', href: '/register' },
      { label: 'Request a demo', href: '/demo' },
      { label: 'Company login', href: adminUrl, external: true },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Support', href: '/contact' },
      { label: 'Partnerships', href: '/contact' },
      { label: 'Security review', href: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Notice', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Security', href: '/security' },
      { label: 'Subprocessors', href: '/subprocessors' },
    ],
  },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                <CheckCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-base font-bold leading-none text-white">QHR Attendance</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-400">
                  Workforce operations
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6">
              Attendance, leave, payroll inputs, org structure, assets, and work management in one
              multi-tenant system with role-based access.
            </p>
          </div>

          {columns.map((column) => (
            <nav aria-label={column.heading} key={column.heading}>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white">{column.heading}</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    {link.external ? (
                      <a className="transition hover:text-white" href={link.href}>
                        {link.label}
                      </a>
                    ) : link.href.startsWith('#') ? (
                      <a className="transition hover:text-white" href={link.href}>
                        {link.label}
                      </a>
                    ) : (
                      <Link className="transition hover:text-white" href={link.href}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-slate-800 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright 2026 QHR Attendance. All rights reserved.</p>
          <p>Built for growing companies that outgrew spreadsheets.</p>
        </div>
      </div>
    </footer>
  )
}
