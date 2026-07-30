const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const {
  calculateWorkDuration,
  dateKey,
  employeeRef,
  findEmployee,
  newId,
  nowIso,
  paginate,
  startOfDayIso,
} = require('../utils/records');
const {
  PERIOD_PATTERN,
  buildAttendanceSummary,
  datesBetween,
  normalizeAttendancePolicy,
  normalizeHolidays,
  normalizeLeaveTypes,
  periodRange,
  workWeekFor,
} = require('../utils/attendancePolicy');
const { describePeriod, describeWeekday, normalizeWorkWeek } = require('../utils/workWeek');

const router = express.Router();

router.use(authRequired);

function attendanceSummary(items) {
  const totalDays = items.length;
  const presentDays = items.filter((item) => item.status === 'present').length;
  const lateDays = items.filter((item) => item.isLate).length;
  const halfDays = items.filter((item) => item.status === 'half_day').length;
  const totalMinutes = items.reduce((sum, item) => sum + (item.workDuration || 0), 0);

  return {
    totalDays,
    presentDays,
    lateDays,
    absentDays: 0,
    halfDays,
    averageWorkHours: totalDays ? Number((totalMinutes / totalDays / 60).toFixed(2)) : 0,
  };
}

function lateInfo(company, checkedInAt) {
  const policy = normalizeAttendancePolicy(company);
  const officeStart = company?.settings?.officeStart || '09:30';
  const [hours, minutes] = officeStart.split(':').map(Number);
  const checkIn = new Date(checkedInAt);
  const expected = new Date(checkIn);
  expected.setUTCHours(hours || 9, minutes || 30, 0, 0);
  const lateByMinutes = Math.max(0, Math.round((checkIn.getTime() - expected.getTime()) / 60000) - policy.lateGraceMinutes);
  return {
    isLate: lateByMinutes > 0,
    lateByMinutes,
  };
}

function currentPeriodFrom(value) {
  const key = dateKey(value);
  return key.slice(0, 7);
}

function stripDailySummary(summary) {
  const { days, ...rest } = summary;
  return rest;
}

function visibleEmployees(data, req) {
  return data.employees.filter((employee) => (
    employee.companyId === req.company._id &&
    employee.status !== 'inactive' &&
    (req.user.role !== 'manager' || employee._id === req.user._id || employee.managerId === req.user._id)
  ));
}

function companyAreas(company) {
  return Array.isArray(company?.attendanceAreas) ? company.attendanceAreas : [];
}

function companyWorkLocations(company) {
  return Array.isArray(company?.workLocations) ? company.workLocations : [];
}

function areaNameFor(company, areaId) {
  if (!areaId) return null;
  const match = companyAreas(company).find((area) => area._id === areaId || area.id === areaId);
  return match?.name || null;
}

function areaAddressFor(company, areaId) {
  if (!areaId) return null;
  const match = companyAreas(company).find((area) => area._id === areaId || area.id === areaId);
  return match?.address || null;
}

function workLocationNameFor(company, workLocationId) {
  if (!workLocationId) return null;
  const match = companyWorkLocations(company).find((location) => (
    location._id === workLocationId || location.id === workLocationId || location.code === workLocationId
  ));
  return match?.name || match?.title || null;
}

function resolvedAreaId(attendance) {
  return attendance?.areaId || attendance?.checkIn?.areaId || attendance?.checkOut?.areaId || null;
}

function resolvedAreaName(company, attendance) {
  const areaId = resolvedAreaId(attendance);
  return areaNameFor(company, areaId) ||
    attendance?.areaName ||
    attendance?.checkIn?.areaName ||
    attendance?.checkOut?.areaName ||
    null;
}

function resolvedWorkLocationId(attendance, employee) {
  return attendance?.workLocationId || employee?.workLocationId || null;
}

function rowStatus(row) {
  return row.attendance?.status || row.day?.status || 'not_checked_in';
}

