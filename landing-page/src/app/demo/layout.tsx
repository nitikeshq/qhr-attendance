import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Request a demo',
  description:
    'Book a 30-minute QHR walkthrough built around your own shifts, work locations, approval chains, and payroll inputs.',
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
