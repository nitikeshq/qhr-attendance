import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QHR - AI-Powered HR Management Platform',
  description: 'Transform your workforce management with GPS-based attendance, smart analytics, and AI-powered insights. Start free today.',
  keywords: 'HR software, attendance management, employee tracking, payroll, leave management',
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
