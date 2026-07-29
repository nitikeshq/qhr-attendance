const express = require('express');

const { authRequired } = require('../middleware/auth');
const { hashSecret, verifySecret } = require('../utils/passwords');
const { fail, ok } = require('../utils/responses');
const {
  findCompany,
  makeToken,
  normalizeCode,
  nowIso,
  publicCompany,
  publicEmployee,
} = require('../utils/records');
const { sessionTokenMatches, setSessionToken } = require('../utils/sessionTokens');

function positiveDuration(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const ACCESS_TOKEN_MS = positiveDuration(process.env.ACCESS_TOKEN_TTL_MS, 24 * 60 * 60 * 1000);
const REFRESH_TOKEN_MS = positiveDuration(process.env.REFRESH_TOKEN_TTL_MS, 30 * 24 * 60 * 60 * 1000);

const router = express.Router();

function tokenPair(session) {
  const accessToken = makeToken();
  const refreshToken = makeToken();
  setSessionToken(session, 'access', accessToken);
  setSessionToken(session, 'refresh', refreshToken);
  return { session, accessToken, refreshToken };
}

function issueSession(data, employeeId, req) {
  const now = Date.now();
  const session = {
    _id: `sess_${now.toString(36)}_${data.sessions.length + 1}`,
    employeeId,
    accessExpiresAt: new Date(now + ACCESS_TOKEN_MS).toISOString(),
    refreshExpiresAt: new Date(now + REFRESH_TOKEN_MS).toISOString(),
    userAgent: req.get('user-agent') || null,
    ip: req.ip,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const issued = tokenPair(session);
  data.sessions.push(session);
  return issued;
}

function tokenPayload(issued) {
  return {
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_MS / 1000),
  };
}

function authPayload(employee, company, issued) {
  const tokens = tokenPayload(issued);
  return {
    employee: publicEmployee(employee, company),
    user: publicEmployee(employee, company),
    tokens,
    ...tokens,
  };
}

function verifyLoginSecret(employee, secret, mode) {
  if (mode === 'passcode') {
    return verifySecret(secret, employee.passcodeHash);
  }

  return verifySecret(secret, employee.passwordHash);
}

router.get('/companies', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const companies = data.companies
      .filter((company) => company.isVerified && company.status === 'active')
      .map(publicCompany);
    return ok(res, { companies });
  } catch (error) {
    return next(error);
  }
});

/**
 * Employee sign-in. Accepts either the issued password or the legacy device
 * passcode, so an employee can use the one-time password mailed to them at
 * onboarding and existing passcode users keep working.
 */
router.post('/login', async (req, res, next) => {
  try {
    const body = req.body || {};
    const { companyCode, employeeId } = body;
    const secret = body.password || body.passcode || '';
    const result = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => normalizeCode(item.code) === normalizeCode(companyCode));
      if (!company || !company.isVerified || company.status !== 'active') {
        return { error: 'Invalid company code' };
      }

      const needle = normalizeCode(employeeId);
      const email = String(body.email || employeeId || '').trim().toLowerCase();
      const employee = data.employees.find((item) => (
        item.companyId === company._id
        && item.status !== 'inactive'
        && (normalizeCode(item.employeeId) === needle || String(item.email || '').toLowerCase() === email)
      ));
      // Either credential is accepted; which one matched does not change access.
      const matches = employee
        && (verifyLoginSecret(employee, secret, 'password') || verifyLoginSecret(employee, secret, 'passcode'));
      if (!matches) {
        return { error: 'Invalid employee ID or password' };
      }

      employee.lastLoginAt = nowIso();
      employee.updatedAt = nowIso();
      const session = issueSession(data, employee._id, req);
      return {
        payload: {
          ...authPayload(employee, company, session),
          // The client must send the user to a change-password screen first.
          requiresPasswordChange: employee.requiresPasswordChange === true,
        },
      };
    });

    if (result.error) return fail(res, 401, result.error);
    return ok(res, result.payload);
  } catch (error) {
    return next(error);
  }
});

