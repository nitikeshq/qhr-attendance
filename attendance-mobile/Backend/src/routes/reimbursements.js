const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const { findEmployee, nowIso, paginate, newId } = require('../utils/records');
const { payrollSummary, recalculateAdjustments } = require('../utils/payroll');
const {
  PAYROLL_PAYMENT_METHOD,
  SEPARATE_PAYMENT_METHOD,
  createPayrollAdjustment,
  ensureReimbursementCollections,
  reimbursementAudit,
  reimbursementNumber,
  serializeReimbursement,
} = require('../utils/reimbursements');

const router = express.Router();
router.use(authRequired);

const RECEIPT_DIRECTORY = path.resolve(__dirname, '../../data/uploads/reimbursements');
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ATTACHMENT_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

function attachmentMatchesMime(buffer, mimeType) {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return false;
}

function canReview(data, req, claim) {
  if (['hr', 'admin'].includes(req.user.role)) return true;
  if (req.user.role !== 'manager') return false;
  return findEmployee(data, claim.employeeId, req.company._id)?.managerId === req.user._id;
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((item) => {
    const rawUrl = String(item?.url || item?.uri || '').trim();
    if (!rawUrl || rawUrl.length > 2048 || !/^https:\/\//i.test(rawUrl)) return null;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:') return null;
    } catch {
      return null;
    }
    return {
      _id: newId('attachment'),
      name: String(item?.name || 'Receipt').slice(0, 120),
      url: rawUrl,
      kind: 'https_url',
      createdAt: nowIso(),
    };
  }).filter(Boolean);
}

