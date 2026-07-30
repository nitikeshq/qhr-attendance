const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const { employeeRef, findEmployee, newId, normalizeCode, nowIso, paginate, publicCompany, publicEmployee } = require('../utils/records');
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
const {
  normalizeAttendancePolicy,
  normalizeHolidays,
  normalizeLeaveTypes,
  periodRange,
} = require('../utils/attendancePolicy');
const {
  PERIOD_PATTERN,
  appendSalaryRevision,
  buildPayslipHtml,
  calculatePayroll,
  ensurePayrollCollections,
  generatePayrollForCompany,
  itemizePayslip,
  issuePayslip,
  maskedAccount,
  normalizePayrollSettings,
  normalizeSalaryStructure,
  payrollIdentitySnapshots,
  payrollSummary,
  recalculateAdjustments,
  salaryRevisionForPeriod,
  yearToDate,
} = require('../utils/payroll');
const {
  markPayrollReimbursementsPaid,
  unlinkClaimAdjustment,
} = require('../utils/reimbursements');
const { ensureLocationLinks, locationsNeedReconcile, reconcileCompanyLocations } = require('../utils/locationLinks');
const { migrateVerificationCodes } = require('../utils/verification');
const { emailConfigured, ensureEmailCollections } = require('../services/mailer');
const { previewPayroll } = require('../utils/payrollPreview');

function ensureCollections(data) {
  data.demoRequests ||= [];
  data.contactMessages ||= [];
  ensureEmailCollections(data);
  // Registration codes used to be stored in plaintext and returned to the caller.
  // Any that survive are hashed and expired, so an exposed code cannot be used.
  migrateVerificationCodes(data);
  ensurePayrollCollections(data);
  data.projects ||= [];
  data.tasks ||= [];
  data.auditLogs ||= [];
  data.sessions ||= [];
  data.subscriptionPlans ||= [
    { _id: 'plan_free', name: 'Free', code: 'free', pricePerUser: 0, annualDiscountPercent: 0, includedSeats: 1, status: 'active', userLimit: 1, sortOrder: 0, description: 'For evaluating QHR with a single account.', features: ['Geofenced attendance', 'Leave and WFH requests', 'Employee mobile app'] },
    { _id: 'plan_starter', name: 'Starter', code: 'starter', pricePerUser: 19, annualDiscountPercent: 0, includedSeats: 0, status: 'active', userLimit: null, sortOrder: 1, description: 'Attendance and leave for a growing team.', features: ['Everything in Free', 'Multiple work locations', 'Multi-level approvals', 'Payroll inputs'] },
    { _id: 'plan_professional', name: 'Professional', code: 'professional', pricePerUser: 29, annualDiscountPercent: 10, includedSeats: 0, status: 'active', userLimit: null, sortOrder: 2, highlighted: true, description: 'Full payroll, assets, and work management.', features: ['Everything in Starter', 'Payslips and statutory reports', 'Desktop work hours', 'Asset register', 'Priority support'] },
    { _id: 'plan_enterprise', name: 'Enterprise', code: 'enterprise', pricePerUser: null, annualDiscountPercent: 0, includedSeats: 0, status: 'active', userLimit: null, sortOrder: 3, description: 'Negotiated terms and rollout support.', features: ['Everything in Professional', 'Custom integrations', 'Dedicated rollout support', 'SLA planning'] },
  ];
  ensureBillingCollections(data);
  // Backfills work locations from geofences and links the two, so an address
  // recorded in one place is available everywhere a location is required.
  ensureLocationLinks(data);
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
    // A tenant's own subscription cost, taken from their actual plan. This used
    // to be `employees.length * 19`: a hardcoded per-head price that ignored the
    // plan, the billing cycle, and how many seats were paid for, so the figure on
    // the dashboard disagreed with the invoice.
    const subscription = normalizedSubscription(req.company, data);
    const monthlySubscription = subscription.billingCycle === 'yearly'
      ? money(subscription.renewalAmount / 12)
      : money(subscription.renewalAmount);

    // Approved work-from-home and half days are attendance, not absence. Counting
    // only `status === 'present'` made this tile contradict the attendance page.
    const presentToday = attendance.filter((item) => (
      ['present', 'half_day', 'work_from_home'].includes(item.status)
    )).length;

    return ok(res, {
      summary: {
        employees: employees.length,
        presentToday,
        pendingLeaves: pendingLeaves.length,
        activeGeofences: req.company.attendanceAreas.length,
        // Seat allowance, so the headcount tile can say "5 of 10 seats used".
        totalSeats: subscription.totalSeats,
        monthlySubscription,
        nextRenewalAt: subscription.nextRenewalAt || null,
        billingCycle: subscription.billingCycle,
        planName: subscription.plan || '',
      },
      recentAttendance: attendance.slice(-5).reverse(),
      pendingLeaves: pendingLeaves.slice(-5).reverse(),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * The outbound email queue.
 *
 * Verification codes and one-time passwords are no longer returned to the caller,
 * so without a configured transport a tenant would be stranded mid-registration.
 * This lets the platform owner see what is waiting to be delivered and relay it
 * until SMTP is set up. Restricted to super_admin: the bodies contain codes.
 */
adminRouter.get('/outbound-emails', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const status = String(req.query.status || '').trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const rows = (data.outboundEmails || [])
      .filter((item) => !status || item.status === status)
      .slice(-limit)
      .reverse();
    return ok(res, {
      transportConfigured: emailConfigured(),
      pending: (data.outboundEmails || []).filter((item) => item.status === 'pending').length,
      failed: (data.outboundEmails || []).filter((item) => item.status === 'failed').length,
      emails: rows,
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

/* -------------------------------------------------------------------------- */
/* Subscription plan catalogue                                                */
/* Super Admin owns pricing, included seats, and the marketing feature list.   */
/* -------------------------------------------------------------------------- */

function planCode(value, fallback) {
  const code = String(value || fallback || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return code || 'plan';
}

function readPlanPayload(body, existing = null) {
  const payload = existing ? { ...existing } : {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = String(body.name || '').trim();
    if (!name) return { error: 'Plan name is required' };
    payload.name = name;
  }
  if (!payload.name) return { error: 'Plan name is required' };

  if (Object.prototype.hasOwnProperty.call(body, 'code')) payload.code = planCode(body.code, payload.name);
  payload.code ||= planCode(payload.name);

  if (Object.prototype.hasOwnProperty.call(body, 'pricePerUser')) {
    // null means "contact sales" — an Enterprise style plan with no list price.
    if (body.pricePerUser === null || body.pricePerUser === '') payload.pricePerUser = null;
    else {
      const price = Number(body.pricePerUser);
      if (!Number.isFinite(price) || price < 0) return { error: 'Price per user must be zero or more' };
      payload.pricePerUser = Math.round(price * 100) / 100;
    }
  }
  if (payload.pricePerUser === undefined) payload.pricePerUser = 0;

  if (Object.prototype.hasOwnProperty.call(body, 'includedSeats')) {
    const seats = Number(body.includedSeats);
    if (!Number.isInteger(seats) || seats < 0) return { error: 'Included seats must be a whole number of zero or more' };
    payload.includedSeats = seats;
  }
  payload.includedSeats ??= 0;

  if (Object.prototype.hasOwnProperty.call(body, 'userLimit')) {
    if (body.userLimit === null || body.userLimit === '') payload.userLimit = null;
    else {
      const limit = Number(body.userLimit);
      if (!Number.isInteger(limit) || limit < 1) return { error: 'User limit must be a whole number of one or more, or empty for unlimited' };
      payload.userLimit = limit;
    }
  }
  if (payload.userLimit === undefined) payload.userLimit = null;

  if (Object.prototype.hasOwnProperty.call(body, 'annualDiscountPercent')) {
    const discount = Number(body.annualDiscountPercent);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) return { error: 'Annual discount must be between 0 and 100' };
    payload.annualDiscountPercent = discount;
  }
  payload.annualDiscountPercent ??= 0;

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (!['active', 'inactive'].includes(body.status)) return { error: 'Plan status must be active or inactive' };
    payload.status = body.status;
  }
  payload.status ||= 'active';

  if (Object.prototype.hasOwnProperty.call(body, 'description')) payload.description = String(body.description || '').trim();
  payload.description ??= '';

  if (Object.prototype.hasOwnProperty.call(body, 'features')) {
    const features = Array.isArray(body.features)
      ? body.features
      : String(body.features || '').split('\n');
    payload.features = features.map((item) => String(item).trim()).filter(Boolean).slice(0, 20);
  }
  payload.features ??= [];

  if (Object.prototype.hasOwnProperty.call(body, 'sortOrder')) {
    const order = Number(body.sortOrder);
    payload.sortOrder = Number.isFinite(order) ? Math.floor(order) : 0;
  }
  payload.sortOrder ??= 0;

  if (Object.prototype.hasOwnProperty.call(body, 'highlighted')) payload.highlighted = body.highlighted === true || body.highlighted === 'true';
  payload.highlighted ??= false;

  payload.isFree = payload.pricePerUser === 0;
  if (payload.isFree && payload.includedSeats < 1) {
    return { error: 'A free plan must include at least one seat, otherwise nobody can sign in' };
  }
  return { payload };
}

adminRouter.get('/subscription-plans', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const plans = [...data.subscriptionPlans].sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
    return ok(res, { plans });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post('/subscription-plans', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const parsed = readPlanPayload(req.body || {});
      if (parsed.error) return { invalid: parsed.error };
      if (data.subscriptionPlans.some((plan) => plan.code === parsed.payload.code)) {
        return { invalid: 'A plan with this code already exists' };
      }
      const plan = { _id: newId('plan'), ...parsed.payload, createdAt: nowIso(), updatedAt: nowIso() };
      data.subscriptionPlans.push(plan);
      recordPlatformAudit(data, req, 'billing.plan_created', req.user.companyId, { code: plan.code, name: plan.name });
      return { plan };
    });
    if (result.invalid) return fail(res, 400, result.invalid);
    return created(res, { plan: result.plan, message: `${result.plan.name} plan created` });
  } catch (error) {
    return next(error);
  }
});

adminRouter.patch('/subscription-plans/:id', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const plan = data.subscriptionPlans.find((item) => item._id === req.params.id);
      if (!plan) return { missing: true };
      const parsed = readPlanPayload(req.body || {}, plan);
      if (parsed.error) return { invalid: parsed.error };
      if (data.subscriptionPlans.some((item) => item.code === parsed.payload.code && item._id !== plan._id)) {
        return { invalid: 'A plan with this code already exists' };
      }
      Object.assign(plan, parsed.payload, { updatedAt: nowIso() });
      recordPlatformAudit(data, req, 'billing.plan_updated', req.user.companyId, { code: plan.code, name: plan.name });
      return { plan };
    });
    if (result.missing) return fail(res, 404, 'Subscription plan not found');
    if (result.invalid) return fail(res, 400, result.invalid);
    return ok(res, { plan: result.plan, message: `${result.plan.name} plan updated` });
  } catch (error) {
    return next(error);
  }
});

