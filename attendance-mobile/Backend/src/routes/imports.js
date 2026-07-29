'use strict';

const express = require('express');

const { authRequired } = require('../middleware/auth');
const { fail, ok } = require('../utils/responses');
const { permissionRequired } = require('../utils/permissions');
const { newId, nowIso, normalizeCode } = require('../utils/records');
const { normalizedSubscription } = require('../utils/billing');
const { hashSecret } = require('../utils/passwords');
const { parseCsvTable, toCsv } = require('../utils/csv');

const router = express.Router();

router.use(authRequired);

const MAX_ROWS = 2000;
const MAX_CSV_CHARS = 4 * 1024 * 1024;

const EMPLOYEE_COLUMNS = [
  'employeeId',
  'firstName',
  'lastName',
  'email',
  'phone',
  'role',
  'department',
  'designation',
  'employmentType',
  'workLocationCode',
  'managerEmail',
  'dateOfJoining',
  'dateOfBirth',
  'status',
];

const REQUIRED_COLUMNS = ['firstName', 'email'];
const ROLES = ['employee', 'manager', 'hr', 'admin'];
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern', 'consultant'];
const STATUSES = ['active', 'inactive', 'suspended'];

const EMPLOYEE_TEMPLATE_ROWS = [
  {
    employeeId: 'EMP1001',
    firstName: 'Anita',
    lastName: 'Rao',
    email: 'anita.rao@example.com',
    phone: '+91 98765 43210',
    role: 'employee',
    department: 'Operations',
    designation: 'Executive',
    employmentType: 'full_time',
    workLocationCode: 'HQ',
    managerEmail: 'priya.sharma@example.com',
    dateOfJoining: '2025-04-01',
    dateOfBirth: '1994-08-17',
    status: 'active',
  },
  {
    employeeId: 'EMP1002',
    firstName: 'Rahul',
    lastName: 'Mehta',
    email: 'rahul.mehta@example.com',
    phone: '+91 98765 43211',
    role: 'manager',
    department: 'Sales',
    designation: 'Regional Manager',
    employmentType: 'full_time',
    workLocationCode: 'BLR2',
    managerEmail: '',
    dateOfJoining: '2024-11-15',
    dateOfBirth: '1988-02-03',
    status: 'active',
  },
];

function companyIdFor(req) {
  if (req.user.role === 'super_admin' && req.query.companyId) return req.query.companyId;
  return req.company?._id;
}

