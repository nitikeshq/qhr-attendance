const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const { employeeRef, findEmployee, newId, normalizeCode, nowIso, publicCompany, publicEmployee } = require('../utils/records');
const {
  applyClearedPayment,
  applyPaidInvoiceToSubscription,
  companyBillingSnapshot,
  createPayment,
  ensureBillingCollections,
  money,
  normalizeBillingMode,
  normalizedSubscription,
  platformBillingSnapshot,
  reverseClearedPayment,
  runBillingCycle,
} = require('../utils/billing');

function ensureCollections(data) {
  data.demoRequests ||= [];
  data.contactMessages ||= [];
  data.payroll ||= [];
  data.projects ||= [];
  data.tasks ||= [];
  data.auditLogs ||= [];
  data.sessions ||= [];
  data.subscriptionPlans ||= [
    { _id: 'plan_starter', name: 'Starter', pricePerUser: 19, annualDiscountPercent: 0, freeAdminSeats: 1, status: 'active', userLimit: null },
    { _id: 'plan_professional', name: 'Professional', pricePerUser: 29, annualDiscountPercent: 10, freeAdminSeats: 1, status: 'active', userLimit: null },
    { _id: 'plan_enterprise', name: 'Enterprise', pricePerUser: null, annualDiscountPercent: 0, freeAdminSeats: 1, status: 'active', userLimit: null },
  ];
  ensureBillingCollections(data);
}

function recordPlatformAudit(data, req, action, companyId, details = {}) {
  data.auditLogs.push({
    _id: newId('audit'),
    actorId: req.user._id,
    actorName: req.user.name,
    actorRole: req.user.role,
    action,
    companyId,
    details,
    createdAt: nowIso(),
  });
}

function companyEmployees(data, companyId) {
  return data.employees.filter((employee) => employee.companyId === companyId && employee.status !== 'inactive');
}

function companySnapshot(data, company) {
  const employees = companyEmployees(data, company._id);
  const billing = companyBillingSnapshot(data, company);
  const subscription = billing.subscription;
  return {
    ...publicCompany(company),
    status: company.status || (company.isVerified ? 'active' : 'pending'),
    employeeCount: employees.length,
    monthlyRevenue: subscription.billingCycle === 'yearly' ? subscription.renewalAmount / 12 : subscription.renewalAmount,
    subscription,
    billingSummary: billing.summary,
  };
}

const publicRouter = express.Router();

publicRouter.post('/demo-requests', async (req, res, next) => {
  try {
    const input = req.body || {};
    const body = {
      ...input,
      name: input.name || input.fullName,
      email: input.email || input.workEmail,
      company: input.company || input.companyName,
      employees: input.employees || input.employeeCount || input.companySize,
    };
    if (!body.name || !body.email) return fail(res, 400, 'Name and email are required');
    const request = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = {
        _id: newId('demo'),
        name: body.name,
        email: String(body.email).trim().toLowerCase(),
        phone: body.phone || null,
        company: body.company || body.companyName || null,
        employees: body.employees || body.companySize || null,
        message: body.message || null,
        status: 'new',
        createdAt: nowIso(),
      };
      data.demoRequests.push(item);
      return item;
    });
    return created(res, { request, message: 'Demo request received' });
  } catch (error) {
    return next(error);
  }
});

publicRouter.post('/contact', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.email || !body.message) return fail(res, 400, 'Name, email, and message are required');
    const contact = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = {
        _id: newId('contact'),
        name: body.name,
        email: String(body.email).trim().toLowerCase(),
        phone: body.phone || null,
        company: body.company || null,
        message: body.message,
        status: 'new',
        createdAt: nowIso(),
      };
      data.contactMessages.push(item);
      return item;
    });
    return created(res, { contact, message: 'Message received' });
  } catch (error) {
    return next(error);
  }
});

const adminRouter = express.Router();
adminRouter.use(authRequired);
adminRouter.use(roleRequired('manager', 'hr', 'admin', 'super_admin'));