adminRouter.delete('/subscription-plans/:id', roleRequired('super_admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const index = data.subscriptionPlans.findIndex((item) => item._id === req.params.id);
      if (index === -1) return { missing: true };
      const plan = data.subscriptionPlans[index];
      // Deleting a plan a tenant is on would leave their subscription orphaned;
      // deactivating keeps history intact and hides it from new purchases.
      const inUse = (data.companies || []).filter((company) => company.subscription?.plan === plan.name);
      if (inUse.length) {
        return { invalid: `${inUse.length} company(s) are on this plan. Set it to inactive instead of deleting it.` };
      }
      data.subscriptionPlans.splice(index, 1);
      recordPlatformAudit(data, req, 'billing.plan_deleted', req.user.companyId, { code: plan.code, name: plan.name });
      return { plan };
    });
    if (result.missing) return fail(res, 404, 'Subscription plan not found');
    if (result.invalid) return fail(res, 409, result.invalid);
    return ok(res, { message: `${result.plan.name} plan deleted` });
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
        'paymentGateway', 'paidSeats', 'includedSeats', 'customRenewalAmount', 'nextRenewalAt', 'customTerms',
      ];
      if (subscriptionFields.some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
        const current = normalizedSubscription(company, data);
        const billingMode = body.billingMode ? normalizeBillingMode(body.billingMode) : current.billingMode;
        const billingCycle = body.billingCycle || current.billingCycle;
        const paidSeats = body.paidSeats !== undefined ? Number(body.paidSeats) : current.paidSeats;
        const includedSeats = body.includedSeats !== undefined ? Number(body.includedSeats) : current.includedSeats;
        const pricePerUser = body.pricePerUser !== undefined ? Number(body.pricePerUser) : current.pricePerUser;
        const annualDiscountPercent = body.annualDiscountPercent !== undefined ? Number(body.annualDiscountPercent) : current.annualDiscountPercent;
        const customRenewalAmount = body.customRenewalAmount === '' || body.customRenewalAmount === null
          ? null
          : body.customRenewalAmount !== undefined ? Number(body.customRenewalAmount) : current.customRenewalAmount;
        if (!['monthly', 'yearly'].includes(billingCycle)) return { invalid: 'Billing cycle is invalid' };
        if (!Number.isInteger(paidSeats) || paidSeats < 0) return { invalid: 'Paid seats must be a whole number of zero or more' };
        if (!Number.isInteger(includedSeats) || includedSeats < 0) return { invalid: 'Included seats must be a whole number of zero or more' };
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
          includedSeats,
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
        if (Object.prototype.hasOwnProperty.call(body.settings, 'attendancePolicy')) {
          company.settings.attendancePolicy = normalizeAttendancePolicy(company, body.settings.attendancePolicy);
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, 'leaveTypes')) company.leaveTypes = normalizeLeaveTypes(body.leaveTypes, company.leaveTypes || []);
      if (Object.prototype.hasOwnProperty.call(body, 'holidays')) company.holidays = normalizeHolidays(body.holidays, company.holidays || []);
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
  const liveEmployee = findEmployee(data, payslip.employeeId);
  const liveCompany = data.companies.find((item) => item._id === payslip.companyId);
  const employee = payslip.employeeSnapshot || (liveEmployee ? { ...employeeRef(liveEmployee), department: liveEmployee.department, designation: liveEmployee.designation } : null);
  const company = payslip.companySnapshot || (liveCompany ? { _id: liveCompany._id, code: liveCompany.code, name: liveCompany.name, legalName: liveCompany.name } : null);
  const detailedPayslip = itemizePayslip(data, payslip);
  return {
    ...detailedPayslip,
    employee,
    company,
    yearToDate: yearToDate(data, payslip),
  };
}

function salaryStructureRecord(employee, settings) {
  return {
    employee: { ...employeeRef(employee), department: employee.department, designation: employee.designation, status: employee.status },
    structure: normalizeSalaryStructure(employee, settings),
  };
}

function payrollAudit(data, req, action, payslip, details = {}) {
  data.payrollAuditLogs.push({
    _id: newId('payroll_audit'),
    companyId: payslip?.companyId || req.company._id,
    payrollId: payslip?._id || null,
    employeeId: payslip?.employeeId || null,
    actorId: req.user._id,
    actorName: req.user.name,
    actorRole: req.user.role,
    action,
    details,
    createdAt: nowIso(),
  });
}

function syncPayrollRun(data, runId) {
  if (!runId) return;
  const run = data.payrollRuns.find((item) => item._id === runId);
  if (!run) return;
  const records = data.payroll.filter((item) => item.runId === runId);
  run.totals = payrollSummary(records);
  if (records.length && records.every((item) => item.status === 'paid')) run.status = 'paid';
  else if (records.length && records.every((item) => ['approved', 'paid'].includes(item.status))) run.status = 'approved';
  else if (records.some((item) => item.status === 'pending_approval')) run.status = 'pending_approval';
  else run.status = 'draft';
  run.updatedAt = nowIso();
}

function normalizePaymentDate(value) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

function publishedForEmployee(payslip) {
  return payslip.status === 'paid' || (payslip.status === 'approved' && (payslip.publishedAt || !payslip.settingsSnapshot));
}

function findCompanyPayslip(data, req, id) {
  return data.payroll.find((item) => item._id === id && item.companyId === req.company._id);
}

payrollRouter.get('/my-payslips', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const payslips = data.payroll
      .filter((item) => item.employeeId === req.user._id && publishedForEmployee(item))
      .sort((a, b) => b.period.localeCompare(a.period))
      .map((item) => serializePayslip(data, item));
    return ok(res, { payslips });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/my-payslips/:id/download', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const payslip = data.payroll.find((item) => item._id === req.params.id && item.employeeId === req.user._id && publishedForEmployee(item));
    if (!payslip) return fail(res, 404, 'Payslip not found');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="payslip-${payslip.period}.html"`);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.send(buildPayslipHtml(data, payslip));
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/my-payslips/:id', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const payslip = data.payroll.find((item) => item._id === req.params.id && item.employeeId === req.user._id && publishedForEmployee(item));
    if (!payslip) return fail(res, 404, 'Payslip not found');
    return ok(res, { payslip: serializePayslip(data, payslip) });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/settings', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    return ok(res, { settings: normalizePayrollSettings(req.company) });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.patch('/settings', roleRequired('admin'), async (req, res, next) => {
  try {
    const settings = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const company = data.companies.find((item) => item._id === req.company._id);
      const current = normalizePayrollSettings(company);
      const body = req.body || {};
      company.payrollSettings = normalizePayrollSettings(company, {
        ...current,
        ...body,
        identity: { ...current.identity, ...(body.identity || {}) },
        statutory: { ...current.statutory, ...(body.statutory || {}) },
        autoGeneration: { ...current.autoGeneration, ...(body.autoGeneration || {}) },
        salaryTemplate: {
          ...current.salaryTemplate,
          ...(body.salaryTemplate || {}),
          basic: { ...current.salaryTemplate.basic, ...(body.salaryTemplate?.basic || {}) },
          hra: { ...current.salaryTemplate.hra, ...(body.salaryTemplate?.hra || {}) },
        },
        earnings: body.earnings ?? current.earnings,
        deductions: body.deductions ?? current.deductions,
        updatedAt: nowIso(),
        updatedBy: req.user._id,
      });
      for (const employee of data.employees.filter((item) => item.companyId === company._id && item.salary)) {
        employee.salary = normalizeSalaryStructure(employee, company.payrollSettings);
      }
      company.updatedAt = nowIso();
      payrollAudit(data, req, 'payroll.settings.updated', null, { fields: Object.keys(body) });
      return company.payrollSettings;
    });
    return ok(res, { settings, message: 'Payroll settings saved' });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/salary-structures', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const settings = normalizePayrollSettings(req.company);
    const salaryStructures = companyEmployees(data, req.company._id)
      .filter((employee) => employee.role !== 'super_admin')
      .map((employee) => salaryStructureRecord(employee, settings));
    return ok(res, { salaryStructures });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/salary-structures/:employeeId/revisions', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const employee = findEmployee(data, req.params.employeeId, req.company._id);
    if (!employee || employee.role === 'super_admin') return fail(res, 404, 'Employee not found');
    const revisions = data.salaryRevisions
      .filter((item) => item.companyId === req.company._id && item.employeeId === employee._id)
      .slice()
      .sort((left, right) => String(right.effectiveFrom).localeCompare(String(left.effectiveFrom)) || String(right.createdAt).localeCompare(String(left.createdAt)));
    return ok(res, { employee: employeeRef(employee), revisions });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/salary-structures/:employeeId', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const employee = findEmployee(data, req.params.employeeId, req.company._id);
    if (!employee || employee.role === 'super_admin') return fail(res, 404, 'Employee not found');
    return ok(res, { salaryStructure: salaryStructureRecord(employee, normalizePayrollSettings(req.company)) });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.put('/salary-structures/:employeeId', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const company = data.companies.find((item) => item._id === req.company._id);
      const employee = findEmployee(data, req.params.employeeId, req.company._id);
      if (!employee || employee.role === 'super_admin') return null;
      const settings = normalizePayrollSettings(company);
      const salaryInput = {
        ...(employee.salary || {}),
        ...(req.body || {}),
        updatedAt: nowIso(),
        updatedBy: req.user._id,
      };
      if (Array.isArray(req.body?.earnings) && !Array.isArray(req.body?.earningOverrides)) delete salaryInput.earningOverrides;
      if (Array.isArray(req.body?.deductions) && !Array.isArray(req.body?.deductionOverrides)) delete salaryInput.deductionOverrides;
      const legacyStatutoryFields = [
        'pfApplicable', 'esiApplicable', 'professionalTaxApplicable',
        'labourWelfareFundApplicable', 'gratuityApplicable',
        'professionalTaxMonthly', 'labourWelfareFundMonthly',
      ];
      if (!req.body?.statutoryOverrides && legacyStatutoryFields.some((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key))) {
        delete salaryInput.statutoryOverrides;
      }
      const salary = normalizeSalaryStructure(employee, settings, salaryInput);
      if (salary.payrollEnabled && salary.monthlyGrossTarget <= 0) return { error: 'Monthly gross salary must be greater than zero' };
      if (salary.payrollEnabled && salary.calculationWarning) return { error: salary.calculationWarning };
      employee.salary = salary;
      const revision = appendSalaryRevision(data, employee, salary, req.user._id, req.body?.revisionReason || 'Payroll salary structure updated');
      employee.updatedAt = nowIso();
      payrollAudit(data, req, 'payroll.salary_structure.updated', { companyId: company._id, employeeId: employee._id }, { effectiveFrom: employee.salary.effectiveFrom, annualCtc: employee.salary.annualCtc, revisionId: revision?._id || null });
      return salaryStructureRecord(employee, settings);
    });
    if (!result) return fail(res, 404, 'Employee not found');
    if (result.error) return fail(res, 400, result.error);
    return ok(res, { salaryStructure: result, message: 'Salary structure saved' });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/runs', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const runs = data.payrollRuns.filter((item) => item.companyId === req.company._id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return ok(res, { runs });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/audit-log', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const auditLogs = data.payrollAuditLogs.filter((item) => item.companyId === req.company._id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return ok(res, { auditLogs });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/payment-advice', roleRequired('admin'), async (req, res, next) => {
  try {
    const period = String(req.query.period || '');
    if (!PERIOD_PATTERN.test(period)) return fail(res, 400, 'Payroll period must use YYYY-MM format');
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const records = data.payroll.filter((item) => {
      const mode = item.employeeSnapshot?.paymentMode || item.salarySnapshot?.paymentMode || item.paymentMode || 'bank_transfer';
      return item.companyId === req.company._id && item.period === period && item.status === 'approved' && item.paymentStatus !== 'paid' && mode === 'bank_transfer';
    });
    const rows = [
      ['document_type', 'payroll_id', 'payroll_number', 'employee_id', 'employee_name', 'bank', 'masked_account', 'ifsc', 'net_amount', 'status'],
      ...records.map((item) => {
        const employee = item.employeeSnapshot || findEmployee(data, item.employeeId) || {};
        return ['Payment Advice/Register - Not a Bank Upload File', item._id, item.payrollNumber, employee.employeeId, employee.name, employee.bankName || item.salarySnapshot?.bankName, maskedAccount(employee.bankAccountLast4 || item.salarySnapshot?.bankAccountLast4), employee.bankIfsc || item.salarySnapshot?.bankIfsc, item.net, item.paymentStatus || 'unpaid'];
      }),
    ];
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="payment-advice-${period}.csv"`);
    res.set('X-Payment-Document-Type', 'Advice/Register - Not a Bank Upload File');
    return res.send(`${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`);
  } catch (error) {
    return next(error);
  }
});

