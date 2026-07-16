const { fail } = require('../utils/responses');
const { findCompany, publicEmployee } = require('../utils/records');
const { normalizedSubscription } = require('../utils/billing');

async function authRequired(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;

    if (!token) {
      return fail(res, 401, 'Authentication token is required');
    }

    const data = await req.app.locals.store.read();
    const session = data.sessions.find((item) => item.accessToken === token);
    if (!session || new Date(session.accessExpiresAt).getTime() < Date.now()) {
      return fail(res, 401, 'Session expired or invalid');
    }

    const employee = data.employees.find((item) => item._id === session.employeeId && item.status !== 'inactive');
    if (!employee) {
      return fail(res, 401, 'User is no longer active');
    }

    const company = findCompany(data, employee.companyId);
    if (['suspended', 'archived'].includes(company?.status) && employee.role !== 'super_admin') {
      return fail(res, 403, `Company access is ${company.status}`);
    }
    const subscription = company ? normalizedSubscription(company, data) : null;
    if (subscription?.billingMode === 'automatic' && subscription.status === 'paused' && employee.role !== 'super_admin') {
      const fallbackBillingAdmin = data.employees.find((item) => item.companyId === company._id && item.role === 'admin' && item.status !== 'inactive');
      const freeAdminEmployeeId = subscription.freeAdminEmployeeId || fallbackBillingAdmin?._id;
      if (employee._id !== freeAdminEmployeeId) {
        return fail(res, 403, 'Subscription payment is overdue. Ask the Company Admin to renew access.');
      }
    }
    req.auth = { session };
    req.user = employee;
    req.company = company;
    req.currentUser = publicEmployee(employee, company);
    return next();
  } catch (error) {
    return next(error);
  }
}

function roleRequired(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, 'You do not have permission to perform this action');
    }
    return next();
  };
}

module.exports = {
  authRequired,
  roleRequired,
};