function matchesRowFilters(row, query) {
  const areaId = String(query.areaId || '').trim();
  if (areaId && String(row.areaId || '') !== areaId) return false;

  const workLocationId = String(query.workLocationId || '').trim();
  if (workLocationId && String(row.workLocationId || '') !== workLocationId) return false;

  const status = String(query.status || '').trim();
  if (status && rowStatus(row) !== status) return false;

  const search = String(query.q || '').trim().toLowerCase();
  if (search) {
    const employee = row.employee || {};
    const haystack = [
      employee.firstName,
      employee.lastName,
      `${employee.firstName || ''} ${employee.lastName || ''}`,
      employee.employeeId,
      employee.email,
    ].filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  return true;
}

function teamAttendanceRows(data, req, day, period) {
  return visibleEmployees(data, req).map((employee) => {
    const attendance = data.attendances.find((item) => item.employeeId === employee._id && item.dateKey === day) || null;
    const summary = buildAttendanceSummary(data, req.company, employee, period, req.company.payrollSettings || {});
    const workLocationId = resolvedWorkLocationId(attendance, employee);
    return {
      employee: employeeRef(employee),
      attendance,
      day: summary.days.find((item) => item.date === day) || null,
      summary: stripDailySummary(summary),
      areaId: resolvedAreaId(attendance),
      areaName: resolvedAreaName(req.company, attendance),
      workLocationId,
      workLocationName: workLocationNameFor(req.company, workLocationId),
    };
  });
}

function filteredTeamRows(data, req, day, period) {
  return teamAttendanceRows(data, req, day, period).filter((row) => matchesRowFilters(row, req.query || {}));
}

function appliedFilters(query) {
  return {
    areaId: String(query.areaId || '').trim() || null,
    workLocationId: String(query.workLocationId || '').trim() || null,
    status: String(query.status || '').trim() || null,
    q: String(query.q || '').trim() || null,
  };
}

function distanceMeters(pointA, pointB) {
  const toRadians = (value) => (Number(value) * Math.PI) / 180;
  const earthRadius = 6371000;
  const latitudeDelta = toRadians(pointB.latitude - pointA.latitude);
  const longitudeDelta = toRadians(pointB.longitude - pointA.longitude);
  const latitudeA = toRadians(pointA.latitude);
  const latitudeB = toRadians(pointB.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(haversine));
}

function hasCoordinates(location) {
  return Boolean(location) && location.latitude !== undefined && location.longitude !== undefined;
}

function resolveNearestArea(company, location) {
  if (!hasCoordinates(location)) return null;
  const areas = companyAreas(company).filter((area) => area.active !== false);
  if (!areas.length) return null;

  const measured = areas.map((area) => ({
    area,
    distanceMeters: Math.round(distanceMeters(location, area)),
    inside: distanceMeters(location, area) <= Number(area.radiusMeters || 150),
  })).sort((a, b) => a.distanceMeters - b.distanceMeters);

  const nearest = measured.find((entry) => entry.inside) || measured[0];
  return { area: nearest.area, distanceMeters: nearest.distanceMeters, inside: nearest.inside };
}

function areaStamp(match) {
  if (!match) return { areaId: null, areaName: null, distanceMeters: null };
  return {
    areaId: match.area._id || match.area.id || null,
    areaName: match.area.name || null,
    distanceMeters: match.distanceMeters,
  };
}

function validateGeofence(company, body) {
  const location = body.location;
  const enforced = body.method === 'geofence';

  if (!hasCoordinates(location)) {
    return enforced ? { error: 'Location is required for geofence check-in' } : {};
  }

  const activeAreas = companyAreas(company).filter((area) => area.active !== false);
  if (!activeAreas.length) {
    return enforced ? { error: 'No active attendance area is configured for this company' } : {};
  }

  const match = resolveNearestArea(company, location);
  if (enforced && !match.inside) {
    return { error: 'You are outside every authorized attendance area' };
  }

  return { area: match.area, distanceMeters: match.distanceMeters };
}

router.get('/today', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const today = dateKey(req.query.date);
    const attendance = data.attendances.find((item) => item.employeeId === req.user._id && item.dateKey === today) || null;
    const summary = buildAttendanceSummary(data, req.company, req.user, currentPeriodFrom(today), req.company.payrollSettings || {});
    return ok(res, {
      attendance,
      day: summary.days.find((item) => item.date === today) || null,
      policy: normalizeAttendancePolicy(req.company),
      status: attendance?.status || 'not_checked_in',
      date: startOfDayIso(today),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/my', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    let attendances = data.attendances
      .filter((item) => item.employeeId === req.user._id)
      .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));

    if (req.query.startDate) {
      attendances = attendances.filter((item) => item.dateKey >= dateKey(req.query.startDate));
    }
    if (req.query.endDate) {
      attendances = attendances.filter((item) => item.dateKey <= dateKey(req.query.endDate));
    }

    const { items, pagination } = paginate(attendances, req.query);
    return ok(res, {
      attendances: items,
      pagination,
      summary: attendanceSummary(attendances),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/team', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const day = dateKey(req.query.date);
    const period = PERIOD_PATTERN.test(String(req.query.period || '')) ? String(req.query.period) : currentPeriodFrom(day);
    return ok(res, {
      date: day,
      period,
      policy: normalizeAttendancePolicy(req.company),
      attendances: filteredTeamRows(data, req, day, period),
      filters: appliedFilters(req.query || {}),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/overview', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const day = dateKey(req.query.date);
    const period = PERIOD_PATTERN.test(String(req.query.period || '')) ? String(req.query.period) : currentPeriodFrom(day);
    return ok(res, {
      date: day,
      period,
      policy: normalizeAttendancePolicy(req.company),
      summaries: filteredTeamRows(data, req, day, period),
      filters: appliedFilters(req.query || {}),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/by-location', roleRequired('manager', 'hr', 'admin'), async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const day = dateKey(req.query.date);
    const period = PERIOD_PATTERN.test(String(req.query.period || '')) ? String(req.query.period) : currentPeriodFrom(day);
    const rows = filteredTeamRows(data, req, day, period);

    const buckets = new Map();
    const unassignedRows = [];

    for (const row of rows) {
      if (!row.areaId) {
        unassignedRows.push(row);
        continue;
      }
      if (!buckets.has(row.areaId)) {
        buckets.set(row.areaId, {
          areaId: row.areaId,
          areaName: row.areaName || areaNameFor(req.company, row.areaId),
          address: areaAddressFor(req.company, row.areaId),
          employees: 0,
          present: 0,
          late: 0,
          rows: [],
        });
      }
      buckets.get(row.areaId).rows.push(row);
    }

    const countGroup = (group) => {
      group.employees = group.rows.length;
      group.present = group.rows.filter((row) => ['present', 'half_day', 'work_from_home'].includes(rowStatus(row))).length;
      group.late = group.rows.filter((row) => Boolean(row.attendance?.isLate || row.day?.isLate)).length;
      return group;
    };

    const groups = [...buckets.values()]
      .map(countGroup)
      .sort((a, b) => String(a.areaName || '').localeCompare(String(b.areaName || '')));

    const unassigned = countGroup({
      areaId: null,
      areaName: 'Unassigned',
      address: null,
      employees: 0,
      present: 0,
      late: 0,
      rows: unassignedRows,
    });

    return ok(res, {
      date: day,
      period,
      groups,
      unassigned,
      filters: appliedFilters(req.query || {}),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/policy', roleRequired('hr', 'admin'), (req, res) => {
  const workWeek = workWeekFor(req.company, req.company.payrollSettings || {});
  return ok(res, {
    policy: normalizeAttendancePolicy(req.company),
    workWeek,
    workWeekSummary: [0, 1, 2, 3, 4, 5, 6].map((weekday) => describeWeekday(workWeek, weekday)),
    leaveTypes: normalizeLeaveTypes(req.company.leaveTypes || []),
    holidays: normalizeHolidays(req.company.holidays || []),
  });
});

/**
 * Day-by-day preview of a month under the current work week and holidays.
 *
 * Payable days were only ever visible after payroll had been generated. This
 * shows the same classification beforehand, so a wrong roster is caught while it
 * is still free to fix.
 */
router.get('/work-week/preview', roleRequired('hr', 'admin'), (req, res) => {
  const period = PERIOD_PATTERN.test(String(req.query.period || ''))
    ? String(req.query.period)
    : dateKey().slice(0, 7);
  const settings = req.company.payrollSettings || {};
  const workWeek = workWeekFor(req.company, settings);
  const { start, end, daysInMonth } = periodRange(period);
  const holidayList = normalizeHolidays(req.company.holidays || []);
  const holidayNames = new Map(holidayList.map((item) => [item.date, item.name]));
  const summary = describePeriod(workWeek, datesBetween(start, end), new Set(holidayNames.keys()));

  const method = settings.workingDayMethod || 'calendar_days';
  // The denominator payroll divides by, which is deliberately independent of the
  // roster: statutory practice often uses a flat 30 regardless of working days.
  const payableDayBasis = method === 'fixed_30'
    ? 30
    : method === 'working_days'
      ? summary.workingDays
      : daysInMonth;

  return ok(res, {
    period,
    calendarDays: daysInMonth,
    workingDays: summary.workingDays,
    halfDays: summary.halfDays,
    weeklyOffDays: summary.weeklyOffDays,
    holidayDays: summary.holidayDays,
    workingDayMethod: method,
    payableDayBasis,
    workWeek,
    workWeekSummary: [0, 1, 2, 3, 4, 5, 6].map((weekday) => describeWeekday(workWeek, weekday)),
    days: summary.days.map((day) => ({ ...day, holidayName: holidayNames.get(day.date) || null })),
  });
});

/** Saves the weekly-off pattern. Admin only: it changes what everyone is paid. */
router.patch('/work-week', roleRequired('admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => item._id === req.company._id);
      if (!company) return null;
      const workWeek = normalizeWorkWeek(req.body?.workWeek ?? req.body, company.payrollSettings?.workingDays);
      company.settings ||= {};
      company.settings.workWeek = workWeek;
      // Kept in step so anything still reading the legacy list agrees with the
      // work week rather than contradicting it.
      company.payrollSettings ||= {};
      company.payrollSettings.workingDays = [0, 1, 2, 3, 4, 5, 6].filter((weekday) => workWeek[weekday] !== 'off');
      company.updatedAt = nowIso();
      return {
        workWeek,
        workingDays: company.payrollSettings.workingDays,
        workWeekSummary: [0, 1, 2, 3, 4, 5, 6].map((weekday) => describeWeekday(workWeek, weekday)),
      };
    });
    if (!result) return fail(res, 404, 'Company not found');
    return ok(res, { ...result, message: 'Work week saved' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/policy', roleRequired('admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => item._id === req.company._id);
      if (!company) return null;
      const body = req.body || {};
      company.settings ||= {};
      company.settings.attendancePolicy = normalizeAttendancePolicy(company, body.attendancePolicy || body.policy || body);
      if (Object.prototype.hasOwnProperty.call(body, 'leaveTypes')) {
        company.leaveTypes = normalizeLeaveTypes(body.leaveTypes, company.leaveTypes || []);
      }
      if (Object.prototype.hasOwnProperty.call(body, 'holidays')) {
        company.holidays = normalizeHolidays(body.holidays, company.holidays || []);
      }
      company.updatedAt = nowIso();
      return {
        policy: normalizeAttendancePolicy(company),
        leaveTypes: normalizeLeaveTypes(company.leaveTypes || []),
        holidays: normalizeHolidays(company.holidays || []),
      };
    });
    if (!result) return fail(res, 404, 'Company not found');
    return ok(res, { ...result, message: 'Attendance policy saved' });
  } catch (error) {
    return next(error);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const attendances = data.attendances.filter((item) => item.employeeId === req.user._id);
    return ok(res, { summary: attendanceSummary(attendances) });
  } catch (error) {
    return next(error);
  }
});

router.post('/check-in', async (req, res, next) => {
  try {
    const body = req.body || {};
    const geofence = validateGeofence(req.company, body) || {};
    if (geofence.error) return fail(res, 403, geofence.error);
    const stamp = areaStamp(geofence.area ? geofence : null);
    const result = await req.app.locals.store.update((data) => {
      const checkedInAt = nowIso();
      const today = dateKey(checkedInAt);
      let attendance = data.attendances.find((item) => item.employeeId === req.user._id && item.dateKey === today);
      const late = lateInfo(req.company, checkedInAt);

      if (!attendance) {
        attendance = {
          _id: newId('att'),
          companyId: req.company._id,
          employeeId: req.user._id,
          date: startOfDayIso(today),
          dateKey: today,
          checkIn: null,
          checkOut: null,
          workDuration: 0,
          status: 'present',
          workMode: 'office',
          isLate: late.isLate,
          lateByMinutes: late.lateByMinutes,
          notes: body.notes || null,
          createdAt: checkedInAt,
          updatedAt: checkedInAt,
        };
        data.attendances.push(attendance);
      }

      if (!attendance.checkIn) {
        const previousStatus = attendance.status;
        const employee = findEmployee(data, req.user._id, req.company._id) || req.user;
        attendance.checkIn = {
          time: checkedInAt,
          location: body.location || null,
          method: body.method || 'manual',
          photo: body.photo || null,
          areaId: stamp.areaId,
          areaName: stamp.areaName,
          distanceMeters: stamp.distanceMeters,
        };
        attendance.areaId = stamp.areaId;
        attendance.areaName = stamp.areaName;
        attendance.workLocationId = employee?.workLocationId || attendance.workLocationId || null;
        attendance.status = previousStatus === 'work_from_home' ? 'work_from_home' : 'present';
        attendance.workMode = attendance.status === 'work_from_home' ? 'work_from_home' : (body.workMode || 'office');
        attendance.isLate = late.isLate;
        attendance.lateByMinutes = late.lateByMinutes;
        attendance.updatedAt = checkedInAt;
      }

      return attendance;
    });

    return created(res, {
      attendance: result,
      message: result.checkIn ? 'Checked in successfully' : 'Already checked in',
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/status', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const allowedStatuses = ['present', 'half_day', 'absent', 'work_from_home'];
    if (!body.employeeId || !body.date || !allowedStatuses.includes(body.status)) {
      return fail(res, 400, 'employeeId, date, and a valid status are required');
    }
    const result = await req.app.locals.store.update((data) => {
      const employee = findEmployee(data, body.employeeId, req.company._id);
      if (!employee) return null;
      const key = dateKey(body.date);
      const now = nowIso();
      let attendance = data.attendances.find((item) => item.employeeId === employee._id && item.dateKey === key);
      if (!attendance) {
        attendance = {
          _id: newId('att'),
          companyId: req.company._id,
          employeeId: employee._id,
          date: startOfDayIso(key),
          dateKey: key,
          checkIn: null,
          checkOut: null,
          workDuration: 0,
          status: body.status,
          workMode: body.status === 'work_from_home' ? 'work_from_home' : 'office',
          isLate: false,
          lateByMinutes: 0,
          notes: null,
          createdAt: now,
          updatedAt: now,
        };
        data.attendances.push(attendance);
      }
      attendance.status = body.status;
      attendance.workMode = body.status === 'work_from_home' ? 'work_from_home' : (body.workMode || 'office');
      attendance.workDuration = Math.max(0, Number(body.workDuration || attendance.workDuration || 0));
      attendance.notes = body.notes || attendance.notes || null;
      attendance.source = 'manual_admin';
      attendance.manualBy = req.user._id;
      attendance.updatedAt = now;
      return {
        attendance,
        employee: employeeRef(employee),
        summary: stripDailySummary(buildAttendanceSummary(data, req.company, employee, key.slice(0, 7), req.company.payrollSettings || {})),
      };
    });
    if (!result) return fail(res, 404, 'Employee not found');
    return ok(res, { ...result, message: 'Attendance status saved' });
  } catch (error) {
    return next(error);
  }
});

router.post('/check-out', async (req, res, next) => {
  try {
    const body = req.body || {};
    const checkOutStamp = areaStamp(resolveNearestArea(req.company, body.location));
    const result = await req.app.locals.store.update((data) => {
      const checkedOutAt = nowIso();
      const today = dateKey(checkedOutAt);
      let attendance = data.attendances.find((item) => item.employeeId === req.user._id && item.dateKey === today);

      if (!attendance) {
        attendance = {
          _id: newId('att'),
          companyId: req.company._id,
          employeeId: req.user._id,
          date: startOfDayIso(today),
          dateKey: today,
          checkIn: null,
          checkOut: null,
          workDuration: 0,
          status: 'present',
          isLate: false,
          lateByMinutes: 0,
          notes: null,
          createdAt: checkedOutAt,
          updatedAt: checkedOutAt,
        };
        data.attendances.push(attendance);
      }

      const employee = findEmployee(data, req.user._id, req.company._id) || req.user;
      attendance.checkOut = {
        time: checkedOutAt,
        location: body.location || null,
        method: body.method || 'manual',
        notes: body.notes || null,
        areaId: checkOutStamp.areaId,
        areaName: checkOutStamp.areaName,
        distanceMeters: checkOutStamp.distanceMeters,
      };
      if (!attendance.areaId && checkOutStamp.areaId) {
        attendance.areaId = checkOutStamp.areaId;
        attendance.areaName = checkOutStamp.areaName;
      }
      if (!attendance.workLocationId && employee?.workLocationId) {
        attendance.workLocationId = employee.workLocationId;
      }
      attendance.workDuration = calculateWorkDuration(attendance.checkIn, attendance.checkOut);
      attendance.updatedAt = checkedOutAt;
      return attendance;
    });

    return ok(res, {
      attendance: result,
      message: 'Checked out successfully',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
