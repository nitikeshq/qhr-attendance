import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QHR Attendance - Workforce Attendance and HRMS',
  description:
    'QHR Attendance helps SMEs manage GPS attendance, leave, WFH, payroll inputs, grievances, wellness, desktop activity, and company onboarding.',
  keywords:
    'QHR, attendance management, GPS attendance, HRMS, leave management, WFH requests, employee tracking',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
