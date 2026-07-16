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

const ACCESS_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;

const router = express.Router();

function issueSession(data, employeeId, req) {
  const now = Date.now();
  const session = {
    _id: `sess_${now.toString(36)}_${data.sessions.length + 1}`,
    employeeId,
    accessToken: makeToken(),
    refreshToken: makeToken(),
    accessExpiresAt: new Date(now + ACCESS_TOKEN_MS).toISOString(),
    refreshExpiresAt: new Date(now + REFRESH_TOKEN_MS).toISOString(),
    userAgent: req.get('user-agent') || null,
    ip: req.ip,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  data.sessions.push(session);
  return session;
}

function tokenPayload(session) {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_MS / 1000),
  };
}

function authPayload(employee, company, session) {
  const tokens = tokenPayload(session);
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

  return verifySecret(secret, employee.passwordHash) || verifySecret(secret, employee.passcodeHash);
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

router.post('/login', async (req, res, next) => {
  try {
    const { companyCode, employeeId, passcode } = req.body || {};
    const result = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => normalizeCode(item.code) === normalizeCode(companyCode));
      if (!company || !company.isVerified || company.status !== 'active') {
        return { error: 'Invalid company code' };
      }

      const employee = data.employees.find((item) => (
        item.companyId === company._id &&
        normalizeCode(item.employeeId) === normalizeCode(employeeId) &&
        item.status !== 'inactive'
      ));
      if (!employee || !verifyLoginSecret(employee, passcode, 'passcode')) {
        return { error: 'Invalid employee ID or passcode' };
      }

      employee.lastLoginAt = nowIso();
      employee.updatedAt = nowIso();
      const session = issueSession(data, employee._id, req);
      return { payload: authPayload(employee, company, session) };
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
      const session = data.sessions.find((item) => item.refreshToken === refreshToken);
      if (!session || new Date(session.refreshExpiresAt).getTime() < Date.now()) {
        return { error: 'Refresh token expired or invalid' };
      }

      const employee = data.employees.find((item) => item._id === session.employeeId && item.status !== 'inactive');
      if (!employee) return { error: 'User is no longer active' };

      const company = findCompany(data, employee.companyId);
      if (['suspended', 'archived'].includes(company?.status) && employee.role !== 'super_admin') {
        return { error: `Company access is ${company.status}`, status: 403 };
      }

      session.accessToken = makeToken();
      session.refreshToken = makeToken();
      session.accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_MS).toISOString();
      session.refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MS).toISOString();
      session.updatedAt = nowIso();

      return { payload: authPayload(employee, company, session) };
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

router.post('/change-password', authRequired, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 4) {
      return fail(res, 400, 'New password must be at least 4 characters long');
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return fail(res, 400, 'New password and confirmation do not match');
    }

    const result = await req.app.locals.store.update((data) => {
      const employee = data.employees.find((item) => item._id === req.user._id);
      if (!employee || !verifyLoginSecret(employee, currentPassword, 'password')) {
        return { error: 'Current password is incorrect' };
      }

      employee.passwordHash = hashSecret(newPassword);
      employee.requiresPasswordChange = false;
      employee.updatedAt = nowIso();
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
