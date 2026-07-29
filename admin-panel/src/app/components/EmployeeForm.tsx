'use client'

import { useState, type ReactNode } from 'react'

import { SearchableSelect, type Option } from './ui'

export const fieldClass = 'neu-input w-full px-3 py-2.5'

export type OrgMaster = { _id: string; name: string; code?: string; status?: string; departmentId?: string | null }
export type WorkLocationRef = {
  _id: string
  name: string
  code?: string
  city?: string
  status?: string
  address?: string
  isPayrollAddress?: boolean
  /** Set when the site was inferred from a geofence and not yet reviewed. */
  derivedFromGeofence?: boolean
}

export type EmployeeLike = {
  _id?: string
  employeeId?: string
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string | null
  role?: string
  status?: string
  managerId?: string | null
  departmentId?: string | null
  designationId?: string | null
  workLocationId?: string | null
  employmentType?: string
  dateOfBirth?: string | null
  dateOfJoining?: string
  lastWorkingDate?: string | null
  profile?: Record<string, string>
}

export type OrgPickerProps = {
  departments: OrgMaster[]
  designations: OrgMaster[]
  workLocations: WorkLocationRef[]
}

function activeOptions(list: Array<{ _id: string; name: string; code?: string; status?: string }>): Option[] {
  return list
    .filter((item) => item.status !== 'inactive')
    .map((item) => ({ value: item._id, label: item.name, hint: item.code || undefined }))
}