payrollRouter.post('/payments/reconcile', roleRequired('admin'), async (req, res, next) => {
  try {
    const period = String(req.body?.period || '');
    const payments = Array.isArray(req.body?.payments) ? req.body.payments : [];
    if (!PERIOD_PATTERN.test(period)) return fail(res, 400, 'Payroll period must use YYYY-MM format');
    if (!payments.length) return fail(res, 400, 'At least one payment is required');
    const references = payments.map((item) => String(item?.paymentReference || '').trim());
    if (references.some((reference) => !reference)) return fail(res, 400, 'Every payment requires a non-empty paymentReference');
    if (new Set(references).size !== references.length) return fail(res, 400, 'Payment references must be unique within the reconciliation batch');
    const paidDates = payments.map((item) => normalizePaymentDate(item?.paidAt));
    if (paidDates.some((date) => !date)) return fail(res, 400, 'Every payment requires a valid company-selected paidAt date in YYYY-MM-DD format');

    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const batch = {
        _id: newId('payment_batch'),
        companyId: req.company._id,
        period,
        createdBy: req.user._id,
        createdAt: nowIso(),
        successes: [],
        errors: [],
      };
      for (const input of payments) {
        const paymentReference = String(input.paymentReference).trim();
        const payslip = data.payroll.find((item) => item._id === input.payrollId && item.companyId === req.company._id && item.period === period);
        if (!payslip) {
          const error = 'Approved same-company payroll record not found for this period';
          batch.errors.push({ payrollId: input.payrollId, paymentReference, error });
          payrollAudit(data, req, 'payroll.payment_reconcile_failed', null, { batchId: batch._id, payrollId: input.payrollId, paymentReference, error });
          continue;
        }
        if (payslip.status === 'paid' || payslip.paymentStatus === 'paid') {
          const error = 'Payroll is already paid';
          batch.errors.push({ payrollId: payslip._id, paymentReference, error });
          payrollAudit(data, req, 'payroll.payment_reconcile_failed', payslip, { batchId: batch._id, paymentReference, error });
          continue;
        }
        if (payslip.status !== 'approved') {
          const error = 'Payroll must be approved before payment';
          batch.errors.push({ payrollId: payslip._id, paymentReference, error });
          payrollAudit(data, req, 'payroll.payment_reconcile_failed', payslip, { batchId: batch._id, paymentReference, error });
          continue;
        }
        const duplicateReference = data.payroll.some((item) => item._id !== payslip._id && item.companyId === req.company._id && item.paymentReference === paymentReference);
        if (duplicateReference) {
          const error = 'Payment reference has already been used';
          batch.errors.push({ payrollId: payslip._id, paymentReference, error });
          payrollAudit(data, req, 'payroll.payment_reconcile_failed', payslip, { batchId: batch._id, paymentReference, error });
          continue;
        }
        payslip.status = 'paid';
        payslip.paymentStatus = 'paid';
        payslip.paymentMode = payslip.employeeSnapshot?.paymentMode || payslip.salarySnapshot?.paymentMode || 'bank_transfer';
        payslip.paymentReference = paymentReference;
        payslip.paidAt = normalizePaymentDate(input.paidAt);
        payslip.publishedAt ||= nowIso();
        payslip.updatedAt = nowIso();
        const linked = markPayrollReimbursementsPaid(data, payslip, paymentReference, payslip.paidAt);
        syncPayrollRun(data, payslip.runId);
        payrollAudit(data, req, 'payroll.payment_reconciled', payslip, { batchId: batch._id, paymentReference, reimbursementCount: linked.length });
        batch.successes.push({ payrollId: payslip._id, payrollNumber: payslip.payrollNumber, paymentReference, paidAt: payslip.paidAt });
      }
      data.paymentBatches.push(batch);
      return batch;
    });
    return ok(res, { batchId: result._id, period, successes: result.successes, errors: result.errors, message: `${result.successes.length} payment(s) reconciled; ${result.errors.length} error(s)` });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const records = data.payroll.filter((item) => item.companyId === req.company._id).sort((a, b) => b.period.localeCompare(a.period) || String(b.createdAt).localeCompare(String(a.createdAt)));
    const settings = normalizePayrollSettings(req.company);
    const salaryStructures = companyEmployees(data, req.company._id).filter((employee) => employee.role !== 'super_admin').map((employee) => salaryStructureRecord(employee, settings));
    const runs = data.payrollRuns.filter((item) => item.companyId === req.company._id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const auditLogs = data.payrollAuditLogs.filter((item) => item.companyId === req.company._id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((item) => ({ ...item, employee: item.employeeId ? employeeRef(findEmployee(data, item.employeeId)) : null }));
    const requestedPeriod = PERIOD_PATTERN.test(String(req.query.period || '')) ? String(req.query.period) : records[0]?.period || new Date().toISOString().slice(0, 7);
    return ok(res, {
      payroll: records.map((item) => serializePayslip(data, item)),
      settings,
      salaryStructures,
      runs,
      auditLogs,
      summary: payrollSummary(records, requestedPeriod),
    });
  } catch (error) {
    return next(error);
  }
});

async function generatePayroll(req, res, next) {
  try {
    const body = req.body || {};
    const period = body.period || new Date().toISOString().slice(0, 7);
    if (!PERIOD_PATTERN.test(period)) return fail(res, 400, 'Payroll period must use YYYY-MM format');
    const generated = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const company = data.companies.find((item) => item._id === req.company._id);
      let employeeId = null;
      if (body.employeeId) {
        const employee = findEmployee(data, body.employeeId, company._id);
        if (!employee) return null;
        employeeId = employee._id;
      }
      const result = generatePayrollForCompany(data, {
        company,
        period,
        employeeId,
        actorId: req.user._id,
        source: body.source || 'manual',
        replaceDrafts: Boolean(body.replaceDrafts),
        submitForApproval: Boolean(body.submitForApproval),
      });
      payrollAudit(data, req, 'payroll.run.generated', null, { runId: result.run._id, period, employeeCount: result.run.employeeCount, createdCount: result.run.createdCount });
      return { ...result, payroll: result.payroll.map((item) => serializePayslip(data, item)) };
    });
    if (!generated) return fail(res, 404, 'Employee not found');
    const skipped = generated.run.skippedCount ? `; ${generated.run.skippedCount} employee(s) skipped because payroll setup is incomplete` : '';
    return created(res, { ...generated, message: `Payroll run ${generated.run.runNumber} prepared for ${generated.run.employeeCount} employee(s)${skipped}` });
  } catch (error) {
    return next(error);
  }
}

/**
 * Dry run. Same computation as generation, nothing written.
 *
 * `view=exceptions` returns only the employees who differ from a clean full
 * month, which on a large payroll is the difference between reviewing fifteen
 * rows and reviewing two hundred.
 */
