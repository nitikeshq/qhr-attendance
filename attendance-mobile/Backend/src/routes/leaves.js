const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { normalizeLeaveTypes } = require('../utils/attendancePolicy');
const { created, fail, ok } = require('../utils/responses');
const { pushNotification } = require('../utils/notifications');
const {
  daysBetweenInclusive,
  employeeRef,
  findEmployee,
  newId,
  nowIso,
  paginate,
  startOfDayIso,
} = require('../utils/records');

const router = express.Router();

router.use(authRequired);

const TERMINAL_STATUSES = ['approved', 'rejected', 'cancelled'];
const HR_ROLES = ['hr', 'admin'];
const HR_LEVEL_DAY_THRESHOLD = 3;
const ALREADY_REVIEWED = 'This leave request has already been reviewed';

const DEFAULT_BALANCE_BUCKETS = {
  casual: 12,
  sick: 10,
  earned: 18,
  unpaid: 0,
};

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function leaveTypeCatalog(company) {
  return normalizeLeaveTypes(company?.leaveTypes || []);
}

function leaveTypeCode(leaveType) {
  return String(leaveType || '').trim().toLowerCase();
}

function findLeaveType(company, leaveType) {
  const code = leaveTypeCode(leaveType);
  return leaveTypeCatalog(company).find((item) => item.code === code) || null;
}

function isUnpaidLeaveType(company, leaveType) {
  const code = leaveTypeCode(leaveType);
  if (code === 'unpaid') return true;
  const type = findLeaveType(company, leaveType);
  return Boolean(type) && (type.paid === false || type.payrollTreatment === 'unpaid');
}

function defaultBucketMap(company) {
  const buckets = {};
  Object.entries(DEFAULT_BALANCE_BUCKETS).forEach(([code, total]) => {
    buckets[code] = { total, used: 0, remaining: total };
  });
  leaveTypeCatalog(company).forEach((type) => {
    const total = Number.isFinite(type.annualAllowance) ? type.annualAllowance : 0;
    buckets[type.code] = { total, used: 0, remaining: total };
  });
  return buckets;
}

function leaveYearOf(value) {
  const key = String(value || '').slice(0, 4);
  const year = Number(key);
  return Number.isInteger(year) && year > 2000 ? year : new Date().getUTCFullYear();
}

/**
 * A leave balance is per employee **per year**.
 *
 * The row carried a `year` field that nothing ever filtered on, so allowances never
 * reset: somebody who used 12 casual days in 2025 still showed 12 used in 2026, and
 * their entitlement was silently gone forever. Matching on the year gives each year
 * a fresh set of credits, and leaves prior years intact for reporting.
 */
function getBalance(data, employeeId, company, year = new Date().getUTCFullYear()) {
  const targetYear = leaveYearOf(year);
  let balance = data.leaveBalances.find((item) => item.employeeId === employeeId && leaveYearOf(item.year) === targetYear);
  if (!balance) {
    // A legacy row with no year is adopted into the current year once, so existing
    // tenants keep the credits they have already consumed this year.
    const legacy = data.leaveBalances.find((item) => item.employeeId === employeeId && !item.year);
    if (legacy && targetYear === new Date().getUTCFullYear()) {
      legacy.year = targetYear;
      balance = legacy;
    } else {
      balance = { employeeId, year: targetYear, balances: defaultBucketMap(company) };
      data.leaveBalances.push(balance);
      return balance;
    }
  }
  balance.balances = balance.balances || {};
  const expected = defaultBucketMap(company);
  Object.entries(expected).forEach(([code, bucket]) => {
    if (!balance.balances[code]) balance.balances[code] = { ...bucket };
    // The allowance follows the company policy, so raising it mid-year reaches
    // people who have already taken leave rather than only new joiners.
    else if (Number(balance.balances[code].total) !== Number(bucket.total)) {
      balance.balances[code].total = bucket.total;
      balance.balances[code].remaining = round2(Math.max(0, Number(bucket.total) - Number(balance.balances[code].used || 0)));
    }
  });
  return balance;
}