export function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="border-b border-line pb-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">{title}</h3>
        {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

export function Labelled({ label, hint, span, children }: { label: ReactNode; hint?: string; span?: boolean; children: ReactNode }) {
  return (
    <label className={`text-sm font-semibold ${span ? 'sm:col-span-2 xl:col-span-3' : ''}`}>
      <span>{label}</span>
      <div className="mt-1 font-normal">{children}</div>
      {hint && <span className="mt-1 block text-xs font-normal leading-5 text-ink-soft">{hint}</span>}
    </label>
  )
}

/** Shared form state, so Add and Edit behave identically. */
export function useEmployeeFormState(employee: EmployeeLike | undefined, workLocations: WorkLocationRef[]) {
  const activeLocations = workLocations.filter((item) => item.status !== 'inactive')
  // Sites the system inferred from a geofence were never a placement decision,
  // so they do not make the choice mandatory. This mirrors the API rule.
  const deliberateLocations = activeLocations.filter((item) => item.derivedFromGeofence !== true)
  const [managerId, setManagerId] = useState(employee?.managerId || '')
  const [departmentId, setDepartmentId] = useState(employee?.departmentId || '')
  const [designationId, setDesignationId] = useState(employee?.designationId || '')
  const [workLocationId, setWorkLocationId] = useState(
    employee?.workLocationId || (activeLocations.length === 1 ? activeLocations[0]._id : ''),
  )
  return {
    managerId,
    setManagerId,
    departmentId,
    setDepartmentId,
    designationId,
    setDesignationId,
    workLocationId,
    setWorkLocationId,
    locationRequired: deliberateLocations.length > 1,
  }
}

/**
 * The complete employee field set, rendered identically by Add and Edit.
 *
 * Previously the two forms carried different fields, so anything captured at
 * creation could not be corrected afterwards. Everything except name, employee
 * ID and email is optional and can be filled in later — an employee record is
 * expected to be completed over time.
 */
export default function EmployeeFormFields({
  employee, roleOptions, managerOptions, mode,
  departments, designations, workLocations,
  managerId, setManagerId,
  departmentId, setDepartmentId,
  designationId, setDesignationId,
  workLocationId, setWorkLocationId,
  locationRequired,
}: {
  employee?: EmployeeLike
  roleOptions: string[]
  managerOptions: Option[]
  mode: 'create' | 'edit'
  managerId: string
  setManagerId: (value: string) => void
  departmentId: string
  setDepartmentId: (value: string) => void
  designationId: string
  setDesignationId: (value: string) => void
  workLocationId: string
  setWorkLocationId: (value: string) => void
  locationRequired: boolean
} & OrgPickerProps) {
  const profile = employee?.profile || {}
  const value = (key: string) => profile[key] || ''
  const today = new Date().toISOString().slice(0, 10)
  const activeLocations = workLocations.filter((item) => item.status !== 'inactive')
  const departmentOptions = activeOptions(departments)
  const designationOptions = activeOptions(
    departmentId ? designations.filter((item) => !item.departmentId || item.departmentId === departmentId) : designations,
  )
  // The full site address is shown, so whoever picks a location can see what it is.
  const locationOptions: Option[] = activeLocations.map((item) => ({
    value: item._id,
    label: item.name,
    hint: item.address || [item.code, item.city].filter(Boolean).join(' · ') || undefined,
  }))
  const selectedLocation = activeLocations.find((item) => item._id === workLocationId)

  const locationHint = selectedLocation?.address
    || (activeLocations.length === 1
      ? `${activeLocations[0].name} is the only active site, so it is preselected.`
      : locationRequired
        ? 'Decides the place of work printed on their payslip.'
        : 'Add work locations under Organisation so payslips carry a place of work.')

  return (
    <div className="space-y-6">
      <FormSection title="Identity">
        <Labelled label="Employee ID"><input name="employeeId" defaultValue={employee?.employeeId || ''} placeholder="EMP002" required className={`${fieldClass} uppercase`} /></Labelled>
        <Labelled label="First name"><input name="firstName" defaultValue={employee?.firstName || ''} required className={fieldClass} /></Labelled>
        <Labelled label="Last name"><input name="lastName" defaultValue={employee?.lastName || ''} className={fieldClass} /></Labelled>
        <Labelled label="Date of birth" hint="Drives the birthday calendar. Employees can hide their own."><input name="dateOfBirth" type="date" defaultValue={String(employee?.dateOfBirth || '').slice(0, 10)} className={fieldClass} /></Labelled>
        <Labelled label="Gender">
          <select name="gender" defaultValue={value('gender')} className={fieldClass}>
            <option value="">Not recorded</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="non_binary">Non-binary</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
            <option value="other">Other</option>
          </select>
        </Labelled>
        <Labelled label="Marital status">
          <select name="maritalStatus" defaultValue={value('maritalStatus')} className={fieldClass}>
            <option value="">Not recorded</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
            <option value="other">Other</option>
          </select>
        </Labelled>
        <Labelled label="Blood group"><input name="bloodGroup" defaultValue={value('bloodGroup')} placeholder="O+" className={fieldClass} /></Labelled>
        <Labelled label="Nationality"><input name="nationality" defaultValue={value('nationality')} className={fieldClass} /></Labelled>
        {mode === 'edit' && (
          <Labelled label="Status">
            <select name="status" defaultValue={employee?.status || 'active'} className={fieldClass}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Labelled>
        )}
      </FormSection>

      <FormSection title="Contact">
        <Labelled label="Work email"><input name="email" type="email" defaultValue={employee?.email || ''} required className={fieldClass} /></Labelled>
        <Labelled label="Phone"><input name="phone" type="tel" defaultValue={employee?.phone || ''} className={fieldClass} /></Labelled>
        <Labelled label="Personal email"><input name="personalEmail" type="email" defaultValue={value('personalEmail')} className={fieldClass} /></Labelled>
        <Labelled label="Alternate phone"><input name="alternatePhone" type="tel" defaultValue={value('alternatePhone')} className={fieldClass} /></Labelled>
      </FormSection>

      <FormSection title="Current address">
        <Labelled span label="Address line 1"><input name="addressLine1" defaultValue={value('addressLine1')} className={fieldClass} /></Labelled>
        <Labelled span label="Address line 2"><input name="addressLine2" defaultValue={value('addressLine2')} className={fieldClass} /></Labelled>
        <Labelled label="City"><input name="city" defaultValue={value('city')} className={fieldClass} /></Labelled>
        <Labelled label="State"><input name="state" defaultValue={value('state')} className={fieldClass} /></Labelled>
        <Labelled label="Pincode"><input name="pincode" defaultValue={value('pincode')} className={fieldClass} /></Labelled>
        <Labelled label="Country"><input name="country" defaultValue={value('country') || 'India'} className={fieldClass} /></Labelled>
      </FormSection>

      <FormSection title="Permanent address" hint="Tick the box to copy the current address on save.">
        <Labelled span label={<span className="flex items-center gap-2 font-semibold"><input name="permanentSameAsCurrent" type="checkbox" value="true" defaultChecked={mode === 'create'} className="h-4 w-4 accent-primary-600" />Same as current address</span>}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <input name="permanentAddressLine1" defaultValue={value('permanentAddressLine1')} placeholder="Address line 1" className={fieldClass} />
            <input name="permanentAddressLine2" defaultValue={value('permanentAddressLine2')} placeholder="Address line 2" className={fieldClass} />
            <input name="permanentCity" defaultValue={value('permanentCity')} placeholder="City" className={fieldClass} />
            <input name="permanentState" defaultValue={value('permanentState')} placeholder="State" className={fieldClass} />
            <input name="permanentPincode" defaultValue={value('permanentPincode')} placeholder="Pincode" className={fieldClass} />
            <input name="permanentCountry" defaultValue={value('permanentCountry')} placeholder="Country" className={fieldClass} />
          </div>
        </Labelled>
      </FormSection>

      <FormSection title="Emergency contact">
        <Labelled label="Name"><input name="emergencyContactName" defaultValue={value('emergencyContactName')} className={fieldClass} /></Labelled>
        <Labelled label="Relationship"><input name="emergencyContactRelation" defaultValue={value('emergencyContactRelation')} placeholder="Spouse, parent, sibling" className={fieldClass} /></Labelled>
        <Labelled label="Phone"><input name="emergencyContactPhone" type="tel" defaultValue={value('emergencyContactPhone')} className={fieldClass} /></Labelled>
      </FormSection>

      <FormSection title="Placement" hint="Department, designation and work location come from Organisation.">
        <Labelled label="Department" hint={departmentOptions.length ? undefined : 'Create departments under Organisation first.'}>
          <SearchableSelect options={departmentOptions} value={departmentId} onChange={(next) => { setDepartmentId(next); setDesignationId('') }} placeholder="Search departments" allowEmpty emptyLabel={departmentOptions.length ? 'Not assigned' : 'No departments yet'} />
        </Labelled>
        <Labelled label="Designation">
          <SearchableSelect options={designationOptions} value={designationId} onChange={setDesignationId} placeholder="Search designations" allowEmpty emptyLabel={designationOptions.length ? 'Not assigned' : 'No designations yet'} />
        </Labelled>
        <Labelled label={<>Work location{locationRequired && <span className="ml-0.5 text-danger">*</span>}</>} hint={locationHint}>
          <SearchableSelect options={locationOptions} value={workLocationId} onChange={setWorkLocationId} placeholder="Search work locations" required={locationRequired} allowEmpty={!locationRequired} emptyLabel={locationOptions.length ? 'Use the payroll address' : 'No work locations yet'} />
        </Labelled>
        <Labelled label="Employment type">
          <select name="employmentType" defaultValue={employee?.employmentType || 'full_time'} className={fieldClass}>
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
            <option value="consultant">Consultant</option>
          </select>
        </Labelled>
        <Labelled label="Role">
          <select name="role" defaultValue={employee?.role || 'employee'} className={`${fieldClass} capitalize`}>
            {roleOptions.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
          </select>
        </Labelled>
        <Labelled label="Reporting manager">
          <SearchableSelect name="managerId" options={managerOptions} value={managerId} onChange={setManagerId} placeholder="Search managers" allowEmpty emptyLabel="No reporting manager" />
        </Labelled>
        <Labelled label="Joining date"><input name="dateOfJoining" type="date" defaultValue={String(employee?.dateOfJoining || today).slice(0, 10)} className={fieldClass} /></Labelled>
        <Labelled label="Probation ends"><input name="probationEndDate" type="date" defaultValue={value('probationEndDate')} className={fieldClass} /></Labelled>
        <Labelled label="Confirmation date"><input name="confirmationDate" type="date" defaultValue={value('confirmationDate')} className={fieldClass} /></Labelled>
        <Labelled label="Notice period (days)"><input name="noticePeriodDays" type="number" min="0" max="365" defaultValue={value('noticePeriodDays')} className={fieldClass} /></Labelled>
        <Labelled label="Employee grade"><input name="employeeGrade" defaultValue={value('employeeGrade')} className={fieldClass} /></Labelled>
        <Labelled label="Cost centre"><input name="costCenter" defaultValue={value('costCenter')} className={fieldClass} /></Labelled>
        {mode === 'edit' && <Labelled label="Last working date"><input name="lastWorkingDate" type="date" defaultValue={String(employee?.lastWorkingDate || '').slice(0, 10)} className={fieldClass} /></Labelled>}
      </FormSection>

      <FormSection title="Records" hint="Only the last four Aadhaar digits are stored.">
        <Labelled label="Aadhaar last 4"><input name="aadhaarLast4" inputMode="numeric" maxLength={4} defaultValue={value('aadhaarLast4')} className={fieldClass} /></Labelled>
        <Labelled label="Passport number"><input name="passportNumber" defaultValue={value('passportNumber')} className={`${fieldClass} uppercase`} /></Labelled>
        <Labelled label="Highest qualification"><input name="highestQualification" defaultValue={value('highestQualification')} className={fieldClass} /></Labelled>
        <Labelled label="Previous employer"><input name="previousEmployer" defaultValue={value('previousEmployer')} className={fieldClass} /></Labelled>
        <Labelled span label="Notes"><textarea name="notes" rows={2} defaultValue={value('notes')} className={fieldClass} /></Labelled>
      </FormSection>
    </div>
  )
}
