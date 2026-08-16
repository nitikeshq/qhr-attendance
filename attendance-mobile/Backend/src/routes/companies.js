const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { hashSecret } = require('../utils/passwords');
const { created, fail, ok } = require('../utils/responses');

const trimmedText = (value) => String(value === undefined || value === null ? '' : value).trim();
const {
  newId,
  normalizeCode,
  nowIso,
  publicCompany,
  publicEmployee,
} = require('../utils/records');
const {
  normalizeAttendancePolicy,
  normalizeHolidays,
  normalizeLeaveTypes,
} = require('../utils/attendancePolicy');
const {
  canResend,
  checkVerification,
  consumeVerification,
  exposeVerificationCode,
  issueVerification,
  verificationEmail,
} = require('../utils/verification');
const { queueEmail } = require('../services/mailer');
const { normalizeRequestOptions } = require('../utils/requestOptions');

const router = express.Router();

function defaultLeaveTypes() {
  return [
    { code: 'casual', name: 'Casual Leave', annualAllowance: 12, color: '#6366F1', paid: true, payrollTreatment: 'paid' },
    { code: 'sick', name: 'Sick Leave', annualAllowance: 10, color: '#10B981', paid: true, payrollTreatment: 'paid' },
    { code: 'earned', name: 'Earned Leave', annualAllowance: 18, color: '#F59E0B', paid: true, payrollTreatment: 'paid' },
    { code: 'unpaid', name: 'Unpaid Leave', annualAllowance: 0, color: '#6B7280', paid: false, payrollTreatment: 'unpaid' },
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
      // Everything the registration wizard collected is written into the company
      // profile so the onboarding checklist starts prefilled instead of blank.
      const registeredAddress = trimmedText(body.registeredAddress || body.addressLine || body.address);
      const registrationProfile = {
        registeredAddress,
        city: trimmedText(body.city),
        state: trimmedText(body.state),
        pincode: trimmedText(body.pincode || body.postalCode),
        industry: trimmedText(body.industry),
        foundedOn: trimmedText(body.foundedOn),
        employeeCountRange: trimmedText(body.employeeCount),
      };

      // A new tenant lands on the free plan, so its included seats come from that
      // plan rather than being hard-coded. Super Admin can change the plan later.
      const freePlan = (data.subscriptionPlans || []).find((plan) => plan.status === 'active' && Number(plan.pricePerUser) === 0);
      const freePlanSeats = Math.max(1, Math.floor(Number(freePlan?.includedSeats) || 1));
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
        subscription: {
          plan: freePlan?.name || 'Free',
          pricePerUser: Math.max(0, Number(freePlan?.pricePerUser) || 0),
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
          includedSeats: freePlanSeats,
          billingContactEmployeeId: adminId,
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
          attendancePolicy: normalizeAttendancePolicy({ payrollSettings: body.payrollSettings || {} }, body.attendancePolicy || {}),

        },
        profile: registrationProfile,
        // The registered address is also the natural first work location, so the
        // onboarding location step and the payslip address start populated.
        workLocations: registeredAddress
          ? [{
            _id: newId('wloc'),
            name: 'Head office',
            code: normalizeCode(`${code}HQ`.slice(0, 8)),
            addressLine: registeredAddress,
            city: registrationProfile.city,
            state: registrationProfile.state,
            pincode: registrationProfile.pincode,
            timezone: body.timezone || 'Asia/Kolkata',
            isPayrollAddress: true,
            pfEstablishmentCode: '',
            esiEmployerCode: '',
            status: 'active',
            createdAt: now,
            updatedAt: now,
          }]
          : [],
        departments: [],
        designations: [],
        calendarEvents: [],
        attendanceAreas: [],
        // Normalized on the way in, so a registered tenant and a seeded one hold the
        // same shape rather than one storing raw literals.
        leaveTypes: normalizeLeaveTypes(defaultLeaveTypes()),
        requestOptions: normalizeRequestOptions(),
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

      // Hashed, time-limited, and delivered by email. It is deliberately not
      // part of the response: returning it would verify nothing.
      const verificationCode = issueVerification(company);
      const message = verificationEmail(company, verificationCode);
      queueEmail(data, {
        to: company.email,
        subject: message.subject,
        body: message.body,
        kind: 'company_verification',
        companyId: company._id,
        dedupeKey: `verify:${company._id}:${company.verification.sentAt}`,
      });

      return { company, admin, verificationCode };
    });

    if (result.error) return fail(res, 409, result.error);
    return created(res, {
      company: publicCompany(result.company),
      admin: publicEmployee(result.admin, result.company),
      // Test and local development only. Never present in production.
      ...(exposeVerificationCode() ? { verificationCode: result.verificationCode } : {}),
      verificationSentTo: result.company.email,
      message: `Company registered. We sent a verification code to ${result.company.email}.`,
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

      // Already verified: repeating the call is harmless and must not require a
      // code that no longer exists.
      if (company.isVerified && company.verificationStatus === 'verified') return { company };

      const outcome = checkVerification(company, verificationCode || code);
      if (outcome.error) {
        company.updatedAt = nowIso();
        return { error: outcome.error, status: outcome.status };
      }

      consumeVerification(company);
      company.isVerified = true;
      company.verificationStatus = 'verified';
      company.status = 'active';
      company.updatedAt = nowIso();
      return { company };
    });

    if (result.error) return fail(res, result.status || 400, result.error);
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