adminRouter.get('/dashboard', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const employees = companyEmployees(data, req.company._id).filter((employee) => (
      req.user.role !== 'manager' || employee._id === req.user._id || employee.managerId === req.user._id
    ));
    const employeeIds = new Set(employees.map((employee) => employee._id));
    const today = new Date().toISOString().slice(0, 10);
    const attendance = data.attendances.filter((item) => item.companyId === req.company._id && employeeIds.has(item.employeeId) && item.dateKey === today);
    const pendingLeaves = data.leaves.filter((item) => item.companyId === req.company._id && employeeIds.has(item.employeeId) && item.status === 'pending');
    return ok(res, {
      summary: {
        employees: employees.length,
        presentToday: attendance.filter((item) => item.status === 'present').length,
        pendingLeaves: pendingLeaves.length,
        activeGeofences: req.company.attendanceAreas.length,
        monthlyRevenue: employees.length * 19,
      },
      recentAttendance: attendance.slice(-5).reverse(),
      pendingLeaves: pendingLeaves.slice(-5).reverse(),
    });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get('/platform-dashboard', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const companies = data.companies.map((company) => companySnapshot(data, company));
    const activeCompanies = companies.filter((company) => company.status === 'active');
    const billing = platformBillingSnapshot(data);
    return ok(res, {
      summary: {
        companies: companies.length,
        activeCompanies: activeCompanies.length,
        pendingCompanies: companies.filter((company) => company.status === 'pending').length,
        suspendedCompanies: companies.filter((company) => company.status === 'suspended').length,
        employees: companies.reduce((total, company) => total + company.employeeCount, 0),
        monthlyRevenue: companies.reduce((total, company) => total + company.monthlyRevenue, 0),
        collectedAmount: billing.summary.collectedAmount,
        pendingAmount: billing.summary.pendingAmount,
        upcomingAmount: billing.summary.upcomingAmount,
        renewalAmount: billing.summary.renewalAmount,
        openLeads: data.demoRequests.filter((item) => item.status === 'new').length + data.contactMessages.filter((item) => item.status === 'new').length,
      },
      companies,
    });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get('/tenant-subscriptions', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const billing = platformBillingSnapshot(data);
    return ok(res, {
      plans: data.subscriptionPlans,
      ...billing,
      paymentGateways: data.paymentGateways,
    });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get('/billing-overview', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    return ok(res, platformBillingSnapshot(data));
  } catch (error) {
    return next(error);
  }
});

adminRouter.post('/billing/run-cycle', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const stats = runBillingCycle(data, req.body?.at ? new Date(req.body.at) : new Date());
      recordPlatformAudit(data, req, 'billing.cycle_run', req.user.companyId, stats);
      return stats;
    });
    return ok(res, { stats: result, message: 'Billing cycle completed' });
  } catch (error) {
    return next(error);
  }
});

