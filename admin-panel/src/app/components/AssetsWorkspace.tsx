'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Laptop, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2, UserPlus, Wrench, X } from 'lucide-react'
import {
  Badge,
  DataTable,
  Drawer,
  EmployeeProfileLink,
  EmptyState,
  Field,
  KeyValue,
  SearchableSelect,
  SectionCard,
  fieldClass,
  humanize,
  type EmployeeProfileTab,
  type Option,
} from './ui'

type EmployeeRef = { _id: string; employeeId: string; firstName?: string; lastName?: string }

export type AssetAssignment = {
  _id: string
  employeeId: string
  employee?: EmployeeRef | null
  assignedAt?: string | null
  expectedReturnAt?: string | null
  returnedAt?: string | null
  conditionOnAssign?: string | null
  conditionOnReturn?: string | null
  acknowledgedAt?: string | null
  notes?: string | null
  status: string
}

export type Asset = {
  _id: string
  assetTag: string
  name: string
  category: string
  serialNumber?: string | null
  make?: string | null
  model?: string | null
  workLocationId?: string | null
  workLocationName?: string | null
  condition: string
  status: string
  notes?: string | null
  assignedTo?: EmployeeRef | null
  currentAssignment?: AssetAssignment | null
}

export type AssetSummary = {
  total: number
  byStatus: Record<string, number>
  byCategory: Record<string, number>
  assigned: number
  available: number
}

type Props = {
  apiRoot: string
  token: string
  role: 'manager' | 'hr' | 'admin'
  employees: Array<{ _id: string; name: string; employeeId: string; department?: string }>
  workLocations: Array<{ _id: string; name: string }>
  onOpenEmployee?: (employeeId: string, tab: EmployeeProfileTab, period?: string) => void
  onChanged: (message: string) => Promise<void> | void
}

type DrawerMode = 'create' | 'edit' | 'assign' | 'return' | 'detail'
type AssetDetail = { asset: Asset; assignments: AssetAssignment[] }

type AssetForm = {
  assetTag: string
  name: string
  category: string
  serialNumber: string
  make: string
  model: string
  workLocationId: string
  condition: string
  status: string
  notes: string
}

type AssignForm = { employeeId: string; expectedReturnAt: string; conditionOnAssign: string; notes: string }
type ReturnForm = { conditionOnReturn: string; notes: string }

const CATEGORIES = ['laptop', 'desktop', 'mobile', 'monitor', 'accessory', 'furniture', 'vehicle', 'software_license', 'other']
const CONDITIONS = ['new', 'good', 'fair', 'damaged', 'retired']
const STATUSES = ['available', 'assigned', 'in_repair', 'retired', 'lost']

const emptyForm: AssetForm = {
  assetTag: '',
  name: '',
  category: 'laptop',
  serialNumber: '',
  make: '',
  model: '',
  workLocationId: '',
  condition: 'good',
  status: 'available',
  notes: '',
}

function toOptions(values: string[]): Option[] {
  return values.map((value) => ({ value, label: humanize(value) }))
}

