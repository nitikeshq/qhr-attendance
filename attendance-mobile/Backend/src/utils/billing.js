const { addDays, newId, nowIso } = require('./records');

const BILLING_MODES = ['automatic', 'manual_online', 'manual_offline', 'custom'];
const BILLING_CYCLES = ['monthly', 'yearly'];
const INVOICE_OPEN_STATUSES = ['issued', 'partially_paid', 'overdue'];

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeBillingMode(value) {
  return BILLING_MODES.includes(value) ? value : 'manual_offline';
}

function ensureBillingCollections(data) {
  data.meta ||= {};
  data.billingInvoices ||= [];
  data.billingPayments ||= [];
  data.billingNotifications ||= [];
  data.paymentGateways ||= [
    { code: 'cashfree', name: 'Cashfree', enabled: false, isDefault: true, mode: 'test' },
    { code: 'payu', name: 'PayU', enabled: false, isDefault: false, mode: 'test' },
  ];
  data.subscriptionPlans ||= [];
  data.subscriptionPlans.forEach((plan) => {
    plan.freeAdminSeats ??= 1;
    plan.annualDiscountPercent ??= 0;
    plan.status ||= 'active';
  });
  if ((data.meta.billingSchemaVersion || 0) < 2) {
    const legacyStarter = data.subscriptionPlans.find((plan) => plan._id === 'plan_starter' && plan.pricePerUser === 0 && plan.userLimit === 5);
    if (legacyStarter) {
      legacyStarter.pricePerUser = 19;
      legacyStarter.userLimit = null;
    }
    (data.companies || []).forEach((company) => {
      company.subscription ||= {};
      const activeEmployees = (data.employees || []).filter((employee) => employee.companyId === company._id && employee.status !== 'inactive');
      const billingAdmin = activeEmployees.find((employee) => employee.role === 'admin');
      company.subscription.billingMode ||= 'manual_offline';
      company.subscription.billingCycle ||= 'monthly';
      company.subscription.annualDiscountPercent ??= 0;
      company.subscription.freeAdminSeats = 1;
      company.subscription.freeAdminEmployeeId ||= billingAdmin?._id || null;
      company.subscription.paidSeats ??= Math.max(0, activeEmployees.length - 1);
      company.subscription.nextRenewalAt ||= company.subscription.currentPeriodEnd || null;
      if (company.subscription.billingMode !== 'automatic' && ['past_due', 'grace', 'paused'].includes(company.subscription.status)) {
        company.subscription.status = 'active';
        company.subscription.graceEndsAt = null;
        company.subscription.pausedAt = null;
      }
    });
    data.meta.billingSchemaVersion = 2;
  }
}

function activeCompanyEmployees(data, companyId) {
  return data.employees.filter((employee) => employee.companyId === companyId && employee.status !== 'inactive');
}

function normalizedSubscription(company, data) {
  const source = company.subscription || {};
  const mode = normalizeBillingMode(source.billingMode);
  const activeUsers = data ? activeCompanyEmployees(data, company._id).length : 0;
  const freeAdminSeats = Math.max(1, Number(source.freeAdminSeats) || 1);
  const inferredPaidSeats = Math.max(0, activeUsers - freeAdminSeats);
  const paidSeats = Math.max(0, Number.isFinite(Number(source.paidSeats)) ? Number(source.paidSeats) : inferredPaidSeats);
  const billingCycle = BILLING_CYCLES.includes(source.billingCycle) ? source.billingCycle : 'monthly';
  const pricePerUser = money(source.pricePerUser ?? 19);
  const annualDiscountPercent = Math.min(100, Math.max(0, Number(source.annualDiscountPercent) || 0));
  const cycleMultiplier = billingCycle === 'yearly' ? 12 : 1;
  const discountMultiplier = billingCycle === 'yearly' ? 1 - annualDiscountPercent / 100 : 1;
  const calculatedRenewal = pricePerUser * paidSeats * cycleMultiplier * discountMultiplier;
  const renewalAmount = money(source.customRenewalAmount ?? calculatedRenewal);

  return {
    plan: source.plan || 'Professional',
    pricePerUser,
    annualDiscountPercent,
    billingCycle,
    billingMode: mode,
    paymentGateway: source.paymentGateway || (mode === 'automatic' ? 'cashfree' : null),
    status: source.status || 'active',
    startedAt: source.startedAt || company.createdAt,
    currentPeriodStart: source.currentPeriodStart || source.startedAt || company.createdAt,
    currentPeriodEnd: source.currentPeriodEnd || source.nextRenewalAt || null,
    nextRenewalAt: source.nextRenewalAt || source.currentPeriodEnd || null,
    graceEndsAt: source.graceEndsAt || null,
    pausedAt: source.pausedAt || null,
    freeAdminSeats,
    freeAdminEmployeeId: source.freeAdminEmployeeId || null,
    paidSeats,
    activeUsers,
    renewalAmount,
    customRenewalAmount: source.customRenewalAmount ?? null,
    automaticSuspensionEnabled: mode === 'automatic',
    customTerms: source.customTerms || null,
  };
}