/**
 * Days already requested but not yet decided, for one leave type and year.
 *
 * Balance is only deducted on final approval, so three separate requests could each
 * pass the "enough remaining" check and collectively blow through the allowance.
 * Pending days are treated as reserved to close that hole.
 */
function pendingDaysFor(data, employeeId, company, code, year) {
  const targetYear = leaveYearOf(year);
  return round2((data.leaves || [])
    .filter((item) => (
      item.employeeId === employeeId
      && item.status === 'pending'
      && leaveTypeCode(item.leaveType) === leaveTypeCode(code)
      && leaveYearOf(item.startDate) === targetYear
    ))
    .reduce((sum, item) => sum + Number(item.days || 0), 0));
}

function balanceBucket(data, leave, company) {
  // Scoped to the year the leave falls in, so a January request draws on the new
  // year's credits rather than the previous one's remainder.
  const balance = getBalance(data, leave.employeeId, company, leaveYearOf(leave.startDate));
  const code = leaveTypeCode(leave.leaveType);
  if (!balance.balances[code]) {
    const type = findLeaveType(company, code);
    const total = type && Number.isFinite(type.annualAllowance) ? type.annualAllowance : 0;
    balance.balances[code] = { total, used: 0, remaining: total };
  }
  return balance.balances[code];
}

function deductBalance(data, leave, company) {
  if (leave.balanceApplied) return;
  const bucket = balanceBucket(data, leave, company);
  if (!bucket) return;
  bucket.used = round2(Number(bucket.used || 0) + Number(leave.days || 0));
  bucket.remaining = round2(Math.max(0, Number(bucket.total || 0) - bucket.used));
  leave.balanceApplied = true;
}

function restoreBalance(data, leave, company) {
  if (!leave.balanceApplied) return;
  const bucket = balanceBucket(data, leave, company);
  if (bucket) {
    bucket.used = round2(Math.max(0, Number(bucket.used || 0) - Number(leave.days || 0)));
    bucket.remaining = round2(Math.max(0, Number(bucket.total || 0) - bucket.used));
  }
  leave.balanceApplied = false;
}

function isActiveEmployee(employee) {
  return Boolean(employee) && employee.status !== 'inactive' && employee.status !== 'terminated';
}

function resolveManagerApprover(data, employee) {
  if (!employee) return null;
  const manager = employee.managerId ? findEmployee(data, employee.managerId, employee.companyId) : null;
  if (isActiveEmployee(manager)) return manager;
  const delegate = employee.delegateApproverId ? findEmployee(data, employee.delegateApproverId, employee.companyId) : null;
  if (isActiveEmployee(delegate)) return delegate;
  return null;
}

function requiresHrLevel(company, leave) {
  return Number(leave.days || 0) > HR_LEVEL_DAY_THRESHOLD || isUnpaidLeaveType(company, leave.leaveType);
}

function makeStep(level, approverRole, approverId, status) {
  return {
    level,
    approverRole,
    approverId: approverId || null,
    status: status || 'pending',
    actedBy: null,
    actedAt: null,
    comments: null,
  };
}

function historyEntry(level, action, actor, comments) {
  return {
    _id: newId('lvact'),
    level: level || 0,
    action,
    actorId: actor?._id || null,
    actorRole: actor?.role || null,
    comments: comments || null,
    at: nowIso(),
  };
}

function pendingStepOf(steps) {
  return (steps || []).find((step) => step.status === 'pending') || null;
}

function currentLevelOf(steps) {
  const pending = pendingStepOf(steps);
  if (pending) return pending.level;
  const last = (steps || [])[(steps || []).length - 1];
  return last ? last.level : 1;
}

function legacyChain(leave) {
  const status = String(leave.status || 'pending');
  let stepStatus = 'pending';
  if (status === 'approved') stepStatus = 'approved';
  else if (status === 'rejected') stepStatus = 'rejected';
  else if (status === 'cancelled') stepStatus = 'skipped';
  const step = makeStep(1, 'manager', leave.approvedBy || null, stepStatus);
  step.actedBy = stepStatus === 'pending' ? null : leave.approvedBy || null;
  step.actedAt = stepStatus === 'pending' ? null : leave.approvedAt || null;
  step.comments = leave.approverComments || null;
  return {
    approvalSteps: [step],
    approvalHistory: Array.isArray(leave.approvalHistory) ? leave.approvalHistory : [],
    currentLevel: 1,
  };
}

