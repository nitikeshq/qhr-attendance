const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { hashSecret } = require('../utils/passwords');
const { buildEmployeeProfile, generateOneTimePassword } = require('../utils/employeeProfile');
const { created, fail, ok } = require('../utils/responses');
const { normalizedSubscription } = require('../utils/billing');
const {
  effectivePermissions,
  hasPermission,
  isPermissionKey,
} = require('../utils/permissions');
const {
  appendSalaryRevision,
  normalizePayrollSettings,
  normalizeSalaryStructure,
} = require('../utils/payroll');
const {
  findCompany,
  findEmployee,
  newId,
  normalizeCode,
  nowIso,
  paginate,
  publicEmployee,
} = require('../utils/records');

const router = express.Router();

router.use(authRequired);
router.use(roleRequired('manager', 'hr', 'admin', 'super_admin'));

function recordEmployeeAudit(data, req, action, employee, details = {}) {
  data.auditLogs ||= [];
  data.auditLogs.push({
    _id: newId('audit'),
    actorId: req.user._id,
    actorName: req.user.name,
    actorRole: req.user.role,
    action,
    companyId: employee.companyId,
    employeeId: employee._id,
    details,
    createdAt: nowIso(),
  });
}

function applyEmployeeSalary(data, employee, company, salaryBody, actorId, defaultReason = 'Employee salary updated') {
  if (!salaryBody || typeof salaryBody !== 'object') return null;
  const settings = normalizePayrollSettings(company);
  const current = employee.salary || {};
  const salaryInput = {
    ...current,
    ...salaryBody,
    monthlyGrossTarget: Number(salaryBody.monthlyGrossTarget ?? salaryBody.monthlyGross ?? current.monthlyGrossTarget ?? 0),
    monthlyTds: Math.max(0, Number(salaryBody.monthlyTds ?? current.monthlyTds ?? 0)),
    effectiveFrom: salaryBody.effectiveFrom || employee.dateOfJoining,
    salaryMode: salaryBody.salaryMode || current.salaryMode || 'company_template',
    updatedAt: nowIso(),
    updatedBy: actorId,
  };

  if (Object.prototype.hasOwnProperty.call(salaryBody, 'recurringExtra')) {
    const recurringExtra = salaryBody.recurringExtra || {};
    const existingOverrides = Array.isArray(current.earningOverrides)
      ? current.earningOverrides.filter((item) => item.code !== 'employee_recurring_extra')
      : [];
    const extraAmount = Math.max(0, Number(recurringExtra.amount || 0));
    salaryInput.earningOverrides = extraAmount > 0
      ? [...existingOverrides, {
          code: 'employee_recurring_extra',
          name: String(recurringExtra.name || 'Recurring addition').trim(),
          calculation: recurringExtra.calculation || 'fixed',
          treatment: 'after_gross',
          value: extraAmount,
          taxable: recurringExtra.taxable === true,
          partOfPfWage: false,
          partOfEsiWage: false,
          prorate: recurringExtra.prorate === true,
          active: true,
        }]
      : existingOverrides;
  }

  const salary = normalizeSalaryStructure(employee, settings, salaryInput);
  if (salary.payrollEnabled && salary.monthlyGrossTarget <= 0) return { error: 'Monthly gross salary must be greater than zero when payroll is enabled' };
  if (salary.payrollEnabled && salary.calculationWarning) return { error: salary.calculationWarning };
  employee.salary = salary;
  const revision = appendSalaryRevision(data, employee, salary, actorId, salaryBody.revisionReason || defaultReason);
  return { salary, revision };
}

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'];
const FALLBACK_DESIGNATIONS = [
  'Company Admin',
  'HR Manager',
  'Engineering Manager',
  'Software Engineer',
  'Sales Executive',
  'Operations Executive',
];

function idList(value) {
  if (!Array.isArray(value)) return [];
  const ids = value.map((item) => String(item || '').trim()).filter(Boolean);
  return [...new Set(ids)];
}

function permissionKeyList(value) {
  if (!Array.isArray(value)) return null;
  const keys = value.map((item) => String(item || '').trim()).filter(Boolean);
  if (keys.some((key) => !isPermissionKey(key))) return null;
  return [...new Set(keys)];
}

function masterList(company, key) {
  return Array.isArray(company?.[key]) ? company[key] : [];
}