adminRouter.patch('/billing/gateways/:code', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const gateway = data.paymentGateways.find((item) => item.code === req.params.code);
      if (!gateway) return null;
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'enabled')) gateway.enabled = Boolean(req.body.enabled);
      if (req.body?.mode) {
        if (!['test', 'live'].includes(req.body.mode)) return { invalid: 'Gateway mode must be test or live' };
        gateway.mode = req.body.mode;
      }
      if (req.body?.isDefault) {
        data.paymentGateways.forEach((item) => { item.isDefault = item.code === gateway.code; });
        gateway.enabled = true;
      }
      if (!gateway.enabled && gateway.isDefault) gateway.isDefault = false;
      if (!data.paymentGateways.some((item) => item.enabled && item.isDefault)) {
        const firstEnabled = data.paymentGateways.find((item) => item.enabled);
        if (firstEnabled) {
          data.paymentGateways.forEach((item) => { item.isDefault = item.code === firstEnabled.code; });
        }
      }
      recordPlatformAudit(data, req, 'billing.gateway_updated', req.user.companyId, { code: gateway.code, enabled: gateway.enabled, isDefault: gateway.isDefault, mode: gateway.mode });
      return gateway;
    });
    if (!result) return fail(res, 404, 'Payment gateway not found');
    if (result.invalid) return fail(res, 400, result.invalid);
    return ok(res, { gateway: result, message: `${result.name} configuration updated` });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post('/billing/invoices', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const body = req.body || {};
      const company = data.companies.find((item) => item._id === body.companyId);
      if (!company) return { error: 'Company not found' };
      const total = money(body.total);
      if (total <= 0) return { error: 'Invoice total must be greater than zero' };
      const subscription = normalizedSubscription(company, data);
      const sequence = data.billingInvoices.length + 1;
      const timestamp = nowIso();
      const invoice = {
        _id: newId('invoice'),
        invoiceNumber: body.invoiceNumber || `QHR-${new Date().getUTCFullYear()}-${String(sequence).padStart(4, '0')}`,
        companyId: company._id,
        kind: body.kind || 'renewal',
        billingCycle: body.billingCycle || subscription.billingCycle,
        seatCount: Number(body.seatCount ?? subscription.paidSeats),
        pricePerSeat: money(body.pricePerSeat ?? subscription.pricePerUser),
        issueDate: body.issueDate || timestamp,
        dueDate: body.dueDate || timestamp,
        periodStart: body.periodStart || subscription.currentPeriodEnd || timestamp,
        periodEnd: body.periodEnd || subscription.nextRenewalAt || null,
        subtotal: money(body.subtotal ?? total),
        tax: money(body.tax),
        total,
        amountPaid: 0,
        status: new Date(body.dueDate || timestamp).getTime() < Date.now() ? 'overdue' : 'issued',
        notes: body.notes || null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.billingInvoices.push(invoice);
      recordPlatformAudit(data, req, 'billing.invoice_created', company._id, { invoiceNumber: invoice.invoiceNumber, total: invoice.total });
      return { invoice, company };
    });
    if (result.error) return fail(res, 400, result.error);
    return created(res, { invoice: companyBillingSnapshot(await req.app.locals.store.read(), result.company).invoices.find((item) => item._id === result.invoice._id), message: 'Invoice created' });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post('/billing/payments', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const paymentResult = createPayment(data, { ...req.body, status: req.body?.status || 'cleared' }, req.user);
      if (paymentResult.error) return paymentResult;
      recordPlatformAudit(data, req, 'billing.payment_recorded', paymentResult.payment.companyId, {
        invoiceId: paymentResult.payment.invoiceId,
        amount: paymentResult.payment.amount,
        method: paymentResult.payment.method,
        status: paymentResult.payment.status,
      });
      return paymentResult;
    });
    if (result.error) return fail(res, 400, result.error);
    const data = await req.app.locals.store.read();
    const billing = companyBillingSnapshot(data, data.companies.find((company) => company._id === result.payment.companyId));
    return created(res, { payment: billing.payments.find((item) => item._id === result.payment._id), invoice: billing.invoices.find((item) => item._id === result.invoice._id), message: 'Payment recorded' });
  } catch (error) {
    return next(error);
  }
});