function invoiceAmounts(invoice) {
  const total = money(invoice.total);
  const amountPaid = money(invoice.amountPaid);
  return { total, amountPaid, amountDue: money(Math.max(0, total - amountPaid)) };
}

function serializeInvoice(invoice, company) {
  const amounts = invoiceAmounts(invoice);
  return {
    ...invoice,
    ...amounts,
    companyName: company?.name || 'Unknown company',
    companyCode: company?.code || '-',
  };
}

function serializePayment(payment, company, invoice) {
  return {
    ...payment,
    companyName: company?.name || 'Unknown company',
    companyCode: company?.code || '-',
    invoiceNumber: invoice?.invoiceNumber || '-',
  };
}

function companyBillingSnapshot(data, company) {
  ensureBillingCollections(data);
  const subscription = normalizedSubscription(company, data);
  const invoices = data.billingInvoices
    .filter((invoice) => invoice.companyId === company._id)
    .map((invoice) => serializeInvoice(invoice, company))
    .sort((left, right) => String(right.issueDate).localeCompare(String(left.issueDate)));
  const payments = data.billingPayments
    .filter((payment) => payment.companyId === company._id)
    .map((payment) => serializePayment(payment, company, data.billingInvoices.find((invoice) => invoice._id === payment.invoiceId)))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const outstandingAmount = money(invoices.reduce((total, invoice) => (
    INVOICE_OPEN_STATUSES.includes(invoice.status) ? total + invoice.amountDue : total
  ), 0));
  const collectedAmount = money(payments.reduce((total, payment) => (
    payment.status === 'cleared' ? total + money(payment.amount) : total
  ), 0));
  const pendingVerificationAmount = money(payments.reduce((total, payment) => (
    payment.status === 'pending_verification' ? total + money(payment.amount) : total
  ), 0));

  return {
    subscription,
    invoices,
    payments,
    summary: {
      collectedAmount,
      outstandingAmount,
      pendingVerificationAmount,
      creditBalance: money(company.billingCredit),
      upcomingRenewalAmount: subscription.renewalAmount,
      nextRenewalAt: subscription.nextRenewalAt,
    },
  };
}