function lower(value) {
  return String(value || '').trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

function isIsoDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function matchMaster(list, value) {
  const needle = lower(value);
  if (!needle) return null;
  return list.find((item) => lower(item.code) === needle)
    || list.find((item) => lower(item.name) === needle)
    || null;
}

/**
 * Validates every row against the company's existing masters and the rest of the
 * file. Runs identically for the dry run and the commit so an import can never
 * apply something the preview said was invalid.
 */
function planEmployeeImport(data, company, records) {
  const workLocations = Array.isArray(company.workLocations) ? company.workLocations : [];
  const departments = Array.isArray(company.departments) ? company.departments : [];
  const designations = Array.isArray(company.designations) ? company.designations : [];

  const existing = data.employees.filter((item) => item.companyId === company._id);
  const byEmail = new Map(existing.map((item) => [lower(item.email), item]));
  const byEmployeeId = new Map(existing.filter((item) => item.employeeId).map((item) => [lower(item.employeeId), item]));

  // Emails and employee IDs must be unique across the file too, not just against
  // what is already stored, otherwise row 40 silently overwrites row 12.
  const seenEmails = new Map();
  const seenEmployeeIds = new Map();

  const plan = records.map(({ line, values }) => {
    const errors = [];
    const warnings = [];
    const email = lower(values.email);
    const employeeIdKey = lower(values.employeeId);

    if (!String(values.firstName || '').trim()) errors.push('firstName is required');
    if (!email) errors.push('email is required');
    else if (!isEmail(email)) errors.push('email is not a valid address');

    if (email) {
      if (seenEmails.has(email)) errors.push(`email duplicates row ${seenEmails.get(email)}`);
      else seenEmails.set(email, line);
    }
    if (employeeIdKey) {
      if (seenEmployeeIds.has(employeeIdKey)) errors.push(`employeeId duplicates row ${seenEmployeeIds.get(employeeIdKey)}`);
      else seenEmployeeIds.set(employeeIdKey, line);
    }

    const targetByEmployeeId = employeeIdKey ? byEmployeeId.get(employeeIdKey) : null;
    const targetByEmail = email ? byEmail.get(email) : null;
    if (targetByEmployeeId && targetByEmail && targetByEmployeeId._id !== targetByEmail._id) {
      errors.push('employeeId and email belong to two different existing employees');
    }
    const target = targetByEmployeeId || targetByEmail || null;

    const role = lower(values.role) || 'employee';
    if (!ROLES.includes(role)) errors.push(`role must be one of ${ROLES.join(', ')}`);

    const employmentType = lower(values.employmentType).replace(/[\s-]+/g, '_') || 'full_time';
    if (!EMPLOYMENT_TYPES.includes(employmentType)) {
      errors.push(`employmentType must be one of ${EMPLOYMENT_TYPES.join(', ')}`);
    }

    const status = lower(values.status) || 'active';
    if (!STATUSES.includes(status)) errors.push(`status must be one of ${STATUSES.join(', ')}`);

    if (values.dateOfJoining && !isIsoDate(values.dateOfJoining)) {
      errors.push('dateOfJoining must be formatted YYYY-MM-DD');
    }
    if (values.dateOfBirth && !isIsoDate(values.dateOfBirth)) {
      errors.push('dateOfBirth must be formatted YYYY-MM-DD');
    }

    let workLocation = null;
    if (String(values.workLocationCode || '').trim()) {
      workLocation = matchMaster(workLocations, values.workLocationCode);
      if (!workLocation) errors.push(`workLocationCode "${values.workLocationCode}" does not match any work location`);
      else if (workLocation.status === 'inactive') errors.push(`work location "${workLocation.name}" is inactive`);
    } else if (!target) {
      warnings.push('No work location: the payslip will fall back to the payroll address');
    }

    const department = matchMaster(departments, values.department);
    const designation = matchMaster(designations, values.designation);
    if (String(values.department || '').trim() && !department) {
      warnings.push(`department "${values.department}" is not a master record and will be stored as free text`);
    }
    if (String(values.designation || '').trim() && !designation) {
      warnings.push(`designation "${values.designation}" is not a master record and will be stored as free text`);
    }

    return {
      line,
      values,
      email,
      action: errors.length ? 'skip' : target ? 'update' : 'create',
      targetId: target?._id || null,
      resolved: { role, employmentType, status, workLocation, department, designation },
      errors,
      warnings,
    };
  });

  // Managers are linked after everyone exists, so a manager listed further down
  // the file still resolves.
  const emailsInFile = new Set(plan.filter((row) => !row.errors.length).map((row) => row.email));
  for (const row of plan) {
    const managerEmail = lower(row.values.managerEmail);
    if (!managerEmail) continue;
    if (managerEmail === row.email) {
      row.errors.push('managerEmail cannot be the employee themselves');
      row.action = 'skip';
      continue;
    }
    if (!byEmail.has(managerEmail) && !emailsInFile.has(managerEmail)) {
      row.warnings.push(`managerEmail "${managerEmail}" was not found and will be left unset`);
    }
  }

  return plan;
}

function summarise(plan) {
  return {
    total: plan.length,
    create: plan.filter((row) => row.action === 'create').length,
    update: plan.filter((row) => row.action === 'update').length,
    invalid: plan.filter((row) => row.action === 'skip').length,
    warnings: plan.filter((row) => row.warnings.length).length,
  };
}

function reportRows(plan) {
  return plan.map((row) => ({
    line: row.line,
    employeeId: row.values.employeeId || '',
    name: `${row.values.firstName || ''} ${row.values.lastName || ''}`.trim(),
    email: row.values.email || '',
    workLocation: row.resolved.workLocation?.name || '',
    action: row.action,
    errors: row.errors,
    warnings: row.warnings,
  }));
}

function readCsvBody(req) {
  const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
  if (!csv.trim()) return { error: 'Provide the file contents in a "csv" field' };
  if (csv.length > MAX_CSV_CHARS) return { error: 'The file is larger than 4 MB' };
  return { csv };
}

router.get('/employees/template', permissionRequired('employees.manage'), (req, res) => {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="qhr-employee-import-template.csv"');
  res.set('Cache-Control', 'no-store');
  return res.send(toCsv(EMPLOYEE_COLUMNS, EMPLOYEE_TEMPLATE_ROWS));
});

/** Read-only reference so the UI can show which codes an operator may use. */
router.get('/employees/reference', permissionRequired('employees.manage'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const companyId = companyIdFor(req);
    const company = data.companies.find((item) => item._id === companyId);
    if (!company) return fail(res, 404, 'Company not found');
    return ok(res, {
      columns: EMPLOYEE_COLUMNS,
      requiredColumns: REQUIRED_COLUMNS,
      roles: ROLES,
      employmentTypes: EMPLOYMENT_TYPES,
      statuses: STATUSES,
      workLocations: (company.workLocations || []).map((item) => ({
        _id: item._id, code: item.code, name: item.name, status: item.status, isPayrollAddress: item.isPayrollAddress === true,
      })),
      departments: (company.departments || []).map((item) => ({ _id: item._id, code: item.code, name: item.name })),
      designations: (company.designations || []).map((item) => ({ _id: item._id, code: item.code, name: item.name })),
    });
  } catch (error) {
    return next(error);
  }
});