function chainOf(leave) {
  if (Array.isArray(leave.approvalSteps) && leave.approvalSteps.length) {
    return {
      approvalSteps: leave.approvalSteps,
      approvalHistory: Array.isArray(leave.approvalHistory) ? leave.approvalHistory : [],
      currentLevel: leave.currentLevel || currentLevelOf(leave.approvalSteps),
    };
  }
  return legacyChain(leave);
}

/**
 * Tells the requester what happened to their leave. The decision is the moment
 * they actually need to know, so it is pushed rather than left to be discovered.
 */
function notifyLeaveDecision(data, req, leave, decision, comments) {
  const approved = decision === 'approved';
  pushNotification(data, {
    companyId: leave.companyId,
    employeeId: leave.employeeId,
    kind: 'leave_decision',
    title: `Leave ${decision}: ${String(leave.startDate).slice(0, 10)} to ${String(leave.endDate).slice(0, 10)}`,
    body: [
      `${leave.days} day(s) of ${String(leave.leaveType || 'leave').replace(/_/g, ' ')}`,
      comments ? `Note: ${comments}` : '',
    ].filter(Boolean).join(' · '),
    severity: approved ? 'success' : 'warning',
    link: { page: 'leaves', id: leave._id },
    dedupeKey: `leave_decision:${leave._id}:${decision}`,
    actorId: req.user._id,
  });
}

function ensureApprovalChain(leave) {
  const chain = chainOf(leave);
  leave.approvalSteps = chain.approvalSteps;
  leave.approvalHistory = chain.approvalHistory;
  leave.currentLevel = chain.currentLevel;
  if (typeof leave.balanceApplied !== 'boolean') {
    leave.balanceApplied = leave.status === 'approved';
  }
  return leave;
}

function buildApprovalSteps(data, company, employee, leave) {
  const steps = [];
  const manager = resolveManagerApprover(data, employee);
  const managerStep = makeStep(1, 'manager', manager?._id || null, manager ? 'pending' : 'skipped');
  if (!manager) {
    managerStep.actedAt = nowIso();
    managerStep.comments = 'No active reporting manager, escalated to HR';
  }
  steps.push(managerStep);
  if (!manager || requiresHrLevel(company, leave)) {
    steps.push(makeStep(2, 'hr', null, 'pending'));
  }
  return steps;
}

function serializeStep(data, step) {
  if (!step) return null;
  const approver = step.approverId ? findEmployee(data, step.approverId) : null;
  return {
    level: step.level,
    approverRole: step.approverRole,
    approverId: step.approverId || null,
    approver: employeeRef(approver),
  };
}

function serializeLeave(data, leave) {
  const employee = findEmployee(data, leave.employeeId);
  const approver = leave.approvedBy ? findEmployee(data, leave.approvedBy) : null;
  const chain = chainOf(leave);
  const pending = pendingStepOf(chain.approvalSteps);
  return {
    ...leave,
    approvalSteps: chain.approvalSteps,
    approvalHistory: chain.approvalHistory,
    currentLevel: chain.currentLevel,
    pendingStep: pending || null,
    pendingApprover: serializeStep(data, pending),
    employee: employeeRef(employee),
    approvedBy: employeeRef(approver),
  };
}

function isChainParticipant(data, leave, user) {
  const chain = chainOf(leave);
  const employee = findEmployee(data, leave.employeeId);
  return chain.approvalSteps.some((step) => step.approverId === user._id || step.actedBy === user._id)
    || chain.approvalHistory.some((entry) => entry.actorId === user._id)
    || (Boolean(employee) && (employee.managerId === user._id || employee.delegateApproverId === user._id));
}