adminRouter.patch('/billing/payments/:id', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const payment = data.billingPayments.find((item) => item._id === req.params.id);
      if (!payment) return null;
      const invoice = data.billingInvoices.find((item) => item._id === payment.invoiceId);
      if (!invoice) return { error: 'Payment invoice no longer exists' };
      const nextStatus = req.body?.status;
      if (!['cleared', 'rejected', 'reversed'].includes(nextStatus)) return { error: 'Payment status is invalid' };
      if (payment.status === nextStatus) return { payment, invoice };
      if (payment.status === 'cleared' && nextStatus !== 'reversed') return { error: 'A cleared payment can only be reversed' };
      if (payment.status === 'cleared' && nextStatus === 'reversed') {
        reverseClearedPayment(invoice, payment.appliedAmount ?? payment.amount);
        const company = data.companies.find((item) => item._id === payment.companyId);
        if (company && payment.creditAmount) company.billingCredit = money(Math.max(0, (company.billingCredit || 0) - payment.creditAmount));
      }
      if (payment.status === 'pending_verification' && nextStatus === 'cleared') {
        const amountDue = Math.max(0, money(invoice.total) - money(invoice.amountPaid));
        payment.appliedAmount = money(Math.min(payment.amount, amountDue));
        payment.creditAmount = money(Math.max(0, payment.amount - amountDue));
        applyClearedPayment(invoice, payment.appliedAmount);
        const company = data.companies.find((item) => item._id === payment.companyId);
        if (company && payment.creditAmount > 0) company.billingCredit = money((company.billingCredit || 0) + payment.creditAmount);
        applyPaidInvoiceToSubscription(data, invoice, nowIso());
      }
      payment.status = nextStatus;
      payment.verifiedBy = req.user._id;
      payment.verifiedAt = nowIso();
      payment.notes = req.body?.notes || payment.notes;
      payment.updatedAt = nowIso();
      recordPlatformAudit(data, req, `billing.payment_${nextStatus}`, payment.companyId, { paymentId: payment._id, invoiceId: invoice._id, amount: payment.amount });
      return { payment, invoice };
    });
    if (!result) return fail(res, 404, 'Payment not found');
    if (result.error) return fail(res, 400, result.error);
    const data = await req.app.locals.store.read();
    const company = data.companies.find((item) => item._id === result.payment.companyId);
    const billing = companyBillingSnapshot(data, company);
    return ok(res, { payment: billing.payments.find((item) => item._id === result.payment._id), invoice: billing.invoices.find((item) => item._id === result.invoice._id), message: `Payment ${result.payment.status}` });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get('/audit-logs', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const auditLogs = data.auditLogs
      .slice()
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .map((entry) => {
        const company = data.companies.find((item) => item._id === entry.companyId);
        const employee = entry.employeeId ? data.employees.find((item) => item._id === entry.employeeId) : null;
        return {
          ...entry,
          companyName: company?.name || 'Platform',
          companyCode: company?.code || '-',
          employeeName: employee?.name || null,
        };
      });
    return ok(res, { auditLogs });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get('/companies/:id', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const company = data.companies.find((item) => item._id === req.params.id || normalizeCode(item.code) === normalizeCode(req.params.id));
    if (!company) return fail(res, 404, 'Company not found');
    const employees = data.employees
      .filter((employee) => employee.companyId === company._id)
      .sort((left, right) => left.name.localeCompare(right.name));
    const auditLogs = data.auditLogs
      .filter((entry) => entry.companyId === company._id)
      .slice(-25)
      .reverse();
    return ok(res, {
      company: companySnapshot(data, company),
      employees: employees.map((employee) => publicEmployee(employee, company)),
      auditLogs,
      billing: companyBillingSnapshot(data, company),
    });
  } catch (error) {
    return next(error);
  }
});