function platformBillingSnapshot(data) {
  ensureBillingCollections(data);
  const companySnapshots = data.companies.map((company) => ({
    company,
    billing: companyBillingSnapshot(data, company),
  }));
  const invoices = data.billingInvoices
    .map((invoice) => serializeInvoice(invoice, data.companies.find((company) => company._id === invoice.companyId)))
    .sort((left, right) => String(right.issueDate).localeCompare(String(left.issueDate)));
  const payments = data.billingPayments
    .map((payment) => serializePayment(
      payment,
      data.companies.find((company) => company._id === payment.companyId),
      data.billingInvoices.find((invoice) => invoice._id === payment.invoiceId),
    ))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const subscriptions = companySnapshots.map(({ company, billing }) => ({
    companyId: company._id,
    companyCode: company.code,
    companyName: company.name,
    ...billing.subscription,
    monthlyRevenue: billing.subscription.billingCycle === 'yearly'
      ? money(billing.subscription.renewalAmount / 12)
      : billing.subscription.renewalAmount,
    outstandingAmount: billing.summary.outstandingAmount,
    collectedAmount: billing.summary.collectedAmount,
    pendingVerificationAmount: billing.summary.pendingVerificationAmount,
  }));
  const collectedAmount = money(payments.reduce((total, payment) => payment.status === 'cleared' ? total + money(payment.amount) : total, 0));
  const pendingAmount = money(invoices.reduce((total, invoice) => INVOICE_OPEN_STATUSES.includes(invoice.status) ? total + invoice.amountDue : total, 0));
  const pendingVerificationAmount = money(payments.reduce((total, payment) => payment.status === 'pending_verification' ? total + money(payment.amount) : total, 0));
  const renewalAmount = money(subscriptions.reduce((total, subscription) => (
    ['active', 'grace', 'past_due'].includes(subscription.status) ? total + subscription.renewalAmount : total
  ), 0));
  const upcomingCutoff = addDays(new Date(), 30).getTime();
  const upcomingAmount = money(subscriptions.reduce((total, subscription) => {
    if (!subscription.nextRenewalAt) return total;
    const renewalAt = new Date(subscription.nextRenewalAt).getTime();
    return renewalAt >= Date.now() && renewalAt <= upcomingCutoff ? total + subscription.renewalAmount : total;
  }, 0));

  return {
    summary: {
      collectedAmount,
      pendingAmount,
      pendingVerificationAmount,
      renewalAmount,
      upcomingAmount,
      overdueInvoices: invoices.filter((invoice) => invoice.status === 'overdue').length,
      partiallyPaidInvoices: invoices.filter((invoice) => invoice.status === 'partially_paid').length,
    },
    subscriptions,
    invoices,
    payments,
  };
}

function applyClearedPayment(invoice, amount) {
  invoice.amountPaid = money((invoice.amountPaid || 0) + money(amount));
  const { total, amountPaid, amountDue } = invoiceAmounts(invoice);
  invoice.amountPaid = Math.min(total, amountPaid);
  if (amountDue <= 0 || invoice.amountPaid >= total) invoice.status = 'paid';
  else if (invoice.amountPaid > 0) invoice.status = 'partially_paid';
  invoice.updatedAt = nowIso();
}

function reverseClearedPayment(invoice, amount) {
  invoice.amountPaid = money(Math.max(0, (invoice.amountPaid || 0) - money(amount)));
  const { amountDue } = invoiceAmounts(invoice);
  invoice.status = invoice.amountPaid > 0 ? 'partially_paid' : (new Date(invoice.dueDate).getTime() < Date.now() ? 'overdue' : 'issued');
  if (amountDue <= 0) invoice.status = 'paid';
  invoice.updatedAt = nowIso();
}

function applyPaidInvoiceToSubscription(data, invoice, paidAt = new Date()) {
  if (invoice.status !== 'paid') return false;
  const company = data.companies.find((item) => item._id === invoice.companyId);
  if (!company) return false;
  const subscription = normalizedSubscription(company, data);
  if (subscription.billingMode !== 'automatic') return false;
  if (subscription.status === 'paused' && invoice.kind !== 'reactivation') return false;
  if (!['renewal', 'reactivation'].includes(invoice.kind)) return false;

  company.subscription.status = 'active';
  company.subscription.currentPeriodStart = invoice.periodStart || new Date(paidAt).toISOString();
  company.subscription.currentPeriodEnd = invoice.periodEnd || addBillingPeriod(paidAt, subscription.billingCycle).toISOString();
  company.subscription.nextRenewalAt = company.subscription.currentPeriodEnd;
  company.subscription.graceEndsAt = null;
  company.subscription.pausedAt = null;
  company.updatedAt = new Date(paidAt).toISOString();
  queueBillingEmail(data, company, invoice.kind === 'reactivation' ? 'subscription_reactivated' : 'renewal_payment_success', paidAt, {
    subject: invoice.kind === 'reactivation' ? 'QHR subscription reactivated' : 'QHR renewal payment received',
    amount: invoice.total,
    nextRenewalAt: company.subscription.nextRenewalAt,
  });
  return true;
}

function calendarDayDifference(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.round((endDay - startDay) / 86400000);
}

