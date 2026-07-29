'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, CalendarDays, Loader2, MapPin, Network, Receipt } from 'lucide-react'

import { Field, SectionCard, fieldClass } from './ui'

type Profile = {
  name: string
  email: string
  phone: string
  domain: string
  registeredAddress: string
  city: string
  state: string
  pincode: string
  industry: string
  foundedOn: string
  timezone: string
  officeStart: string
  officeEnd: string
}

const empty: Profile = {
  name: '', email: '', phone: '', domain: '', registeredAddress: '', city: '', state: '',
  pincode: '', industry: '', foundedOn: '', timezone: 'Asia/Kolkata', officeStart: '09:30', officeEnd: '18:30',
}

const INDUSTRIES = [
  'IT services', 'Manufacturing', 'Retail', 'Healthcare', 'Education', 'Logistics',
  'Construction', 'Financial services', 'Hospitality', 'Other',
]

function text(value: unknown) {
  return value === undefined || value === null ? '' : String(value)
}

/**
 * Company identity, edited from Settings.
 *
 * These are company-level details, not payroll mechanics, so they belong here
 * rather than buried inside the payroll workspace. It writes through the same
 * onboarding endpoint the setup checklist uses, so both stay in sync and the
 * checklist reflects edits made later.
 */
export default function CompanyProfileCard({ apiRoot, token, canEdit, onSaved, onOpenPage }: {
  apiRoot: string
  token: string
  canEdit: boolean
  onSaved: (message: string) => Promise<void> | void
  onOpenPage: (page: string) => void
}) {
  const [profile, setProfile] = useState<Profile>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState({ locations: 0, departments: 0, designations: 0, holidays: 0 })

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<{ data: T; message?: string }> => {
    const response = await fetch(`${apiRoot}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.message || 'Request failed')
    return { data: (body?.data || {}) as T, message: body?.message }
  }, [apiRoot, token])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      type Snapshot = {
        data?: {
          profile?: Record<string, unknown>
          settings?: Record<string, unknown>
          workLocations?: unknown[]
          departments?: unknown[]
          designations?: unknown[]
          holidays?: unknown[]
        }
      }
      const { data } = await request<Snapshot>('/onboarding')
      const source = data.data?.profile || {}
      const settings = data.data?.settings || {}
      setProfile({
        name: text(source.name),
        email: text(source.email),
        phone: text(source.phone),
        domain: text(source.domain),
        registeredAddress: text(source.registeredAddress),
        city: text(source.city),
        state: text(source.state),
        pincode: text(source.pincode),
        industry: text(source.industry),
        foundedOn: text(source.foundedOn),
        timezone: text(source.timezone) || text(settings.timezone) || 'Asia/Kolkata',
        officeStart: text(settings.officeStart) || '09:30',
        officeEnd: text(settings.officeEnd) || '18:30',
      })
      setCounts({
        locations: (data.data?.workLocations || []).length,
        departments: (data.data?.departments || []).length,
        designations: (data.data?.designations || []).length,
        holidays: (data.data?.holidays || []).length,
      })
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load company details')
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => { void load() }, [load])

  function update(patch: Partial<Profile>) {
    setProfile((current) => ({ ...current, ...patch }))
    setError('')
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const { message } = await request<Record<string, unknown>>('/onboarding/company_profile', {
        method: 'PATCH',
        body: JSON.stringify(profile),
      })
      await load()
      await onSaved(message || 'Company details saved')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save company details')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SectionCard title="Company details" description="Loading">
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading
        </div>
      </SectionCard>
    )
  }

  const links: Array<{ label: string; hint: string; page: string; icon: typeof MapPin }> = [
    { label: 'Work locations', hint: `${counts.locations} configured`, page: 'org', icon: MapPin },
    { label: 'Departments and designations', hint: `${counts.departments} / ${counts.designations}`, page: 'org', icon: Network },
    { label: 'Holidays and calendar', hint: `${counts.holidays} holidays`, page: 'calendar', icon: CalendarDays },
    { label: 'Payroll identity and statutory', hint: 'PAN, TAN, GSTIN, PF, ESI', page: 'payroll', icon: Receipt },
  ]

  return (
    <div className="space-y-4">
      <SectionCard
        title="Company details"
        description="Registered identity, contact details, address, and working hours. Used across payslips, attendance, and the shared calendar."
        icon={<Building2 className="h-4 w-4" />}
        actions={canEdit ? (
          <button type="button" onClick={() => void save()} disabled={saving} className="gradient-button flex items-center gap-2 rounded-md px-3.5 py-2 text-sm disabled:cursor-not-allowed">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save company details
          </button>
        ) : undefined}
      >
        {error && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>
        )}
        {!canEdit && (
          <p className="mb-4 rounded-md border border-line bg-surface-subtle px-3 py-2 text-sm text-ink-soft">
            A Company Admin can change these details. You can review them here.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registered company name" required>
            <input value={profile.name} disabled={!canEdit} onChange={(event) => update({ name: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Contact email" required>
            <input type="email" value={profile.email} disabled={!canEdit} onChange={(event) => update({ email: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Phone">
            <input value={profile.phone} disabled={!canEdit} onChange={(event) => update({ phone: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Email domain" hint="Used to auto-match employee sign-ups, e.g. acme.com">
            <input value={profile.domain} disabled={!canEdit} onChange={(event) => update({ domain: event.target.value })} className={fieldClass} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Registered address" required>
              <textarea rows={2} value={profile.registeredAddress} disabled={!canEdit} onChange={(event) => update({ registeredAddress: event.target.value })} className={fieldClass} />
            </Field>
          </div>
          <Field label="City" required>
            <input value={profile.city} disabled={!canEdit} onChange={(event) => update({ city: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="State" required>
            <input value={profile.state} disabled={!canEdit} onChange={(event) => update({ state: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Pincode" required>
            <input value={profile.pincode} disabled={!canEdit} onChange={(event) => update({ pincode: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Industry" required>
            <select value={profile.industry} disabled={!canEdit} onChange={(event) => update({ industry: event.target.value })} className={fieldClass}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>

          <Field label="Founded on" hint="Incorporation date. Produces the company anniversary on the shared calendar.">
            <input type="date" value={profile.foundedOn} disabled={!canEdit} onChange={(event) => update({ foundedOn: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Timezone" required>
            <input value={profile.timezone} disabled={!canEdit} onChange={(event) => update({ timezone: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Office start" required>
            <input type="time" value={profile.officeStart} disabled={!canEdit} onChange={(event) => update({ officeStart: event.target.value })} className={fieldClass} />
          </Field>
          <Field label="Office end" required>
            <input type="time" value={profile.officeEnd} disabled={!canEdit} onChange={(event) => update({ officeEnd: event.target.value })} className={fieldClass} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Other company configuration"
        description="The rest of the company setup, grouped where it is actually managed."
      >
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <li key={link.label}>
                <button
                  type="button"
                  onClick={() => onOpenPage(link.page)}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface-subtle px-3.5 py-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-primary-700 ring-1 ring-inset ring-line">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{link.label}</span>
                    <span className="block text-xs text-ink-soft">{link.hint}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </SectionCard>
    </div>
  )
}
