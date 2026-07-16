const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const {
  dateKey,
  employeeRef,
  findEmployee,
  newId,
  nowIso,
} = require('../utils/records');

const router = express.Router();

router.use(authRequired);

function canViewTeamMember(req, employee) {
  return req.user.role !== 'manager' || employee?._id === req.user._id || employee?.managerId === req.user._id;
}

function getOrCreateActivity(data, employee, company, day = dateKey()) {
  let activity = data.desktopActivities.find((item) => item.employeeId === employee._id && item.dateKey === day);
  if (!activity) {
    const now = nowIso();
    activity = {
      _id: newId('desktop'),
      companyId: company._id,
      employeeId: employee._id,
      dateKey: day,
      sessionStart: null,
      sessionEnd: null,
      snapshots: [],
      topApps: [],
      topCategories: [],
      createdAt: now,
      updatedAt: now,
    };
    data.desktopActivities.push(activity);
  }
  return activity;
}

function summarizeActivity(activity) {
  const snapshots = activity?.snapshots || [];
  const activeSnapshots = snapshots.filter((snapshot) => snapshot.isActive);
  const totalActiveSeconds = activeSnapshots.length * 30;
  const totalIdleSeconds = Math.max(0, snapshots.length * 30 - totalActiveSeconds);

  return {
    snapshots: snapshots.length,
    activeSnapshots: activeSnapshots.length,
    totalActiveSeconds,
    totalIdleSeconds,
    lastActivityAt: snapshots.at(-1)?.timestamp || activity?.updatedAt || null,
    topApps: activity?.topApps || [],
    topCategories: activity?.topCategories || [],
  };
}

function serializeActivity(data, activity) {
  const employee = findEmployee(data, activity.employeeId);
  return {
    ...activity,
    employee: employeeRef(employee),
    summary: summarizeActivity(activity),
  };
}

function getOrCreateState(data, employee, company, deviceInfo = {}) {
  let state = data.desktopStates.find((item) => item.employeeId === employee._id && item.deviceId === deviceInfo.deviceId);
  if (!state) {
    const now = nowIso();
    state = {
      _id: newId('desktop_state'),
      companyId: company._id,
      employeeId: employee._id,
      deviceId: deviceInfo.deviceId || 'default-device',
      deviceInfo,
      status: 'offline',
      lastHeartbeatAt: null,
      lastSnapshotAt: null,
      createdAt: now,
      updatedAt: now,
    };
    data.desktopStates.push(state);
  }
  return state;
}

router.post('/record', async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await req.app.locals.store.update((data) => {
      const now = nowIso();
      const day = dateKey(body.snapshot?.timestamp || body.sessionStart || body.sessionEnd || now);
      const activity = getOrCreateActivity(data, req.user, req.company, day);

      if (body.sessionStart) activity.sessionStart = body.sessionStart;
      if (body.sessionEnd) activity.sessionEnd = body.sessionEnd;
      if (body.deviceInfo) activity.deviceInfo = body.deviceInfo;

      if (body.snapshot) {
        const exists = activity.snapshots.some((snapshot) => snapshot.snapshotId && snapshot.snapshotId === body.snapshot.snapshotId);
        if (!exists) {
          activity.snapshots.push({
            ...body.snapshot,
            recordedAt: now,
          });
        }
        const state = getOrCreateState(data, req.user, req.company, body.deviceInfo || {});
        state.status = body.snapshot.isActive ? 'active' : 'idle';
        state.lastSnapshotAt = body.snapshot.timestamp || now;
        state.updatedAt = now;
      }

      activity.updatedAt = now;
      return serializeActivity(data, activity);
    });

    return created(res, {
      activity: result,
      message: 'Desktop activity recorded successfully',
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/heartbeat', async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await req.app.locals.store.update((data) => {
      const state = getOrCreateState(data, req.user, req.company, body.deviceInfo || {});
      state.status = body.status || 'online';
      state.lastHeartbeatAt = nowIso();
      state.updatedAt = nowIso();
      return state;
    });

    return ok(res, {
      state: result,
      message: 'Heartbeat recorded successfully',
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/consent', async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await req.app.locals.store.update((data) => {
      const deviceId = body.deviceInfo?.deviceId || 'default-device';
      let consent = data.desktopConsents.find((item) => item.employeeId === req.user._id && item.deviceId === deviceId);
      const now = nowIso();
      if (!consent) {
        consent = {
          _id: newId('desktop_consent'),
          companyId: req.company._id,
          employeeId: req.user._id,
          deviceId,
          accepted: false,
          policyVersion: body.policyVersion || 'desktop-monitoring-v1',
          acceptedAt: null,
          revokedAt: null,
          deviceInfo: body.deviceInfo || {},
          createdAt: now,
          updatedAt: now,
        };
        data.desktopConsents.push(consent);
      }

      consent.accepted = Boolean(body.accepted);
      consent.policyVersion = body.policyVersion || consent.policyVersion;
      consent.deviceInfo = body.deviceInfo || consent.deviceInfo;
      consent.acceptedAt = consent.accepted ? (body.acceptedAt || now) : consent.acceptedAt;
      consent.revokedAt = consent.accepted ? null : now;
      consent.syncedAt = now;
      consent.updatedAt = now;
      return consent;
    });

    return ok(res, {
      consent: result,
      message: 'Desktop monitoring consent recorded successfully',
    });
  } catch (error) {
    return next(error);
  }
});