function canReadLeave(data, leave, user) {
  if (leave.employeeId === user._id) return true;
  if (HR_ROLES.includes(user.role)) return true;
  return isChainParticipant(data, leave, user);
}

function stepPermission(data, leave, step, user) {
  if (!step) return { denied: ALREADY_REVIEWED };
  if (step.approverRole === 'hr') {
    if (HR_ROLES.includes(user.role)) return { allowed: true };
    return { denied: 'Only HR or admin can review this leave request at this level' };
  }
  const employee = findEmployee(data, leave.employeeId);
  if (step.approverId && step.approverId === user._id) return { allowed: true };
  if (!step.approverId && employee && employee.managerId === user._id) return { allowed: true };
  if (employee && employee.delegateApproverId === user._id) return { allowed: true };
  if (HR_ROLES.includes(user.role)) return { allowed: true, override: true };
  return { denied: 'You can only review leave requests awaiting your approval' };
}

function isPendingApproverFor(data, leave, user) {
  const chain = chainOf(leave);
  const step = pendingStepOf(chain.approvalSteps);
  if (!step) return false;
  const permission = stepPermission(data, leave, step, user);
  return Boolean(permission.allowed) && !permission.override;
}

function overlapsExistingLeave(data, leave) {
  const start = startOfDayIso(leave.startDate);
  const end = startOfDayIso(leave.endDate);
  return data.leaves.some((item) => {
    if (item._id === leave._id) return false;
    if (item.employeeId !== leave.employeeId) return false;
    if (['cancelled', 'rejected'].includes(String(item.status))) return false;
    const itemStart = startOfDayIso(item.startDate);
    const itemEnd = startOfDayIso(item.endDate || item.startDate);
    return itemStart <= end && itemEnd >= start;
  });
}

/**
 * The leave types an employee can choose. Normalized rather than raw, so the app
 * gets stable codes and a resolved paid/unpaid flag instead of whatever shape the
 * company record happens to hold.
 */
router.get('/types', (req, res) => {
  const leaveTypes = leaveTypeCatalog(req.company).map((type) => ({
    ...type,
    label: type.name,
    unpaid: type.paid === false,
  }));
  return ok(res, { leaveTypes, types: leaveTypes });
});

/**
 * Leave balance. Defaults to the signed-in user; HR and admin may ask for anybody
 * in the company, and a manager for their own reports. Without this an employee
 * profile could show leave history but not what was left.
 */
router.get('/balance', async (req, res, next) => {
  try {
    const requested = String(req.query.employeeId || '').trim();
    let subjectId = req.user._id;

    if (requested && requested !== req.user._id) {
      const store = await req.app.locals.store.read();
      const target = store.employees.find((item) => item._id === requested && item.companyId === req.company._id);
      if (!target) return fail(res, 404, 'Employee not found');

      const permitted = HR_ROLES.includes(req.user.role)
        || target.managerId === req.user._id
        || target.delegateApproverId === req.user._id;
      if (!permitted) return fail(res, 403, 'You do not have permission to view this leave balance');
      subjectId = target._id;
    }

    const year = leaveYearOf(req.query.year || new Date().getUTCFullYear());
    const balance = await req.app.locals.store.update((draft) => getBalance(draft, subjectId, req.company, year));
    const data = await req.app.locals.store.read();

    // Credits per type, with pending requests reserved, so what an employee sees is
    // what they can actually still apply for.
    const credits = leaveTypeCatalog(req.company).map((type) => {
      const bucket = balance.balances[type.code] || { total: type.annualAllowance, used: 0, remaining: type.annualAllowance };
      const pending = pendingDaysFor(data, subjectId, req.company, type.code, year);
      return {
        code: type.code,
        name: type.name,
        paid: type.paid !== false,
        credit: round2(bucket.total),
        used: round2(bucket.used),
        pending,
        available: round2(Math.max(0, Number(bucket.remaining || 0) - pending)),
      };
    });

    return ok(res, { balance, credits, year, employeeId: subjectId });
  } catch (error) {
    return next(error);
  }
});