adminRouter.patch('/companies/:id', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const company = data.companies.find((item) => item._id === req.params.id);
      if (!company) return null;
      const body = req.body || {};
      const nextStatus = body.status ? String(body.status).toLowerCase() : null;
      if (nextStatus && !['active', 'pending', 'suspended', 'archived'].includes(nextStatus)) {
        return { invalid: 'Company status is invalid' };
      }
      if (company._id === req.user.companyId && ['suspended', 'archived'].includes(nextStatus)) {
        return { protected: 'The company containing your Super Admin account cannot be suspended or archived' };
      }
      if (body.code) {
        const code = normalizeCode(body.code);
        const duplicate = data.companies.some((item) => item._id !== company._id && normalizeCode(item.code) === code);
        if (duplicate) return { conflict: 'Company code is already registered' };
        company.code = code;
      }
      if (body.email) {
        const email = String(body.email).trim().toLowerCase();
        const duplicate = data.companies.some((item) => item._id !== company._id && String(item.email).toLowerCase() === email);
        if (duplicate) return { conflict: 'Company email is already registered' };
        company.email = email;
      }
      for (const key of ['name', 'phone', 'domain']) {
        if (Object.prototype.hasOwnProperty.call(body, key)) company[key] = body[key] || null;
      }
      if (body.status) {
        company.status = nextStatus;
        if (nextStatus === 'active') {
          company.isVerified = true;
          company.verificationStatus = 'verified';
        }
        if (nextStatus === 'archived') company.subscription = { ...company.subscription, ...normalizedSubscription(company, data), status: 'cancelled' };
        if (['suspended', 'archived'].includes(nextStatus)) {
          const employeeIds = new Set(data.employees.filter((employee) => employee.companyId === company._id).map((employee) => employee._id));
          data.sessions = data.sessions.filter((session) => !employeeIds.has(session.employeeId));
        }
      }
      const subscriptionFields = [
        'plan', 'subscriptionStatus', 'pricePerUser', 'annualDiscountPercent', 'billingCycle', 'billingMode',
        'paymentGateway', 'paidSeats', 'customRenewalAmount', 'nextRenewalAt', 'customTerms',
      ];
      if (subscriptionFields.some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
        const current = normalizedSubscription(company, data);
        const billingMode = body.billingMode ? normalizeBillingMode(body.billingMode) : current.billingMode;
        const billingCycle = body.billingCycle || current.billingCycle;
        const paidSeats = body.paidSeats !== undefined ? Number(body.paidSeats) : current.paidSeats;
        const pricePerUser = body.pricePerUser !== undefined ? Number(body.pricePerUser) : current.pricePerUser;
        const annualDiscountPercent = body.annualDiscountPercent !== undefined ? Number(body.annualDiscountPercent) : current.annualDiscountPercent;
        const customRenewalAmount = body.customRenewalAmount === '' || body.customRenewalAmount === null
          ? null
          : body.customRenewalAmount !== undefined ? Number(body.customRenewalAmount) : current.customRenewalAmount;
        if (!['monthly', 'yearly'].includes(billingCycle)) return { invalid: 'Billing cycle is invalid' };
        if (!Number.isInteger(paidSeats) || paidSeats < 0) return { invalid: 'Paid seats must be a whole number of zero or more' };
        if (!Number.isFinite(pricePerUser) || pricePerUser < 0) return { invalid: 'Price per user is invalid' };
        if (!Number.isFinite(annualDiscountPercent) || annualDiscountPercent < 0 || annualDiscountPercent > 100) return { invalid: 'Annual discount must be between 0 and 100' };
        if (customRenewalAmount !== null && (!Number.isFinite(customRenewalAmount) || customRenewalAmount < 0)) return { invalid: 'Custom renewal amount is invalid' };
        if (body.paymentGateway && !['cashfree', 'payu'].includes(body.paymentGateway)) return { invalid: 'Payment gateway is invalid' };

        const requestedStatus = body.subscriptionStatus || current.status;
        company.subscription = {
          ...company.subscription,
          plan: body.plan || current.plan,
          pricePerUser,
          annualDiscountPercent,
          billingCycle,
          billingMode,
          paymentGateway: billingMode === 'automatic' ? (body.paymentGateway || current.paymentGateway || 'cashfree') : null,
          status: billingMode === 'automatic' ? requestedStatus : (requestedStatus === 'cancelled' ? 'cancelled' : 'active'),
          paidSeats,
          freeAdminSeats: 1,
          customRenewalAmount,
          nextRenewalAt: body.nextRenewalAt || current.nextRenewalAt,
          currentPeriodEnd: body.nextRenewalAt || current.currentPeriodEnd,
          customTerms: body.customTerms !== undefined ? body.customTerms || null : current.customTerms,
          graceEndsAt: billingMode === 'automatic' ? current.graceEndsAt : null,
          pausedAt: billingMode === 'automatic' ? current.pausedAt : null,
        };
      }
      if (body.settings && typeof body.settings === 'object') {
        const allowedSettings = ['gpsTracking', 'autoCheckIn', 'leaveApproval', 'desktopMonitoring', 'requirePhotoAttendance', 'officeStart', 'officeEnd', 'timezone'];
        company.settings ||= {};
        for (const key of allowedSettings) {
          if (Object.prototype.hasOwnProperty.call(body.settings, key)) company.settings[key] = body.settings[key];
        }
      }
      company.updatedAt = nowIso();
      recordPlatformAudit(data, req, 'company.updated', company._id, {
        fields: Object.keys(body).filter((key) => key !== 'settings'),
        settings: body.settings ? Object.keys(body.settings) : [],
      });
      return companySnapshot(data, company);
    });
    if (!result) return fail(res, 404, 'Company not found');
    if (result.invalid) return fail(res, 400, result.invalid);
    if (result.protected) return fail(res, 409, result.protected);
    if (result.conflict) return fail(res, 409, result.conflict);
    return ok(res, { company: result, message: 'Company updated successfully' });
  } catch (error) {
    return next(error);
  }
});

