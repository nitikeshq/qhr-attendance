'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Layers, Loader2, MapPin, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import {
  Badge,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  KeyValue,
  SearchableSelect,
  SectionCard,
  TabBar,
  fieldClass,
  humanize,
  type Option,
} from './ui'

export type OrgEmployee = {
  _id: string
  name: string
  employeeId: string
  role: string
  department?: string
  designation?: string
  departmentId?: string | null
  designationId?: string | null
  workLocationId?: string | null
  managerId?: string | null
  permissionGrants?: string[]
  permissionRevokes?: string[]
}

export type Department = {
  _id: string
  name: string
  code?: string
  parentDepartmentId?: string | null
  headEmployeeId?: string | null
  status?: string
}

export type Designation = {
  _id: string
  name: string
  code?: string
  level?: number
  departmentId?: string | null
  status?: string
}

export type WorkLocation = {
  _id: string
  name: string
  code?: string
  addressLine?: string
  city?: string
  state?: string
  pincode?: string
  timezone?: string
  isPayrollAddress?: boolean
  pfEstablishmentCode?: string
  esiEmployerCode?: string
  status?: string
  /** Readable single-line address, resolved by the API. */
  address?: string
  /** Set when the site was inferred from a geofence and not yet reviewed. */
  derivedFromGeofence?: boolean
  /** The attendance geofence that belongs to this site, when one exists. */
  geofence?: {
    _id: string
    name?: string
    latitude?: number
    longitude?: number
    radiusMeters?: number
    active?: boolean
  } | null
}

export type DepartmentNode = Department & { children?: DepartmentNode[] }

type OrgPayload = {
  departments?: Department[]
  designations?: Designation[]
  workLocations?: WorkLocation[]
  hierarchy?: DepartmentNode[]
}

type PermissionCatalogItem = { key: string; label: string; module: string }
type PermissionPayload = { catalog?: PermissionCatalogItem[]; roleDefaults?: Record<string, string[]> }
type PermissionState = 'inherited' | 'granted' | 'revoked'

type TabKey = 'hierarchy' | 'departments' | 'designations' | 'locations' | 'access'

type DepartmentForm = { name: string; code: string; parentDepartmentId: string; headEmployeeId: string; status: string }
type DesignationForm = { name: string; code: string; level: string; departmentId: string; status: string }
type LocationForm = {
  name: string
  code: string
  addressLine: string
  city: string
  state: string
  pincode: string
  timezone: string
  pfEstablishmentCode: string
  esiEmployerCode: string
  isPayrollAddress: boolean
  status: string
  // Coordinates create or update the attendance geofence for this site, so an
  // address only has to be entered once.
  latitude: string
  longitude: string
  radiusMeters: string
}

type DrawerState =
  | { kind: 'department'; id: string | null }
  | { kind: 'designation'; id: string | null }
  | { kind: 'location'; id: string | null }
  | null

type Props = {
  apiRoot: string
  token: string
  role: 'manager' | 'hr' | 'admin'
  employees: OrgEmployee[]
  onChanged: (message: string) => Promise<void> | void
}

type ApiError = Error & { status?: number }

const emptyDepartmentForm: DepartmentForm = { name: '', code: '', parentDepartmentId: '', headEmployeeId: '', status: 'active' }
const emptyDesignationForm: DesignationForm = { name: '', code: '', level: '1', departmentId: '', status: 'active' }
const emptyLocationForm: LocationForm = {
  name: '', code: '', addressLine: '', city: '', state: '', pincode: '', timezone: 'Asia/Kolkata',
  pfEstablishmentCode: '', esiEmployerCode: '', isPayrollAddress: false, status: 'active',
  latitude: '', longitude: '', radiusMeters: '150',
}

const statusOptions: Option[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const employmentTypeOptions: Option[] = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
]

const permissionStates: Array<{ value: PermissionState; label: string }> = [
  { value: 'inherited', label: 'Inherited from role' },
  { value: 'granted', label: 'Granted' },
  { value: 'revoked', label: 'Revoked' },
]