payrollRouter.get('/preview', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const period = String(req.query.period || '').trim() || new Date().toISOString().slice(0, 7);
    if (!PERIOD_PATTERN.test(period)) return fail(res, 400, 'Payroll period must use YYYY-MM format');

    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const company = data.companies.find((item) => item._id === req.company._id);
    if (!company) return fail(res, 404, 'Company not found');

    const preview = previewPayroll(data, { company, period });
    const view = String(req.query.view || 'all').toLowerCase();
    const rows = view === 'exceptions'
      ? preview.rows.filter((row) => row.reasons.length > 0 || row.blockers.length > 0)
      : preview.rows;

    return ok(res, { ...preview, view, rows });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.post('/generate', roleRequired('hr', 'admin'), generatePayroll);
payrollRouter.post('/bulk-generate', roleRequired('hr', 'admin'), generatePayroll);

payrollRouter.post('/bulk/submit', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const period = req.body?.period;
    if (!PERIOD_PATTERN.test(String(period || ''))) return fail(res, 400, 'Payroll period must use YYYY-MM format');
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const records = data.payroll.filter((item) => item.companyId === req.company._id && item.period === period && item.status === 'draft');
      for (const payslip of records) {
        payslip.status = 'pending_approval';
        payslip.submittedBy = req.user._id;
        payslip.submittedAt = nowIso();
        payslip.updatedAt = nowIso();
        payrollAudit(data, req, 'payroll.submitted', payslip, { bulk: true });
      }
      for (const runId of new Set(records.map((item) => item.runId).filter(Boolean))) syncPayrollRun(data, runId);
      return records.length;
    });
    return ok(res, { count: result, message: `${result} payroll record(s) submitted for approval` });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.post('/bulk/approve', roleRequired('admin'), async (req, res, next) => {
  try {
    const period = req.body?.period;
    if (!PERIOD_PATTERN.test(String(period || ''))) return fail(res, 400, 'Payroll period must use YYYY-MM format');
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const settings = normalizePayrollSettings(req.company);
      const records = data.payroll.filter((item) => item.companyId === req.company._id && item.period === period && ['draft', 'pending_approval'].includes(item.status));

      // Approval freezes the month: adjustments and recalculation are refused
      // afterwards. A leave still awaiting a decision would therefore produce a
      // payslip that is knowably wrong and no longer fixable in place.
      if (req.body?.force !== true) {
        const subjects = new Set(records.map((item) => item.employeeId));
        const range = periodRange(period);
        const from = range.start.toISOString().slice(0, 10);
        const to = range.end.toISOString().slice(0, 10);
        const stalled = (data.leaves || []).filter((leave) => (
          subjects.has(leave.employeeId)
          && leave.status === 'pending'
          && String(leave.startDate).slice(0, 10) <= to
          && String(leave.endDate || leave.startDate).slice(0, 10) >= from
        ));
        if (stalled.length) {
          return {
            error: `${stalled.length} leave request(s) covering ${period} are still pending. Decide them first, or approve with force to accept the current figures.`,
            status: 409,
          };
        }
      }

      for (const payslip of records) {
        payslip.status = 'approved';
        payslip.approvedBy = req.user._id;
        payslip.approvedAt = nowIso();
        payslip.publishedAt = settings.publishOnApproval ? nowIso() : null;
        issuePayslip(payslip, req.user._id);
        payslip.updatedAt = nowIso();
        payrollAudit(data, req, 'payroll.approved', payslip, { bulk: true, published: Boolean(payslip.publishedAt) });
      }
      for (const runId of new Set(records.map((item) => item.runId).filter(Boolean))) syncPayrollRun(data, runId);
      return { count: records.length };
    });
    if (result.error) return fail(res, result.status || 409, result.error);
    return ok(res, { count: result.count, message: `${result.count} payroll record(s) approved${normalizePayrollSettings(req.company).publishOnApproval ? ' and published' : ''}` });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.post('/bulk/publish', roleRequired('admin'), async (req, res, next) => {
  try {
    const period = req.body?.period;
    if (!PERIOD_PATTERN.test(String(period || ''))) return fail(res, 400, 'Payroll period must use YYYY-MM format');
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const records = data.payroll.filter((item) => item.companyId === req.company._id && item.period === period && ['approved', 'paid'].includes(item.status) && !item.publishedAt);
      for (const payslip of records) {
        payslip.publishedAt = nowIso();
        payslip.updatedAt = nowIso();
        payrollAudit(data, req, 'payroll.published', payslip, { bulk: true });
      }
      return records.length;
    });
    return ok(res, { count: result, message: `${result} payslip(s) published to employees` });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.post('/:id/submit', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const payslip = findCompanyPayslip(data, req, req.params.id);
      if (!payslip) return null;
      if (payslip.status !== 'draft') return { error: 'Only draft payroll can be submitted' };
      payslip.status = 'pending_approval';
      payslip.submittedBy = req.user._id;
      payslip.submittedAt = nowIso();
      payslip.updatedAt = nowIso();
      syncPayrollRun(data, payslip.runId);
      payrollAudit(data, req, 'payroll.submitted', payslip);
      return serializePayslip(data, payslip);
    });
    if (!result) return fail(res, 404, 'Payroll record not found');
    if (result.error) return fail(res, 409, result.error);
    return ok(res, { payroll: result, message: 'Payroll submitted for approval' });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.patch('/:id/approve', roleRequired('admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const payslip = findCompanyPayslip(data, req, req.params.id);
      if (!payslip) return null;
      if (!['draft', 'pending_approval'].includes(payslip.status)) return { error: 'Only draft or submitted payroll can be approved' };
      const settings = normalizePayrollSettings(req.company);
      payslip.status = 'approved';
      payslip.approvedBy = req.user._id;
      payslip.approvedAt = nowIso();
      payslip.publishedAt = settings.publishOnApproval ? nowIso() : null;
      issuePayslip(payslip, req.user._id);
      payslip.updatedAt = nowIso();
      syncPayrollRun(data, payslip.runId);
      payrollAudit(data, req, 'payroll.approved', payslip, { published: Boolean(payslip.publishedAt) });
      return serializePayslip(data, payslip);
    });
    if (!result) return fail(res, 404, 'Payroll record not found');
    if (result.error) return fail(res, 409, result.error);
    return ok(res, { payroll: result, message: result.publishedAt ? 'Payroll approved and published' : 'Payroll approved' });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.post('/:id/publish', roleRequired('admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const payslip = findCompanyPayslip(data, req, req.params.id);
      if (!payslip) return null;
      if (!['approved', 'paid'].includes(payslip.status)) return { error: 'Approve payroll before publishing it' };
      payslip.publishedAt = payslip.publishedAt || nowIso();
      payslip.updatedAt = nowIso();
      payrollAudit(data, req, 'payroll.published', payslip);
      return serializePayslip(data, payslip);
    });
    if (!result) return fail(res, 404, 'Payroll record not found');
    if (result.error) return fail(res, 409, result.error);
    return ok(res, { payroll: result, message: 'Payslip published to employee' });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.post('/:id/adjustments', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.name || Number(body.amount) <= 0) return fail(res, 400, 'Adjustment name and a positive amount are required');
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const payslip = findCompanyPayslip(data, req, req.params.id);
      if (!payslip) return null;
      if (!['draft', 'pending_approval'].includes(payslip.status)) return { error: 'Approved payroll cannot be edited' };
      const adjustment = {
        _id: newId('payroll_adjustment'),
        kind: ['earning', 'deduction', 'reimbursement'].includes(body.kind) ? body.kind : 'earning',
        code: normalizeCode(body.code || body.name).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        name: String(body.name),
        amount: Math.round(Number(body.amount) * 100) / 100,
        notes: String(body.notes || ''),
        createdBy: req.user._id,
        createdAt: nowIso(),
      };
      payslip.adjustments ||= [];
      payslip.adjustments.push(adjustment);
      recalculateAdjustments(payslip);
      syncPayrollRun(data, payslip.runId);
      payrollAudit(data, req, 'payroll.adjustment.added', payslip, { adjustment });
      return serializePayslip(data, payslip);
    });
    if (!result) return fail(res, 404, 'Payroll record not found');
    if (result.error) return fail(res, 409, result.error);
    return created(res, { payroll: result, message: 'Payroll adjustment added' });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.delete('/:id/adjustments/:adjustmentId', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const payslip = findCompanyPayslip(data, req, req.params.id);
      if (!payslip) return null;
      if (!['draft', 'pending_approval'].includes(payslip.status)) return { error: 'Approved payroll cannot be edited' };
      const before = (payslip.adjustments || []).length;
      const removedAdjustment = (payslip.adjustments || []).find((item) => item._id === req.params.adjustmentId);
      payslip.adjustments = (payslip.adjustments || []).filter((item) => item._id !== req.params.adjustmentId);
      if (payslip.adjustments.length === before) return { error: 'Adjustment not found' };
      unlinkClaimAdjustment(data, payslip._id, removedAdjustment);
      recalculateAdjustments(payslip);
      syncPayrollRun(data, payslip.runId);
      payrollAudit(data, req, 'payroll.adjustment.removed', payslip, { adjustmentId: req.params.adjustmentId });
      return serializePayslip(data, payslip);
    });
    if (!result) return fail(res, 404, 'Payroll record not found');
    if (result.error) return fail(res, result.error === 'Adjustment not found' ? 404 : 409, result.error);
    return ok(res, { payroll: result, message: 'Payroll adjustment removed' });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.post('/:id/recalculate', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const payslip = findCompanyPayslip(data, req, req.params.id);
      if (!payslip) return null;
      if (['approved', 'paid'].includes(payslip.status) || payslip.issuedAt) return { error: 'Issued payroll cannot be recalculated; add the correction in the next payroll period' };

      const company = data.companies.find((item) => item._id === req.company._id);
      const employee = findEmployee(data, payslip.employeeId, req.company._id);
      if (!company || !employee) return { error: 'Company or employee record is unavailable' };
      const settings = normalizePayrollSettings(company);
      const selectedRevision = salaryRevisionForPeriod(data, employee, payslip.period);
      const salary = normalizeSalaryStructure(employee, settings, selectedRevision.salary);
      if (!salary.payrollEnabled || salary.monthlyGrossTarget <= 0) return { error: 'Configure this employee salary structure before recalculating payroll' };

      const previousStatus = payslip.status;
      const calculated = calculatePayroll(
        data,
        company,
        employee,
        payslip.period,
        settings,
        salary,
        payslip.adjustments || [],
      );
      const identitySnapshots = payrollIdentitySnapshots(company, employee, calculated.salarySnapshot, settings);
      Object.assign(payslip, calculated, identitySnapshots, {
        salaryRevisionId: selectedRevision.revision?._id || null,
        salaryRevisionEffectiveFrom: selectedRevision.revision?.effectiveFrom || calculated.salarySnapshot.effectiveFrom || null,
        status: 'draft',
        paymentStatus: 'unpaid',
        generatedBy: req.user._id,
        generatedAt: nowIso(),
        submittedBy: null,
        submittedAt: null,
        approvedBy: null,
        approvedAt: null,
        publishedAt: null,
        paidAt: null,
        paymentReference: null,
        updatedAt: nowIso(),
      });
      if (previousStatus === 'approved') {
        payslip.reopenedBy = req.user._id;
        payslip.reopenedAt = nowIso();
        payslip.reopenReason = reason;
      }
      syncPayrollRun(data, payslip.runId);
      payrollAudit(data, req, 'payroll.recalculated', payslip, {
        previousStatus,
        reason: reason || null,
        adjustmentsPreserved: payslip.adjustments.length,
      });
      return serializePayslip(data, payslip);
    });
    if (!result) return fail(res, 404, 'Payroll record not found');
    if (result.error) return fail(res, 409, result.error);
    return ok(res, {
      payroll: result,
      message: 'Payroll recalculated from current company settings and employee salary structure',
    });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.post('/:id/mark-paid', roleRequired('admin'), async (req, res, next) => {
  try {
    const paymentReference = String(req.body?.paymentReference || '').trim();
    const paidAt = normalizePaymentDate(req.body?.paidAt);
    if (!paymentReference) return fail(res, 400, 'Payment reference is required');
    if (!paidAt) return fail(res, 400, 'A valid company-selected paid date is required in YYYY-MM-DD format');
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const payslip = findCompanyPayslip(data, req, req.params.id);
      if (!payslip) return null;
      if (payslip.status === 'paid' || payslip.paymentStatus === 'paid') return { error: 'Payroll is already paid' };
      if (payslip.status !== 'approved') return { error: 'Approve payroll before marking it paid' };
      if (data.payroll.some((item) => item._id !== payslip._id && item.companyId === req.company._id && item.paymentReference === paymentReference)) return { error: 'Payment reference has already been used' };
      payslip.status = 'paid';
      payslip.paymentStatus = 'paid';
      payslip.paymentMode = req.body?.paymentMode || payslip.employeeSnapshot?.paymentMode || payslip.salarySnapshot?.paymentMode || 'bank_transfer';
      payslip.paymentReference = paymentReference;
      payslip.paidAt = paidAt;
      payslip.publishedAt = payslip.publishedAt || nowIso();
      payslip.updatedAt = nowIso();
      const paidReimbursements = markPayrollReimbursementsPaid(data, payslip, payslip.paymentReference, payslip.paidAt);
      syncPayrollRun(data, payslip.runId);
      payrollAudit(data, req, 'payroll.marked_paid', payslip, { paymentReference: payslip.paymentReference, reimbursementCount: paidReimbursements.length });
      return serializePayslip(data, payslip);
    });
    if (!result) return fail(res, 404, 'Payroll record not found');
    if (result.error) return fail(res, 409, result.error);
    return ok(res, { payroll: result, message: 'Payroll marked paid' });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.post('/:id/reopen', roleRequired('admin'), async (req, res, next) => {
  try {
    if (!req.body?.reason) return fail(res, 400, 'A reason is required to reopen payroll');
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const payslip = findCompanyPayslip(data, req, req.params.id);
      if (!payslip) return null;
      if (['approved', 'paid'].includes(payslip.status) || payslip.issuedAt) return { error: 'Issued payroll cannot be reopened; create a correction in the next period' };
      payslip.status = 'draft';
      payslip.approvedBy = null;
      payslip.approvedAt = null;
      payslip.publishedAt = null;
      payslip.reopenedBy = req.user._id;
      payslip.reopenedAt = nowIso();
      payslip.reopenReason = String(req.body.reason);
      payslip.updatedAt = nowIso();
      syncPayrollRun(data, payslip.runId);
      payrollAudit(data, req, 'payroll.reopened', payslip, { reason: payslip.reopenReason });
      return serializePayslip(data, payslip);
    });
    if (!result) return fail(res, 404, 'Payroll record not found');
    if (result.error) return fail(res, 409, result.error);
    return ok(res, { payroll: result, message: 'Payroll reopened as draft' });
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/:id/download', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const payslip = findCompanyPayslip(data, req, req.params.id);
    if (!payslip) return fail(res, 404, 'Payroll record not found');
    const employee = findEmployee(data, payslip.employeeId);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="payslip-${employee?.employeeId || 'employee'}-${payslip.period}.html"`);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.send(buildPayslipHtml(data, payslip));
  } catch (error) {
    return next(error);
  }
});

payrollRouter.get('/:id', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const payslip = findCompanyPayslip(data, req, req.params.id);
    if (!payslip) return fail(res, 404, 'Payroll record not found');
    return ok(res, { payroll: serializePayslip(data, payslip) });
  } catch (error) {
    return next(error);
  }
});

const DEFAULT_BOARD_COLUMNS = [
  { id: 'backlog', name: 'Backlog', order: 0, isDone: false },
  { id: 'todo', name: 'To do', order: 1, isDone: false },
  { id: 'in_progress', name: 'In progress', order: 2, isDone: false },
  { id: 'in_review', name: 'In review', order: 3, isDone: false },
  { id: 'done', name: 'Done', order: 4, isDone: true },
];
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const TASK_MANAGER_ROLES = ['manager', 'hr', 'admin', 'super_admin'];
const RANK_STEP = 1000;

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function defaultBoardColumns() {
  return DEFAULT_BOARD_COLUMNS.map((column) => ({ ...column }));
}

function normalizeBoardColumns(value) {
  if (!Array.isArray(value) || !value.length) return defaultBoardColumns();
  const columns = [];
  value.forEach((entry, index) => {
    const source = typeof entry === 'string' ? { name: entry } : entry;
    if (!source) return;
    const name = String(source.name || source.id || '').trim();
    if (!name) return;
    const id = slugify(source.id || name) || `column_${index + 1}`;
    if (columns.some((column) => column.id === id)) return;
    const order = Number.isFinite(Number(source.order)) ? Number(source.order) : index;
    columns.push({ id, name, order, isDone: Boolean(source.isDone) });
  });
  if (!columns.length) return defaultBoardColumns();
  columns.sort((a, b) => a.order - b.order);
  columns.forEach((column, index) => { column.order = index; });
  if (!columns.some((column) => column.isDone)) columns[columns.length - 1].isDone = true;
  return columns;
}

function projectColumns(project) {
  return normalizeBoardColumns(project?.boardColumns);
}

function deriveProjectKey(name) {
  const words = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  let base = '';
  if (words.length > 1) base = words.map((word) => word[0]).join('');
  else if (words.length === 1) base = words[0];
  base = base.replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (base.length < 2) base = `${base}PRJ`.slice(0, 3);
  return base;
}

function validProjectKey(value) {
  const key = normalizeCode(value);
  return /^[A-Z0-9]{2,10}$/.test(key) ? key : null;
}

function uniqueProjectKey(data, companyId, desired, excludeId) {
  const taken = new Set(
    data.projects
      .filter((project) => project.companyId === companyId && project._id !== excludeId)
      .map((project) => normalizeCode(project.key))
      .filter(Boolean),
  );
  const base = desired || 'PRJ';
  if (!taken.has(base)) return base;
  for (let counter = 2; counter < 1000; counter += 1) {
    const suffix = String(counter);
    const candidate = `${base.slice(0, Math.max(2, 10 - suffix.length))}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 4)}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