adminRouter.delete('/companies/:id', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const company = data.companies.find((item) => item._id === req.params.id);
      if (!company) return null;
      if (company._id === req.user.companyId) return { protected: 'The company containing your Super Admin account cannot be archived' };
      company.status = 'archived';
      company.subscription = { ...company.subscription, ...normalizedSubscription(company, data), status: 'cancelled' };
      company.updatedAt = nowIso();
      const employeeIds = new Set(data.employees.filter((employee) => employee.companyId === company._id).map((employee) => employee._id));
      data.sessions = data.sessions.filter((session) => !employeeIds.has(session.employeeId));
      recordPlatformAudit(data, req, 'company.archived', company._id, { code: company.code, name: company.name });
      return companySnapshot(data, company);
    });
    if (!result) return fail(res, 404, 'Company not found');
    if (result.protected) return fail(res, 409, result.protected);
    return ok(res, { company: result, message: 'Company archived successfully' });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get('/leads', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    return ok(res, { demoRequests: data.demoRequests, contactMessages: data.contactMessages });
  } catch (error) {
    return next(error);
  }
});

adminRouter.patch('/leads/:kind/:id', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const collection = req.params.kind === 'contact' ? data.contactMessages : data.demoRequests;
      const item = collection.find((entry) => entry._id === req.params.id);
      if (!item) return null;
      item.status = req.body?.status || 'contacted';
      item.updatedAt = nowIso();
      return item;
    });
    if (!result) return fail(res, 404, 'Lead not found');
    return ok(res, { lead: result, message: 'Lead updated successfully' });
  } catch (error) {
    return next(error);
  }
});

const payrollRouter = express.Router();
payrollRouter.use(authRequired);

function serializePayslip(data, payslip) {
  return { ...payslip, employee: employeeRef(findEmployee(data, payslip.employeeId)) };
}

payrollRouter.get('/my-payslips', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    return ok(res, { payslips: data.payroll.filter((item) => item.employeeId === req.user._id).map((item) => serializePayslip(data, item)) });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    return ok(res, { payroll: data.payroll.filter((item) => item.companyId === req.company._id).map((item) => serializePayslip(data, item)) });
  } catch (error) {
    return next(error);
  }
});

async function generatePayroll(req, res, next) {
  try {
    const body = req.body || {};
    const period = body.period || new Date().toISOString().slice(0, 7);
    const generated = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const requested = body.employeeId ? [findEmployee(data, body.employeeId, req.company._id)].filter(Boolean) : companyEmployees(data, req.company._id);
      return requested.map((employee) => {
        const existing = data.payroll.find((item) => item.employeeId === employee._id && item.period === period);
        if (existing) return existing;
        const basic = Number(body.basic || employee.salary?.basic || 30000);
        const hra = Number(body.hra || employee.salary?.hra || Math.round(basic * 0.4));
        const allowances = Number(body.allowances || employee.salary?.allowances || 3000);
        const deductions = Number(body.deductions || employee.salary?.deductions || Math.round(basic * 0.08));
        const item = {
          _id: newId('payroll'), companyId: req.company._id, employeeId: employee._id, period,
          basic, hra, allowances, deductions, gross: basic + hra + allowances,
          net: basic + hra + allowances - deductions, status: 'draft', createdAt: nowIso(), updatedAt: nowIso(),
        };
        data.payroll.push(item);
        return item;
      });
    });
    return created(res, { payroll: generated, message: `Payroll generated for ${generated.length} employee(s)` });
  } catch (error) {
    return next(error);
  }
}

