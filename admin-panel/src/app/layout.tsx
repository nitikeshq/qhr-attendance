import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QHR Admin Panel',
  description: 'Admin dashboard for QHR HR Management System',
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