function reason(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function employeeName(employee?: EmployeeRef | null) {
  if (!employee) return ''
  return `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeId
}

async function request<T>(apiRoot: string, token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`)
  return payload.data as T
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="neu-inset rounded-lg p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export default function AssetsWorkspace({ apiRoot, token, role, employees, workLocations, onOpenEmployee, onChanged }: Props) {
  const canManage = role === 'hr' || role === 'admin'
  const [assets, setAssets] = useState<Asset[]>([])
  const [summary, setSummary] = useState<AssetSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [holderId, setHolderId] = useState('')
  const [workLocationId, setWorkLocationId] = useState('')

  const [mode, setMode] = useState<DrawerMode | null>(null)
  const [active, setActive] = useState<Asset | null>(null)
  const [form, setForm] = useState<AssetForm>(emptyForm)
  const [assignForm, setAssignForm] = useState<AssignForm>({ employeeId: '', expectedReturnAt: '', conditionOnAssign: 'good', notes: '' })
  const [returnForm, setReturnForm] = useState<ReturnForm>({ conditionOnReturn: 'good', notes: '' })
  const [detail, setDetail] = useState<AssetDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const employeeOptions = useMemo<Option[]>(
    () => employees.map((employee) => ({ value: employee._id, label: employee.name, hint: [employee.employeeId, employee.department].filter(Boolean).join(' • ') })),
    [employees],
  )
  const locationOptions = useMemo<Option[]>(() => workLocations.map((location) => ({ value: location._id, label: location.name })), [workLocations])
  const categoryOptions = useMemo(() => toOptions(CATEGORIES), [])
  const conditionOptions = useMemo(() => toOptions(CONDITIONS), [])
  const statusOptions = useMemo(() => toOptions(STATUSES), [])

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (query) params.set('q', query)
      if (category) params.set('category', category)
      if (status) params.set('status', status)
      if (holderId) params.set('employeeId', holderId)
      if (workLocationId) params.set('workLocationId', workLocationId)
      const [list, totals] = await Promise.all([
        request<{ assets: Asset[] }>(apiRoot, token, `/assets?${params.toString()}`),
        request<AssetSummary>(apiRoot, token, '/assets/summary'),
      ])
      setAssets(list.assets || [])
      setSummary(totals)
    } catch (failure) {
      setError(reason(failure, 'Could not load assets'))
    } finally {
      setLoading(false)
    }
  }, [apiRoot, token, query, category, status, holderId, workLocationId])

  useEffect(() => { void load() }, [load])

  function closeDrawer() {
    setMode(null)
    setActive(null)
    setDetail(null)
  }

  function openCreate() {
    setActive(null)
    setForm(emptyForm)
    setMode('create')
  }

  function openEdit(asset: Asset) {
    setActive(asset)
    setForm({
      assetTag: asset.assetTag || '',
      name: asset.name || '',
      category: asset.category || 'other',
      serialNumber: asset.serialNumber || '',
      make: asset.make || '',
      model: asset.model || '',
      workLocationId: asset.workLocationId || '',
      condition: asset.condition || 'good',
      status: asset.status || 'available',
      notes: asset.notes || '',
    })
    setMode('edit')
  }

  function openAssign(asset: Asset) {
    setActive(asset)
    setAssignForm({ employeeId: '', expectedReturnAt: '', conditionOnAssign: asset.condition || 'good', notes: '' })
    setMode('assign')
  }

  function openReturn(asset: Asset) {
    setActive(asset)
    setReturnForm({ conditionOnReturn: asset.condition || 'good', notes: '' })
    setMode('return')
  }

  const openDetail = useCallback(async (asset: Asset) => {
    setActive(asset)
    setMode('detail')
    setDetail(null)
    setDetailLoading(true)
    setError('')
    try {
      const result = await request<AssetDetail>(apiRoot, token, `/assets/${asset._id}`)
      setDetail(result)
    } catch (failure) {
      setError(reason(failure, 'Could not load asset history'))
    } finally {
      setDetailLoading(false)
    }
  }, [apiRoot, token])

  async function mutate(key: string, path: string, options: RequestInit, message: string) {
    setBusy(key)
    setError('')
    try {
      await request<Record<string, unknown>>(apiRoot, token, path, options)
      await onChanged(message)
      await load()
      return true
    } catch (failure) {
      setError(reason(failure, message ? `${message} failed` : 'Request failed'))
      return false
    } finally {
      setBusy('')
    }
  }

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = {
      assetTag: form.assetTag.trim(),
      name: form.name.trim(),
      category: form.category,
      serialNumber: form.serialNumber.trim() || null,
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      workLocationId: form.workLocationId || null,
      condition: form.condition,
      status: form.status,
      notes: form.notes.trim() || null,
    }
    const editing = mode === 'edit' && active
    const done = await mutate(
      'save',
      editing ? `/assets/${active._id}` : '/assets',
      { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) },
      editing ? 'Asset updated' : 'Asset added',
    )
    if (done) closeDrawer()
  }

  async function assignAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!active) return
    if (!assignForm.employeeId) {
      setError('Select the employee taking custody of this asset.')
      return
    }
    const done = await mutate(
      'assign',
      `/assets/${active._id}/assign`,
      {
        method: 'POST',
        body: JSON.stringify({
          employeeId: assignForm.employeeId,
          expectedReturnAt: assignForm.expectedReturnAt || null,
          conditionOnAssign: assignForm.conditionOnAssign,
          notes: assignForm.notes.trim() || null,
        }),
      },
      'Asset assigned',
    )
    if (done) closeDrawer()
  }

  async function returnAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!active) return
    const done = await mutate(
      'return',
      `/assets/${active._id}/return`,
      {
        method: 'POST',
        body: JSON.stringify({ conditionOnReturn: returnForm.conditionOnReturn, notes: returnForm.notes.trim() || null }),
      },
      'Asset returned',
    )
    if (done) closeDrawer()
  }

  async function removeAsset(asset: Asset) {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${asset.assetTag}? Assigned assets cannot be deleted.`)) return
    await mutate(`delete-${asset._id}`, `/assets/${asset._id}`, { method: 'DELETE' }, 'Asset deleted')
  }

  const inRepair = summary?.byStatus?.in_repair ?? assets.filter((asset) => asset.status === 'in_repair').length
  const filtersApplied = Boolean(query || category || status || holderId || workLocationId)

  const rows = assets.map((asset) => {
    const assigned = asset.status === 'assigned' && asset.currentAssignment
    return [
      <div key="asset" className="min-w-0">
        <p className="font-semibold text-slate-800">{asset.name}</p>
        <p className="text-xs text-slate-500">{[asset.make, asset.model, asset.serialNumber].filter(Boolean).join(' • ') || 'No serial recorded'}</p>
      </div>,
      <span key="tag" className="font-mono text-xs font-semibold text-slate-700">{asset.assetTag}</span>,
      humanize(asset.category),
      asset.assignedTo ? (
        <div key="holder" className="min-w-0">
          <EmployeeProfileLink employeeId={asset.assignedTo._id} tab="assets" onOpen={onOpenEmployee}>{employeeName(asset.assignedTo)}</EmployeeProfileLink>
          <p className="text-xs text-slate-500">{asset.assignedTo.employeeId}</p>
        </div>
      ) : <span key="holder" className="text-slate-400">Unassigned</span>,
      asset.workLocationName || <span key="location" className="text-slate-400">Not set</span>,
      <Badge key="condition">{asset.condition}</Badge>,
      <Badge key="status">{asset.status}</Badge>,
      <div key="actions" className="flex flex-wrap gap-2">
        <button type="button" aria-label={`View ${asset.assetTag}`} onClick={() => { void openDetail(asset) }} className="neu-button rounded-md p-2">
          <Eye className="h-4 w-4" />
        </button>
        {canManage && (
          <>
            {assigned ? (
              <button type="button" disabled={busy !== ''} onClick={() => openReturn(asset)} className="neu-button rounded-md px-2.5 py-2 text-xs font-semibold disabled:opacity-50">
                <RotateCcw className="mr-1 inline h-3.5 w-3.5" />Return
              </button>
            ) : (
              <button
                type="button" disabled={busy !== '' || ['retired', 'lost'].includes(asset.status)}
                onClick={() => openAssign(asset)}
                className="neu-button rounded-md px-2.5 py-2 text-xs font-semibold disabled:opacity-50"
              >
                <UserPlus className="mr-1 inline h-3.5 w-3.5" />Assign
              </button>
            )}
            <button type="button" aria-label={`Edit ${asset.assetTag}`} onClick={() => openEdit(asset)} className="neu-button rounded-md p-2">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button" aria-label={`Delete ${asset.assetTag}`} disabled={busy === `delete-${asset._id}`}
              onClick={() => { void removeAsset(asset) }}
              className="neu-button rounded-md p-2 text-red-600 disabled:opacity-50"
            >
              {busy === `delete-${asset._id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </>
        )}
      </div>,
    ]
  })

  const historyRows = (detail?.assignments || []).map((assignment) => [
    <div key="employee" className="min-w-0">
      {assignment.employee?._id ? (
        <><EmployeeProfileLink employeeId={assignment.employee._id} tab="assets" onOpen={onOpenEmployee}>{employeeName(assignment.employee) || assignment.employeeId}</EmployeeProfileLink><p className="text-xs text-slate-500">{assignment.employee.employeeId}</p></>
      ) : <p className="font-semibold text-slate-800">{assignment.employeeId}</p>}
    </div>,
    formatDate(assignment.assignedAt),
    formatDate(assignment.expectedReturnAt),
    formatDate(assignment.returnedAt),
    humanize(assignment.conditionOnAssign || '-'),
    assignment.conditionOnReturn ? humanize(assignment.conditionOnReturn) : <span key="condition-in" className="text-slate-400">Pending</span>,
    assignment.acknowledgedAt
      ? <Badge key="ack" tone="positive">{`Acknowledged ${formatDate(assignment.acknowledgedAt)}`}</Badge>
      : <Badge key="ack" tone="warning">Awaiting acknowledgement</Badge>,
    <Badge key="status">{assignment.status}</Badge>,
  ])

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      <SectionCard
        title="Asset register"
        description="Assignment and custody tracking only. No finance, valuation, or depreciation is calculated here."
        actions={
          <>
            <button type="button" onClick={() => { void load() }} disabled={loading} className="neu-button rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50">
              {loading ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 inline h-4 w-4" />}Refresh
            </button>
            {canManage && (
              <button type="button" onClick={openCreate} className="gradient-button rounded-lg px-3 py-2 text-sm font-semibold">
                <Plus className="mr-1 inline h-4 w-4" />Add asset
              </button>
            )}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total assets" value={summary?.total ?? assets.length} hint="Company owned records" />
          <Metric label="Assigned" value={summary?.assigned ?? assets.filter((asset) => asset.status === 'assigned').length} hint="In employee custody" />
          <Metric label="Available" value={summary?.available ?? assets.filter((asset) => asset.status === 'available').length} hint="Ready to hand over" />
          <Metric label="In repair" value={inRepair} hint="Temporarily out of service" />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Search">
            <input
              value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Tag, name, serial, make" aria-label="Search assets" className={fieldClass}
            />
          </Field>
          <Field label="Category">
            <SearchableSelect options={categoryOptions} value={category} onChange={setCategory} allowEmpty emptyLabel="All categories" placeholder="Search category" />
          </Field>
          <Field label="Status">
            <SearchableSelect options={statusOptions} value={status} onChange={setStatus} allowEmpty emptyLabel="All statuses" placeholder="Search status" />
          </Field>
          <Field label="Assigned employee">
            <SearchableSelect options={employeeOptions} value={holderId} onChange={setHolderId} allowEmpty emptyLabel="Anyone" placeholder="Search employee" />
          </Field>
          <Field label="Work location">
            <SearchableSelect options={locationOptions} value={workLocationId} onChange={setWorkLocationId} allowEmpty emptyLabel="All locations" placeholder="Search location" />
          </Field>
        </div>

        <div className="mt-5">
          {loading && !assets.length ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />Loading assets
            </div>
          ) : (
            <DataTable
              headers={['Asset', 'Tag', 'Category', 'Assigned to', 'Location', 'Condition', 'Status', 'Actions']}
              rows={rows}
              searchable
              searchPlaceholder="Filter loaded assets"
              empty={filtersApplied ? 'No assets match these filters' : 'No assets recorded yet'}
              emptyHint={canManage ? 'Add an asset to start tracking custody and handovers.' : 'Ask HR to register company assets.'}
            />
          )}
        </div>
      </SectionCard>

      {(mode === 'create' || mode === 'edit') && (
        <Drawer
          title={mode === 'edit' ? 'Edit asset' : 'Add asset'}
          subtitle={mode === 'edit' ? active?.assetTag : 'Custody record, no financial values'}
          close={closeDrawer}
          footer={
            <button
              type="submit" form="asset-form" disabled={busy === 'save'}
              className="gradient-button w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy === 'save' ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <Wrench className="mr-1 inline h-4 w-4" />}
              {mode === 'edit' ? 'Save asset' : 'Create asset'}
            </button>
          }
        >
          <form id="asset-form" onSubmit={saveAsset} className="space-y-4">
            <Field label="Asset tag" required hint={mode === 'edit' ? 'Tags cannot be changed after creation.' : 'Unique identifier printed on the asset.'}>
              <input
                value={form.assetTag} onChange={(event) => setForm({ ...form, assetTag: event.target.value })}
                required readOnly={mode === 'edit'} className={`${fieldClass} ${mode === 'edit' ? 'bg-slate-100' : ''}`}
              />
            </Field>
            <Field label="Asset name" required>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required className={fieldClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" required>
                <SearchableSelect options={categoryOptions} value={form.category} onChange={(value) => setForm({ ...form, category: value })} required placeholder="Search category" />
              </Field>
              <Field label="Serial number">
                <input value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Make">
                <input value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Model">
                <input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} className={fieldClass} />
              </Field>
              <Field label="Work location">
                <SearchableSelect options={locationOptions} value={form.workLocationId} onChange={(value) => setForm({ ...form, workLocationId: value })} allowEmpty emptyLabel="Not set" placeholder="Search location" />
              </Field>
              <Field label="Condition" required>
                <SearchableSelect options={conditionOptions} value={form.condition} onChange={(value) => setForm({ ...form, condition: value })} required placeholder="Search condition" />
              </Field>
            </div>
            <Field label="Status" required hint="Status moves to assigned automatically when you hand the asset over.">
              <SearchableSelect options={statusOptions} value={form.status} onChange={(value) => setForm({ ...form, status: value })} required placeholder="Search status" />
            </Field>
            <Field label="Notes">
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className={fieldClass} />
            </Field>
          </form>
        </Drawer>
      )}

      {mode === 'assign' && active && (
        <Drawer title="Assign asset" subtitle={`${active.assetTag} • ${active.name}`} close={closeDrawer}>
          <form onSubmit={assignAsset} className="space-y-4">
            <Field label="Employee" required hint="Custody transfers to this employee until the asset is returned.">
              <SearchableSelect options={employeeOptions} value={assignForm.employeeId} onChange={(value) => setAssignForm({ ...assignForm, employeeId: value })} required placeholder="Search employee" />
            </Field>
            <Field label="Expected return date">
              <input type="date" value={assignForm.expectedReturnAt} onChange={(event) => setAssignForm({ ...assignForm, expectedReturnAt: event.target.value })} className={fieldClass} />
            </Field>
            <Field label="Condition at handover" required>
              <SearchableSelect options={conditionOptions} value={assignForm.conditionOnAssign} onChange={(value) => setAssignForm({ ...assignForm, conditionOnAssign: value })} required placeholder="Search condition" />
            </Field>
            <Field label="Notes">
              <textarea value={assignForm.notes} onChange={(event) => setAssignForm({ ...assignForm, notes: event.target.value })} rows={3} className={fieldClass} />
            </Field>
            <button type="submit" disabled={busy === 'assign'} className="gradient-button w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
              {busy === 'assign' ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 inline h-4 w-4" />}Assign asset
            </button>
          </form>
        </Drawer>
      )}

      {mode === 'return' && active && (
        <Drawer title="Record return" subtitle={`${active.assetTag} • ${employeeName(active.assignedTo) || 'Current holder'}`} close={closeDrawer}>
          <form onSubmit={returnAsset} className="space-y-4">
            <Field label="Condition on return" required hint="Recorded against the open assignment and applied to the asset.">
              <SearchableSelect options={conditionOptions} value={returnForm.conditionOnReturn} onChange={(value) => setReturnForm({ ...returnForm, conditionOnReturn: value })} required placeholder="Search condition" />
            </Field>
            <Field label="Notes">
              <textarea value={returnForm.notes} onChange={(event) => setReturnForm({ ...returnForm, notes: event.target.value })} rows={3} className={fieldClass} />
            </Field>
            <button type="submit" disabled={busy === 'return'} className="gradient-button w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
              {busy === 'return' ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 inline h-4 w-4" />}Mark returned
            </button>
          </form>
        </Drawer>
      )}

      {mode === 'detail' && active && (
        <Drawer title={active.name} subtitle={`${active.assetTag} • ${humanize(active.category)}`} close={closeDrawer} wide>
          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />Loading custody history
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <KeyValue label="Asset tag" value={detail?.asset.assetTag || active.assetTag} />
                <KeyValue label="Category" value={humanize(detail?.asset.category || active.category)} />
                <KeyValue label="Status" value={<Badge>{detail?.asset.status || active.status}</Badge>} />
                <KeyValue label="Condition" value={<Badge>{detail?.asset.condition || active.condition}</Badge>} />
                <KeyValue label="Serial number" value={detail?.asset.serialNumber || active.serialNumber || '-'} />
                <KeyValue label="Make and model" value={[detail?.asset.make || active.make, detail?.asset.model || active.model].filter(Boolean).join(' ') || '-'} />
                <KeyValue label="Work location" value={detail?.asset.workLocationName || active.workLocationName || 'Not set'} />
                <KeyValue
                  label="Currently with"
                  value={(detail?.asset.assignedTo || active.assignedTo)?._id ? (
                    <EmployeeProfileLink employeeId={(detail?.asset.assignedTo || active.assignedTo)!._id} tab="assets" onOpen={onOpenEmployee}>{employeeName(detail?.asset.assignedTo || active.assignedTo)}</EmployeeProfileLink>
                  ) : 'Unassigned'}
                />
                <KeyValue label="Expected return" value={formatDate(detail?.asset.currentAssignment?.expectedReturnAt || active.currentAssignment?.expectedReturnAt)} />
              </div>
              {(detail?.asset.notes || active.notes) && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{detail?.asset.notes || active.notes}</p>
              )}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-bold">Assignment history</h3>
                </div>
                <p className="mb-3 text-xs text-slate-500">Custody trail only. Acknowledgement is captured from the employee app when they confirm receipt.</p>
                {historyRows.length ? (
                  <DataTable
                    headers={['Employee', 'Assigned', 'Expected return', 'Returned', 'Condition out', 'Condition in', 'Acknowledgement', 'Status']}
                    rows={historyRows}
                    defaultPageSize={10}
                    stickyFirstColumn={false}
                  />
                ) : (
                  <EmptyState label="No handovers recorded" hint="This asset has never been assigned to an employee." />
                )}
              </div>
            </div>
          )}
        </Drawer>
      )}
    </div>
  )
}
