const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { hashSecret } = require('../utils/passwords');
const { created, fail, ok } = require('../utils/responses');
const { normalizedSubscription } = require('../utils/billing');
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

router.get('/designations', (req, res) => ok(res, {
  designations: [
    'Company Admin',
    'HR Manager',
    'Engineering Manager',
    'Software Engineer',
    'Sales Executive',
    'Operations Executive',
  ],
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

    const targetCompanyId = req.user.role === 'super_admin' && body.companyId ? body.companyId : req.company._id;
    if (body.role === 'super_admin' && targetCompanyId !== req.user.companyId) {
      return fail(res, 403, 'Super Admin accounts can only belong to the platform company');
    }

    const result = await req.app.locals.store.update((data) => {
      const company = findCompany(data, targetCompanyId);
      if (!company) return { error: 'Company not found', status: 404 };
      if (['suspended', 'archived'].includes(company.status)) return { error: 'Employees cannot be added to a suspended or archived company', status: 409 };
      const subscription = normalizedSubscription(company, data);
      const activeAccounts = data.employees.filter((employee) => employee.companyId === targetCompanyId && employee.status !== 'inactive').length;
      const accountLimit = subscription.freeAdminSeats + subscription.paidSeats;
      if ((body.status || 'active') !== 'inactive' && subscription.status !== 'trial' && activeAccounts >= accountLimit) {
        return { error: `No paid seats are available. Increase the paid-seat allowance above ${subscription.paidSeats} before adding another account.`, status: 409 };
      }
      const employeeId = normalizeCode(body.employeeId || `EMP${String(data.employees.length + 1).padStart(3, '0')}`);
      const exists = data.employees.some((employee) => (
        (employee.companyId === targetCompanyId && normalizeCode(employee.employeeId) === employeeId) ||
        String(employee.email).toLowerCase() === String(body.email).trim().toLowerCase()
      ));
      if (exists) return { error: 'Employee ID or email already exists' };

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
        managerId: body.managerId || null,
        status: body.status || 'active',
        dateOfJoining: body.dateOfJoining || new Date().toISOString().slice(0, 10),
        passcodeHash: hashSecret(body.passcode || '1234'),
        passwordHash: hashSecret(body.password || body.passcode || '1234'),
        requiresPasswordChange: Boolean(body.requiresPasswordChange),
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      };

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
      return { employee, company };
    });

    if (result.error) return fail(res, result.status || 409, result.error);
    return created(res, {
      employee: publicEmployee(result.employee, result.company),
      message: 'Employee created successfully',
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
    const result = await req.app.locals.store.update((data) => {
      const employee = findEmployee(data, req.params.id, req.user.role === 'super_admin' ? undefined : req.company._id);
      if (!employee) return { error: 'Employee not found' };
      if (req.body?.role === 'super_admin' && req.user.role !== 'super_admin') return { forbidden: 'Only a Super Admin can assign the Super Admin role' };
      if (req.body?.role === 'super_admin' && employee.companyId !== req.user.companyId) return { forbidden: 'Super Admin accounts can only belong to the platform company' };
      if (employee._id === req.user._id && req.body?.role && req.body.role !== 'super_admin') return { protected: 'You cannot remove your own Super Admin role' };
      if (employee._id === req.user._id && req.body?.status === 'inactive') return { protected: 'You cannot deactivate your own account' };
      if (req.body?.role === 'admin' && !['admin', 'super_admin'].includes(req.user.role)) return { forbidden: 'Only an Admin can assign the Admin role' };
      if (employee.status === 'inactive' && req.body?.status === 'active') {
        const company = findCompany(data, employee.companyId);
        const subscription = normalizedSubscription(company, data);
        const activeAccounts = data.employees.filter((item) => item.companyId === employee.companyId && item.status !== 'inactive').length;
        if (subscription.status !== 'trial' && activeAccounts >= subscription.freeAdminSeats + subscription.paidSeats) {
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
      if (req.body?.passcode) {
        if (String(req.body.passcode).length < 4) return { invalid: 'Passcode must be at least 4 characters long' };
        employee.passcodeHash = hashSecret(req.body.passcode);
        employee.passwordHash = hashSecret(req.body.password || req.body.passcode);
        employee.requiresPasswordChange = Boolean(req.body.requiresPasswordChange);
      }

      const allowed = ['firstName', 'lastName', 'phone', 'role', 'department', 'designation', 'managerId', 'status', 'dateOfJoining'];
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
          employee[key] = req.body[key];
        }
      }
      employee.name = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
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
