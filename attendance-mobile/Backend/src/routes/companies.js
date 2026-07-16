const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { hashSecret } = require('../utils/passwords');
const { created, fail, ok } = require('../utils/responses');
const {
  newId,
  normalizeCode,
  nowIso,
  publicCompany,
  publicEmployee,
} = require('../utils/records');

const router = express.Router();

function defaultLeaveTypes() {
  return [
    { code: 'casual', name: 'Casual Leave', annualAllowance: 12, color: '#6366F1' },
    { code: 'sick', name: 'Sick Leave', annualAllowance: 10, color: '#10B981' },
    { code: 'earned', name: 'Earned Leave', annualAllowance: 18, color: '#F59E0B' },
    { code: 'unpaid', name: 'Unpaid Leave', annualAllowance: 0, color: '#6B7280' },
  ];
}

router.get('/', authRequired, async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const visibleCompanies = req.user.role === 'super_admin'
      ? data.companies
      : data.companies.filter((company) => company._id === req.company._id);
    const companies = visibleCompanies.map(publicCompany);
    return ok(res, { companies });
  } catch (error) {
    return next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const input = req.body || {};
    const body = {
      ...input,
      name: input.name || input.companyName,
      code: input.code || input.companyCode,
      email: input.email || input.adminEmail,
      phone: input.phone || input.adminPhone,
    };
    if (!body.name || !body.code || !body.email) {
      return fail(res, 400, 'Company name, code, and email are required');
    }
    if (body.adminPassword && String(body.adminPassword).length < 8) {
      return fail(res, 400, 'Admin password must be at least 8 characters long');
    }

    const result = await req.app.locals.store.update((data) => {
      const code = normalizeCode(body.code);
      if (data.companies.some((company) => normalizeCode(company.code) === code)) {
        return { error: 'Company code is already registered' };
      }
      if (data.employees.some((employee) => String(employee.email).toLowerCase() === String(body.adminEmail || body.email).trim().toLowerCase())) {
        return { error: 'Admin email is already registered' };
      }

      const now = nowIso();
      const companyId = newId('company');
      const adminId = newId('emp');
      const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
      const company = {
        _id: companyId,
        name: body.name,
        code,
        email: String(body.email).trim().toLowerCase(),
        phone: body.phone || null,
        domain: body.domain || null,
        isVerified: false,
        verificationStatus: 'pending',
        status: 'pending',
        verificationCode,
        subscription: {
          plan: 'Starter',
          pricePerUser: 19,
          annualDiscountPercent: 0,
          billingCycle: 'monthly',
          billingMode: 'manual_online',
          paymentGateway: null,
          status: 'trial',
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: null,
          nextRenewalAt: null,
          graceEndsAt: null,
          pausedAt: null,
          freeAdminSeats: 1,
          freeAdminEmployeeId: adminId,
          paidSeats: 0,
        },
        branding: {
          primaryColor: body.primaryColor || '#6366F1',
          secondaryColor: body.secondaryColor || '#8B5CF6',
          logo: body.logo || null,
        },
        settings: {
          timezone: body.timezone || 'Asia/Kolkata',
          officeStart: body.officeStart || '09:30',
          officeEnd: body.officeEnd || '18:30',
          gpsTracking: true,
          autoCheckIn: true,
          leaveApproval: true,
          desktopMonitoring: true,
          requirePhotoAttendance: false,
        },
        attendanceAreas: [],
        leaveTypes: defaultLeaveTypes(),
        holidays: [],
        createdAt: now,
        updatedAt: now,
      };

      const admin = {
        _id: adminId,
        companyId,
        employeeId: body.adminEmployeeId || 'ADMIN001',
        firstName: body.adminFirstName || body.adminName || 'Company',
        lastName: body.adminLastName || 'Admin',
        name: `${body.adminFirstName || body.adminName || 'Company'} ${body.adminLastName || 'Admin'}`.trim(),
        email: String(body.adminEmail || body.email).trim().toLowerCase(),
        phone: body.adminPhone || body.phone || null,
        role: 'admin',
        department: 'Management',
        designation: 'Company Admin',
        managerId: null,
        status: 'active',
        dateOfJoining: new Date().toISOString().slice(0, 10),
        passcodeHash: hashSecret(body.adminPasscode || '1234'),
        passwordHash: hashSecret(body.adminPassword || body.password || 'password123'),
        requiresPasswordChange: false,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      };

      data.companies.push(company);
      data.employees.push(admin);
      data.leaveBalances.push({
        employeeId: admin._id,
        year: new Date().getUTCFullYear(),
        balances: {
          casual: { total: 12, used: 0, remaining: 12 },
          sick: { total: 10, used: 0, remaining: 10 },
          earned: { total: 18, used: 0, remaining: 18 },
          unpaid: { total: 0, used: 0, remaining: 0 },
        },
      });

      return { company, admin, verificationCode };
    });

    if (result.error) return fail(res, 409, result.error);
    return created(res, {
      company: publicCompany(result.company),
      admin: publicEmployee(result.admin, result.company),
      verificationCode: result.verificationCode,
      message: 'Company registered. Use the verification code to activate it locally.',
    });
  } catch (error) {
    return next(error);
  }
});

async function verifyCompany(req, res, next) {
  try {
    const { companyCode, code, verificationCode } = req.body || {};
    const result = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => normalizeCode(item.code) === normalizeCode(companyCode || code));
      if (!company) return { error: 'Company not found' };

      const provided = String(verificationCode || '').trim();
      if (!provided) return { error: 'Verification code is required' };
      if (company.verificationCode && provided !== company.verificationCode) {
        return { error: 'Verification code is incorrect' };
      }

      company.isVerified = true;
      company.verificationStatus = 'verified';
      company.status = 'active';
      company.updatedAt = nowIso();
      return { company };
    });

    if (result.error) return fail(res, 400, result.error);
    return ok(res, {
      company: publicCompany(result.company),
      message: 'Company verified successfully',
    });
  } catch (error) {
    return next(error);
  }
}

router.post('/verify', verifyCompany);
router.post('/verify-email', verifyCompany);

router.patch('/settings', authRequired, roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const allowed = ['gpsTracking', 'autoCheckIn', 'leaveApproval', 'desktopMonitoring', 'requirePhotoAttendance', 'officeStart', 'officeEnd', 'timezone'];
    const company = await req.app.locals.store.update((data) => {
      const item = data.companies.find((entry) => entry._id === req.company._id);
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) item.settings[key] = req.body[key];
      }
      item.updatedAt = nowIso();
      return item;
    });
    return ok(res, { company: publicCompany(company), message: 'Company settings updated' });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', authRequired, async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const company = data.companies.find((item) => item._id === req.params.id || normalizeCode(item.code) === normalizeCode(req.params.id));
    if (!company) return fail(res, 404, 'Company not found');
    if (req.user.role !== 'super_admin' && company._id !== req.company._id) {
      return fail(res, 403, 'You do not have permission to view this company');
    }
    return ok(res, { company: publicCompany(company) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
