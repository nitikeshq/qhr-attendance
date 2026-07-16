const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const {
  daysBetweenInclusive,
  employeeRef,
  findEmployee,
  newId,
  nowIso,
  paginate,
} = require('../utils/records');

const router = express.Router();

router.use(authRequired);

function getBalance(data, employeeId) {
  let balance = data.leaveBalances.find((item) => item.employeeId === employeeId);
  if (!balance) {
    balance = {
      employeeId,
      year: new Date().getUTCFullYear(),
      balances: {
        casual: { total: 12, used: 0, remaining: 12 },
        sick: { total: 10, used: 0, remaining: 10 },
        earned: { total: 18, used: 0, remaining: 18 },
        unpaid: { total: 0, used: 0, remaining: 0 },
      },
    };
    data.leaveBalances.push(balance);
  }
  return balance;
}

function serializeLeave(data, leave) {
  const employee = findEmployee(data, leave.employeeId);
  const approver = leave.approvedBy ? findEmployee(data, leave.approvedBy) : null;
  return {
    ...leave,
    employee: employeeRef(employee),
    approvedBy: employeeRef(approver),
  };
}

router.get('/types', (req, res) => ok(res, {
  leaveTypes: req.company.leaveTypes || [],
  types: req.company.leaveTypes || [],
}));

router.get('/balance', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.update((draft) => getBalance(draft, req.user._id));
    return ok(res, { balance: data });
  } catch (error) {
    return next(error);
  }
});

router.get('/my', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const leaves = data.leaves
      .filter((leave) => leave.employeeId === req.user._id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const { items, pagination } = paginate(leaves, req.query);
    return ok(res, {
      leaves: items.map((leave) => serializeLeave(data, leave)),
      pagination,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/approvals/pending', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const visibleEmployeeIds = req.user.role === 'manager'
      ? new Set(data.employees.filter((employee) => employee.managerId === req.user._id).map((employee) => employee._id))
      : null;
    const leaves = data.leaves
      .filter((leave) => leave.companyId === req.company._id && leave.status === 'pending' && (!visibleEmployeeIds || visibleEmployeeIds.has(leave.employeeId)))
      .map((leave) => serializeLeave(data, leave));
    return ok(res, { leaves });
  } catch (error) {
    return next(error);
  }
});

async function applyLeave(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.leaveType || !body.startDate || !body.endDate) {
      return fail(res, 400, 'leaveType, startDate, and endDate are required');
    }

    const result = await req.app.locals.store.update((data) => {
      const days = daysBetweenInclusive(body.startDate, body.endDate, body.isHalfDay);
      const now = nowIso();
      const leave = {
        _id: newId('leave'),
        companyId: req.company._id,
        employeeId: req.user._id,
        leaveType: body.leaveType,
        startDate: new Date(body.startDate).toISOString(),
        endDate: new Date(body.endDate).toISOString(),
        days,
        reason: body.reason || '',
        attachments: body.attachments || [],
        isHalfDay: Boolean(body.isHalfDay),
        halfDayType: body.halfDayType || null,
        status: 'pending',
        approverComments: null,
        approvedBy: null,
        approvedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      data.leaves.push(leave);
      return serializeLeave(data, leave);
    });

    return created(res, {
      leave: result,
      message: 'Leave request submitted successfully',
    });
  } catch (error) {
    return next(error);
  }
}

router.post('/', applyLeave);
router.post('/apply', applyLeave);

router.get('/:id', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const leave = data.leaves.find((item) => item._id === req.params.id && item.companyId === req.company._id);
    if (!leave) return fail(res, 404, 'Leave request not found');
    return ok(res, { leave: serializeLeave(data, leave) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/approve', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await req.app.locals.store.update((data) => {
      const leave = data.leaves.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!leave) return { error: 'Leave request not found' };
      if (req.user.role === 'manager') {
        const employee = data.employees.find((item) => item._id === leave.employeeId);
        if (!employee || employee.managerId !== req.user._id) return { forbidden: 'You can only review leave requests from your direct reports' };
      }

      const action = body.action || body.status || 'approve';
      leave.status = action === 'reject' || action === 'rejected' ? 'rejected' : 'approved';
      leave.approverComments = body.comments || body.approverComments || null;
      leave.approvedBy = req.user._id;
      leave.approvedAt = nowIso();
      leave.updatedAt = nowIso();

      if (leave.status === 'approved') {
        const balance = getBalance(data, leave.employeeId);
        const bucket = balance.balances[leave.leaveType];
        if (bucket) {
          bucket.used = Number((bucket.used + leave.days).toFixed(2));
          bucket.remaining = Number(Math.max(0, bucket.total - bucket.used).toFixed(2));
        }
      }

      return { leave: serializeLeave(data, leave) };
    });

    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.error) return fail(res, 404, result.error);
    return ok(res, {
      leave: result.leave,
      message: `Leave request ${result.leave.status} successfully`,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const leave = data.leaves.find((item) => item._id === req.params.id && item.employeeId === req.user._id);
      if (!leave) return { error: 'Leave request not found' };
      leave.status = 'cancelled';
      leave.updatedAt = nowIso();
      return { leave: serializeLeave(data, leave) };
    });

    if (result.error) return fail(res, 404, result.error);
    return ok(res, { leave: result.leave, message: 'Leave request cancelled successfully' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
