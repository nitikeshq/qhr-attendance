import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact the team',
  description:
    'Reach the QHR team for support, implementation help, partnerships, or a security and privacy review.',
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