async function request<T>(apiRoot: string, token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  })
  const payload = (await response.json().catch(() => ({}))) as { data?: T; message?: string }
  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status})`) as ApiError
    error.status = response.status
    throw error
  }
  return payload.data as T
}

function messageOf(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}

function InlineError({ message }: { message: string }) {
  if (!message) return null
  return <p className="mt-2 text-sm font-semibold text-red-600">{message}</p>
}

export default function OrgWorkspace({ apiRoot, token, role, employees, onChanged }: Props) {
  const [tab, setTab] = useState<TabKey>('hierarchy')
  const [departments, setDepartments] = useState<Department[]>([])
  const [designations, setDesignations] = useState<Designation[]>([])
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([])
  const [hierarchy, setHierarchy] = useState<DepartmentNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [formError, setFormError] = useState('')
  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>(emptyDepartmentForm)
  const [designationForm, setDesignationForm] = useState<DesignationForm>(emptyDesignationForm)
  const [locationForm, setLocationForm] = useState<LocationForm>(emptyLocationForm)

  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([])
  const [roleDefaults, setRoleDefaults] = useState<Record<string, string[]>>({})
  const [permissionsBlocked, setPermissionsBlocked] = useState(role !== 'admin')
  const [permissionsError, setPermissionsError] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [permissionDraft, setPermissionDraft] = useState<Record<string, PermissionState>>({})
  const [assignmentDraft, setAssignmentDraft] = useState({
    departmentId: '', designationId: '', workLocationId: '', managerId: '', employmentType: '',
  })

  const canManage = role === 'hr' || role === 'admin'

  const loadOrg = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await request<OrgPayload>(apiRoot, token, '/org')
      setDepartments(data.departments || [])
      setDesignations(data.designations || [])
      setWorkLocations(data.workLocations || [])
      setHierarchy(data.hierarchy || [])
    } catch (reason) {
      setError(messageOf(reason, 'Could not load the organisation structure'))
    } finally {
      setLoading(false)
    }
  }, [apiRoot, token])

  useEffect(() => { void loadOrg() }, [loadOrg])

  useEffect(() => {
    if (role !== 'admin') {
      setPermissionsBlocked(true)
      return
    }
    let active = true
    request<PermissionPayload>(apiRoot, token, '/org/permissions')
      .then((data) => {
        if (!active) return
        setCatalog(data.catalog || [])
        setRoleDefaults(data.roleDefaults || {})
        setPermissionsBlocked(false)
      })
      .catch((reason: unknown) => {
        if (!active) return
        const status = (reason as ApiError).status
        setPermissionsBlocked(true)
        if (status !== 403) setPermissionsError(messageOf(reason, 'Could not load the permission catalog'))
      })
    return () => { active = false }
  }, [apiRoot, role, token])

  const employeeById = useMemo(() => new Map(employees.map((item) => [item._id, item])), [employees])
  const selectedEmployee = selectedEmployeeId ? employeeById.get(selectedEmployeeId) || null : null

  useEffect(() => {
    if (!selectedEmployee) {
      setPermissionDraft({})
      setAssignmentDraft({ departmentId: '', designationId: '', workLocationId: '', managerId: '', employmentType: '' })
      return
    }
    const draft: Record<string, PermissionState> = {}
    for (const key of selectedEmployee.permissionGrants || []) draft[key] = 'granted'
    for (const key of selectedEmployee.permissionRevokes || []) draft[key] = 'revoked'
    setPermissionDraft(draft)
    setAssignmentDraft({
      departmentId: selectedEmployee.departmentId || '',
      designationId: selectedEmployee.designationId || '',
      workLocationId: selectedEmployee.workLocationId || '',
      managerId: selectedEmployee.managerId || '',
      employmentType: '',
    })
  }, [selectedEmployee])

  const employeeOptions = useMemo<Option[]>(() => employees.map((item) => ({
    value: item._id,
    label: item.name || item.employeeId,
    hint: `${item.employeeId}${item.department ? ` · ${item.department}` : ''} · ${humanize(item.role)}`,
  })), [employees])

  const departmentOptions = useMemo<Option[]>(() => departments.map((item) => ({
    value: item._id,
    label: item.name,
    hint: item.code || undefined,
  })), [departments])

  const locationOptions = useMemo<Option[]>(() => workLocations.map((item) => ({
    value: item._id,
    label: item.name,
    hint: [item.city, item.state].filter(Boolean).join(', ') || undefined,
  })), [workLocations])

  const designationOptions = useMemo<Option[]>(() => designations.map((item) => ({
    value: item._id,
    label: item.name,
    hint: `Level ${item.level || 1}`,
  })), [designations])

  const departmentName = useCallback((id?: string | null) => (
    id ? departments.find((item) => item._id === id)?.name || 'Unknown department' : '-'
  ), [departments])

  const employeeName = useCallback((id?: string | null) => (
    id ? employeeById.get(id)?.name || 'Unknown employee' : '-'
  ), [employeeById])

  const headcountByDepartment = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of employees) {
      if (!item.departmentId) continue
      counts.set(item.departmentId, (counts.get(item.departmentId) || 0) + 1)
    }
    return counts
  }, [employees])

  const headcountByDesignation = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of employees) {
      if (!item.designationId) continue
      counts.set(item.designationId, (counts.get(item.designationId) || 0) + 1)
    }
    return counts
  }, [employees])

  const designationCountByDepartment = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of designations) {
      if (!item.departmentId) continue
      counts.set(item.departmentId, (counts.get(item.departmentId) || 0) + 1)
    }
    return counts
  }, [designations])

  const unassignedEmployees = employees.filter((item) => !item.departmentId).length

  async function mutate(key: string, path: string, options: RequestInit, fallbackMessage: string, onDone?: () => void) {
    setBusy(key)
    setFormError('')
    setError('')
    try {
      const result = await request<{ message?: string }>(apiRoot, token, path, options)
      await loadOrg()
      onDone?.()
      await onChanged(result?.message || fallbackMessage)
    } catch (reason) {
      const text = messageOf(reason, fallbackMessage)
      if (drawer) setFormError(text)
      else setError(text)
    } finally {
      setBusy('')
    }
  }

  function openDepartment(record?: Department) {
    setFormError('')
    setDepartmentForm(record
      ? {
        name: record.name || '',
        code: record.code || '',
        parentDepartmentId: record.parentDepartmentId || '',
        headEmployeeId: record.headEmployeeId || '',
        status: record.status || 'active',
      }
      : emptyDepartmentForm)
    setDrawer({ kind: 'department', id: record?._id || null })
  }

  function openDesignation(record?: Designation) {
    setFormError('')
    setDesignationForm(record
      ? {
        name: record.name || '',
        code: record.code || '',
        level: String(record.level || 1),
        departmentId: record.departmentId || '',
        status: record.status || 'active',
      }
      : emptyDesignationForm)
    setDrawer({ kind: 'designation', id: record?._id || null })
  }

  function openLocation(record?: WorkLocation) {
    setFormError('')
    setLocationForm(record
      ? {
        name: record.name || '',
        code: record.code || '',
        addressLine: record.addressLine || '',
        city: record.city || '',
        state: record.state || '',
        pincode: record.pincode || '',
        timezone: record.timezone || 'Asia/Kolkata',
        pfEstablishmentCode: record.pfEstablishmentCode || '',
        esiEmployerCode: record.esiEmployerCode || '',
        isPayrollAddress: record.isPayrollAddress === true,
        status: record.status || 'active',
        latitude: record.geofence?.latitude === undefined || record.geofence?.latitude === null ? '' : String(record.geofence.latitude),
        longitude: record.geofence?.longitude === undefined || record.geofence?.longitude === null ? '' : String(record.geofence.longitude),
        radiusMeters: String(record.geofence?.radiusMeters ?? 150),
      }
      : emptyLocationForm)
    setDrawer({ kind: 'location', id: record?._id || null })
  }

  async function submitDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!drawer || drawer.kind !== 'department') return
    const body = JSON.stringify({
      name: departmentForm.name.trim(),
      code: departmentForm.code.trim(),
      parentDepartmentId: departmentForm.parentDepartmentId || null,
      headEmployeeId: departmentForm.headEmployeeId || null,
      status: departmentForm.status,
    })
    await mutate(
      'save-department',
      drawer.id ? `/org/departments/${drawer.id}` : '/org/departments',
      { method: drawer.id ? 'PATCH' : 'POST', body },
      drawer.id ? 'Department updated' : 'Department created',
      () => setDrawer(null),
    )
  }

  async function submitDesignation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!drawer || drawer.kind !== 'designation') return
    const body = JSON.stringify({
      name: designationForm.name.trim(),
      code: designationForm.code.trim(),
      level: Number(designationForm.level) || 1,
      departmentId: designationForm.departmentId || null,
      status: designationForm.status,
    })
    await mutate(
      'save-designation',
      drawer.id ? `/org/designations/${drawer.id}` : '/org/designations',
      { method: drawer.id ? 'PATCH' : 'POST', body },
      drawer.id ? 'Designation updated' : 'Designation created',
      () => setDrawer(null),
    )
  }

  async function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!drawer || drawer.kind !== 'location') return
    const body = JSON.stringify({
      name: locationForm.name.trim(),
      code: locationForm.code.trim(),
      addressLine: locationForm.addressLine.trim(),
      city: locationForm.city.trim(),
      state: locationForm.state.trim(),
      pincode: locationForm.pincode.trim(),
      timezone: locationForm.timezone.trim() || 'Asia/Kolkata',
      pfEstablishmentCode: locationForm.pfEstablishmentCode.trim(),
      esiEmployerCode: locationForm.esiEmployerCode.trim(),
      isPayrollAddress: locationForm.isPayrollAddress,
      status: locationForm.status,
      // Sent as strings; the API only touches the geofence when both
      // coordinates are present, and leaves an existing one alone otherwise.
      latitude: locationForm.latitude.trim(),
      longitude: locationForm.longitude.trim(),
      radiusMeters: locationForm.radiusMeters.trim(),
    })
    await mutate(
      'save-location',
      drawer.id ? `/org/work-locations/${drawer.id}` : '/org/work-locations',
      { method: drawer.id ? 'PATCH' : 'POST', body },
      drawer.id ? 'Work location updated' : 'Work location created',
      () => setDrawer(null),
    )
  }

  async function removeRecord(kind: 'departments' | 'designations' | 'work-locations', id: string, label: string) {
    if (!window.confirm(`Delete ${label}? Records that are still referenced cannot be deleted.`)) return
    await mutate(`delete-${id}`, `/org/${kind}/${id}`, { method: 'DELETE' }, `Could not delete ${label}`)
  }

  async function savePermissions() {
    if (!selectedEmployee) return
    setBusy('save-permissions')
    setPermissionsError('')
    try {
      const permissionGrants = Object.keys(permissionDraft).filter((key) => permissionDraft[key] === 'granted')
      const permissionRevokes = Object.keys(permissionDraft).filter((key) => permissionDraft[key] === 'revoked')
      const result = await request<{ message?: string }>(apiRoot, token, `/employees/${selectedEmployee._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissionGrants, permissionRevokes }),
      })
      await onChanged(result?.message || 'Permissions updated')
    } catch (reason) {
      setPermissionsError(messageOf(reason, 'Could not save permissions'))
    } finally {
      setBusy('')
    }
  }

  async function saveAssignment() {
    if (!selectedEmployee) return
    setBusy('save-assignment')
    setPermissionsError('')
    try {
      const body: Record<string, unknown> = {
        departmentId: assignmentDraft.departmentId || null,
        designationId: assignmentDraft.designationId || null,
        workLocationId: assignmentDraft.workLocationId || null,
        managerId: assignmentDraft.managerId || null,
      }
      if (assignmentDraft.employmentType) body.employmentType = assignmentDraft.employmentType
      const result = await request<{ message?: string }>(apiRoot, token, `/employees/${selectedEmployee._id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      await onChanged(result?.message || 'Employee assignment updated')
    } catch (reason) {
      setPermissionsError(messageOf(reason, 'Could not save the assignment'))
    } finally {
      setBusy('')
    }
  }

  function permissionStateOf(key: string): PermissionState {
    return permissionDraft[key] || 'inherited'
  }

  function setPermission(key: string, state: PermissionState) {
    setPermissionDraft((current) => {
      const next = { ...current }
      if (state === 'inherited') delete next[key]
      else next[key] = state
      return next
    })
  }

  const roleBaseline = useMemo(() => new Set(
    selectedEmployee ? roleDefaults[selectedEmployee.role] || [] : [],
  ), [roleDefaults, selectedEmployee])

  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, PermissionCatalogItem[]>()
    for (const item of catalog) {
      const list = groups.get(item.module) || []
      list.push(item)
      groups.set(item.module, list)
    }
    return [...groups.entries()]
  }, [catalog])

  const effectiveCount = useMemo(() => catalog.filter((item) => {
    const state = permissionStateOf(item.key)
    if (state === 'granted') return true
    if (state === 'revoked') return false
    return roleBaseline.has(item.key)
  }).length, [catalog, permissionDraft, roleBaseline])

  function renderTree(nodes: DepartmentNode[], depth = 0): ReactNode {
    return nodes.map((node) => (
      <div key={node._id}>
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-slate-200 py-2 pl-3"
          style={{ marginLeft: depth * 20 }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {node.name}
              {node.code && <span className="ml-2 text-xs font-normal text-slate-500">{node.code}</span>}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Head: {employeeName(node.headEmployeeId)} · Designations: {designationCountByDepartment.get(node._id) || 0} · Employees: {headcountByDepartment.get(node._id) || 0}
            </p>
          </div>
          <Badge>{node.status || 'active'}</Badge>
        </div>
        {node.children && node.children.length > 0 && renderTree(node.children, depth + 1)}
      </div>
    ))
  }

  const departmentRows: ReactNode[][] = departments.map((item) => [
    item.name,
    item.code || '-',
    departmentName(item.parentDepartmentId),
    employeeName(item.headEmployeeId),
    String(headcountByDepartment.get(item._id) || 0),
    <Badge key="status">{item.status || 'active'}</Badge>,
    <div key="actions" className="flex gap-2">
      <button
        type="button" aria-label={`Edit ${item.name}`} disabled={!canManage}
        onClick={() => openDepartment(item)}
        className="neu-button rounded-md p-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button" aria-label={`Delete ${item.name}`} disabled={!canManage || busy === `delete-${item._id}`}
        onClick={() => void removeRecord('departments', item._id, item.name)}
        className="neu-button rounded-md p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>,
  ])

  const designationRows: ReactNode[][] = designations.map((item) => [
    item.name,
    item.code || '-',
    String(item.level || 1),
    departmentName(item.departmentId),
    String(headcountByDesignation.get(item._id) || 0),
    <Badge key="status">{item.status || 'active'}</Badge>,
    <div key="actions" className="flex gap-2">
      <button
        type="button" aria-label={`Edit ${item.name}`} disabled={!canManage}
        onClick={() => openDesignation(item)}
        className="neu-button rounded-md p-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button" aria-label={`Delete ${item.name}`} disabled={!canManage || busy === `delete-${item._id}`}
        onClick={() => void removeRecord('designations', item._id, item.name)}
        className="neu-button rounded-md p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>,
  ])

  const locationRows: ReactNode[][] = workLocations.map((item) => [
    <div key="name">
      <p className="font-semibold">{item.name}</p>
      {item.address ? <p className="text-xs text-slate-500">{item.address}</p> : null}
      {/* Created from a geofence that had no site of its own. Worth reviewing,
          because the address was parsed rather than entered. */}
      {item.derivedFromGeofence ? <p className="text-xs text-warning">Created from a geofence · check the address</p> : null}
    </div>,
    item.code || '-',
    item.city || '-',
    // Whether attendance check-in works at this site, which is the question
    // people actually have when they look at this table.
    item.geofence
      ? <Badge key="geo" tone="positive">{`${item.geofence.radiusMeters ?? 0}m radius`}</Badge>
      : <span key="geo" className="text-xs text-slate-500">No geofence</span>,
    item.isPayrollAddress ? <Badge key="payroll" tone="positive">payroll address</Badge> : <span key="site" className="text-slate-500">Work site</span>,
    <Badge key="status">{item.status || 'active'}</Badge>,
    <div key="actions" className="flex gap-2">
      <button
        type="button" aria-label={`Edit ${item.name}`} disabled={!canManage}
        onClick={() => openLocation(item)}
        className="neu-button rounded-md p-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button" aria-label={`Delete ${item.name}`} disabled={!canManage || busy === `delete-${item._id}`}
        onClick={() => void removeRecord('work-locations', item._id, item.name)}
        className="neu-button rounded-md p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>,
  ])

  const parentOptions = useMemo<Option[]>(() => (
    drawer && drawer.kind === 'department' && drawer.id
      ? departmentOptions.filter((option) => option.value !== drawer.id)
      : departmentOptions
  ), [departmentOptions, drawer])

  return (
    <div className="space-y-5">
      <TabBar<TabKey>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'hierarchy', label: 'Company hierarchy' },
          { key: 'departments', label: 'Departments', count: departments.length },
          { key: 'designations', label: 'Designations', count: designations.length },
          { key: 'locations', label: 'Work locations', count: workLocations.length },
          { key: 'access', label: 'Access control' },
        ]}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
      )}

      {loading ? (
        <SectionCard>
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading organisation structure...
          </div>
        </SectionCard>
      ) : (
        <>
          {tab === 'hierarchy' && (
            <SectionCard
              title="Company hierarchy"
              description="Reporting structure built from parent departments, with live headcount from your employee directory."
              actions={(
                <button type="button" onClick={() => void loadOrg()} className="neu-button flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold">
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
              )}
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <KeyValue label="Departments" value={departments.length} />
                <KeyValue label="Designations" value={designations.length} />
                <KeyValue label="Work locations" value={workLocations.length} />
                <KeyValue label="Unassigned employees" value={unassignedEmployees} />
              </div>
              {hierarchy.length === 0 ? (
                <EmptyState
                  label="No departments defined yet"
                  hint="Create your top-level departments first (for example Operations or Engineering), then add child departments and pick a head for each. Designations and employees can then be linked to them."
                  action={canManage ? (
                    <button type="button" onClick={() => { setTab('departments'); openDepartment() }} className="gradient-button flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold">
                      <Plus className="h-4 w-4" /> Add department
                    </button>
                  ) : undefined}
                />
              ) : (
                <div className="space-y-1">{renderTree(hierarchy)}</div>
              )}
            </SectionCard>
          )}

          {tab === 'departments' && (
            <SectionCard
              title="Departments"
              description="Group employees into departments and nest them to build the reporting hierarchy."
              actions={canManage ? (
                <button type="button" onClick={() => openDepartment()} className="gradient-button flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold">
                  <Plus className="h-4 w-4" /> New department
                </button>
              ) : undefined}
            >
              <DataTable
                searchable
                searchPlaceholder="Search departments"
                headers={['Name', 'Code', 'Parent', 'Head', 'Employees', 'Status', 'Actions']}
                rows={departmentRows}
                empty="No departments yet"
                emptyHint="Departments drive hierarchy, designation grouping, and payroll reporting."
              />
            </SectionCard>
          )}

          {tab === 'designations' && (
            <SectionCard
              title="Designations"
              description="Job titles with a seniority level. Level 1 is the most senior."
              actions={canManage ? (
                <button type="button" onClick={() => openDesignation()} className="gradient-button flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold">
                  <Plus className="h-4 w-4" /> New designation
                </button>
              ) : undefined}
            >
              <DataTable
                searchable
                searchPlaceholder="Search designations"
                headers={['Name', 'Code', 'Level', 'Department', 'Employees', 'Status', 'Actions']}
                rows={designationRows}
                empty="No designations yet"
                emptyHint="Add designations so employee records and payslips show a consistent job title."
              />
            </SectionCard>
          )}

          {tab === 'locations' && (
            <SectionCard
              title="Work locations"
              description="Exactly one location can be the payroll address printed on payslips and used for statutory codes. Every other location is an attendance or work site."
              actions={canManage ? (
                <button type="button" onClick={() => openLocation()} className="gradient-button flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold">
                  <Plus className="h-4 w-4" /> New work location
                </button>
              ) : undefined}
            >
              <DataTable
                searchable
                searchPlaceholder="Search work locations"
                headers={['Name', 'Code', 'City', 'Attendance', 'Payroll address', 'Status', 'Actions']}
                rows={locationRows}
                empty="No work locations yet"
                emptyHint="Add the registered office as the payroll address, then add branches and client sites for attendance."
              />
            </SectionCard>
          )}

          {tab === 'access' && (
            permissionsBlocked ? (
              <SectionCard title="Access control">
                <EmptyState
                  label="Only a Company Admin can manage custom permissions"
                  hint="Role defaults still apply to every user. Ask your Company Admin to grant or revoke individual permissions, or to change this user's role."
                />
                <InlineError message={permissionsError} />
              </SectionCard>
            ) : (
              <div className="space-y-5">
                <SectionCard
                  title="Custom permissions"
                  description="Start from the role defaults, then grant extras or revoke specific permissions for one employee."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Employee" required hint="Search by name, employee ID, or department.">
                      <SearchableSelect
                        options={employeeOptions}
                        value={selectedEmployeeId}
                        onChange={setSelectedEmployeeId}
                        placeholder="Search employees"
                        emptyLabel="Select an employee"
                        required
                      />
                    </Field>
                    {selectedEmployee && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <KeyValue label="Role" value={humanize(selectedEmployee.role)} />
                        <KeyValue label="Effective permissions" value={`${effectiveCount} of ${catalog.length}`} />
                      </div>
                    )}
                  </div>

                  {!selectedEmployee ? (
                    <div className="mt-4">
                      <EmptyState
                        label="Select an employee to review access"
                        hint="Permissions are calculated from the role defaults plus individual grants, minus individual revokes."
                      />
                    </div>
                  ) : (
                    <div className="mt-5 space-y-5">
                      {groupedCatalog.map(([module, items]) => (
                        <div key={module} className="rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                            <ShieldCheck className="h-4 w-4 text-slate-500" />
                            <p className="text-sm font-bold text-slate-700">{humanize(module)}</p>
                          </div>
                          <ul className="divide-y divide-slate-200">
                            {items.map((item) => {
                              const state = permissionStateOf(item.key)
                              const inherited = roleBaseline.has(item.key)
                              const effective = state === 'granted' ? true : state === 'revoked' ? false : inherited
                              return (
                                <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                      {item.key} · role default: {inherited ? 'allowed' : 'not allowed'} · effective: {effective ? 'allowed' : 'not allowed'}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-1" role="group" aria-label={`${item.label} access`}>
                                    {permissionStates.map((option) => (
                                      <button
                                        key={option.value}
                                        type="button"
                                        aria-pressed={state === option.value}
                                        onClick={() => setPermission(item.key, option.value)}
                                        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${state === option.value ? 'gradient-button' : 'neu-button text-slate-600'}`}
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                      <InlineError message={permissionsError} />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy === 'save-permissions'}
                          onClick={() => void savePermissions()}
                          className="gradient-button rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy === 'save-permissions' ? 'Saving permissions...' : 'Save permissions'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPermissionDraft({})}
                          className="neu-button rounded-md px-4 py-2 text-sm font-semibold"
                        >
                          Reset to role defaults
                        </button>
                      </div>
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Organisation assignment"
                  description="Place this employee in the structure. Leave a picker empty to clear the assignment."
                >
                  {!selectedEmployee ? (
                    <EmptyState label="Select an employee above" hint="Assignments reuse the same employee selection as permissions." />
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Department">
                          <SearchableSelect
                            options={departmentOptions} allowEmpty emptyLabel="No department"
                            value={assignmentDraft.departmentId}
                            onChange={(value) => setAssignmentDraft((current) => ({ ...current, departmentId: value }))}
                            placeholder="Search departments"
                          />
                        </Field>
                        <Field label="Designation">
                          <SearchableSelect
                            options={designationOptions} allowEmpty emptyLabel="No designation"
                            value={assignmentDraft.designationId}
                            onChange={(value) => setAssignmentDraft((current) => ({ ...current, designationId: value }))}
                            placeholder="Search designations"
                          />
                        </Field>
                        <Field label="Work location">
                          <SearchableSelect
                            options={locationOptions} allowEmpty emptyLabel="No work location"
                            value={assignmentDraft.workLocationId}
                            onChange={(value) => setAssignmentDraft((current) => ({ ...current, workLocationId: value }))}
                            placeholder="Search work locations"
                          />
                        </Field>
                        <Field label="Reporting manager" hint="Approvals and team views follow this manager.">
                          <SearchableSelect
                            options={employeeOptions.filter((option) => option.value !== selectedEmployee._id)}
                            allowEmpty emptyLabel="No reporting manager"
                            value={assignmentDraft.managerId}
                            onChange={(value) => setAssignmentDraft((current) => ({ ...current, managerId: value }))}
                            placeholder="Search employees"
                          />
                        </Field>
                        <Field label="Employment type" hint="Leave unchanged to keep the current employment type.">
                          <SearchableSelect
                            options={employmentTypeOptions} allowEmpty emptyLabel="Keep unchanged"
                            value={assignmentDraft.employmentType}
                            onChange={(value) => setAssignmentDraft((current) => ({ ...current, employmentType: value }))}
                            placeholder="Search employment types"
                          />
                        </Field>
                      </div>
                      <InlineError message={permissionsError} />
                      <button
                        type="button"
                        disabled={busy === 'save-assignment'}
                        onClick={() => void saveAssignment()}
                        className="gradient-button rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy === 'save-assignment' ? 'Saving assignment...' : 'Save assignment'}
                      </button>
                    </div>
                  )}
                </SectionCard>
              </div>
            )
          )}
        </>
      )}

      {drawer?.kind === 'department' && (
        <Drawer
          title={drawer.id ? 'Edit department' : 'New department'}
          subtitle="Departments group employees and can be nested to build the hierarchy."
          close={() => setDrawer(null)}
        >
          <form onSubmit={submitDepartment} className="space-y-4">
            <Field label="Department name" required>
              <input
                required value={departmentForm.name}
                onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))}
                className={fieldClass} placeholder="Engineering"
              />
            </Field>
            <Field label="Code" hint="Short unique code. Generated from the name when left blank.">
              <input
                value={departmentForm.code}
                onChange={(event) => setDepartmentForm((current) => ({ ...current, code: event.target.value }))}
                className={fieldClass} placeholder="ENG"
              />
            </Field>
            <Field label="Parent department" hint="Leave empty for a top-level department.">
              <SearchableSelect
                options={parentOptions} allowEmpty emptyLabel="No parent (top level)"
                value={departmentForm.parentDepartmentId}
                onChange={(value) => setDepartmentForm((current) => ({ ...current, parentDepartmentId: value }))}
                placeholder="Search departments"
              />
            </Field>
            <Field label="Head of department">
              <SearchableSelect
                options={employeeOptions} allowEmpty emptyLabel="No head assigned"
                value={departmentForm.headEmployeeId}
                onChange={(value) => setDepartmentForm((current) => ({ ...current, headEmployeeId: value }))}
                placeholder="Search employees"
              />
            </Field>
            <Field label="Status">
              <SearchableSelect
                options={statusOptions} required value={departmentForm.status}
                onChange={(value) => setDepartmentForm((current) => ({ ...current, status: value }))}
                placeholder="Select status"
              />
            </Field>
            <InlineError message={formError} />
            <div className="flex gap-2">
              <button
                type="submit" disabled={busy === 'save-department'}
                className="gradient-button rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'save-department' ? 'Saving...' : drawer.id ? 'Save department' : 'Create department'}
              </button>
              <button type="button" onClick={() => setDrawer(null)} className="neu-button rounded-md px-4 py-2 text-sm font-semibold">Cancel</button>
            </div>
          </form>
        </Drawer>
      )}

      {drawer?.kind === 'designation' && (
        <Drawer
          title={drawer.id ? 'Edit designation' : 'New designation'}
          subtitle="Job titles with a seniority level used across employee records and payslips."
          close={() => setDrawer(null)}
        >
          <form onSubmit={submitDesignation} className="space-y-4">
            <Field label="Designation name" required>
              <input
                required value={designationForm.name}
                onChange={(event) => setDesignationForm((current) => ({ ...current, name: event.target.value }))}
                className={fieldClass} placeholder="Senior Engineer"
              />
            </Field>
            <Field label="Code" hint="Short unique code. Generated from the name when left blank.">
              <input
                value={designationForm.code}
                onChange={(event) => setDesignationForm((current) => ({ ...current, code: event.target.value }))}
                className={fieldClass} placeholder="SR-ENG"
              />
            </Field>
            <Field label="Level" required hint="1 = most senior. Higher numbers sit lower in the structure.">
              <input
                required type="number" min={1} step={1} value={designationForm.level}
                onChange={(event) => setDesignationForm((current) => ({ ...current, level: event.target.value }))}
                className={fieldClass}
              />
            </Field>
            <Field label="Department" hint="Leave empty for a company-wide designation.">
              <SearchableSelect
                options={departmentOptions} allowEmpty emptyLabel="No department"
                value={designationForm.departmentId}
                onChange={(value) => setDesignationForm((current) => ({ ...current, departmentId: value }))}
                placeholder="Search departments"
              />
            </Field>
            <Field label="Status">
              <SearchableSelect
                options={statusOptions} required value={designationForm.status}
                onChange={(value) => setDesignationForm((current) => ({ ...current, status: value }))}
                placeholder="Select status"
              />
            </Field>
            <InlineError message={formError} />
            <div className="flex gap-2">
              <button
                type="submit" disabled={busy === 'save-designation'}
                className="gradient-button rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'save-designation' ? 'Saving...' : drawer.id ? 'Save designation' : 'Create designation'}
              </button>
              <button type="button" onClick={() => setDrawer(null)} className="neu-button rounded-md px-4 py-2 text-sm font-semibold">Cancel</button>
            </div>
          </form>
        </Drawer>
      )}

      {drawer?.kind === 'location' && (
        <Drawer
          title={drawer.id ? 'Edit work location' : 'New work location'}
          subtitle="Offices, branches, and client sites used for attendance and payroll."
          close={() => setDrawer(null)}
          wide
        >
          <form onSubmit={submitLocation} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Location name" required>
                <input
                  required value={locationForm.name}
                  onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))}
                  className={fieldClass} placeholder="Head office"
                />
              </Field>
              <Field label="Code" hint="Short unique code. Generated from the name when left blank.">
                <input
                  value={locationForm.code}
                  onChange={(event) => setLocationForm((current) => ({ ...current, code: event.target.value }))}
                  className={fieldClass} placeholder="HO"
                />
              </Field>
            </div>
            <Field label="Address line">
              <input
                value={locationForm.addressLine}
                onChange={(event) => setLocationForm((current) => ({ ...current, addressLine: event.target.value }))}
                className={fieldClass} placeholder="Plot 4, Industrial Area"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="City">
                <input
                  value={locationForm.city}
                  onChange={(event) => setLocationForm((current) => ({ ...current, city: event.target.value }))}
                  className={fieldClass}
                />
              </Field>
              <Field label="State">
                <input
                  value={locationForm.state}
                  onChange={(event) => setLocationForm((current) => ({ ...current, state: event.target.value }))}
                  className={fieldClass}
                />
              </Field>
              <Field label="Pincode">
                <input
                  value={locationForm.pincode}
                  onChange={(event) => setLocationForm((current) => ({ ...current, pincode: event.target.value }))}
                  className={fieldClass} inputMode="numeric"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Timezone" hint="Attendance timestamps for this site use this timezone.">
                <input
                  value={locationForm.timezone}
                  onChange={(event) => setLocationForm((current) => ({ ...current, timezone: event.target.value }))}
                  className={fieldClass} placeholder="Asia/Kolkata"
                />
              </Field>
              <Field label="PF establishment code" hint="Only needed when provident fund is enabled.">
                <input
                  value={locationForm.pfEstablishmentCode}
                  onChange={(event) => setLocationForm((current) => ({ ...current, pfEstablishmentCode: event.target.value }))}
                  className={fieldClass}
                />
              </Field>
              <Field label="ESI employer code" hint="Only needed when ESI is enabled.">
                <input
                  value={locationForm.esiEmployerCode}
                  onChange={(event) => setLocationForm((current) => ({ ...current, esiEmployerCode: event.target.value }))}
                  className={fieldClass}
                />
              </Field>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Attendance geofence</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Coordinates turn this address into the check-in boundary for the site. Leave them blank to keep the address for payroll only. Saving here creates or updates the matching geofence, so the address never has to be entered twice.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Field label="Latitude">
                  <input
                    value={locationForm.latitude}
                    onChange={(event) => setLocationForm((current) => ({ ...current, latitude: event.target.value }))}
                    className={fieldClass} inputMode="decimal" placeholder="12.9716"
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    value={locationForm.longitude}
                    onChange={(event) => setLocationForm((current) => ({ ...current, longitude: event.target.value }))}
                    className={fieldClass} inputMode="decimal" placeholder="77.5946"
                  />
                </Field>
                <Field label="Radius (metres)" hint="Between 25 and 5000.">
                  <input
                    value={locationForm.radiusMeters}
                    onChange={(event) => setLocationForm((current) => ({ ...current, radiusMeters: event.target.value }))}
                    className={fieldClass} inputMode="numeric" placeholder="150"
                  />
                </Field>
              </div>
            </div>
            <Field label="Status">
              <SearchableSelect
                options={statusOptions} required value={locationForm.status}
                onChange={(value) => setLocationForm((current) => ({ ...current, status: value }))}
                placeholder="Select status"
              />
            </Field>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <input
                type="checkbox" checked={locationForm.isPayrollAddress}
                onChange={(event) => setLocationForm((current) => ({ ...current, isPayrollAddress: event.target.checked }))}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-semibold text-slate-800">Use as the payroll address</span>
                <span className="mt-1 block text-xs text-slate-500">
                  Exactly one location can be the payroll address. It is printed on payslips and used for statutory filing details. Turning it on here removes the flag from the location that currently holds it. Every other location stays an attendance or work site.
                </span>
              </span>
            </label>
            <InlineError message={formError} />
            <div className="flex gap-2">
              <button
                type="submit" disabled={busy === 'save-location'}
                className="gradient-button rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'save-location' ? 'Saving...' : drawer.id ? 'Save work location' : 'Create work location'}
              </button>
              <button type="button" onClick={() => setDrawer(null)} className="neu-button rounded-md px-4 py-2 text-sm font-semibold">Cancel</button>
            </div>
          </form>
        </Drawer>
      )}

      <p className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {departments.length} departments</span>
        <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {designations.length} designations</span>
        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {workLocations.length} work locations</span>
      </p>
    </div>
  )
}