function activeCompanyEmployee(data, companyId, employeeId) {
  if (employeeId === null || employeeId === undefined || employeeId === '') return null;
  const needle = typeof employeeId === 'object' ? employeeId._id || employeeId.employeeId : employeeId;
  const employee = findEmployee(data, needle, companyId);
  if (!employee || employee.status === 'inactive') return null;
  return employee;
}

function normalizeEmployeeIdList(data, companyId, value, label) {
  if (value === null || value === undefined) return { ids: [] };
  if (!Array.isArray(value)) return { error: `${label} must be an array of employee ids` };
  const ids = [];
  for (const entry of value) {
    const employee = activeCompanyEmployee(data, companyId, entry);
    if (!employee) return { error: `${label} must only contain active employees of your company` };
    if (!ids.includes(employee._id)) ids.push(employee._id);
  }
  return { ids };
}

function normalizeDateInput(value, label) {
  if (value === null || value === undefined || value === '') return { value: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: `${label} is not a valid date` };
  return { value: date.toISOString() };
}

function normalizeLabels(value) {
  if (value === null || value === undefined) return { labels: [] };
  if (!Array.isArray(value)) return { error: 'Labels must be an array of strings' };
  const labels = [];
  for (const entry of value) {
    const label = String(entry === null || entry === undefined ? '' : entry).trim();
    if (!label) continue;
    if (!labels.includes(label)) labels.push(label);
  }
  return { labels };
}

function actorDisplayName(user) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return parts || user?.name || user?.email || 'Unknown';
}

function serializeProject(data, project) {
  if (!project) return null;
  const columns = projectColumns(project);
  return {
    ...project,
    key: normalizeCode(project.key) || deriveProjectKey(project.name),
    boardColumns: columns,
    taskCounter: Number(project.taskCounter) || 0,
    members: Array.isArray(project.members) ? project.members : [],
    leadEmployeeId: project.leadEmployeeId || null,
    startDate: project.startDate || null,
    dueDate: project.dueDate || null,
    lead: project.leadEmployeeId ? employeeRef(findEmployee(data, project.leadEmployeeId, project.companyId)) : null,
  };
}

function projectRef(data, project) {
  if (!project) return null;
  return {
    _id: project._id,
    key: normalizeCode(project.key) || deriveProjectKey(project.name),
    name: project.name,
  };
}

function findCompanyProject(data, req, id) {
  return data.projects.find((project) => project._id === id && project.companyId === req.company._id);
}

function taskStatusId(columns, status) {
  if (status === null || status === undefined || status === '') return columns[0].id;
  const needle = slugify(status);
  const compact = needle.replace(/_/g, '');
  const match = columns.find((column) => {
    const nameSlug = slugify(column.name);
    return column.id === needle
      || nameSlug === needle
      || column.id.replace(/_/g, '') === compact
      || nameSlug.replace(/_/g, '') === compact;
  });
  return match ? match.id : null;
}

function rankOf(task) {
  const raw = task?.rank;
  if (raw === null || raw === undefined || raw === '') return null;
  return raw;
}

function compareTasksByRank(a, b) {
  const left = rankOf(a);
  const right = rankOf(b);
  if (left !== null && right !== null) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    } else {
      const compared = String(left).localeCompare(String(right));
      if (compared !== 0) return compared;
    }
  } else if (left === null && right !== null) {
    return 1;
  } else if (right === null && left !== null) {
    return -1;
  }
  return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
}

function nextRankInColumn(tasks) {
  const numbers = tasks.map((task) => Number(rankOf(task))).filter((value) => Number.isFinite(value));
  const highest = numbers.length ? Math.max(...numbers) : 0;
  return highest + RANK_STEP;
}

function rankBetween(beforeRank, afterRank) {
  const before = Number(beforeRank);
  const after = Number(afterRank);
  const hasBefore = beforeRank !== null && beforeRank !== undefined && beforeRank !== '' && Number.isFinite(before);
  const hasAfter = afterRank !== null && afterRank !== undefined && afterRank !== '' && Number.isFinite(after);
  if (hasBefore && hasAfter) return (before + after) / 2;
  if (hasBefore) return before + RANK_STEP;
  if (hasAfter) return after - RANK_STEP;
  return RANK_STEP;
}

function serializeTask(data, task, projectHint) {
  if (!task) return null;
  const project = projectHint || data.projects.find((entry) => entry._id === task.projectId) || null;
  const columns = projectColumns(project);
  const reporterId = task.reporterId || task.createdBy || null;
  const status = taskStatusId(columns, task.status) || columns[0].id;
  return {
    ...task,
    key: task.key || null,
    status,
    rank: rankOf(task),
    reporterId,
    assignedTo: task.assignedTo || null,
    priority: TASK_PRIORITIES.includes(task.priority) ? task.priority : 'medium',
    labels: Array.isArray(task.labels) ? task.labels : [],
    storyPoints: task.storyPoints === null || task.storyPoints === undefined ? null : Number(task.storyPoints),
    startDate: task.startDate || null,
    dueDate: task.dueDate || null,
    statusChangedAt: task.statusChangedAt || task.updatedAt || task.createdAt || null,
    watchers: Array.isArray(task.watchers) ? task.watchers : [],
    comments: Array.isArray(task.comments) ? task.comments : [],
    activity: Array.isArray(task.activity) ? task.activity : [],
    timeLogs: Array.isArray(task.timeLogs) ? task.timeLogs : [],
    assignee: task.assignedTo ? employeeRef(findEmployee(data, task.assignedTo, task.companyId)) : null,
    project: projectRef(data, project),
  };
}

function serializeTaskDetail(data, task, projectHint) {
  const base = serializeTask(data, task, projectHint);
  if (!base) return null;
  return {
    ...base,
    reporter: base.reporterId ? employeeRef(findEmployee(data, base.reporterId, task.companyId)) : null,
    watcherRefs: base.watchers.map((id) => employeeRef(findEmployee(data, id, task.companyId))).filter(Boolean),
    comments: base.comments.map((comment) => ({
      ...comment,
      author: employeeRef(findEmployee(data, comment.employeeId, task.companyId)),
      mentionRefs: (Array.isArray(comment.mentions) ? comment.mentions : [])
        .map((id) => employeeRef(findEmployee(data, id, task.companyId)))
        .filter(Boolean),
    })),
  };
}

function isTaskManager(user) {
  return TASK_MANAGER_ROLES.includes(user?.role);
}

function taskVisibleToUser(task, user) {
  if (isTaskManager(user)) return true;
  const watchers = Array.isArray(task.watchers) ? task.watchers : [];
  return task.assignedTo === user._id
    || task.reporterId === user._id
    || task.createdBy === user._id
    || watchers.includes(user._id);
}

function canUpdateTask(task, user) {
  if (isTaskManager(user)) return true;
  return task.assignedTo === user._id || task.reporterId === user._id || task.createdBy === user._id;
}

function pushTaskActivity(task, req, field, from, to) {
  task.activity ||= [];
  task.activity.push({
    _id: newId('activity'),
    field,
    from: from === undefined ? null : from,
    to: to === undefined ? null : to,
    actorId: req.user._id,
    actorName: actorDisplayName(req.user),
    at: nowIso(),
  });
}

const projectsRouter = express.Router();
projectsRouter.use(authRequired);

projectsRouter.get('/', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const projects = data.projects
      .filter((item) => item.companyId === req.company._id && item.status !== 'archived')
      .map((item) => serializeProject(data, item));
    return ok(res, { projects });
  } catch (error) { return next(error); }
});

projectsRouter.post('/', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    if (!req.body?.name) return fail(res, 400, 'Project name is required');
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const body = req.body || {};
      let key = null;
      if (body.key !== undefined && body.key !== null && String(body.key).trim() !== '') {
        key = validProjectKey(body.key);
        if (!key) return { error: 'Project key must be 2-10 letters or numbers' };
        const duplicate = data.projects.find((project) => project.companyId === req.company._id && normalizeCode(project.key) === key);
        if (duplicate) return { error: 'Project key is already in use' };
      } else {
        key = uniqueProjectKey(data, req.company._id, deriveProjectKey(body.name));
      }

      const members = normalizeEmployeeIdList(data, req.company._id, body.members, 'Project members');
      if (members.error) return { error: members.error };

      let leadEmployeeId = null;
      if (body.leadEmployeeId) {
        const lead = activeCompanyEmployee(data, req.company._id, body.leadEmployeeId);
        if (!lead) return { error: 'Project lead must be an active employee of your company' };
        leadEmployeeId = lead._id;
      }

      const startDate = normalizeDateInput(body.startDate, 'Start date');
      if (startDate.error) return { error: startDate.error };
      const dueDate = normalizeDateInput(body.dueDate, 'Due date');
      if (dueDate.error) return { error: dueDate.error };

      const timestamp = nowIso();
      const item = {
        _id: newId('project'),
        companyId: req.company._id,
        key,
        name: body.name,
        description: body.description || '',
        members: members.ids,
        leadEmployeeId,
        startDate: startDate.value,
        dueDate: dueDate.value,
        status: 'active',
        taskCounter: 0,
        boardColumns: normalizeBoardColumns(body.boardColumns),
        createdBy: req.user._id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.projects.push(item);
      return { project: item };
    });
    if (result?.error) return fail(res, 400, result.error);
    return created(res, { project: serializeProject(await req.app.locals.store.read(), result.project), message: 'Project created' });
  } catch (error) { return next(error); }
});

projectsRouter.get('/:id/board', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const project = findCompanyProject(data, req, req.params.id);
    if (!project) return fail(res, 404, 'Project not found');
    const columns = projectColumns(project);
    const tasks = data.tasks
      .filter((task) => task.companyId === req.company._id && task.projectId === project._id)
      .filter((task) => taskVisibleToUser(task, req.user))
      .map((task) => serializeTask(data, task, project));
    return ok(res, {
      project: serializeProject(data, project),
      columns: columns.map((column) => ({
        column,
        tasks: tasks.filter((task) => task.status === column.id).sort(compareTasksByRank),
      })),
    });
  } catch (error) { return next(error); }
});

projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const project = findCompanyProject(data, req, req.params.id);
    if (!project) return fail(res, 404, 'Project not found');
    const serialized = serializeProject(data, project);
    return ok(res, { project: serialized, columns: serialized.boardColumns });
  } catch (error) { return next(error); }
});

projectsRouter.put('/:id', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = findCompanyProject(data, req, req.params.id);
      if (!item) return { error: 'Project not found', status: 404 };
      const body = req.body || {};

      if (body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) return { error: 'Project name is required' };
        item.name = name;
      }
      if (body.description !== undefined) item.description = body.description || '';
      if (body.members !== undefined) {
        const members = normalizeEmployeeIdList(data, item.companyId, body.members, 'Project members');
        if (members.error) return { error: members.error };
        item.members = members.ids;
      }
      if (body.leadEmployeeId !== undefined) {
        if (!body.leadEmployeeId) {
          item.leadEmployeeId = null;
        } else {
          const lead = activeCompanyEmployee(data, item.companyId, body.leadEmployeeId);
          if (!lead) return { error: 'Project lead must be an active employee of your company' };
          item.leadEmployeeId = lead._id;
        }
      }
      if (body.startDate !== undefined) {
        const startDate = normalizeDateInput(body.startDate, 'Start date');
        if (startDate.error) return { error: startDate.error };
        item.startDate = startDate.value;
      }
      if (body.dueDate !== undefined) {
        const dueDate = normalizeDateInput(body.dueDate, 'Due date');
        if (dueDate.error) return { error: dueDate.error };
        item.dueDate = dueDate.value;
      }
      if (body.status !== undefined) {
        const status = String(body.status || '').trim().toLowerCase();
        if (!['active', 'on_hold', 'completed', 'archived'].includes(status)) {
          return { error: 'Project status must be active, on_hold, completed, or archived' };
        }
        item.status = status;
      }
      if (body.boardColumns !== undefined) {
        const columns = normalizeBoardColumns(body.boardColumns);
        const removed = projectColumns(item)
          .map((column) => column.id)
          .filter((id) => !columns.some((column) => column.id === id));
        const orphan = data.tasks.find((task) => task.projectId === item._id && removed.includes(taskStatusId(projectColumns(item), task.status)));
        if (orphan) return { error: 'Cannot remove a board column that still has tasks' };
        item.boardColumns = columns;
      }
      item.key = normalizeCode(item.key) || uniqueProjectKey(data, item.companyId, deriveProjectKey(item.name), item._id);
      item.updatedAt = nowIso();
      return { project: item };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    return ok(res, { project: serializeProject(await req.app.locals.store.read(), result.project), message: 'Project updated' });
  } catch (error) { return next(error); }
});

projectsRouter.delete('/:id', roleRequired('admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = findCompanyProject(data, req, req.params.id);
      if (!item) return { error: 'Project not found', status: 404 };
      const columns = projectColumns(item);
      const doneColumns = columns.filter((column) => column.isDone).map((column) => column.id);
      const openTasks = data.tasks.filter((task) => (
        task.projectId === item._id && !doneColumns.includes(taskStatusId(columns, task.status))
      ));
      if (openTasks.length && req.query.force !== 'true') {
        return { error: `Project still has ${openTasks.length} unfinished task${openTasks.length === 1 ? '' : 's'}. Complete them or retry with force=true`, status: 409 };
      }
      item.status = 'archived';
      item.updatedAt = nowIso();
      return { project: item };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    return ok(res, { message: 'Project archived' });
  } catch (error) { return next(error); }
});

const tasksRouter = express.Router();
tasksRouter.use(authRequired);

function findCompanyTask(data, req, id) {
  return data.tasks.find((task) => task._id === id && task.companyId === req.company._id);
}

function commentBodyFrom(body) {
  const raw = body?.body ?? body?.message ?? body?.text ?? '';
  return String(raw === null || raw === undefined ? '' : raw).trim();
}

function reindexColumnRanks(tasks) {
  tasks.forEach((task, index) => {
    const current = Number(rankOf(task));
    if (!Number.isFinite(current)) task.rank = (index + 1) * RANK_STEP;
  });
}

tasksRouter.get('/', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    let tasks = data.tasks.filter((item) => item.companyId === req.company._id);
    if (req.user.role === 'employee') {
      tasks = tasks.filter((item) => taskVisibleToUser(item, req.user));
    }
    if (req.query.projectId) tasks = tasks.filter((item) => item.projectId === req.query.projectId);
    if (req.query.assignedTo) tasks = tasks.filter((item) => item.assignedTo === req.query.assignedTo);
    if (req.query.priority) {
      const priority = String(req.query.priority).trim().toLowerCase();
      tasks = tasks.filter((item) => (TASK_PRIORITIES.includes(item.priority) ? item.priority : 'medium') === priority);
    }
    if (req.query.q) {
      const needle = String(req.query.q).trim().toLowerCase();
      tasks = tasks.filter((item) => String(item.title || '').toLowerCase().includes(needle) || String(item.key || '').toLowerCase().includes(needle));
    }

    let serialized = tasks.map((item) => serializeTask(data, item));
    if (req.query.status) {
      const needle = slugify(req.query.status);
      const compact = needle.replace(/_/g, '');
      serialized = serialized.filter((item) => slugify(item.status) === needle || slugify(item.status).replace(/_/g, '') === compact);
    }
    serialized.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    if (typeof paginate === 'function') {
      const { items, pagination } = paginate(serialized, req.query);
      return ok(res, { tasks: items, pagination });
    }
    return ok(res, { tasks: serialized });
  } catch (error) { return next(error); }
});

tasksRouter.post('/', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    if (!req.body?.title) return fail(res, 400, 'Task title is required');
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const body = req.body || {};
      const project = body.projectId
        ? data.projects.find((entry) => entry._id === body.projectId && entry.companyId === req.company._id && entry.status !== 'archived')
        : null;
      if (!project) return { error: 'Select a project before creating a task' };

      const columns = projectColumns(project);
      project.boardColumns = columns;
      const status = taskStatusId(columns, body.status);
      if (!status) return { error: 'Task status must match one of the project board columns' };

      let assignedTo = null;
      if (body.assignedTo) {
        const assignee = activeCompanyEmployee(data, req.company._id, body.assignedTo);
        if (!assignee) return { error: 'Assignee must be an active employee of your company' };
        assignedTo = assignee._id;
      }

      const labels = normalizeLabels(body.labels);
      if (labels.error) return { error: labels.error };

      let storyPoints = null;
      if (body.storyPoints !== undefined && body.storyPoints !== null && body.storyPoints !== '') {
        storyPoints = Number(body.storyPoints);
        if (!Number.isFinite(storyPoints)) return { error: 'Story points must be a number' };
      }

      const priority = body.priority === undefined || body.priority === null || body.priority === ''
        ? 'medium'
        : String(body.priority).trim().toLowerCase();
      if (!TASK_PRIORITIES.includes(priority)) return { error: 'Priority must be low, medium, high, or urgent' };

      const startDate = normalizeDateInput(body.startDate, 'Start date');
      if (startDate.error) return { error: startDate.error };
      const dueDate = normalizeDateInput(body.dueDate, 'Due date');
      if (dueDate.error) return { error: dueDate.error };

      const watchers = normalizeEmployeeIdList(data, req.company._id, body.watchers, 'Watchers');
      if (watchers.error) return { error: watchers.error };

      const siblings = data.tasks
        .filter((task) => task.projectId === project._id && taskStatusId(columns, task.status) === status)
        .sort(compareTasksByRank);

      project.key = normalizeCode(project.key) || uniqueProjectKey(data, project.companyId, deriveProjectKey(project.name), project._id);
      project.taskCounter = (Number(project.taskCounter) || 0) + 1;
      project.updatedAt = nowIso();

      const timestamp = nowIso();
      const watcherIds = [...new Set([req.user._id, ...watchers.ids, ...(assignedTo ? [assignedTo] : [])])];
      const item = {
        _id: newId('task'),
        companyId: req.company._id,
        projectId: project._id,
        key: `${project.key}-${project.taskCounter}`,
        title: body.title,
        description: body.description || '',
        reporterId: req.user._id,
        assignedTo,
        status,
        rank: nextRankInColumn(siblings),
        priority,
        labels: labels.labels,
        storyPoints,
        startDate: startDate.value,
        dueDate: dueDate.value,
        statusChangedAt: timestamp,
        watchers: watcherIds,
        comments: [],
        activity: [{
          _id: newId('activity'),
          field: 'created',
          from: null,
          to: status,
          actorId: req.user._id,
          actorName: actorDisplayName(req.user),
          at: timestamp,
        }],
        timeLogs: [],
        createdBy: req.user._id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.tasks.push(item);
      return { task: item, project };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    const data = await req.app.locals.store.read();
    return created(res, { task: serializeTask(data, result.task, result.project), message: 'Task created' });
  } catch (error) { return next(error); }
});

tasksRouter.get('/:id', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureCollections(data);
    const task = findCompanyTask(data, req, req.params.id);
    if (!task) return fail(res, 404, 'Task not found');
    if (!taskVisibleToUser(task, req.user)) return fail(res, 403, 'You do not have permission to view this task');
    return ok(res, { task: serializeTaskDetail(data, task) });
  } catch (error) { return next(error); }
});

tasksRouter.put('/:id', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = findCompanyTask(data, req, req.params.id);
      if (!item) return { error: 'Task not found', status: 404 };
      const reporterId = item.reporterId || item.createdBy || null;
      item.reporterId = reporterId;
      if (!canUpdateTask(item, req.user)) return { error: 'You do not have permission to update this task', status: 403 };

      const project = data.projects.find((entry) => entry._id === item.projectId) || null;
      const columns = projectColumns(project);
      const body = req.body || {};
      const changes = [];

      if (body.title !== undefined) {
        const title = String(body.title || '').trim();
        if (!title) return { error: 'Task title is required' };
        if (title !== item.title) changes.push(['title', item.title, title]);
        item.title = title;
      }
      if (body.description !== undefined) {
        const description = body.description || '';
        if (description !== item.description) changes.push(['description', item.description || '', description]);
        item.description = description;
      }
      if (body.assignedTo !== undefined) {
        let assignedTo = null;
        if (body.assignedTo) {
          const assignee = activeCompanyEmployee(data, item.companyId, body.assignedTo);
          if (!assignee) return { error: 'Assignee must be an active employee of your company' };
          assignedTo = assignee._id;
        }
        if (assignedTo !== (item.assignedTo || null)) {
          changes.push(['assignedTo', item.assignedTo || null, assignedTo]);
          item.assignedTo = assignedTo;
          if (assignedTo) {
            item.watchers ||= [];
            if (!item.watchers.includes(assignedTo)) item.watchers.push(assignedTo);
          }
        }
      }
      if (body.status !== undefined) {
        const status = taskStatusId(columns, body.status);
        if (!status) return { error: 'Task status must match one of the project board columns' };
        const previous = taskStatusId(columns, item.status) || columns[0].id;
        if (status !== previous) {
          changes.push(['status', previous, status]);
          item.statusChangedAt = nowIso();
        }
        item.status = status;
      }
      if (body.priority !== undefined) {
        const priority = String(body.priority || 'medium').trim().toLowerCase();
        if (!TASK_PRIORITIES.includes(priority)) return { error: 'Priority must be low, medium, high, or urgent' };
        if (priority !== item.priority) changes.push(['priority', item.priority || null, priority]);
        item.priority = priority;
      }
      if (body.labels !== undefined) {
        const labels = normalizeLabels(body.labels);
        if (labels.error) return { error: labels.error };
        const before = Array.isArray(item.labels) ? item.labels : [];
        if (before.join('|') !== labels.labels.join('|')) changes.push(['labels', before, labels.labels]);
        item.labels = labels.labels;
      }
      if (body.storyPoints !== undefined) {
        let storyPoints = null;
        if (body.storyPoints !== null && body.storyPoints !== '') {
          storyPoints = Number(body.storyPoints);
          if (!Number.isFinite(storyPoints)) return { error: 'Story points must be a number' };
        }
        if (storyPoints !== (item.storyPoints ?? null)) changes.push(['storyPoints', item.storyPoints ?? null, storyPoints]);
        item.storyPoints = storyPoints;
      }
      if (body.startDate !== undefined) {
        const startDate = normalizeDateInput(body.startDate, 'Start date');
        if (startDate.error) return { error: startDate.error };
        if (startDate.value !== (item.startDate || null)) changes.push(['startDate', item.startDate || null, startDate.value]);
        item.startDate = startDate.value;
      }
      if (body.dueDate !== undefined) {
        const dueDate = normalizeDateInput(body.dueDate, 'Due date');
        if (dueDate.error) return { error: dueDate.error };
        if (dueDate.value !== (item.dueDate || null)) changes.push(['dueDate', item.dueDate || null, dueDate.value]);
        item.dueDate = dueDate.value;
      }

      changes.forEach(([field, from, to]) => pushTaskActivity(item, req, field, from, to));
      item.updatedAt = nowIso();
      return { task: item, project };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    const data = await req.app.locals.store.read();
    return ok(res, { task: serializeTask(data, result.task, result.project), message: 'Task updated' });
  } catch (error) { return next(error); }
});

