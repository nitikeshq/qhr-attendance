const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const {
  dateKey,
  employeeRef,
  findEmployee,
  newId,
  nowIso,
  paginate,
  startOfDayIso,
} = require('../utils/records');
const { datesBetween } = require('../utils/attendancePolicy');

const router = express.Router();

router.use(authRequired);

function serializeWfh(data, request) {
  const employee = findEmployee(data, request.employeeId);
  const reviewer = request.reviewedBy ? findEmployee(data, request.reviewedBy) : null;
  return {
    ...request,
    employee: employeeRef(employee),
    reviewedBy: employeeRef(reviewer),
  };
}

function canReviewWfh(data, req, request) {
  if (['hr', 'admin'].includes(req.user.role)) return true;
  if (req.user.role !== 'manager') return false;
  const employee = findEmployee(data, request.employeeId, req.company._id);
  return employee?.managerId === req.user._id;
}

function syncApprovedWfhAttendance(data, request, actorId) {
  const start = new Date(startOfDayIso(request.startDate || request.date));
  const end = new Date(startOfDayIso(request.endDate || request.startDate || request.date));
  const now = nowIso();
  for (const date of datesBetween(start, end)) {
    const key = dateKey(date);
    let attendance = data.attendances.find((item) => item.employeeId === request.employeeId && item.dateKey === key);
    if (!attendance) {
      attendance = {
        _id: newId('att'),
        companyId: request.companyId,
        employeeId: request.employeeId,
        date: startOfDayIso(key),
        dateKey: key,
        checkIn: null,
        checkOut: null,
        workDuration: 0,
        status: 'work_from_home',
        workMode: 'work_from_home',
        isLate: false,
        lateByMinutes: 0,
        notes: request.reason || 'Work from home',
        createdAt: now,
        updatedAt: now,
      };
      data.attendances.push(attendance);
    }
    attendance.status = 'work_from_home';
    attendance.workMode = 'work_from_home';
    attendance.source = request.source || 'wfh';
    attendance.wfhRequestId = request._id;
    attendance.manualBy = actorId || attendance.manualBy || null;
    attendance.notes = attendance.notes || request.reason || null;
    attendance.updatedAt = now;
  }
}

router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.date && !body.startDate) {
      return fail(res, 400, 'date is required');
    }

    const result = await req.app.locals.store.update((data) => {
      const now = nowIso();
      const request = {
        _id: newId('wfh'),
        companyId: req.company._id,
        employeeId: req.user._id,
        date: startOfDayIso(body.date || body.startDate),
        startDate: startOfDayIso(body.startDate || body.date),
        endDate: startOfDayIso(body.endDate || body.date || body.startDate),
        reason: body.reason || '',
        emergencyContact: body.emergencyContact || null,
        workFromLocation: body.workFromLocation || body.location || null,
        status: 'pending',
        reviewComments: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      data.wfhRequests.push(request);
      return serializeWfh(data, request);
    });

    return created(res, {
      wfhRequest: result,
      request: result,
      message: 'WFH request submitted successfully',
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/my-requests', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const requests = data.wfhRequests
      .filter((request) => request.employeeId === req.user._id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const { items, pagination } = paginate(requests, req.query);
    return ok(res, {
      wfhRequests: items.map((request) => serializeWfh(data, request)),
      requests: items.map((request) => serializeWfh(data, request)),
      pagination,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/pending', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const requests = data.wfhRequests
      .filter((request) => request.companyId === req.company._id && request.status === 'pending' && canReviewWfh(data, req, request))
      .map((request) => serializeWfh(data, request));
    return ok(res, { wfhRequests: requests, requests });
  } catch (error) {
    return next(error);
  }
});

router.get('/stats', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const requests = data.wfhRequests.filter((request) => request.companyId === req.company._id && canReviewWfh(data, req, request));
    const stats = requests.reduce((summary, request) => {
      summary.total += 1;
      summary[request.status] = (summary[request.status] || 0) + 1;
      return summary;
    }, { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 });
    return ok(res, { stats });
  } catch (error) {
    return next(error);
  }
});

router.post('/assign', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.employeeId || (!body.date && !body.startDate)) {
      return fail(res, 400, 'employeeId and date are required');
    }
    const result = await req.app.locals.store.update((data) => {
      const employee = findEmployee(data, body.employeeId, req.company._id);
      if (!employee) return null;
      const now = nowIso();
      const request = {
        _id: newId('wfh'),
        companyId: req.company._id,
        employeeId: employee._id,
        date: startOfDayIso(body.date || body.startDate),
        startDate: startOfDayIso(body.startDate || body.date),
        endDate: startOfDayIso(body.endDate || body.date || body.startDate),
        reason: body.reason || 'Assigned by admin',
        emergencyContact: body.emergencyContact || null,
        workFromLocation: body.workFromLocation || body.location || null,
        status: 'approved',
        source: 'admin_assignment',
        reviewComments: body.reviewComments || 'Assigned by admin',
        reviewedBy: req.user._id,
        reviewedAt: now,
        createdBy: req.user._id,
        createdAt: now,
        updatedAt: now,
      };
      data.wfhRequests.push(request);
      syncApprovedWfhAttendance(data, request, req.user._id);
      return serializeWfh(data, request);
    });
    if (!result) return fail(res, 404, 'Employee not found');
    return created(res, {
      wfhRequest: result,
      request: result,
      message: 'WFH assignment saved and attendance updated',
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const request = data.wfhRequests.find((item) => item._id === req.params.id && item.companyId === req.company._id);
    if (!request) return fail(res, 404, 'WFH request not found');
    if (request.employeeId !== req.user._id && !canReviewWfh(data, req, request)) return fail(res, 403, 'You do not have permission to view this WFH request');
    return ok(res, { wfhRequest: serializeWfh(data, request), request: serializeWfh(data, request) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/review', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await req.app.locals.store.update((data) => {
      const request = data.wfhRequests.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!request) return { error: 'WFH request not found' };
      if (!canReviewWfh(data, req, request)) return { forbidden: 'You can only review WFH requests assigned to your role or direct team' };

      const action = body.action || body.status || 'approved';
      request.status = action === 'reject' || action === 'rejected' ? 'rejected' : 'approved';
      request.reviewComments = body.comments || body.reviewComments || null;
      request.reviewedBy = req.user._id;
      request.reviewedAt = nowIso();
      request.updatedAt = nowIso();
      if (request.status === 'approved') syncApprovedWfhAttendance(data, request, req.user._id);
      return { request: serializeWfh(data, request) };
    });

    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.error) return fail(res, 404, result.error);
    return ok(res, {
      wfhRequest: result.request,
      request: result.request,
      message: `WFH request ${result.request.status} successfully`,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const request = data.wfhRequests.find((item) => item._id === req.params.id && item.employeeId === req.user._id);
      if (!request) return { error: 'WFH request not found' };
      request.status = 'cancelled';
      request.updatedAt = nowIso();
      return { request: serializeWfh(data, request) };
    });

    if (result.error) return fail(res, 404, result.error);
    return ok(res, {
      wfhRequest: result.request,
      request: result.request,
      message: 'WFH request cancelled successfully',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
