import type { Metadata } from 'next'
import './globals.css'

const title = 'QHR Attendance — Workforce attendance, leave, and payroll inputs'
const description =
  'QHR is a multi-tenant HRMS for growing companies: geofenced attendance, multi-level leave approval, org structure, role-based permissions, payroll inputs, assets, and work management in one system of record.'

export const metadata: Metadata = {
  title: {
    default: title,
    template: '%s · QHR Attendance',
  },
  description,
  applicationName: 'QHR Attendance',
  keywords: [
    'HRMS',
    'attendance management',
    'GPS attendance',
    'geofenced check-in',
    'leave management',
    'payroll inputs',
    'workforce management',
    'employee self-service',
  ],
  openGraph: {
    title,
    description,
    siteName: 'QHR Attendance',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
          href="#main-content"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
