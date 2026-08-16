const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const { dateKey, employeeRef, findEmployee, newId, nowIso, paginate } = require('../utils/records');

/**
 * Overtime and extra working hours.
 *
 * Attendance records when somebody was present, but presence alone should never
 * increase pay: a person who stayed late because they were waiting for a lift has
 * not earned overtime. So extra hours are *claimed* and then *approved*, and only
 * approved hours are visible to payroll.
 *
 * HR or an admin decides, never a manager, because this moves money. The claimed
 * hours are kept alongside the approved hours so a reduced approval is auditable
 * rather than overwriting what the employee asked for.
 */

const router = express.Router();
router.use(authRequired);

const HR_ROLES = ['hr', 'admin'];
const MAX_HOURS_PER_DAY = 12;
const KINDS = ['overtime', 'extra_hours'];

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function ensureCollections(data) {
  data.overtimeRequests ||= [];
  return data;
}

function serialize(data, request) {
  const employee = findEmployee(data, request.employeeId, request.companyId);
  return {
    ...request,
    employee: employeeRef(employee),
    // The figure payroll should use: nothing until a decision, then what was allowed.
    payableHours: request.status === 'approved' ? round2(request.approvedHours) : 0,
  };
}

function requestNumber(data, companyId) {
  const count = data.overtimeRequests.filter((item) => item.companyId === companyId).length + 1;
  return `OT-${new Date().getUTCFullYear()}-${String(count).padStart(4, '0')}`;
}

/** Claim extra hours for a date. */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const hours = round2(body.hours);
    const date = dateKey(body.date);
    const kind = KINDS.includes(body.kind) ? body.kind : 'overtime';

    if (!date) return fail(res, 400, 'A valid date (YYYY-MM-DD) is required');
    if (!Number.isFinite(hours) || hours <= 0) return fail(res, 400, 'Hours must be greater than zero');
    if (hours > MAX_HOURS_PER_DAY) return fail(res, 400, `Overtime cannot exceed ${MAX_HOURS_PER_DAY} hours for one day`);
    if (!String(body.reason || '').trim()) return fail(res, 400, 'A reason is required so the approver can decide');
    // A claim for a day that has not happened yet cannot be evidenced.
    if (date > dateKey()) return fail(res, 400, 'Overtime can only be claimed for a date that has already passed');

    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const duplicate = data.overtimeRequests.find((item) => (
        item.employeeId === req.user._id && item.date === date && item.status !== 'rejected'
      ));
      if (duplicate) return { conflict: `Overtime for ${date} is already ${duplicate.status}` };

      const now = nowIso();
      const request = {
        _id: newId('overtime'),
        requestNumber: requestNumber(data, req.company._id),
        companyId: req.company._id,
        employeeId: req.user._id,
        kind,
        date,
        // Kept separately so a partial approval never rewrites the original claim.
        claimedHours: hours,
        approvedHours: 0,
        reason: String(body.reason).trim(),
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        reviewerComments: null,
        createdAt: now,
        updatedAt: now,
      };
      data.overtimeRequests.push(request);
      return { request: serialize(data, request) };
    });

    if (result.conflict) return fail(res, 409, result.conflict);
    return created(res, { overtime: result.request, message: `Overtime ${result.request.requestNumber} submitted for approval` });
  } catch (error) {
    return next(error);
  }
});

/** My claims, newest first. */
router.get('/my', async (req, res, next) => {
  try {
    const data = ensureCollections(await req.app.locals.store.read());
    const mine = data.overtimeRequests
      .filter((item) => item.employeeId === req.user._id)
      .sort((left, right) => String(right.date).localeCompare(String(left.date)));
    const { items, pagination } = paginate(mine, req.query);
    const approvedHours = round2(mine.filter((item) => item.status === 'approved').reduce((sum, item) => sum + Number(item.approvedHours || 0), 0));
    return ok(res, {
      overtime: items.map((item) => serialize(data, item)),
      pagination,
      totals: { requests: mine.length, approvedHours },
    });
  } catch (error) {
    return next(error);
  }
});

/** The approval queue. */
router.get('/pending', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = ensureCollections(await req.app.locals.store.read());
    const pending = data.overtimeRequests
      .filter((item) => item.companyId === req.company._id && item.status === 'pending')
      .sort((left, right) => String(left.date).localeCompare(String(right.date)));
    return ok(res, { overtime: pending.map((item) => serialize(data, item)), count: pending.length });
  } catch (error) {
    return next(error);
  }
});

/**
 * Decide a claim. HR and admin only: a manager can vouch for the work informally,
 * but approving paid hours is a payroll action.
 */
router.post('/:id/review', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const action = String(body.action || '').toLowerCase();
    if (!['approve', 'reject'].includes(action)) return fail(res, 400, 'action must be approve or reject');

    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const request = data.overtimeRequests.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!request) return null;
      if (request.status !== 'pending') return { conflict: `This claim has already been ${request.status}` };

      if (action === 'approve') {
        // An approver may allow fewer hours than claimed, never more.
        const requested = body.approvedHours === undefined ? request.claimedHours : round2(body.approvedHours);
        if (!Number.isFinite(requested) || requested <= 0) return { invalid: 'Approved hours must be greater than zero' };
        if (requested > request.claimedHours) return { invalid: `Cannot approve more than the ${request.claimedHours} hour(s) claimed` };
        request.approvedHours = requested;
        request.status = 'approved';
      } else {
        request.approvedHours = 0;
        request.status = 'rejected';
      }

      request.reviewedBy = req.user._id;
      request.reviewedAt = nowIso();
      request.reviewerComments = String(body.comments || '').trim() || null;
      request.updatedAt = request.reviewedAt;
      return { request: serialize(data, request) };
    });

    if (!result) return fail(res, 404, 'Overtime request not found');
    if (result.conflict) return fail(res, 409, result.conflict);
    if (result.invalid) return fail(res, 400, result.invalid);
    return ok(res, { overtime: result.request, message: `Overtime ${result.request.status}` });
  } catch (error) {
    return next(error);
  }
});

/** Approved hours for a period, which is what payroll consumes. */
router.get('/approved', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const data = ensureCollections(await req.app.locals.store.read());
    const period = /^\d{4}-\d{2}$/.test(String(req.query.period || '')) ? String(req.query.period) : dateKey().slice(0, 7);
    const rows = data.overtimeRequests.filter((item) => (
      item.companyId === req.company._id && item.status === 'approved' && String(item.date).slice(0, 7) === period
    ));
    const byEmployee = new Map();
    for (const row of rows) {
      const current = byEmployee.get(row.employeeId) || { employeeId: row.employeeId, hours: 0, days: 0 };
      current.hours = round2(current.hours + Number(row.approvedHours || 0));
      current.days += 1;
      byEmployee.set(row.employeeId, current);
    }
    return ok(res, {
      period,
      employees: [...byEmployee.values()].map((item) => ({ ...item, employee: employeeRef(findEmployee(data, item.employeeId, req.company._id)) })),
      totalHours: round2(rows.reduce((sum, item) => sum + Number(item.approvedHours || 0), 0)),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