router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!body.category || !body.expenseDate || !body.description || !Number.isFinite(amount) || amount <= 0) {
      return fail(res, 400, 'Category, expense date, description, and a positive amount are required');
    }
    const attachmentInputs = Array.isArray(body.attachments) ? body.attachments : [];
    if (attachmentInputs.length > 10) return fail(res, 400, 'A reimbursement can have at most 10 attachments');
    const attachments = normalizeAttachments(attachmentInputs);
    if (attachments.length !== attachmentInputs.length) return fail(res, 400, 'Attachment URLs must be valid HTTPS URLs of 2048 characters or fewer; data URLs are not accepted');
    const result = await req.app.locals.store.update((data) => {
      ensureReimbursementCollections(data);
      const now = nowIso();
      const claim = {
        _id: newId('reimbursement'),
        claimNumber: reimbursementNumber(data),
        companyId: req.company._id,
        employeeId: req.user._id,
        category: String(body.category).trim(),
        expenseDate: String(body.expenseDate).slice(0, 10),
        amount,
        description: String(body.description).trim(),
        projectOrCostCenter: String(body.projectOrCostCenter || '').trim(),
        merchant: String(body.merchant || '').trim(),
        attachments,
        status: 'pending_manager',
        approvedAmount: null,
        approverComments: null,
        managerApprovedBy: null,
        managerApprovedAt: null,
        approvedBy: null,
        approvedAt: null,
        paymentMethod: null,
        payrollPeriod: null,
        linkedPayrollId: null,
        adjustmentId: null,
        paymentReference: null,
        paidAt: null,
        createdAt: now,
        updatedAt: now,
      };
      data.reimbursements.push(claim);
      reimbursementAudit(data, req.user, 'reimbursement.submitted', claim, { amount });
      return serializeReimbursement(data, claim);
    });
    return created(res, { reimbursement: result, message: `Reimbursement ${result.claimNumber} submitted` });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/attachments', async (req, res, next) => {
  try {
    const body = req.body || {};
    const mimeType = String(body.mimeType || '').toLowerCase();
    const extension = ATTACHMENT_TYPES[mimeType];
    if (!extension) return fail(res, 400, 'Receipt must be a PDF, JPEG, or PNG file');
    const encoded = String(body.dataBase64 || '').replace(/\s/g, '');
    if (!encoded || encoded.startsWith('data:') || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      return fail(res, 400, 'A valid base64 file payload is required; data URLs are not accepted');
    }
    const decoded = Buffer.from(encoded, 'base64');
    if (!decoded.length || decoded.length > MAX_ATTACHMENT_BYTES) return fail(res, 400, 'Receipt must not exceed 5 MB');
    if (!attachmentMatchesMime(decoded, mimeType)) return fail(res, 400, 'Receipt content does not match the selected PDF, JPEG, or PNG file type');

    const result = await req.app.locals.store.update(async (data) => {
      ensureReimbursementCollections(data);
      const claim = data.reimbursements.find((item) => item._id === req.params.id && item.companyId === req.company._id && item.employeeId === req.user._id);
      if (!claim) return { error: 'Reimbursement request not found', status: 404 };
      if (!['pending_manager', 'pending_finance'].includes(claim.status)) return { error: 'Attachments can only be added while a claim is pending', status: 409 };
      claim.attachments ||= [];
      if (claim.attachments.length >= 10) return { error: 'A reimbursement can have at most 10 attachments', status: 409 };
      await fs.mkdir(RECEIPT_DIRECTORY, { recursive: true });
      const fileName = `${crypto.randomBytes(24).toString('hex')}${extension}`;
      const absolutePath = path.join(RECEIPT_DIRECTORY, fileName);
      await fs.writeFile(absolutePath, decoded, { flag: 'wx' });
      const attachment = {
        _id: newId('attachment'),
        name: String(body.name || 'Receipt').replace(/[\r\n]/g, ' ').slice(0, 120),
        mimeType,
        size: decoded.length,
        storagePath: `uploads/reimbursements/${fileName}`,
        kind: 'protected_file',
        createdBy: req.user._id,
        createdAt: nowIso(),
      };
      claim.attachments.push(attachment);
      claim.updatedAt = nowIso();
      reimbursementAudit(data, req.user, 'reimbursement.attachment_added', claim, { attachmentId: attachment._id, mimeType, size: decoded.length });
      return { attachment };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return created(res, { attachment: result.attachment, message: 'Receipt attached securely' });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/attachments/:attachmentId', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureReimbursementCollections(data);
    const claim = data.reimbursements.find((item) => item._id === req.params.id && item.companyId === req.company._id);
    if (!claim) return fail(res, 404, 'Reimbursement request not found');
    if (claim.employeeId !== req.user._id && !canReview(data, req, claim)) return fail(res, 403, 'You are not authorized to view this receipt');
    const attachment = (claim.attachments || []).find((item) => item._id === req.params.attachmentId && item.kind === 'protected_file');
    if (!attachment) return fail(res, 404, 'Receipt attachment not found');
    const fileName = path.basename(String(attachment.storagePath || ''));
    const absolutePath = path.resolve(RECEIPT_DIRECTORY, fileName);
    if (!fileName || path.dirname(absolutePath) !== RECEIPT_DIRECTORY) return fail(res, 404, 'Receipt attachment not found');
    const safeName = String(attachment.name || `receipt${path.extname(fileName)}`).replace(/["\r\n\\/]/g, '_');
    res.set('Content-Type', attachment.mimeType);
    res.set('Content-Disposition', `attachment; filename="${safeName}"`);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.sendFile(absolutePath, (error) => {
      if (error && !res.headersSent) next(Object.assign(error, { status: error.code === 'ENOENT' ? 404 : error.status }));
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/my', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureReimbursementCollections(data);
    const claims = data.reimbursements
      .filter((claim) => claim.employeeId === req.user._id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const { items, pagination } = paginate(claims, req.query);
    return ok(res, { reimbursements: items.map((claim) => serializeReimbursement(data, claim)), pagination });
  } catch (error) {
    return next(error);
  }
});

router.get('/', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    ensureReimbursementCollections(data);
    let claims = data.reimbursements.filter((claim) => claim.companyId === req.company._id && canReview(data, req, claim));
    if (req.query.status) claims = claims.filter((claim) => claim.status === req.query.status);
    claims.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const { items, pagination } = paginate(claims, req.query);
    return ok(res, { reimbursements: items.map((claim) => serializeReimbursement(data, claim)), pagination });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/review', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const action = body.action === 'reject' ? 'reject' : 'approve';
    const result = await req.app.locals.store.update((data) => {
      ensureReimbursementCollections(data);
      const claim = data.reimbursements.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!claim) return { error: 'Reimbursement request not found', status: 404 };
      if (!canReview(data, req, claim)) return { error: 'You can only review requests from your direct reports', status: 403 };
      if (!['pending_manager', 'pending_finance'].includes(claim.status)) return { error: 'This reimbursement has already been reviewed', status: 409 };
      if (req.user.role === 'manager' && claim.status !== 'pending_manager') return { error: 'Managers can only review reimbursements pending manager approval', status: 409 };

      if (action === 'reject') {
        claim.status = 'rejected';
        claim.approverComments = String(body.comments || '').trim() || null;
        claim.rejectedBy = req.user._id;
        claim.rejectedAt = nowIso();
        claim.updatedAt = nowIso();
        reimbursementAudit(data, req.user, 'reimbursement.rejected', claim, { comments: claim.approverComments });
        return { claim };
      }

      if (req.user.role === 'manager') {
        claim.status = 'pending_finance';
        claim.managerApprovedBy = req.user._id;
        claim.managerApprovedAt = nowIso();
        claim.approverComments = String(body.comments || '').trim() || null;
        claim.updatedAt = nowIso();
        reimbursementAudit(data, req.user, 'reimbursement.manager_approved', claim);
        return { claim };
      }

      const approvedAmount = Math.round(Number(body.approvedAmount ?? claim.amount) * 100) / 100;
      const paymentMethod = body.paymentMethod === SEPARATE_PAYMENT_METHOD ? SEPARATE_PAYMENT_METHOD : PAYROLL_PAYMENT_METHOD;
      const payrollPeriod = paymentMethod === PAYROLL_PAYMENT_METHOD ? String(body.payrollPeriod || '') : null;
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0 || approvedAmount > claim.amount) {
        return { error: 'Approved amount must be positive and cannot exceed the claimed amount', status: 400 };
      }
      if (paymentMethod === PAYROLL_PAYMENT_METHOD && !/^\d{4}-(0[1-9]|1[0-2])$/.test(payrollPeriod)) {
        return { error: 'Select a payroll month for this reimbursement', status: 400 };
      }

      claim.approvedAmount = approvedAmount;
      claim.paymentMethod = paymentMethod;
      claim.payrollPeriod = payrollPeriod;
      claim.approvedBy = req.user._id;
      claim.approvedAt = nowIso();
      claim.approverComments = String(body.comments || '').trim() || null;
      claim.status = 'approved';
      claim.updatedAt = nowIso();

      if (paymentMethod === PAYROLL_PAYMENT_METHOD) {
        const payslip = data.payroll?.find((item) => item.employeeId === claim.employeeId && item.period === payrollPeriod && ['draft', 'pending_approval'].includes(item.status));
        if (payslip) {
          const adjustment = createPayrollAdjustment(claim, req.user._id);
          payslip.adjustments ||= [];
          if (!payslip.adjustments.some((item) => item.reimbursementClaimId === claim._id)) payslip.adjustments.push(adjustment);
          claim.linkedPayrollId = payslip._id;
          claim.adjustmentId = adjustment._id;
          claim.status = 'queued_for_payroll';
          recalculateAdjustments(payslip);
          const run = data.payrollRuns?.find((item) => item._id === payslip.runId);
          if (run) {
            run.totals = payrollSummary(data.payroll.filter((item) => item.runId === run._id));
            run.updatedAt = nowIso();
          }
        }
      }
      reimbursementAudit(data, req.user, 'reimbursement.finance_approved', claim, { approvedAmount, paymentMethod, payrollPeriod });
      return { claim };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    const serialized = await req.app.locals.store.read().then((data) => serializeReimbursement(data, result.claim));
    return ok(res, { reimbursement: serialized, message: result.claim.status === 'pending_finance' ? 'Manager approval recorded; finance review is pending' : 'Reimbursement reviewed successfully' });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/mark-paid', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const paidAt = String(req.body?.paidAt || '').trim();
    const parsedPaidAt = new Date(`${paidAt}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt) || Number.isNaN(parsedPaidAt.getTime()) || parsedPaidAt.toISOString().slice(0, 10) !== paidAt) {
      return fail(res, 400, 'A valid company-selected paid date is required in YYYY-MM-DD format');
    }
    const result = await req.app.locals.store.update((data) => {
      ensureReimbursementCollections(data);
      const claim = data.reimbursements.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!claim) return { error: 'Reimbursement request not found', status: 404 };
      if (claim.paymentMethod !== SEPARATE_PAYMENT_METHOD || claim.status !== 'approved') return { error: 'Only separately paid approved reimbursements can be marked paid here', status: 409 };
      const reference = String(req.body?.paymentReference || '').trim();
      if (!reference) return { error: 'Payment reference is required', status: 400 };
      claim.status = 'paid';
      claim.paymentReference = reference;
      claim.paidAt = paidAt;
      claim.updatedAt = nowIso();
      reimbursementAudit(data, req.user, 'reimbursement.paid_separately', claim, { paymentReference: reference });
      return { claim };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    const serialized = await req.app.locals.store.read().then((data) => serializeReimbursement(data, result.claim));
    return ok(res, { reimbursement: serialized, message: 'Reimbursement marked paid' });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureReimbursementCollections(data);
      const claim = data.reimbursements.find((item) => item._id === req.params.id && item.employeeId === req.user._id);
      if (!claim) return { error: 'Reimbursement request not found', status: 404 };
      if (!['pending_manager', 'pending_finance'].includes(claim.status)) return { error: 'Approved or paid reimbursements cannot be cancelled', status: 409 };
      claim.status = 'cancelled';
      claim.updatedAt = nowIso();
      reimbursementAudit(data, req.user, 'reimbursement.cancelled', claim);
      return { claim };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    const serialized = await req.app.locals.store.read().then((data) => serializeReimbursement(data, result.claim));
    return ok(res, { reimbursement: serialized, message: 'Reimbursement request cancelled' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
