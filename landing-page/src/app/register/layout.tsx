import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Register your company',
  description:
    'Create your QHR workspace in six guided steps: company profile, administrator account, security, review, and email activation.',
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