payrollRouter.post('/generate', roleRequired('hr', 'admin'), generatePayroll);
payrollRouter.post('/bulk-generate', roleRequired('hr', 'admin'), generatePayroll);

payrollRouter.patch('/:id/approve', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const payslip = data.payroll.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!payslip) return null;
      payslip.status = 'approved';
      payslip.approvedBy = req.user._id;
      payslip.approvedAt = nowIso();
      payslip.updatedAt = nowIso();
      return serializePayslip(data, payslip);
    });
    if (!result) return fail(res, 404, 'Payroll record not found');
    return ok(res, { payroll: result, message: 'Payroll approved' });
  } catch (error) {
    return next(error);
  }
});

const projectsRouter = express.Router();
projectsRouter.use(authRequired);

projectsRouter.get('/', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    return ok(res, { projects: data.projects.filter((item) => item.companyId === req.company._id && item.status !== 'archived') });
  } catch (error) { return next(error); }
});

projectsRouter.post('/', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    if (!req.body?.name) return fail(res, 400, 'Project name is required');
    const project = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = { _id: newId('project'), companyId: req.company._id, name: req.body.name, description: req.body.description || '', members: req.body.members || [], status: 'active', createdBy: req.user._id, createdAt: nowIso(), updatedAt: nowIso() };
      data.projects.push(item);
      return item;
    });
    return created(res, { project, message: 'Project created' });
  } catch (error) { return next(error); }
});

projectsRouter.put('/:id', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const project = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = data.projects.find((entry) => entry._id === req.params.id && entry.companyId === req.company._id);
      if (!item) return null;
      Object.assign(item, req.body, { _id: item._id, companyId: item.companyId, updatedAt: nowIso() });
      return item;
    });
    if (!project) return fail(res, 404, 'Project not found');
    return ok(res, { project, message: 'Project updated' });
  } catch (error) { return next(error); }
});

projectsRouter.delete('/:id', roleRequired('admin'), async (req, res, next) => {
  try {
    const project = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = data.projects.find((entry) => entry._id === req.params.id && entry.companyId === req.company._id);
      if (!item) return null;
      item.status = 'archived'; item.updatedAt = nowIso(); return item;
    });
    if (!project) return fail(res, 404, 'Project not found');
    return ok(res, { message: 'Project archived' });
  } catch (error) { return next(error); }
});

const tasksRouter = express.Router();
tasksRouter.use(authRequired);

tasksRouter.get('/', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read(); ensureCollections(data);
    let tasks = data.tasks.filter((item) => item.companyId === req.company._id);
    if (req.user.role === 'employee') {
      tasks = tasks.filter((item) => item.assignedTo === req.user._id || item.createdBy === req.user._id);
    }
    return ok(res, { tasks });
  } catch (error) { return next(error); }
});

tasksRouter.post('/', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    if (!req.body?.title) return fail(res, 400, 'Task title is required');
    const task = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = { _id: newId('task'), companyId: req.company._id, projectId: req.body.projectId || null, title: req.body.title, description: req.body.description || '', assignedTo: req.body.assignedTo || req.user._id, status: req.body.status || 'todo', priority: req.body.priority || 'medium', dueDate: req.body.dueDate || null, comments: [], timeLogs: [], createdBy: req.user._id, createdAt: nowIso(), updatedAt: nowIso() };
      data.tasks.push(item); return item;
    });
    return created(res, { task, message: 'Task created' });
  } catch (error) { return next(error); }
});

tasksRouter.put('/:id', async (req, res, next) => {
  try {
    const task = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = data.tasks.find((entry) => entry._id === req.params.id && entry.companyId === req.company._id);
      if (!item) return null;
      Object.assign(item, req.body, { _id: item._id, companyId: item.companyId, updatedAt: nowIso() }); return item;
    });
    if (!task) return fail(res, 404, 'Task not found');
    return ok(res, { task, message: 'Task updated' });
  } catch (error) { return next(error); }
});