tasksRouter.patch('/:id/move', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = findCompanyTask(data, req, req.params.id);
      if (!item) return { error: 'Task not found', status: 404 };
      item.reporterId ||= item.createdBy || null;
      if (!canUpdateTask(item, req.user)) return { error: 'You do not have permission to move this task', status: 403 };

      const project = data.projects.find((entry) => entry._id === item.projectId) || null;
      if (!project) return { error: 'Select a project before creating a task' };
      const columns = projectColumns(project);
      const body = req.body || {};
      const status = taskStatusId(columns, body.status === undefined ? item.status : body.status);
      if (!status) return { error: 'Status must match one of the project board columns' };

      const siblings = data.tasks
        .filter((task) => task._id !== item._id && task.projectId === project._id && taskStatusId(columns, task.status) === status)
        .sort(compareTasksByRank);
      reindexColumnRanks(siblings);

      let beforeTask = null;
      let afterTask = null;
      if (body.beforeTaskId) {
        beforeTask = siblings.find((task) => task._id === body.beforeTaskId) || null;
        if (!beforeTask) return { error: 'beforeTaskId is not a task in the target column' };
      }
      if (body.afterTaskId) {
        afterTask = siblings.find((task) => task._id === body.afterTaskId) || null;
        if (!afterTask) return { error: 'afterTaskId is not a task in the target column' };
      }
      if (beforeTask && !afterTask) afterTask = siblings[siblings.indexOf(beforeTask) + 1] || null;
      if (afterTask && !beforeTask) beforeTask = siblings[siblings.indexOf(afterTask) - 1] || null;

      const previousStatus = taskStatusId(columns, item.status) || columns[0].id;
      const previousRank = rankOf(item);
      const nextRank = (!beforeTask && !afterTask)
        ? nextRankInColumn(siblings)
        : rankBetween(beforeTask ? rankOf(beforeTask) : null, afterTask ? rankOf(afterTask) : null);

      if (previousStatus !== status) {
        pushTaskActivity(item, req, 'status', previousStatus, status);
        item.statusChangedAt = nowIso();
      }
      if (previousRank !== nextRank) pushTaskActivity(item, req, 'rank', previousRank, nextRank);
      item.status = status;
      item.rank = nextRank;
      item.updatedAt = nowIso();
      return { task: item, project };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    const data = await req.app.locals.store.read();
    return ok(res, { task: serializeTask(data, result.task, result.project), message: 'Task moved' });
  } catch (error) { return next(error); }
});

tasksRouter.post('/:id/comments', async (req, res, next) => {
  try {
    const body = commentBodyFrom(req.body);
    if (!body) return fail(res, 400, 'Comment cannot be empty');
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = findCompanyTask(data, req, req.params.id);
      if (!item) return { error: 'Task not found', status: 404 };
      item.comments ||= [];
      item.watchers ||= [];

      let parentCommentId = null;
      if (req.body?.parentCommentId) {
        const parent = item.comments.find((comment) => comment._id === req.body.parentCommentId);
        if (!parent) return { error: 'Parent comment not found on this task' };
        parentCommentId = parent._id;
      }
      const mentions = normalizeEmployeeIdList(data, item.companyId, req.body?.mentions, 'Mentions');
      if (mentions.error) return { error: mentions.error };

      const comment = {
        _id: newId('comment'),
        employeeId: req.user._id,
        body,
        parentCommentId,
        mentions: mentions.ids,
        editedAt: null,
        createdAt: nowIso(),
      };
      item.comments.push(comment);
      for (const mentioned of [req.user._id, ...mentions.ids]) {
        if (!item.watchers.includes(mentioned)) item.watchers.push(mentioned);
      }
      pushTaskActivity(item, req, 'comment', null, comment._id);
      item.updatedAt = nowIso();
      return { task: item, comment };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    const data = await req.app.locals.store.read();
    return ok(res, { task: serializeTaskDetail(data, result.task), comment: result.comment, message: 'Comment added' });
  } catch (error) { return next(error); }
});

tasksRouter.patch('/:id/comments/:commentId', async (req, res, next) => {
  try {
    const body = commentBodyFrom(req.body);
    if (!body) return fail(res, 400, 'Comment cannot be empty');
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = findCompanyTask(data, req, req.params.id);
      if (!item) return { error: 'Task not found', status: 404 };
      const comment = (item.comments || []).find((entry) => entry._id === req.params.commentId);
      if (!comment) return { error: 'Comment not found', status: 404 };
      if (comment.employeeId !== req.user._id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return { error: 'Only the comment author or an admin can edit this comment', status: 403 };
      }
      if (req.body?.mentions !== undefined) {
        const mentions = normalizeEmployeeIdList(data, item.companyId, req.body.mentions, 'Mentions');
        if (mentions.error) return { error: mentions.error };
        comment.mentions = mentions.ids;
        item.watchers ||= [];
        for (const mentioned of mentions.ids) {
          if (!item.watchers.includes(mentioned)) item.watchers.push(mentioned);
        }
      }
      comment.body = body;
      comment.editedAt = nowIso();
      item.updatedAt = nowIso();
      return { task: item, comment };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    const data = await req.app.locals.store.read();
    return ok(res, { task: serializeTaskDetail(data, result.task), comment: result.comment, message: 'Comment updated' });
  } catch (error) { return next(error); }
});

tasksRouter.delete('/:id/comments/:commentId', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = findCompanyTask(data, req, req.params.id);
      if (!item) return { error: 'Task not found', status: 404 };
      const comment = (item.comments || []).find((entry) => entry._id === req.params.commentId);
      if (!comment) return { error: 'Comment not found', status: 404 };
      if (comment.employeeId !== req.user._id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return { error: 'Only the comment author or an admin can delete this comment', status: 403 };
      }
      item.comments = item.comments.filter((entry) => entry._id !== comment._id);
      pushTaskActivity(item, req, 'comment_deleted', comment._id, null);
      item.updatedAt = nowIso();
      return { task: item };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    const data = await req.app.locals.store.read();
    return ok(res, { task: serializeTaskDetail(data, result.task), message: 'Comment deleted' });
  } catch (error) { return next(error); }
});

tasksRouter.post('/:id/watch', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = findCompanyTask(data, req, req.params.id);
      if (!item) return { error: 'Task not found', status: 404 };
      item.watchers ||= [];
      if (!item.watchers.includes(req.user._id)) {
        item.watchers.push(req.user._id);
        item.updatedAt = nowIso();
      }
      return { task: item };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    const data = await req.app.locals.store.read();
    return ok(res, { task: serializeTask(data, result.task), message: 'Watching task' });
  } catch (error) { return next(error); }
});

tasksRouter.delete('/:id/watch', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = findCompanyTask(data, req, req.params.id);
      if (!item) return { error: 'Task not found', status: 404 };
      item.watchers = (Array.isArray(item.watchers) ? item.watchers : []).filter((id) => id !== req.user._id);
      item.updatedAt = nowIso();
      return { task: item };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    const data = await req.app.locals.store.read();
    return ok(res, { task: serializeTask(data, result.task), message: 'Stopped watching task' });
  } catch (error) { return next(error); }
});

tasksRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const item = findCompanyTask(data, req, req.params.id);
      if (!item) return { error: 'Task not found', status: 404 };
      const reporterId = item.reporterId || item.createdBy || null;
      if (!isTaskManager(req.user) && reporterId !== req.user._id) {
        return { error: 'You do not have permission to delete this task', status: 403 };
      }
      data.tasks = data.tasks.filter((task) => task._id !== item._id);
      return { removed: true };
    });
    if (result?.error) return fail(res, result.status || 400, result.error);
    return ok(res, { message: 'Task deleted' });
  } catch (error) { return next(error); }
});

for (const action of ['time-logs', 'verify-visit', 'record-exit']) {
  tasksRouter.post(`/:id/${action}`, async (req, res, next) => {
    try {
      const task = await req.app.locals.store.update((data) => {
        ensureCollections(data);
        const item = findCompanyTask(data, req, req.params.id);
        if (!item) return null;
        item.timeLogs ||= [];
        const record = { _id: newId(action.replace('-', '_')), employeeId: req.user._id, ...req.body, createdAt: nowIso() };
        if (action === 'time-logs') item.timeLogs.push(record);
        if (action === 'verify-visit') item.visitVerification = record;
        if (action === 'record-exit') item.visitExit = record;
        item.updatedAt = nowIso(); return item;
      });
      if (!task) return fail(res, 404, 'Task not found');
      const data = await req.app.locals.store.read();
      return ok(res, { task: serializeTask(data, task), message: 'Task activity recorded' });
    } catch (error) { return next(error); }
  });
}

const areasRouter = express.Router();
areasRouter.use(authRequired);

/** Whitelisted geofence fields, so a PATCH cannot write arbitrary keys. */
function areaPayload(body, existing, locations) {
  const payload = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  let linked = existing.workLocationId ? locations.find((item) => item._id === existing.workLocationId) || null : null;
  if (has('workLocationId')) {
    const requested = String(body.workLocationId || '').trim();
    if (!requested) {
      payload.workLocationId = null;
      payload.standalone = true;
      linked = null;
    } else {
      linked = locations.find((item) => item._id === requested) || null;
      if (!linked) return { error: 'Work location was not found for this company' };
      payload.workLocationId = linked._id;
      payload.standalone = false;
    }
  }

  if (has('name')) {
    const name = String(body.name || '').trim();
    if (!name && !linked) return { error: 'Geofence name is required' };
    payload.name = name || linked.name;
  }
  if (has('address')) payload.address = String(body.address || '').trim();
  if (has('active')) payload.active = body.active !== false && body.active !== 'false';

  for (const key of ['latitude', 'longitude']) {
    if (!has(key)) continue;
    const value = Number(body[key]);
    if (!Number.isFinite(value)) return { error: `${key === 'latitude' ? 'Latitude' : 'Longitude'} must be a number` };
    if (key === 'latitude' && (value < -90 || value > 90)) return { error: 'Latitude must be between -90 and 90' };
    if (key === 'longitude' && (value < -180 || value > 180)) return { error: 'Longitude must be between -180 and 180' };
    payload[key] = value;
  }

  if (has('radiusMeters') || has('radius')) {
    const value = Number(has('radiusMeters') ? body.radiusMeters : body.radius);
    if (!Number.isFinite(value) || value < 25 || value > 5000) return { error: 'Radius must be between 25 and 5000 metres' };
    payload.radiusMeters = Math.round(value);
  }

  // A linked geofence takes its name and address from the site, so the two can
  // never disagree about where a place is.
  if (linked) {
    payload.name = linked.name;
    payload.address = [linked.addressLine, linked.city, linked.state, linked.pincode]
      .map((part) => String(part || '').trim()).filter(Boolean).join(', ');
  }

  return { payload };
}