/**
 * Issues a fresh code. Needed because codes now expire and lock after repeated
 * wrong guesses, so without this a tenant could be stranded mid-registration.
 * The response never reveals whether the company exists, so this cannot be used
 * to enumerate tenants.
 */
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { companyCode, code } = req.body || {};
    const wanted = normalizeCode(companyCode || code);
    const result = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => normalizeCode(item.code) === wanted);
      if (!company) return { silent: true };
      if (company.isVerified && company.verificationStatus === 'verified') return { silent: true };

      const gate = canResend(company);
      if (!gate.allowed) return { error: `Please wait ${gate.retryAfter} second(s) before requesting another code`, status: 429 };

      const fresh = issueVerification(company);
      company.verification.resendCount += 1;
      const message = verificationEmail(company, fresh);
      queueEmail(data, {
        to: company.email,
        subject: message.subject,
        body: message.body,
        kind: 'company_verification',
        companyId: company._id,
        dedupeKey: `verify:${company._id}:${company.verification.sentAt}`,
      });
      company.updatedAt = nowIso();
      return { company, verificationCode: fresh };
    });

    if (result.error) return fail(res, result.status || 429, result.error);
    return ok(res, {
      ...(result.company && exposeVerificationCode() ? { verificationCode: result.verificationCode } : {}),
      message: 'If that company is awaiting verification, a new code is on its way to the registered email address.',
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Everything an employee picks from when raising a request, in one call.
 *
 * The mobile app used free-text inputs for leave type and expense category, so a
 * person had to know the company's vocabulary and type it correctly. This is the
 * single source those dropdowns read.
 */
router.get('/request-options', authRequired, async (req, res, next) => {
  try {
    const options = normalizeRequestOptions(req.company);
    return ok(res, {
      leaveTypes: normalizeLeaveTypes(req.company.leaveTypes || [])
        .map((type) => ({ ...type, label: type.name, unpaid: type.paid === false })),
      reimbursementCategories: options.reimbursementCategories.filter((item) => item.active),
      grievanceCategories: options.grievanceCategories.filter((item) => item.active),
      allowOtherReimbursementCategory: options.allowOtherReimbursementCategory,
      allowOtherGrievanceCategory: options.allowOtherGrievanceCategory,
    });
  } catch (error) {
    return next(error);
  }
});

/** Admin owns the lists. HR may read them, only an admin may change them. */
router.patch('/request-options', authRequired, roleRequired('admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => item._id === req.company._id);
      if (!company) return null;
      company.requestOptions = normalizeRequestOptions(company, req.body || {});
      company.updatedAt = nowIso();
      return company.requestOptions;
    });
    if (!result) return fail(res, 404, 'Company not found');
    return ok(res, { requestOptions: result, message: 'Request options saved' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/settings', authRequired, roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const allowed = ['gpsTracking', 'autoCheckIn', 'leaveApproval', 'desktopMonitoring', 'requirePhotoAttendance', 'officeStart', 'officeEnd', 'timezone'];
    const company = await req.app.locals.store.update((data) => {
      const item = data.companies.find((entry) => entry._id === req.company._id);
      item.settings ||= {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) item.settings[key] = req.body[key];
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'attendancePolicy')) {
        item.settings.attendancePolicy = normalizeAttendancePolicy(item, req.body.attendancePolicy);
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'leaveTypes')) {
        item.leaveTypes = normalizeLeaveTypes(req.body.leaveTypes, item.leaveTypes || []);
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'holidays')) {
        item.holidays = normalizeHolidays(req.body.holidays, item.holidays || []);
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