function validateOrgReferences(company, body) {
  const checks = [
    { field: 'departmentId', collection: 'departments', label: 'Department' },
    { field: 'designationId', collection: 'designations', label: 'Designation' },
    { field: 'workLocationId', collection: 'workLocations', label: 'Work location' },
  ];
  for (const check of checks) {
    if (!Object.prototype.hasOwnProperty.call(body, check.field)) continue;
    const value = body[check.field];
    if (value === null || value === '' || value === undefined) continue;
    if (!masterList(company, check.collection).some((item) => item._id === value)) {
      return `${check.label} was not found for this company`;
    }
  }
  return null;
}

function normalizeEmploymentType(value, fallback = 'full_time') {
  const type = String(value || '').trim();
  return EMPLOYMENT_TYPES.includes(type) ? type : fallback;
}

router.get('/designations', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const company = findCompany(data, req.company?._id);
    const names = masterList(company, 'designations')
      .filter((item) => item.status !== 'inactive')
      .map((item) => String(item.name || '').trim())
      .filter(Boolean);
    return ok(res, { designations: names.length ? names : FALLBACK_DESIGNATIONS });
  } catch (error) {
    return next(error);
  }
});

router.get('/me/permissions', (req, res) => ok(res, {
  role: req.user.role,
  permissions: [...effectivePermissions(req.user)],
}));

