const { employeeRef, findEmployee, newId, nowIso } = require('./records');

const PAYROLL_PAYMENT_METHOD = 'through_payroll';
const SEPARATE_PAYMENT_METHOD = 'separate_payment';

function ensureReimbursementCollections(data) {
  data.reimbursements ||= [];
  data.counters ||= {};
  data.reimbursementAuditLogs ||= [];
}

function reimbursementNumber(data) {
  ensureReimbursementCollections(data);
  data.counters.reimbursement = (data.counters.reimbursement || 0) + 1;
  return `RMB-${new Date().getUTCFullYear()}-${String(data.counters.reimbursement).padStart(4, '0')}`;
}

function serializeReimbursement(data, claim) {
  const employee = findEmployee(data, claim.employeeId);
  const managerApprover = claim.managerApprovedBy ? findEmployee(data, claim.managerApprovedBy) : null;
  const financeApprover = claim.approvedBy ? findEmployee(data, claim.approvedBy) : null;
  return {
    ...claim,
    employee: employeeRef(employee),
    managerApprover: employeeRef(managerApprover),
    financeApprover: employeeRef(financeApprover),
  };
}

function reimbursementAudit(data, actor, action, claim, details = {}) {
  ensureReimbursementCollections(data);
  data.reimbursementAuditLogs.push({
    _id: newId('reimbursement_audit'),
    companyId: claim.companyId,
    reimbursementId: claim._id,
    employeeId: claim.employeeId,
    actorId: actor?._id || null,
    actorName: actor?.name || 'System',
    actorRole: actor?.role || 'system',
    action,
    details,
    createdAt: nowIso(),
  });
}

function createPayrollAdjustment(claim, actorId = null) {
  const adjustmentId = claim.adjustmentId || newId('payroll_adjustment');
  return {
    _id: adjustmentId,
    kind: 'reimbursement',
    code: `reimbursement_${String(claim.claimNumber || claim._id).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name: `${claim.category || 'Expense'} reimbursement`,
    amount: Number(claim.approvedAmount || claim.amount || 0),
    notes: [claim.claimNumber, claim.description].filter(Boolean).join(' - '),
    reimbursementClaimId: claim._id,
    createdBy: actorId || claim.approvedBy || null,
    createdAt: claim.approvedAt || nowIso(),
  };
}

function payrollAdjustmentsForEmployee(data, employeeId, period, payrollId, existingAdjustments = [], actorId = null) {
  ensureReimbursementCollections(data);
  const adjustments = [...existingAdjustments];
  const existingClaimIds = new Set(adjustments.map((item) => item.reimbursementClaimId).filter(Boolean));
  const claims = data.reimbursements.filter((claim) => (
    claim.employeeId === employeeId
    && claim.paymentMethod === PAYROLL_PAYMENT_METHOD
    && claim.payrollPeriod === period
    && ['approved', 'queued_for_payroll'].includes(claim.status)
    && (!claim.linkedPayrollId || claim.linkedPayrollId === payrollId)
  ));

  for (const claim of claims) {
    if (!existingClaimIds.has(claim._id)) {
      const adjustment = createPayrollAdjustment(claim, actorId);
      adjustments.push(adjustment);
      claim.adjustmentId = adjustment._id;
      existingClaimIds.add(claim._id);
    }
    claim.linkedPayrollId = payrollId;
    claim.status = 'queued_for_payroll';
    claim.updatedAt = nowIso();
  }
  return adjustments;
}

function unlinkClaimAdjustment(data, payrollId, adjustment) {
  if (!adjustment?.reimbursementClaimId) return;
  ensureReimbursementCollections(data);
  const claim = data.reimbursements.find((item) => item._id === adjustment.reimbursementClaimId && item.linkedPayrollId === payrollId);
  if (!claim || claim.status === 'paid') return;
  claim.status = 'approved';
  claim.linkedPayrollId = null;
  claim.adjustmentId = null;
  claim.updatedAt = nowIso();
}

function markPayrollReimbursementsPaid(data, payslip, paymentReference, paidAt) {
  ensureReimbursementCollections(data);
  const claims = data.reimbursements.filter((claim) => claim.linkedPayrollId === payslip._id);
  for (const claim of claims) {
    claim.status = 'paid';
    claim.paidAt = paidAt || nowIso();
    claim.paymentReference = paymentReference || payslip.paymentReference || null;
    claim.updatedAt = nowIso();
  }
  return claims;
}

module.exports = {
  PAYROLL_PAYMENT_METHOD,
  SEPARATE_PAYMENT_METHOD,
  createPayrollAdjustment,
  ensureReimbursementCollections,
  markPayrollReimbursementsPaid,
  payrollAdjustmentsForEmployee,
  reimbursementAudit,
  reimbursementNumber,
  serializeReimbursement,
  unlinkClaimAdjustment,
};