router.post('/admin-login', async (req, res, next) => {
  try {
    const { email, password, companyCode } = req.body || {};
    const result = await req.app.locals.store.update((data) => {
      const employee = data.employees.find((item) => {
        const companyMatches = !companyCode || normalizeCode(findCompany(data, item.companyId)?.code) === normalizeCode(companyCode);
        return companyMatches &&
          String(item.email || '').toLowerCase() === String(email || '').trim().toLowerCase() &&
          ['manager', 'hr', 'admin', 'super_admin'].includes(item.role) &&
          item.status !== 'inactive';
      });

      if (!employee || !verifyLoginSecret(employee, password, 'password')) {
        return { error: 'Invalid admin credentials' };
      }

      const company = findCompany(data, employee.companyId);
      if (['suspended', 'archived'].includes(company?.status) && employee.role !== 'super_admin') {
        return { error: `Company access is ${company.status}`, status: 403 };
      }
      employee.lastLoginAt = nowIso();
      employee.updatedAt = nowIso();
      const session = issueSession(data, employee._id, req);
      return { payload: authPayload(employee, company, session) };
    });

    if (result.error) return fail(res, result.status || 401, result.error);
    return ok(res, result.payload);
  } catch (error) {
    return next(error);
  }
});

async function refreshHandler(req, res, next) {
  try {
    const { refreshToken } = req.body || {};
    const result = await req.app.locals.store.update((data) => {
      const session = data.sessions.find((item) => sessionTokenMatches(item, 'refresh', refreshToken));
      if (!session || new Date(session.refreshExpiresAt).getTime() < Date.now()) {
        return { error: 'Refresh token expired or invalid' };
      }

      const employee = data.employees.find((item) => item._id === session.employeeId && item.status !== 'inactive');
      if (!employee) return { error: 'User is no longer active' };

      const company = findCompany(data, employee.companyId);
      if (['suspended', 'archived'].includes(company?.status) && employee.role !== 'super_admin') {
        return { error: `Company access is ${company.status}`, status: 403 };
      }

      const now = Date.now();
      session.accessExpiresAt = new Date(now + ACCESS_TOKEN_MS).toISOString();
      session.refreshExpiresAt = new Date(now + REFRESH_TOKEN_MS).toISOString();
      session.updatedAt = nowIso();
      const issued = tokenPair(session);

      return { payload: authPayload(employee, company, issued) };
    });

    if (result.error) return fail(res, result.status || 401, result.error);
    return ok(res, result.payload);
  } catch (error) {
    return next(error);
  }
}

router.post('/refresh-token', refreshHandler);
router.post('/refresh', refreshHandler);

router.get('/me', authRequired, (req, res) => ok(res, {
  user: req.currentUser,
  employee: req.currentUser,
}));

function passwordPolicyError(password) {
  const value = String(password || '');
  if (value.length < 10) return 'New password must be at least 10 characters long';
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) return 'New password must include uppercase and lowercase letters';
  if (!/\d/.test(value)) return 'New password must include a number';
  if (!/[^A-Za-z0-9]/.test(value)) return 'New password must include a special character';
  return null;
}

router.post('/change-password', authRequired, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    const policyError = passwordPolicyError(newPassword);
    if (policyError) return fail(res, 400, policyError);
    if (confirmPassword && newPassword !== confirmPassword) {
      return fail(res, 400, 'New password and confirmation do not match');
    }

    const result = await req.app.locals.store.update((data) => {
      const employee = data.employees.find((item) => item._id === req.user._id);
      if (!employee || !verifyLoginSecret(employee, currentPassword, 'password')) {
        return { error: 'Current password is incorrect' };
      }
      if (verifySecret(newPassword, employee.passwordHash)) {
        return { error: 'New password must be different from the current password' };
      }

      employee.passwordHash = hashSecret(newPassword);
      employee.requiresPasswordChange = false;
      employee.updatedAt = nowIso();
      data.sessions = data.sessions.filter((session) => (
        session.employeeId !== employee._id || session._id === req.auth.session._id
      ));
      return { employee, company: findCompany(data, employee.companyId) };
    });

    if (result.error) return fail(res, 400, result.error);
    return ok(res, {
      user: publicEmployee(result.employee, result.company),
      message: 'Password changed successfully',
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', authRequired, async (req, res, next) => {
  try {
    await req.app.locals.store.update((data) => {
      data.sessions = data.sessions.filter((session) => session._id !== req.auth.session._id);
    });
    return ok(res, { message: 'Logged out successfully' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