router.get('/', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    let employees = req.user.role === 'super_admin'
      ? data.employees
      : data.employees.filter((employee) => employee.companyId === req.company._id);
    if (req.user.role === 'super_admin' && req.query.companyId) {
      employees = employees.filter((employee) => employee.companyId === req.query.companyId);
    }
    if (req.user.role === 'manager') {
      employees = employees.filter((employee) => employee._id === req.user._id || employee.managerId === req.user._id);
    }

    if (req.query.role) {
      employees = employees.filter((employee) => employee.role === req.query.role);
    }
    if (req.query.status) {
      employees = employees.filter((employee) => employee.status === req.query.status);
    }

    const { items, pagination } = paginate(employees, req.query);
    return ok(res, {
      employees: items.map((employee) => publicEmployee(employee, findCompany(data, employee.companyId))),
      pagination,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/', roleRequired('hr', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.firstName || !body.email) {
      return fail(res, 400, 'firstName and email are required');
    }
    if (body.passcode && String(body.passcode).length < 4) {
      return fail(res, 400, 'Passcode must be at least 4 characters long');
    }
    if (body.role === 'super_admin' && req.user.role !== 'super_admin') {
      return fail(res, 403, 'Only a Super Admin can create another Super Admin');
    }
    if (body.role === 'admin' && !['admin', 'super_admin'].includes(req.user.role)) {
      return fail(res, 403, 'Only an Admin can create an Admin account');
    }

    const sendsPermissionOverrides = Object.prototype.hasOwnProperty.call(body, 'permissionGrants')
      || Object.prototype.hasOwnProperty.call(body, 'permissionRevokes');
    if (sendsPermissionOverrides && !hasPermission(req.user, 'permissions.manage')) {
      return fail(res, 403, 'You do not have permission to manage custom permissions');
    }
    const permissionGrants = permissionKeyList(body.permissionGrants ?? []);
    const permissionRevokes = permissionKeyList(body.permissionRevokes ?? []);
    if (permissionGrants === null || permissionRevokes === null) {
      return fail(res, 400, 'One or more permission keys are invalid');
    }

    const targetCompanyId = req.user.role === 'super_admin' && body.companyId ? body.companyId : req.company._id;
    if (body.role === 'super_admin' && targetCompanyId !== req.user.companyId) {
      return fail(res, 403, 'Super Admin accounts can only belong to the platform company');
    }

    const result = await req.app.locals.store.update((data) => {
      const company = findCompany(data, targetCompanyId);
      if (!company) return { error: 'Company not found', status: 404 };
      if (['suspended', 'archived'].includes(company.status)) return { error: 'Employees cannot be added to a suspended or archived company', status: 409 };
      // Work location is how the payslip gets a place of work, so it is required
      // as soon as the company has more than one site. With exactly one active
      // location we pick it automatically rather than making the user choose.
      //
      // Locations the system inferred from an attendance geofence are excluded
      // from that count. They were never a deliberate placement decision, so
      // they must not start demanding one; the registered address is used
      // instead. Editing such a location in Organisation clears the flag and it
      // then counts like any other site.
      const activeLocations = (Array.isArray(company.workLocations) ? company.workLocations : [])
        .filter((item) => item.status !== 'inactive');
      const deliberateLocations = activeLocations.filter((item) => item.derivedFromGeofence !== true);
      let resolvedWorkLocationId = body.workLocationId || null;
      if (!resolvedWorkLocationId) {
        if (activeLocations.length === 1) resolvedWorkLocationId = activeLocations[0]._id;
        else if (deliberateLocations.length > 1) {
          return { error: 'Select the work location this employee reports to', status: 400 };
        } else if (deliberateLocations.length === 1) {
          resolvedWorkLocationId = deliberateLocations[0]._id;
        } else if (activeLocations.length > 1) {
          const registered = activeLocations.find((item) => item.isPayrollAddress === true);
          resolvedWorkLocationId = (registered || activeLocations[0])._id;
        }
      }

      const profileResult = buildEmployeeProfile(body);
      if (profileResult.error) return { error: profileResult.error, status: 400 };
      const employeeProfile = profileResult.profile;

      const subscription = normalizedSubscription(company, data);
      const activeAccounts = data.employees.filter((employee) => employee.companyId === targetCompanyId && employee.status !== 'inactive').length;
      const accountLimit = subscription.totalSeats;
      if ((body.status || 'active') !== 'inactive' && subscription.status !== 'trial' && activeAccounts >= accountLimit) {
        return { error: `No paid seats are available. Increase the paid-seat allowance above ${subscription.paidSeats} before adding another account.`, status: 409 };
      }
      // Explicit password wins so an import or migration can carry one over.
      const issuedPassword = String(body.password || '').trim() || generateOneTimePassword();
      const employeeId = normalizeCode(body.employeeId || `EMP${String(data.employees.length + 1).padStart(3, '0')}`);
      const exists = data.employees.some((employee) => (
        (employee.companyId === targetCompanyId && normalizeCode(employee.employeeId) === employeeId) ||
        String(employee.email).toLowerCase() === String(body.email).trim().toLowerCase()
      ));
      if (exists) return { error: 'Employee ID or email already exists' };

      const referenceError = validateOrgReferences(company, body);
      if (referenceError) return { error: referenceError, status: 400 };

      const now = nowIso();
      const employee = {
        _id: newId('emp'),
        companyId: targetCompanyId,
        employeeId,
        firstName: body.firstName,
        lastName: body.lastName || '',
        name: `${body.firstName} ${body.lastName || ''}`.trim(),
        email: String(body.email).trim().toLowerCase(),
        phone: body.phone || null,
        role: body.role || 'employee',
        department: body.department || 'Operations',
        designation: body.designation || 'Employee',
        departmentId: body.departmentId || null,
        designationId: body.designationId || null,
        workLocationId: resolvedWorkLocationId,
        dateOfBirth: body.dateOfBirth || null,
        // Employees can keep their birthday off the shared company calendar.
        hideBirthday: body.hideBirthday === true,
        profile: employeeProfile,
        employmentType: normalizeEmploymentType(body.employmentType),
        managerId: body.managerId || null,
        approverIds: idList(body.approverIds),
        delegateApproverId: body.delegateApproverId || null,
        permissionGrants,
        permissionRevokes,
        status: body.status || 'active',
        dateOfJoining: body.dateOfJoining || new Date().toISOString().slice(0, 10),
        passcodeHash: hashSecret(body.passcode || '1234'),
        // A generated one-time password is the default. Never a shared default
        // like "1234", and the plaintext is returned once and never stored.
        passwordHash: hashSecret(issuedPassword),
        requiresPasswordChange: true,
        passwordIssuedAt: now,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      };

      if (body.salary) {
        const salaryResult = applyEmployeeSalary(data, employee, company, body.salary, req.user._id, 'Initial salary structure created');
        if (salaryResult?.error) return { error: salaryResult.error, status: 400 };
      }

      data.employees.push(employee);
      data.leaveBalances.push({
        employeeId: employee._id,
        year: new Date().getUTCFullYear(),
        balances: {
          casual: { total: 12, used: 0, remaining: 12 },
          sick: { total: 10, used: 0, remaining: 10 },
          earned: { total: 18, used: 0, remaining: 18 },
          unpaid: { total: 0, used: 0, remaining: 0 },
        },
      });

      recordEmployeeAudit(data, req, 'employee.created', employee, { employeeId: employee.employeeId, role: employee.role });
      return { employee, company, issuedPassword };
    });

    if (result.error) return fail(res, result.status || 409, result.error);
    return created(res, {
      employee: publicEmployee(result.employee, result.company),
      // Shown once so the admin can hand it over. Only the hash is stored, so
      // it cannot be retrieved again — use the reset endpoint instead.
      credentials: {
        employeeId: result.employee.employeeId,
        companyCode: result.company.code,
        oneTimePassword: result.issuedPassword,
        mustChangeOnFirstLogin: true,
      },
      message: 'Employee created successfully',
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Issues a fresh one-time password. Returned once, forces a change at the next
 * sign-in, and revokes every existing session so a lost or shared credential
 * cannot keep being used.
 */
router.post('/:id/reset-password', roleRequired('hr', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const employee = findEmployee(data, req.params.id, req.user.role === 'super_admin' ? undefined : req.company._id);
      if (!employee) return { missing: true };

      const issuedPassword = generateOneTimePassword();
      employee.passwordHash = hashSecret(issuedPassword);
      employee.requiresPasswordChange = true;
      employee.passwordIssuedAt = nowIso();
      employee.updatedAt = nowIso();
      data.sessions = data.sessions.filter((session) => session.employeeId !== employee._id);

      recordEmployeeAudit(data, req, 'employee.password_reset', employee, { employeeId: employee.employeeId });
      return { employee, company: findCompany(data, employee.companyId), issuedPassword };
    });

    if (result.missing) return fail(res, 404, 'Employee not found');
    return ok(res, {
      credentials: {
        employeeId: result.employee.employeeId,
        companyCode: result.company?.code || '',
        oneTimePassword: result.issuedPassword,
        mustChangeOnFirstLogin: true,
      },
      message: `A new one-time password was issued for ${result.employee.name}. All their sessions were signed out.`,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const employee = findEmployee(data, req.params.id, req.user.role === 'super_admin' ? undefined : req.company._id);
    if (!employee) return fail(res, 404, 'Employee not found');
    if (req.user.role === 'manager' && employee._id !== req.user._id && employee.managerId !== req.user._id) {
      return fail(res, 403, 'You can only view your direct team');
    }
    return ok(res, { employee: publicEmployee(employee, findCompany(data, employee.companyId)) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', roleRequired('hr', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const sendsPermissionOverrides = Object.prototype.hasOwnProperty.call(body, 'permissionGrants')
      || Object.prototype.hasOwnProperty.call(body, 'permissionRevokes');
    if (sendsPermissionOverrides && !hasPermission(req.user, 'permissions.manage')) {
      return fail(res, 403, 'You do not have permission to manage custom permissions');
    }
    const permissionGrants = Object.prototype.hasOwnProperty.call(body, 'permissionGrants')
      ? permissionKeyList(body.permissionGrants)
      : undefined;
    const permissionRevokes = Object.prototype.hasOwnProperty.call(body, 'permissionRevokes')
      ? permissionKeyList(body.permissionRevokes)
      : undefined;
    if (permissionGrants === null || permissionRevokes === null) {
      return fail(res, 400, 'One or more permission keys are invalid');
    }

    const result = await req.app.locals.store.update((data) => {
      const employee = findEmployee(data, req.params.id, req.user.role === 'super_admin' ? undefined : req.company._id);
      if (!employee) return { error: 'Employee not found' };
      if (req.body?.role === 'super_admin' && req.user.role !== 'super_admin') return { forbidden: 'Only a Super Admin can assign the Super Admin role' };
      if (req.body?.role === 'super_admin' && employee.companyId !== req.user.companyId) return { forbidden: 'Super Admin accounts can only belong to the platform company' };
      if (employee._id === req.user._id && req.user.role === 'super_admin' && req.body?.role && req.body.role !== 'super_admin') return { protected: 'You cannot remove your own Super Admin role' };
      if (employee._id === req.user._id && req.user.role === 'admin' && req.body?.role && req.body.role !== 'admin') return { protected: 'You cannot remove your own Company Admin role' };
      if (employee._id === req.user._id && req.body?.status === 'inactive') return { protected: 'You cannot deactivate your own account' };
      if (req.body?.role === 'admin' && !['admin', 'super_admin'].includes(req.user.role)) return { forbidden: 'Only an Admin can assign the Admin role' };
      if (req.body?.status && req.body.status !== employee.status && !['admin', 'super_admin'].includes(req.user.role)) return { forbidden: 'Only an Admin can activate or deactivate an employee' };
      const removesCompanyAdmin = employee.role === 'admin' && (req.body?.status === 'inactive' || (req.body?.role && req.body.role !== 'admin'));
      if (removesCompanyAdmin) {
        const otherAdmins = data.employees.filter((item) => item.companyId === employee.companyId && item._id !== employee._id && item.role === 'admin' && item.status !== 'inactive');
        if (!otherAdmins.length) return { protected: 'A company must keep at least one active Company Admin' };
      }
      if (employee.status === 'inactive' && req.body?.status === 'active') {
        const company = findCompany(data, employee.companyId);
        const subscription = normalizedSubscription(company, data);
        const activeAccounts = data.employees.filter((item) => item.companyId === employee.companyId && item.status !== 'inactive').length;
        if (subscription.status !== 'trial' && activeAccounts >= subscription.totalSeats) {
          return { conflict: `No paid seats are available. Increase the paid-seat allowance above ${subscription.paidSeats} before reactivating this account.` };
        }
      }

      if (req.body?.email) {
        const email = String(req.body.email).trim().toLowerCase();
        if (data.employees.some((item) => item._id !== employee._id && String(item.email).toLowerCase() === email)) {
          return { conflict: 'Employee email is already registered' };
        }
        employee.email = email;
      }
      if (req.body?.employeeId) {
        const employeeId = normalizeCode(req.body.employeeId);
        if (!employeeId) return { invalid: 'Employee ID is required' };
        if (data.employees.some((item) => item._id !== employee._id && item.companyId === employee.companyId && normalizeCode(item.employeeId) === employeeId)) {
          return { conflict: 'Employee ID already exists in this company' };
        }
        employee.employeeId = employeeId;
      }
      if (req.body?.passcode) {
        if (String(req.body.passcode).length < 4) return { invalid: 'Passcode must be at least 4 characters long' };
        employee.passcodeHash = hashSecret(req.body.passcode);
        employee.passwordHash = hashSecret(req.body.password || req.body.passcode);
        employee.requiresPasswordChange = Boolean(req.body.requiresPasswordChange);
      }

      const referenceError = validateOrgReferences(findCompany(data, employee.companyId), req.body || {});
      if (referenceError) return { invalid: referenceError };

      const profileResult = buildEmployeeProfile(req.body || {}, employee.profile || {});
      if (profileResult.error) return { invalid: profileResult.error };
      employee.profile = profileResult.profile;

      const allowed = [
        'firstName',
        'lastName',
        'phone',
        'role',
        'department',
        'designation',
        'departmentId',
        'designationId',
        'workLocationId',
        'delegateApproverId',
        'managerId',
        'status',
        'dateOfBirth',
        'hideBirthday',
        'dateOfJoining',
        'lastWorkingDate',
      ];
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
          employee[key] = req.body[key];
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'employmentType')) {
        employee.employmentType = normalizeEmploymentType(req.body.employmentType, employee.employmentType || 'full_time');
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'approverIds')) {
        employee.approverIds = idList(req.body.approverIds);
      }
      if (permissionGrants !== undefined) employee.permissionGrants = permissionGrants;
      if (permissionRevokes !== undefined) employee.permissionRevokes = permissionRevokes;
      employee.name = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
      if (req.body?.salary) {
        const company = findCompany(data, employee.companyId);
        const salaryResult = applyEmployeeSalary(data, employee, company, req.body.salary, req.user._id, 'Employee salary updated');
        if (salaryResult?.error) return { invalid: salaryResult.error };
      }
      employee.updatedAt = nowIso();
      recordEmployeeAudit(data, req, 'employee.updated', employee, { fields: Object.keys(req.body || {}).filter((key) => !['passcode', 'password'].includes(key)) });
      return { employee, company: findCompany(data, employee.companyId) };
    });

    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.protected) return fail(res, 409, result.protected);
    if (result.invalid) return fail(res, 400, result.invalid);
    if (result.conflict) return fail(res, 409, result.conflict);
    if (result.error) return fail(res, 404, result.error);
    return ok(res, {
      employee: publicEmployee(result.employee, result.company),
      message: 'Employee updated successfully',
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', roleRequired('admin', 'super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const employee = findEmployee(data, req.params.id, req.user.role === 'super_admin' ? undefined : req.company._id);
      if (!employee) return { error: 'Employee not found' };
      if (employee._id === req.user._id) return { protected: 'You cannot deactivate your own account' };
      employee.status = 'inactive';
      employee.updatedAt = nowIso();
      data.sessions = data.sessions.filter((session) => session.employeeId !== employee._id);
      recordEmployeeAudit(data, req, 'employee.deactivated', employee, { employeeId: employee.employeeId });
      return { employee };
    });

    if (result.protected) return fail(res, 409, result.protected);
    if (result.error) return fail(res, 404, result.error);
    return ok(res, { message: 'Employee deactivated successfully' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