async function stateHandler(req, res, next) {
  try {
    const body = req.body || {};
    const data = await req.app.locals.store.read();
    const deviceId = body.deviceInfo?.deviceId || req.query.deviceId || 'default-device';
    const consent = data.desktopConsents.find((item) => item.employeeId === req.user._id && item.deviceId === deviceId) || null;
    const state = data.desktopStates.find((item) => item.employeeId === req.user._id && item.deviceId === deviceId) || null;
    const activity = data.desktopActivities.find((item) => item.employeeId === req.user._id && item.dateKey === dateKey()) || null;

    return ok(res, {
      consent,
      state,
      monitoring: {
        enabled: Boolean(consent?.accepted),
        policyVersion: body.policyVersion || consent?.policyVersion || 'desktop-monitoring-v1',
      },
      employee: employeeRef(req.user),
      today: activity ? serializeActivity(data, activity) : null,
    });
  } catch (error) {
    return next(error);
  }
}

router.post('/state', stateHandler);
router.get('/state', stateHandler);

router.put('/apps', async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await req.app.locals.store.update((data) => {
      const activity = getOrCreateActivity(data, req.user, req.company, dateKey(body.date));
      activity.topApps = body.topApps || body.apps || [];
      activity.topCategories = body.topCategories || body.categories || [];
      activity.updatedAt = nowIso();
      return serializeActivity(data, activity);
    });

    return ok(res, {
      activity: result,
      message: 'App usage updated successfully',
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/my', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const day = dateKey(req.query.date);
    const activity = data.desktopActivities.find((item) => item.employeeId === req.user._id && item.dateKey === day);
    return ok(res, {
      activity: activity ? serializeActivity(data, activity) : null,
      date: day,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/team', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const day = dateKey(req.query.date);
    const employees = data.employees.filter((employee) => employee.companyId === req.company._id && employee.status !== 'inactive' && canViewTeamMember(req, employee));
    const team = employees.map((employee) => {
      const activity = data.desktopActivities.find((item) => item.employeeId === employee._id && item.dateKey === day) || null;
      const states = data.desktopStates.filter((item) => item.employeeId === employee._id);
      return {
        employee: employeeRef(employee),
        activity: activity ? serializeActivity(data, activity) : null,
        states,
      };
    });
    return ok(res, { date: day, team });
  } catch (error) {
    return next(error);
  }
});

router.get('/live', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const live = data.desktopStates
      .filter((state) => state.companyId === req.company._id && canViewTeamMember(req, findEmployee(data, state.employeeId)))
      .map((state) => ({
        ...state,
        employee: employeeRef(findEmployee(data, state.employeeId)),
      }));
    return ok(res, { live });
  } catch (error) {
    return next(error);
  }
});

router.get('/summary', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const day = dateKey(req.query.date);
    const activities = data.desktopActivities.filter((activity) => activity.companyId === req.company._id && activity.dateKey === day && canViewTeamMember(req, findEmployee(data, activity.employeeId)));
    const summary = activities.reduce((acc, activity) => {
      const item = summarizeActivity(activity);
      acc.employees += 1;
      acc.snapshots += item.snapshots;
      acc.totalActiveSeconds += item.totalActiveSeconds;
      acc.totalIdleSeconds += item.totalIdleSeconds;
      return acc;
    }, { employees: 0, snapshots: 0, totalActiveSeconds: 0, totalIdleSeconds: 0 });
    return ok(res, { date: day, summary });
  } catch (error) {
    return next(error);
  }
});

router.get('/:employeeId/:date', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const employee = findEmployee(data, req.params.employeeId, req.company._id);
    if (!employee) return fail(res, 404, 'Employee not found');
    if (!canViewTeamMember(req, employee)) return fail(res, 403, 'You can only view desktop activity for your direct team');
    const activity = data.desktopActivities.find((item) => item.employeeId === employee._id && item.dateKey === dateKey(req.params.date));
    return ok(res, {
      employee: employeeRef(employee),
      activity: activity ? serializeActivity(data, activity) : null,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