/** Dry run. Parses and validates without writing anything. */
router.post('/employees/validate', permissionRequired('employees.manage'), async (req, res, next) => {
  try {
    const body = readCsvBody(req);
    if (body.error) return fail(res, 400, body.error);

    const data = await req.app.locals.store.read();
    const companyId = companyIdFor(req);
    const company = data.companies.find((item) => item._id === companyId);
    if (!company) return fail(res, 404, 'Company not found');

    const parsed = parseCsvTable(body.csv, EMPLOYEE_COLUMNS);
    if (parsed.error) return fail(res, 400, parsed.error);
    const missing = REQUIRED_COLUMNS.filter((column) => parsed.absentColumns.includes(column));
    if (missing.length) return fail(res, 400, `Missing required column(s): ${missing.join(', ')}`);
    if (parsed.records.length > MAX_ROWS) return fail(res, 400, `Import is limited to ${MAX_ROWS} rows per file`);
    if (!parsed.records.length) return fail(res, 400, 'The file has a header but no data rows');

    const plan = planEmployeeImport(data, company, parsed.records);
    return ok(res, {
      summary: summarise(plan),
      rows: reportRows(plan),
      unknownColumns: parsed.unknownColumns,
      message: 'Validation complete. Nothing has been saved yet.',
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Applies the import. Valid rows are created or updated; invalid rows are skipped
 * and reported. Runs inside a single store update so a failure part-way cannot
 * leave half a migration behind.
 */
router.post('/employees/commit', permissionRequired('employees.manage'), async (req, res, next) => {
  try {
    const body = readCsvBody(req);
    if (body.error) return fail(res, 400, body.error);

    const parsed = parseCsvTable(body.csv, EMPLOYEE_COLUMNS);
    if (parsed.error) return fail(res, 400, parsed.error);
    const missing = REQUIRED_COLUMNS.filter((column) => parsed.absentColumns.includes(column));
    if (missing.length) return fail(res, 400, `Missing required column(s): ${missing.join(', ')}`);
    if (parsed.records.length > MAX_ROWS) return fail(res, 400, `Import is limited to ${MAX_ROWS} rows per file`);
    if (!parsed.records.length) return fail(res, 400, 'The file has a header but no data rows');

    const companyId = companyIdFor(req);
    const defaultPasscode = String(req.body?.defaultPasscode || '').trim() || '1234';

    const result = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => item._id === companyId);
      if (!company) return { error: 'Company not found', status: 404 };

      const plan = planEmployeeImport(data, company, parsed.records);
      const applicable = plan.filter((row) => row.action !== 'skip');
      if (!applicable.length) {
        return { error: 'Every row failed validation. Nothing was imported.', status: 400 };
      }

      // Bulk import must respect the seat allowance, otherwise it becomes a way to
      // add unlimited employees without buying seats.
      const subscription = normalizedSubscription(company, data);
      if (subscription.status !== 'trial') {
        const activeAccounts = data.employees.filter((item) => item.companyId === company._id && item.status !== 'inactive').length;
        const newActive = applicable.filter((row) => row.action === 'create' && row.resolved.status !== 'inactive').length;
        if (activeAccounts + newActive > subscription.totalSeats) {
          const shortfall = activeAccounts + newActive - subscription.totalSeats;
          return {
            error: `This import needs ${shortfall} more seat(s). You have ${subscription.totalSeats} seat(s) with ${activeAccounts} in use. Increase the paid-seat allowance before importing.`,
            status: 409,
          };
        }
      }

      const now = nowIso();
      let created = 0;
      let updated = 0;

      for (const row of applicable) {
        const { values, resolved } = row;
        const firstName = String(values.firstName).trim();
        const lastName = String(values.lastName || '').trim();
        const shared = {
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim(),
          phone: String(values.phone || '').trim() || null,
          role: resolved.role,
          department: resolved.department?.name || String(values.department || '').trim() || 'Operations',
          designation: resolved.designation?.name || String(values.designation || '').trim() || 'Employee',
          departmentId: resolved.department?._id || null,
          designationId: resolved.designation?._id || null,
          employmentType: resolved.employmentType,
          status: resolved.status,
          updatedAt: now,
        };
        // Only overwrite the location when the file supplied one, so a partial
        // migration file cannot wipe assignments it did not mention.
        if (resolved.workLocation) shared.workLocationId = resolved.workLocation._id;

        if (row.action === 'update') {
          const employee = data.employees.find((item) => item._id === row.targetId);
          if (!employee) {
            row.action = 'skip';
            row.errors.push('Employee disappeared before the import was applied');
            continue;
          }
          Object.assign(employee, shared);
          if (String(values.employeeId || '').trim()) employee.employeeId = String(values.employeeId).trim();
          if (isIsoDate(values.dateOfJoining)) employee.dateOfJoining = String(values.dateOfJoining).trim();
          if (isIsoDate(values.dateOfBirth)) employee.dateOfBirth = String(values.dateOfBirth).trim();
          row.appliedId = employee._id;
          updated += 1;
          continue;
        }

        const employee = {
          _id: newId('emp'),
          companyId: company._id,
          employeeId: String(values.employeeId || '').trim() || normalizeCode(`${company.code}${data.employees.length + created + 1}`),
          ...shared,
          email: row.email,
          workLocationId: resolved.workLocation?._id || null,
          managerId: null,
          approverIds: [],
          delegateApproverId: null,
          permissionGrants: [],
          permissionRevokes: [],
          dateOfJoining: isIsoDate(values.dateOfJoining) ? String(values.dateOfJoining).trim() : now.slice(0, 10),
          dateOfBirth: isIsoDate(values.dateOfBirth) ? String(values.dateOfBirth).trim() : null,
          hideBirthday: false,
          passcodeHash: hashSecret(defaultPasscode),
          passwordHash: hashSecret(defaultPasscode),
          requiresPasswordChange: true,
          lastLoginAt: null,
          createdAt: now,
        };
        data.employees.push(employee);
        row.appliedId = employee._id;
        created += 1;
      }

      // Second pass: everyone exists now, so manager references resolve.
      const byEmail = new Map(
        data.employees.filter((item) => item.companyId === company._id).map((item) => [lower(item.email), item]),
      );
      let managersLinked = 0;
      for (const row of applicable) {
        if (!row.appliedId) continue;
        const managerEmail = lower(row.values.managerEmail);
        if (!managerEmail) continue;
        const manager = byEmail.get(managerEmail);
        const employee = data.employees.find((item) => item._id === row.appliedId);
        if (!manager || !employee || manager._id === employee._id) continue;
        employee.managerId = manager._id;
        employee.updatedAt = now;
        managersLinked += 1;
      }

      company.updatedAt = now;
      return { plan, created, updated, managersLinked };
    });

    if (result.error) return fail(res, result.status || 400, result.error);

    const skipped = result.plan.filter((row) => row.action === 'skip').length;
    return ok(res, {
      summary: {
        total: result.plan.length,
        created: result.created,
        updated: result.updated,
        skipped,
        managersLinked: result.managersLinked,
      },
      rows: reportRows(result.plan),
      message: `Imported ${result.created} new and updated ${result.updated} employee(s)${skipped ? `, skipped ${skipped}` : ''}.`,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