areasRouter.get('/', async (req, res, next) => {
  try {
    // Same lazy backfill as Organisation: a geofence with no site of its own gets
    // one, so this page never shows an address that is unusable elsewhere.
    if (locationsNeedReconcile(req.company)) {
      const companyId = req.company._id;
      await req.app.locals.store.update((draft) => {
        const target = draft.companies.find((item) => item._id === companyId);
        if (target) {
          reconcileCompanyLocations(target);
          target.updatedAt = nowIso();
        }
        return {};
      });
    }
  } catch (error) {
    return next(error);
  }

  const locations = Array.isArray(req.company.workLocations) ? req.company.workLocations : [];
  // Surface the owning site so a geofence is never an orphaned address.
  const areas = (req.company.attendanceAreas || []).map((area) => {
    const location = area.workLocationId ? locations.find((item) => item._id === area.workLocationId) : null;
    return {
      ...area,
      workLocation: location ? { _id: location._id, name: location.name, code: location.code } : null,
    };
  });
  return ok(res, { areas, workLocations: locations });
});

areasRouter.post('/', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    if (!req.body?.name || req.body?.latitude === undefined || req.body?.longitude === undefined) return fail(res, 400, 'Name, latitude, and longitude are required');
    const area = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => item._id === req.company._id);
      // Attaching a work location keeps the geofence and the site address in step.
      const locations = Array.isArray(company.workLocations) ? company.workLocations : [];
      const linked = req.body.workLocationId ? locations.find((row) => row._id === req.body.workLocationId) : null;
      if (req.body.workLocationId && !linked) return { error: 'Work location was not found for this company' };
      const address = req.body.address || (linked
        ? [linked.addressLine, linked.city, linked.state, linked.pincode].map((part) => String(part || '').trim()).filter(Boolean).join(', ')
        : '');
      // `standalone` records the deliberate choice not to attach a site, so the
      // backfill leaves this boundary alone instead of inventing one for it.
      const item = { _id: newId('area'), name: req.body.name || linked?.name || 'Location', workLocationId: linked?._id || null, standalone: !linked, address, latitude: Number(req.body.latitude), longitude: Number(req.body.longitude), radiusMeters: Number(req.body.radiusMeters || req.body.radius || 150), active: true };
      company.attendanceAreas ||= [];
      company.attendanceAreas.push(item); company.updatedAt = nowIso(); return { area: item };
    });
    if (area.error) return fail(res, 400, area.error);
    return created(res, { area: area.area, message: 'Attendance area created' });
  } catch (error) { return next(error); }
});

areasRouter.patch('/:id', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => item._id === req.company._id);
      company.attendanceAreas ||= [];
      const item = company.attendanceAreas.find((entry) => entry._id === req.params.id);
      if (!item) return { error: 'Attendance area not found', status: 404 };

      const locations = Array.isArray(company.workLocations) ? company.workLocations : [];
      const built = areaPayload(req.body || {}, item, locations);
      if (built.error) return { error: built.error, status: 400 };

      Object.assign(item, built.payload);
      company.updatedAt = nowIso();

      const location = item.workLocationId ? locations.find((entry) => entry._id === item.workLocationId) || null : null;
      return {
        area: {
          ...item,
          workLocation: location ? { _id: location._id, name: location.name, code: location.code } : null,
        },
      };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, { area: result.area, message: 'Geofence updated' });
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

subscriptionsRouter.post('/plan-change', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const company = data.companies.find((item) => item._id === req.company._id);
      if (!company) return { error: 'Company not found' };
      const current = normalizedSubscription(company, data);
      if (current.billingMode === 'custom') return { error: 'Custom subscriptions are managed by Super Admin under your negotiated terms' };

      const plan = data.subscriptionPlans.find((item) => item._id === req.body?.planId && item.status === 'active');
      if (!plan) return { error: 'Selected subscription plan is not available' };
      if (plan.pricePerUser === null || plan.pricePerUser === undefined) return { error: 'Contact Super Admin for an Enterprise or custom subscription' };

      const paidSeats = Number(req.body?.paidSeats);
      const billingCycle = req.body?.billingCycle;
      const includedSeats = Math.max(0, Math.floor(Number(plan.includedSeats) || 0));
      const minimumPaidSeats = Math.max(0, current.activeUsers - includedSeats);
      if (!Number.isInteger(paidSeats) || paidSeats < minimumPaidSeats) {
        return { error: `At least ${minimumPaidSeats} paid seat${minimumPaidSeats === 1 ? '' : 's'} are required for your active users` };
      }
      if (plan.userLimit !== null && paidSeats > Number(plan.userLimit)) return { error: `This plan supports up to ${plan.userLimit} paid seats` };
      if (!['monthly', 'yearly'].includes(billingCycle)) return { error: 'Billing cycle must be monthly or yearly' };
      const existingPurchase = data.billingInvoices.find((invoice) => (
        invoice.companyId === company._id && invoice.kind === 'subscription_purchase' && ['issued', 'partially_paid', 'overdue'].includes(invoice.status)
      ));
      if (existingPurchase) return { error: `Complete or ask Super Admin to cancel ${existingPurchase.invoiceNumber} before creating another plan order` };
      const unsettledInvoice = data.billingInvoices.find((invoice) => (
        invoice.companyId === company._id && ['issued', 'partially_paid', 'overdue'].includes(invoice.status) && money(Number(invoice.total) - Number(invoice.amountPaid)) > 0
      ));
      if (unsettledInvoice) return { error: `Settle ${unsettledInvoice.invoiceNumber} before changing the subscription plan` };

      let paymentGateway = null;
      if (current.billingMode === 'automatic') {
        const assigned = data.paymentGateways.find((gateway) => gateway.enabled && gateway.code === current.paymentGateway);
        const fallback = data.paymentGateways.find((gateway) => gateway.enabled && gateway.isDefault) || data.paymentGateways.find((gateway) => gateway.enabled);
        paymentGateway = assigned?.code || fallback?.code || null;
        if (!paymentGateway) return { error: 'No payment gateway is currently available. Contact Super Admin.' };
        if (current.status === 'paused' && companyBillingSnapshot(data, company).summary.outstandingAmount > 0) {
          return { error: 'Outstanding invoices must be settled before a paused subscription can start a new prepaid term' };
        }
      }

      const annualDiscountPercent = Number(plan.annualDiscountPercent) || 0;
      const cycleMultiplier = billingCycle === 'yearly' ? 12 : 1;
      const discountMultiplier = billingCycle === 'yearly' ? 1 - annualDiscountPercent / 100 : 1;
      const total = money(Number(plan.pricePerUser) * paidSeats * cycleMultiplier * discountMultiplier);
      if (total <= 0) return { error: 'Subscription order total must be greater than zero' };
      const timestamp = nowIso();
      const invoice = {
        _id: newId('invoice'),
        invoiceNumber: `QHR-${new Date().getUTCFullYear()}-${String(data.billingInvoices.length + 1).padStart(4, '0')}`,
        companyId: company._id,
        kind: 'subscription_purchase',
        billingCycle,
        seatCount: paidSeats,
        pricePerSeat: money(plan.pricePerUser),
        issueDate: timestamp,
        dueDate: timestamp,
        periodStart: null,
        periodEnd: null,
        subtotal: total,
        tax: 0,
        total,
        amountPaid: 0,
        status: 'issued',
        notes: `${plan.name} prepaid ${billingCycle} subscription`,
        subscriptionChange: {
          plan: plan.name,
          pricePerUser: money(plan.pricePerUser),
          annualDiscountPercent,
          billingCycle,
          paidSeats,
          paymentGateway,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.billingInvoices.push(invoice);
      recordPlatformAudit(data, req, 'billing.plan_order_created', company._id, {
        invoiceNumber: invoice.invoiceNumber,
        plan: plan.name,
        billingCycle,
        paidSeats,
        total,
      });
      return { company, invoice };
    });
    if (result.error) return fail(res, 400, result.error);
    const data = await req.app.locals.store.read();
    const billing = companyBillingSnapshot(data, result.company);
    return created(res, {
      invoice: billing.invoices.find((item) => item._id === result.invoice._id),
      message: result.invoice.subscriptionChange.paymentGateway
        ? 'Plan order created. Continue to secure checkout.'
        : 'Plan order created. Submit payment for Super Admin verification.',
    });
  } catch (error) { return next(error); }
});

subscriptionsRouter.post('/checkout', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const company = data.companies.find((item) => item._id === req.company._id);
      if (!company) return { error: 'Company not found' };
      const subscription = normalizedSubscription(company, data);
      if (subscription.billingMode !== 'automatic') return { error: 'Gateway checkout is only available for automatic subscriptions' };
      const invoice = data.billingInvoices.find((item) => item._id === req.body?.invoiceId && item.companyId === company._id);
      if (!invoice) return { error: 'Invoice not found for this company' };
      const amountDue = money(Math.max(0, Number(invoice.total) - Number(invoice.amountPaid)));
      if (amountDue <= 0 || invoice.status === 'paid') return { error: 'This invoice is already settled' };

      const assignedCode = invoice.subscriptionChange?.paymentGateway || subscription.paymentGateway;
      const gateway = data.paymentGateways.find((item) => item.enabled && item.code === assignedCode)
        || data.paymentGateways.find((item) => item.enabled && item.isDefault);
      if (!gateway) return { error: 'The assigned payment gateway is unavailable. Contact Super Admin.' };
      if (gateway.mode !== 'test') {
        return { liveGateway: gateway.name };
      }

      const reference = `${gateway.code.toUpperCase()}-TEST-${Date.now()}`;
      const paymentResult = createPayment(data, {
        companyId: company._id,
        invoiceId: invoice._id,
        amount: amountDue,
        method: gateway.code,
        reference,
        notes: `${gateway.name} test checkout`,
        status: 'cleared',
      }, req.user);
      if (paymentResult.error) return paymentResult;
      recordPlatformAudit(data, req, 'billing.gateway_payment_cleared', company._id, {
        invoiceId: invoice._id,
        gateway: gateway.code,
        amount: amountDue,
        reference,
      });
      return { company, invoice, payment: paymentResult.payment, gateway };
    });
    if (result.error) return fail(res, 400, result.error);
    if (result.liveGateway) return fail(res, 503, `${result.liveGateway} live checkout requires production merchant credentials and signed webhook configuration`);
    const data = await req.app.locals.store.read();
    const billing = companyBillingSnapshot(data, result.company);
    const isActive = billing.subscription.status === 'active';
    return ok(res, {
      invoice: billing.invoices.find((item) => item._id === result.invoice._id),
      payment: billing.payments.find((item) => item._id === result.payment._id),
      current: billing.subscription,
      message: isActive
        ? `${result.gateway.name} test payment completed and the subscription is active`
        : `${result.gateway.name} test payment completed. The prior balance is settled; purchase a new prepaid term to reactivate paid users.`,
    });
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
