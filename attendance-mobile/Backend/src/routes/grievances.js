const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const {
  employeeRef,
  findEmployee,
  newId,
  nowIso,
  paginate,
} = require('../utils/records');

const router = express.Router();

router.use(authRequired);

function ticketNumber(data) {
  data.counters.grievance = (data.counters.grievance || 0) + 1;
  return `GRV-${new Date().getUTCFullYear()}-${String(data.counters.grievance).padStart(3, '0')}`;
}

function serializeGrievance(data, grievance) {
  const employee = grievance.isAnonymous ? null : findEmployee(data, grievance.employeeId);
  const assignedTo = grievance.assignedTo ? findEmployee(data, grievance.assignedTo) : null;
  return {
    ...grievance,
    employee: employeeRef(employee),
    assignedTo: employeeRef(assignedTo),
  };
}

function canManageGrievance(data, req, grievance) {
  if (['hr', 'admin'].includes(req.user.role)) return true;
  if (req.user.role !== 'manager' || grievance.isAnonymous) return false;
  const employee = findEmployee(data, grievance.employeeId, req.company._id);
  return employee?.managerId === req.user._id;
}

router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.subject || !body.description) {
      return fail(res, 400, 'subject and description are required');
    }

    const result = await req.app.locals.store.update((data) => {
      const now = nowIso();
      const grievance = {
        _id: newId('grv'),
        companyId: req.company._id,
        employeeId: req.user._id,
        category: body.category || 'other',
        subject: body.subject,
        description: body.description,
        isAnonymous: Boolean(body.isAnonymous),
        status: 'open',
        priority: body.priority || 'medium',
        attachments: body.attachments || [],
        assignedTo: body.assignedTo || null,
        ticketNumber: ticketNumber(data),
        comments: [],
        satisfactionRating: null,
        createdAt: now,
        updatedAt: now,
      };
      data.grievances.push(grievance);
      return serializeGrievance(data, grievance);
    });

    return created(res, {
      grievance: result,
      message: 'Grievance submitted successfully',
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/my-grievances', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const grievances = data.grievances
      .filter((grievance) => grievance.employeeId === req.user._id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const { items, pagination } = paginate(grievances, req.query);
    return ok(res, {
      grievances: items.map((grievance) => serializeGrievance(data, grievance)),
      pagination,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/all', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const grievances = data.grievances
      .filter((grievance) => grievance.companyId === req.company._id && canManageGrievance(data, req, grievance))
      .map((grievance) => serializeGrievance(data, grievance));
    return ok(res, { grievances });
  } catch (error) {
    return next(error);
  }
});

router.get('/assigned', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const grievances = data.grievances
      .filter((grievance) => grievance.companyId === req.company._id && grievance.assignedTo === req.user._id)
      .map((grievance) => serializeGrievance(data, grievance));
    return ok(res, { grievances });
  } catch (error) {
    return next(error);
  }
});

router.get('/stats', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const stats = data.grievances
      .filter((grievance) => grievance.companyId === req.company._id && canManageGrievance(data, req, grievance))
      .reduce((summary, grievance) => {
        summary.total += 1;
        summary[grievance.status] = (summary[grievance.status] || 0) + 1;
        return summary;
      }, { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
    return ok(res, { stats });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const grievance = data.grievances.find((item) => item._id === req.params.id && item.companyId === req.company._id);
    if (!grievance) return fail(res, 404, 'Grievance not found');
    if (grievance.employeeId !== req.user._id && grievance.assignedTo !== req.user._id && !canManageGrievance(data, req, grievance)) {
      return fail(res, 403, 'You do not have permission to view this grievance');
    }
    return ok(res, { grievance: serializeGrievance(data, grievance) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/assign', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const grievance = data.grievances.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!grievance) return { error: 'Grievance not found' };
      if (!canManageGrievance(data, req, grievance)) return { forbidden: 'You can only manage grievances from your direct team' };
      const assignee = req.body?.assignedTo || req.body?.employeeId || req.user._id;
      grievance.assignedTo = findEmployee(data, assignee, req.company._id)?._id || assignee;
      grievance.status = grievance.status === 'open' ? 'in_progress' : grievance.status;
      grievance.updatedAt = nowIso();
      return { grievance: serializeGrievance(data, grievance) };
    });

    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.error) return fail(res, 404, result.error);
    return ok(res, { grievance: result.grievance, message: 'Grievance assigned successfully' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const grievance = data.grievances.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!grievance) return { error: 'Grievance not found' };
      if (!canManageGrievance(data, req, grievance) && grievance.assignedTo !== req.user._id) return { forbidden: 'You can only update grievances assigned to you or your direct team' };
      grievance.status = req.body?.status || 'in_progress';
      grievance.resolution = req.body?.resolution || grievance.resolution || null;
      grievance.updatedAt = nowIso();
      return { grievance: serializeGrievance(data, grievance) };
    });

    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.error) return fail(res, 404, result.error);
    return ok(res, { grievance: result.grievance, message: 'Grievance status updated successfully' });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/comment', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const grievance = data.grievances.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!grievance) return { error: 'Grievance not found' };
      if (grievance.employeeId !== req.user._id && grievance.assignedTo !== req.user._id && !canManageGrievance(data, req, grievance)) return { forbidden: 'You do not have permission to comment on this grievance' };
      const comment = {
        _id: newId('comment'),
        employeeId: req.user._id,
        message: req.body?.message || req.body?.comment || '',
        createdAt: nowIso(),
      };
      grievance.comments.push(comment);
      grievance.updatedAt = nowIso();
      return { grievance: serializeGrievance(data, grievance), comment };
    });

    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.error) return fail(res, 404, result.error);
    return created(res, { grievance: result.grievance, comment: result.comment, message: 'Comment added successfully' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/resolve', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const grievance = data.grievances.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!grievance) return { error: 'Grievance not found' };
      if (!canManageGrievance(data, req, grievance) && grievance.assignedTo !== req.user._id) return { forbidden: 'You can only resolve grievances assigned to you or your direct team' };
      grievance.status = 'resolved';
      grievance.resolution = req.body?.resolution || req.body?.comment || null;
      grievance.resolvedAt = nowIso();
      grievance.updatedAt = nowIso();
      return { grievance: serializeGrievance(data, grievance) };
    });

    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.error) return fail(res, 404, result.error);
    return ok(res, { grievance: result.grievance, message: 'Grievance resolved successfully' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/close', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const grievance = data.grievances.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!grievance) return { error: 'Grievance not found' };
      if (grievance.employeeId !== req.user._id && !canManageGrievance(data, req, grievance)) return { forbidden: 'You do not have permission to close this grievance' };
      grievance.status = 'closed';
      grievance.closedAt = nowIso();
      grievance.updatedAt = nowIso();
      return { grievance: serializeGrievance(data, grievance) };
    });

    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.error) return fail(res, 404, result.error);
    return ok(res, { grievance: result.grievance, message: 'Grievance closed successfully' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/rate', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const grievance = data.grievances.find((item) => item._id === req.params.id && item.employeeId === req.user._id);
      if (!grievance) return { error: 'Grievance not found' };
      grievance.satisfactionRating = Number(req.body?.rating || req.body?.satisfactionRating || 0);
      grievance.ratingComment = req.body?.comment || null;
      grievance.updatedAt = nowIso();
      return { grievance: serializeGrievance(data, grievance) };
    });

    if (result.error) return fail(res, 404, result.error);
    return ok(res, { grievance: result.grievance, message: 'Grievance rated successfully' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