for (const action of ['comments', 'time-logs', 'verify-visit', 'record-exit']) {
  tasksRouter.post(`/:id/${action}`, async (req, res, next) => {
    try {
      const task = await req.app.locals.store.update((data) => {
        ensureCollections(data);
        const item = data.tasks.find((entry) => entry._id === req.params.id && entry.companyId === req.company._id);
        if (!item) return null;
        const record = { _id: newId(action.replace('-', '_')), employeeId: req.user._id, ...req.body, createdAt: nowIso() };
        if (action === 'comments') item.comments.push(record);
        if (action === 'time-logs') item.timeLogs.push(record);
        if (action === 'verify-visit') item.visitVerification = record;
        if (action === 'record-exit') item.visitExit = record;
        item.updatedAt = nowIso(); return item;
      });
      if (!task) return fail(res, 404, 'Task not found');
      return ok(res, { task, message: 'Task activity recorded' });
    } catch (error) { return next(error); }
  });
}

const areasRouter = express.Router();
areasRouter.use(authRequired);

areasRouter.get('/', (req, res) => ok(res, { areas: req.company.attendanceAreas || [] }));

areasRouter.post('/', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    if (!req.body?.name || req.body?.latitude === undefined || req.body?.longitude === undefined) return fail(res, 400, 'Name, latitude, and longitude are required');
    const area = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => item._id === req.company._id);
      const item = { _id: newId('area'), name: req.body.name, address: req.body.address || '', latitude: Number(req.body.latitude), longitude: Number(req.body.longitude), radiusMeters: Number(req.body.radiusMeters || req.body.radius || 150), active: true };
      company.attendanceAreas.push(item); company.updatedAt = nowIso(); return item;
    });
    return created(res, { area, message: 'Attendance area created' });
  } catch (error) { return next(error); }
});

areasRouter.patch('/:id', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const area = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => item._id === req.company._id);
      const item = company.attendanceAreas.find((entry) => entry._id === req.params.id);
      if (!item) return null;
      Object.assign(item, req.body, { _id: item._id }); company.updatedAt = nowIso(); return item;
    });
    if (!area) return fail(res, 404, 'Attendance area not found');
    return ok(res, { area, message: 'Attendance area updated' });
  } catch (error) { return next(error); }
});

areasRouter.delete('/:id', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const removed = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => item._id === req.company._id);
      const before = company.attendanceAreas.length;
      company.attendanceAreas = company.attendanceAreas.filter((entry) => entry._id !== req.params.id);
      return company.attendanceAreas.length !== before;
    });
    if (!removed) return fail(res, 404, 'Attendance area not found');
    return ok(res, { message: 'Attendance area removed' });
  } catch (error) { return next(error); }
});

const subscriptionsRouter = express.Router();
subscriptionsRouter.use(authRequired);
subscriptionsRouter.use(roleRequired('admin'));
subscriptionsRouter.get('/', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read(); ensureCollections(data);
    const billing = companyBillingSnapshot(data, req.company);
    return ok(res, { plans: data.subscriptionPlans, current: billing.subscription, summary: billing.summary, invoices: billing.invoices, payments: billing.payments, paymentGateways: data.paymentGateways.filter((gateway) => gateway.enabled) });
  } catch (error) { return next(error); }
});

subscriptionsRouter.post('/manual-payments', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const subscription = normalizedSubscription(req.company, data);
      if (!['manual_online', 'manual_offline', 'custom'].includes(subscription.billingMode)) {
        return { error: 'Manual payment submission is not available for an automatic subscription' };
      }
      return createPayment(data, {
        ...req.body,
        companyId: req.company._id,
        status: 'pending_verification',
      }, req.user);
    });
    if (result.error) return fail(res, 400, result.error);
    const data = await req.app.locals.store.read();
    const billing = companyBillingSnapshot(data, req.company);
    return created(res, { payment: billing.payments.find((item) => item._id === result.payment._id), message: 'Payment submitted for Super Admin verification' });
  } catch (error) { return next(error); }
});

module.exports = { adminRouter, areasRouter, payrollRouter, projectsRouter, publicRouter, subscriptionsRouter, tasksRouter };