function addBillingPeriod(value, billingCycle) {
  const date = new Date(value);
  if (billingCycle === 'yearly') date.setUTCFullYear(date.getUTCFullYear() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date;
}

function queueBillingEmail(data, company, type, scheduledFor, details = {}) {
  const dayKey = new Date(scheduledFor).toISOString().slice(0, 10);
  const uniqueKey = `${company._id}:${type}:${dayKey}`;
  if (data.billingNotifications.some((item) => item.uniqueKey === uniqueKey)) return false;
  data.billingNotifications.push({
    _id: newId('billing_notice'),
    uniqueKey,
    companyId: company._id,
    companyName: company.name,
    recipient: company.billingEmail || company.email,
    channel: 'email',
    type,
    subject: details.subject || 'QHR subscription update',
    details,
    scheduledFor: new Date(scheduledFor).toISOString(),
    status: 'pending',
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return true;
}

function ensureRenewalInvoice(data, company, subscription, renewalAt) {
  const existing = data.billingInvoices.find((invoice) => (
    invoice.companyId === company._id && invoice.kind === 'renewal' && String(invoice.periodStart).slice(0, 10) === renewalAt.toISOString().slice(0, 10)
  ));
  if (existing) return existing;
  const periodEnd = addBillingPeriod(renewalAt, subscription.billingCycle);
  const invoice = {
    _id: newId('invoice'),
    invoiceNumber: `QHR-${renewalAt.getUTCFullYear()}-${String(data.billingInvoices.length + 1).padStart(4, '0')}`,
    companyId: company._id,
    kind: 'renewal',
    billingCycle: subscription.billingCycle,
    seatCount: subscription.paidSeats,
    pricePerSeat: subscription.pricePerUser,
    issueDate: renewalAt.toISOString(),
    dueDate: renewalAt.toISOString(),
    periodStart: renewalAt.toISOString(),
    periodEnd: periodEnd.toISOString(),
    subtotal: subscription.renewalAmount,
    tax: 0,
    total: subscription.renewalAmount,
    amountPaid: 0,
    status: 'overdue',
    notes: 'Generated by the automatic renewal cycle',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  data.billingInvoices.push(invoice);
  return invoice;
}

function runBillingCycle(data, at = new Date()) {
  ensureBillingCollections(data);
  const now = new Date(at);
  const stats = { companiesChecked: 0, invoicesCreated: 0, notificationsQueued: 0, enteredGrace: 0, paused: 0, overdueInvoices: 0 };

  data.billingInvoices.forEach((invoice) => {
    if (invoice.status === 'issued' && new Date(invoice.dueDate).getTime() < now.getTime()) {
      invoice.status = invoice.amountPaid > 0 ? 'partially_paid' : 'overdue';
      invoice.updatedAt = now.toISOString();
      stats.overdueInvoices += 1;
    }
  });

  data.companies.forEach((company) => {
    stats.companiesChecked += 1;
    const subscription = normalizedSubscription(company, data);
    if (!subscription.nextRenewalAt || subscription.status === 'cancelled') return;
    const renewalAt = new Date(subscription.nextRenewalAt);
    if (Number.isNaN(renewalAt.getTime())) return;
    const daysToRenewal = calendarDayDifference(now, renewalAt);
    const remindersEnabled = company.subscription?.billingRemindersEnabled !== false;

    if (remindersEnabled && [7, 3, 1].includes(daysToRenewal)) {
      const queued = queueBillingEmail(data, company, `renewal_reminder_${daysToRenewal}`, now, {
        subject: `QHR renewal due in ${daysToRenewal} day${daysToRenewal === 1 ? '' : 's'}`,
        renewalAt: renewalAt.toISOString(),
        amount: subscription.renewalAmount,
        billingMode: subscription.billingMode,
      });
      if (queued) stats.notificationsQueued += 1;
    }

    if (renewalAt.getTime() > now.getTime()) return;
    if (subscription.billingMode !== 'automatic') {
      if (remindersEnabled && [0, -3, -7, -14, -30].includes(daysToRenewal)) {
        const queued = queueBillingEmail(data, company, `manual_payment_due_${Math.abs(daysToRenewal)}`, now, {
          subject: daysToRenewal === 0 ? 'QHR manual renewal is due today' : 'QHR manual renewal remains outstanding',
          renewalAt: renewalAt.toISOString(),
          amount: subscription.renewalAmount,
          automaticSuspension: false,
        });
        if (queued) stats.notificationsQueued += 1;
      }
      return;
    }

    const beforeInvoiceCount = data.billingInvoices.length;
    const renewalInvoice = ensureRenewalInvoice(data, company, subscription, renewalAt);
    if (data.billingInvoices.length > beforeInvoiceCount) stats.invoicesCreated += 1;
    if (renewalInvoice.status === 'paid') return;
    const graceEndsAt = company.subscription.graceEndsAt
      ? new Date(company.subscription.graceEndsAt)
      : addDays(renewalAt, 15);

    if (!['grace', 'paused'].includes(company.subscription.status)) {
      company.subscription.status = 'grace';
      company.subscription.graceEndsAt = graceEndsAt.toISOString();
      company.subscription.pausedAt = null;
      stats.enteredGrace += 1;
      if (queueBillingEmail(data, company, 'renewal_payment_failed', now, {
        subject: 'QHR renewal payment requires attention',
        amount: renewalInvoice.total,
        graceEndsAt: graceEndsAt.toISOString(),
      })) stats.notificationsQueued += 1;
    }

    const graceDay = Math.max(1, Math.floor((now.getTime() - renewalAt.getTime()) / 86400000) + 1);
    if (now.getTime() < graceEndsAt.getTime() && [1, 3, 7, 10, 13, 14, 15].includes(graceDay)) {
      if (queueBillingEmail(data, company, `grace_reminder_${graceDay}`, now, {
        subject: graceDay >= 14 ? 'QHR access will pause soon' : 'QHR renewal payment reminder',
        amount: renewalInvoice.total,
        graceDay,
        graceEndsAt: graceEndsAt.toISOString(),
      })) stats.notificationsQueued += 1;
    }

    if (now.getTime() >= graceEndsAt.getTime() && company.subscription.status !== 'paused') {
      company.subscription.status = 'paused';
      company.subscription.pausedAt = now.toISOString();
      stats.paused += 1;
      if (queueBillingEmail(data, company, 'subscription_paused', now, {
        subject: 'QHR paid-user access has been paused',
        amount: renewalInvoice.total,
        pausedAt: now.toISOString(),
        freeAdminAccess: true,
      })) stats.notificationsQueued += 1;
    }
    company.updatedAt = now.toISOString();
  });

  return stats;
}

function createPayment(data, input, actor) {
  const invoice = data.billingInvoices.find((item) => item._id === input.invoiceId);
  if (!invoice || invoice.companyId !== input.companyId) return { error: 'Invoice not found for this company' };
  const amount = money(input.amount);
  if (amount <= 0) return { error: 'Payment amount must be greater than zero' };
  const payment = {
    _id: newId('payment'),
    companyId: input.companyId,
    invoiceId: input.invoiceId,
    amount,
    method: input.method || 'bank_transfer',
    reference: input.reference || null,
    proofUrl: input.proofUrl || null,
    notes: input.notes || null,
    status: input.status === 'cleared' ? 'cleared' : 'pending_verification',
    submittedBy: actor?._id || null,
    submittedByName: actor?.name || 'System',
    verifiedBy: input.status === 'cleared' ? actor?._id || null : null,
    verifiedAt: input.status === 'cleared' ? nowIso() : null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  data.billingPayments.push(payment);
  if (payment.status === 'cleared') {
    const amountDue = invoiceAmounts(invoice).amountDue;
    payment.appliedAmount = money(Math.min(amount, amountDue));
    payment.creditAmount = money(Math.max(0, amount - amountDue));
    applyClearedPayment(invoice, payment.appliedAmount);
    const company = data.companies.find((item) => item._id === input.companyId);
    if (company && payment.creditAmount > 0) company.billingCredit = money((company.billingCredit || 0) + payment.creditAmount);
    applyPaidInvoiceToSubscription(data, invoice, payment.verifiedAt);
  }
  return { payment, invoice };
}

module.exports = {
  BILLING_CYCLES,
  BILLING_MODES,
  applyClearedPayment,
  applyPaidInvoiceToSubscription,
  companyBillingSnapshot,
  createPayment,
  ensureBillingCollections,
  invoiceAmounts,
  money,
  normalizeBillingMode,
  normalizedSubscription,
  platformBillingSnapshot,
  reverseClearedPayment,
  runBillingCycle,
};