/** One employee's leave history, for HR opening a profile. */
router.get('/employee/:employeeId', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const target = data.employees.find((item) => item._id === req.params.employeeId && item.companyId === req.company._id);
    if (!target) return fail(res, 404, 'Employee not found');

    const permitted = HR_ROLES.includes(req.user.role)
      || target.managerId === req.user._id
      || target.delegateApproverId === req.user._id;
    if (!permitted) return fail(res, 403, 'You do not have permission to view this leave history');

    const leaves = data.leaves
      .filter((leave) => leave.employeeId === target._id)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    const { items, pagination } = paginate(leaves, req.query);

    return ok(res, {
      leaves: items.map((leave) => serializeLeave(data, leave)),
      count: leaves.length,
      pagination,
    });
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
    const isHr = HR_ROLES.includes(req.user.role);
    const leaves = data.leaves
      .filter((leave) => leave.companyId === req.company._id
        && leave.status === 'pending'
        && (isHr || isPendingApproverFor(data, leave, req.user)))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
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
      const employee = findEmployee(data, req.user._id, req.company._id);
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
        balanceApplied: false,
        approvalSteps: [],
        approvalHistory: [],
        currentLevel: 1,
        createdAt: now,
        updatedAt: now,
      };

      if (overlapsExistingLeave(data, leave)) {
        return { conflict: 'You already have a leave request covering these dates' };
      }

      // The type has to be one the company actually offers. Previously any free-text
      // code was accepted: an unknown code created a zero-allowance bucket, and
      // anything containing "unpaid" skipped the balance check entirely.
      const catalog = leaveTypeCatalog(req.company);
      if (catalog.length && !catalog.some((item) => item.code === leaveTypeCode(leave.leaveType))) {
        return { invalid: `Choose one of your company leave types: ${catalog.map((item) => item.name).join(', ')}` };
      }

      if (!isUnpaidLeaveType(req.company, leave.leaveType)) {
        const bucket = balanceBucket(data, leave, req.company);
        const pending = pendingDaysFor(data, leave.employeeId, req.company, leave.leaveType, leave.startDate);
        const available = round2(Math.max(0, Number(bucket?.remaining || 0) - pending));
        if (days > available) {
          const pendingNote = pending > 0 ? `, ${pending} day(s) already awaiting a decision` : '';
          return {
            invalid: `Insufficient ${leaveTypeCode(leave.leaveType)} leave credit for ${leaveYearOf(leave.startDate)}: `
              + `${days} day(s) requested, ${available} day(s) available${pendingNote}. `
              + 'Apply under an unpaid leave type if you need to exceed your credit.',
          };
        }
      }

      leave.approvalSteps = buildApprovalSteps(data, req.company, employee, leave);
      leave.currentLevel = currentLevelOf(leave.approvalSteps);
      leave.approvalHistory = [historyEntry(leave.currentLevel, 'submitted', req.user, leave.reason)];
      leave.approvalSteps
        .filter((step) => step.status === 'skipped')
        .forEach((step) => {
          leave.approvalHistory.push(historyEntry(step.level, 'skipped', null, step.comments));
        });

      data.leaves.push(leave);
      return { leave: serializeLeave(data, leave) };
    });

    if (result.invalid) return fail(res, 400, result.invalid);
    if (result.conflict) return fail(res, 409, result.conflict);

    return created(res, {
      leave: result.leave,
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
    if (!canReadLeave(data, leave, req.user)) {
      return fail(res, 403, 'You do not have permission to view this leave request');
    }
    return ok(res, { leave: serializeLeave(data, leave) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const leave = data.leaves.find((item) => item._id === req.params.id && item.companyId === req.company._id);
    if (!leave) return fail(res, 404, 'Leave request not found');
    if (!canReadLeave(data, leave, req.user)) {
      return fail(res, 403, 'You do not have permission to view this leave request');
    }
    const chain = chainOf(leave);
    const history = chain.approvalHistory.map((entry) => {
      const actor = entry.actorId ? findEmployee(data, entry.actorId) : null;
      const actorName = actor ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() : null;
      return {
        ...entry,
        actorName: actorName || null,
        actor: employeeRef(actor),
      };
    });
    return ok(res, {
      leaveId: leave._id,
      currentLevel: chain.currentLevel,
      status: leave.status,
      approvalSteps: chain.approvalSteps,
      approvalHistory: history,
      history,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/approve', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const rawAction = String(body.action || body.status || 'approve').toLowerCase();
    const isReject = rawAction === 'reject' || rawAction === 'rejected';
    const comments = body.comments || body.approverComments || null;

    const result = await req.app.locals.store.update((data) => {
      const leave = data.leaves.find((item) => item._id === req.params.id && item.companyId === req.company._id);
      if (!leave) return { error: 'Leave request not found' };
      ensureApprovalChain(leave);

      if (TERMINAL_STATUSES.includes(String(leave.status))) {
        return { conflict: ALREADY_REVIEWED };
      }

      const step = pendingStepOf(leave.approvalSteps);
      if (!step) return { conflict: ALREADY_REVIEWED };

      const permission = stepPermission(data, leave, step, req.user);
      if (!permission.allowed) return { forbidden: permission.denied };

      const now = nowIso();
      step.actedBy = req.user._id;
      step.actedAt = now;
      step.comments = comments;
      leave.approverComments = comments;
      leave.approvedBy = req.user._id;
      leave.approvedAt = now;
      leave.updatedAt = now;

      if (permission.override) {
        leave.approvalHistory.push(historyEntry(step.level, 'overridden', req.user, comments));
      }

      if (isReject) {
        step.status = 'rejected';
        leave.status = 'rejected';
        leave.currentLevel = step.level;
        leave.approvalSteps
          .filter((item) => item.status === 'pending')
          .forEach((item) => {
            item.status = 'skipped';
            item.actedAt = now;
          });
        leave.approvalHistory.push(historyEntry(step.level, 'rejected', req.user, comments));
        restoreBalance(data, leave, req.company);
        notifyLeaveDecision(data, req, leave, 'rejected', comments);
        return { leave: serializeLeave(data, leave) };
      }

      step.status = 'approved';
      leave.approvalHistory.push(historyEntry(step.level, 'approved', req.user, comments));

      const nextStep = pendingStepOf(leave.approvalSteps);
      if (nextStep) {
        leave.status = 'pending';
        leave.currentLevel = nextStep.level;
        leave.approvalHistory.push(historyEntry(nextStep.level, 'forwarded', req.user, null));
        return { leave: serializeLeave(data, leave), forwarded: true, level: step.level };
      }

      leave.status = 'approved';
      leave.currentLevel = step.level;
      deductBalance(data, leave, req.company);
      notifyLeaveDecision(data, req, leave, 'approved', comments);
      return { leave: serializeLeave(data, leave) };
    });

    if (result.forbidden) return fail(res, 403, result.forbidden);
    if (result.conflict) return fail(res, 409, result.conflict);
    if (result.error) return fail(res, 404, result.error);

    const message = result.forwarded
      ? `Leave request approved at level ${result.level} and forwarded for further approval`
      : `Leave request ${result.leave.status} successfully`;
    return ok(res, {
      leave: result.leave,
      message,
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
      ensureApprovalChain(leave);
      if (leave.status === 'cancelled') return { conflict: 'This leave request has already been cancelled' };

      const now = nowIso();
      restoreBalance(data, leave, req.company);
      leave.approvalSteps
        .filter((step) => step.status === 'pending')
        .forEach((step) => {
          step.status = 'skipped';
          step.actedAt = now;
        });
      leave.status = 'cancelled';
      leave.updatedAt = now;
      leave.approvalHistory.push(historyEntry(leave.currentLevel, 'cancelled', req.user, req.body?.reason || null));
      return { leave: serializeLeave(data, leave) };
    });

    if (result.conflict) return fail(res, 409, result.conflict);
    if (result.error) return fail(res, 404, result.error);
    return ok(res, { leave: result.leave, message: 'Leave request cancelled successfully' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
