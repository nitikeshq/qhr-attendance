'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react'

import { Badge, DataTable, Drawer, EmptyState, Field, SectionCard, fieldClass } from './ui'

export type PlanRecord = {
  _id?: string
  name: string
  code?: string
  pricePerUser: number | null
  annualDiscountPercent?: number
  includedSeats?: number
  userLimit: number | null
  status: string
  description?: string
  features?: string[]
  sortOrder?: number
  highlighted?: boolean
  isFree?: boolean
}

type Draft = {
  name: string
  code: string
  priceMode: 'paid' | 'free' | 'custom'
  pricePerUser: string
  includedSeats: string
  annualDiscountPercent: string
  userLimit: string
  status: 'active' | 'inactive'
  description: string
  features: string
  sortOrder: string
  highlighted: boolean
}

function toDraft(plan?: PlanRecord | null): Draft {
  const priceMode: Draft['priceMode'] = plan
    ? plan.pricePerUser === null
      ? 'custom'
      : Number(plan.pricePerUser) === 0
        ? 'free'
        : 'paid'
    : 'paid'
  return {
    name: plan?.name || '',
    code: plan?.code || '',
    priceMode,
    pricePerUser: plan?.pricePerUser === null || plan?.pricePerUser === undefined ? '' : String(plan.pricePerUser),
    includedSeats: String(plan?.includedSeats ?? 0),
    annualDiscountPercent: String(plan?.annualDiscountPercent ?? 0),
    userLimit: plan?.userLimit === null || plan?.userLimit === undefined ? '' : String(plan.userLimit),
    status: plan?.status === 'inactive' ? 'inactive' : 'active',
    description: plan?.description || '',
    features: (plan?.features || []).join('\n'),
    sortOrder: String(plan?.sortOrder ?? 0),
    highlighted: plan?.highlighted === true,
  }
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Custom'
  return `Rs.${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default function PlanCatalogue({
  apiRoot, token, onChanged,
}: {
  apiRoot: string
  token: string
  onChanged: (message: string) => Promise<void> | void
}) {
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<PlanRecord | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(toDraft(null))

  async function request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; message?: string }> {
    const response = await fetch(`${apiRoot}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.message || 'Request failed')
    return { data: (body?.data || {}) as T, message: body?.message }
  }

  async function load() {
    setLoading(true)
    try {
      const { data } = await request<{ plans: PlanRecord[] }>('/admin/subscription-plans')
      setPlans(data.plans || [])
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load plans')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [apiRoot, token])

  const open = creating || Boolean(editing)

  function startCreate() {
    setDraft(toDraft(null))
    setEditing(null)
    setCreating(true)
    setError('')
  }

  function startEdit(plan: PlanRecord) {
    setDraft(toDraft(plan))
    setEditing(plan)
    setCreating(false)
    setError('')
  }

  function close() {
    setCreating(false)
    setEditing(null)
  }

  const payload = useMemo(() => ({
    name: draft.name.trim(),
    code: draft.code.trim(),
    pricePerUser: draft.priceMode === 'custom' ? null : draft.priceMode === 'free' ? 0 : Number(draft.pricePerUser || 0),
    includedSeats: Math.max(0, Math.floor(Number(draft.includedSeats) || 0)),
    annualDiscountPercent: Math.max(0, Math.min(100, Number(draft.annualDiscountPercent) || 0)),
    userLimit: draft.userLimit.trim() === '' ? null : Math.max(1, Math.floor(Number(draft.userLimit) || 1)),
    status: draft.status,
    description: draft.description.trim(),
    features: draft.features.split('\n').map((item) => item.trim()).filter(Boolean),
    sortOrder: Math.floor(Number(draft.sortOrder) || 0),
    highlighted: draft.highlighted,
  }), [draft])

  const localError = useMemo(() => {
    if (!payload.name) return 'Plan name is required.'
    if (draft.priceMode === 'paid' && !(Number(draft.pricePerUser) > 0)) return 'Enter a price above zero, or choose Free / Custom.'
    if (payload.pricePerUser === 0 && payload.includedSeats < 1) return 'A free plan must include at least one seat, otherwise nobody can sign in.'
    return ''
  }, [payload, draft.priceMode, draft.pricePerUser])

  async function save() {
    if (localError) { setError(localError); return }
    setBusy('save')
    setError('')
    try {
      const target = editing?._id ? `/admin/subscription-plans/${editing._id}` : '/admin/subscription-plans'
      const { message } = await request<{ plan: PlanRecord }>(target, {
        method: editing?._id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      close()
      await load()
      await onChanged(message || 'Plan saved')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the plan')
    } finally {
      setBusy('')
    }
  }

  async function remove(plan: PlanRecord) {
    if (!plan._id) return
    if (!window.confirm(`Delete the ${plan.name} plan? Companies already on it will block the delete.`)) return
    setBusy(`delete-${plan._id}`)
    setError('')
    try {
      const { message } = await request<Record<string, never>>(`/admin/subscription-plans/${plan._id}`, { method: 'DELETE' })
      await load()
      await onChanged(message || 'Plan deleted')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the plan')
    } finally {
      setBusy('')
    }
  }

  if (loading) {
    return (
      <SectionCard title="Plans and pricing" description="Loading the plan catalogue">
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="animate-in rounded-lg border border-red-200 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>
      )}

      <SectionCard
        title="Plans and pricing"
        description="Every plan sells exactly the seats a company buys. A free tier is expressed by including seats in the plan itself."
        icon={<Star className="h-4 w-4" />}
        actions={
          <button type="button" onClick={startCreate} className="gradient-button flex items-center gap-2 rounded-md px-3.5 py-2 text-sm">
            <Plus className="h-4 w-4" /> New plan
          </button>
        }
      >
        {!plans.length ? (
          <EmptyState label="No plans yet" hint="Create at least one plan so companies have something to buy." action={<button type="button" onClick={startCreate} className="gradient-button rounded-md px-3.5 py-2 text-sm">New plan</button>} />
        ) : (
          <DataTable
            headers={['Plan', 'Price / user / month', 'Included seats', 'Seat cap', 'Yearly discount', 'Status', 'Actions']}
            defaultPageSize={25}
            rows={plans.map((plan) => [
              <div key={`${plan._id}-name`} className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold">
                  {plan.name}
                  {plan.highlighted && <Star className="h-3 w-3 shrink-0 fill-current text-warning" />}
                </p>
                <p className="truncate text-xs text-ink-soft">{plan.code}{plan.description ? ` · ${plan.description}` : ''}</p>
              </div>,
              <span key={`${plan._id}-price`} className="font-semibold tabular-nums">{money(plan.pricePerUser)}</span>,
              <span key={`${plan._id}-seats`} className="tabular-nums">{plan.includedSeats ?? 0}</span>,
              <span key={`${plan._id}-cap`} className="tabular-nums">{plan.userLimit === null || plan.userLimit === undefined ? 'Unlimited' : plan.userLimit}</span>,
              <span key={`${plan._id}-disc`} className="tabular-nums">{plan.annualDiscountPercent ? `${plan.annualDiscountPercent}%` : '-'}</span>,
              <Badge key={`${plan._id}-status`}>{plan.status}</Badge>,
              <div key={`${plan._id}-actions`} className="flex gap-1.5">
                <button type="button" onClick={() => startEdit(plan)} aria-label={`Edit ${plan.name}`} className="ghost-button p-1.5"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => void remove(plan)} disabled={busy !== ''} aria-label={`Delete ${plan.name}`} className="ghost-button p-1.5 text-danger disabled:opacity-40">
                  {busy === `delete-${plan._id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>,
            ])}
          />
        )}
      </SectionCard>

      <SectionCard title="How the seat model works" description="Read this before changing prices.">
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {[
            'Purchased seats are the whole allowance. Ten seats means ten usable accounts, not eleven.',
            'A free tier is a plan with a price of zero and one or more included seats.',
            'Included seats are added on top of purchased seats, so keep them at zero on paid plans.',
            'Seat cap limits how many seats a company may buy on that plan. Leave it empty for unlimited.',
            'Set a plan to inactive to retire it. Companies already on it keep their subscription.',
            'Features are marketing copy shown on the company billing page, one per line.',
          ].map((item) => (
            <li key={item} className="flex gap-2.5 text-sm text-ink-soft">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
              {item}
            </li>
          ))}
        </ul>
      </SectionCard>

      {open && (
        <Drawer
          title={editing ? `Edit ${editing.name}` : 'New plan'}
          subtitle="Pricing, seats, and the feature list companies see"
          close={close}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-soft">{localError || 'Changes apply to new purchases immediately.'}</p>
              <div className="flex gap-2">
                <button type="button" onClick={close} className="neu-button rounded-md px-3 py-2 text-sm">Cancel</button>
                <button type="button" onClick={() => void save()} disabled={Boolean(localError) || busy !== ''} className="gradient-button flex items-center gap-2 rounded-md px-3.5 py-2 text-sm disabled:cursor-not-allowed">
                  {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editing ? 'Save plan' : 'Create plan'}
                </button>
              </div>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan name" required>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Code" hint="Used internally. Generated from the name when left empty.">
              <input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="professional" className={fieldClass} />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Pricing" required>
                <div className="grid grid-cols-3 gap-1 rounded-md border border-line bg-surface-subtle p-1">
                  {([['paid', 'Per seat'], ['free', 'Free tier'], ['custom', 'Contact sales']] as const).map(([value, label]) => (
                    <button
                      key={value} type="button" onClick={() => setDraft({ ...draft, priceMode: value })}
                      className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${draft.priceMode === value ? 'bg-white text-primary-700 shadow-card' : 'text-ink-soft hover:text-ink'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {draft.priceMode === 'paid' && (
              <Field label="Price per seat / month" required>
                <input type="number" min="0" step="0.01" value={draft.pricePerUser} onChange={(event) => setDraft({ ...draft, pricePerUser: event.target.value })} className={fieldClass} />
              </Field>
            )}
            <Field label="Included seats" hint={draft.priceMode === 'free' ? 'How many accounts the free tier allows.' : 'Keep at 0 so purchased seats are the entire allowance.'}>
              <input type="number" min="0" step="1" value={draft.includedSeats} onChange={(event) => setDraft({ ...draft, includedSeats: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Yearly discount %" hint="Applied when a company chooses yearly billing.">
              <input type="number" min="0" max="100" step="1" value={draft.annualDiscountPercent} onChange={(event) => setDraft({ ...draft, annualDiscountPercent: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Seat cap" hint="Maximum seats purchasable on this plan. Empty means unlimited.">
              <input type="number" min="1" step="1" value={draft.userLimit} onChange={(event) => setDraft({ ...draft, userLimit: event.target.value })} placeholder="Unlimited" className={fieldClass} />
            </Field>
            <Field label="Status">
              <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft['status'] })} className={fieldClass}>
                <option value="active">Active — available to buy</option>
                <option value="inactive">Inactive — hidden from new purchases</option>
              </select>
            </Field>
            <Field label="Display order" hint="Lower numbers appear first.">
              <input type="number" step="1" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} className={fieldClass} />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Short description">
                <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Full payroll, assets, and work management." className={fieldClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Features" hint="One per line. Shown on the company billing page.">
                <textarea rows={6} value={draft.features} onChange={(event) => setDraft({ ...draft, features: event.target.value })} className={fieldClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface-subtle px-3 py-2.5 text-sm">
                <input type="checkbox" checked={draft.highlighted} onChange={(event) => setDraft({ ...draft, highlighted: event.target.checked })} className="h-4 w-4 accent-primary-600" />
                <span>Highlight this plan as the recommended option</span>
              </label>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  )
}
