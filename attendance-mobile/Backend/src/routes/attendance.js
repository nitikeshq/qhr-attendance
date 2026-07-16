const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const {
  calculateWorkDuration,
  dateKey,
  employeeRef,
  newId,
  nowIso,
  paginate,
  startOfDayIso,
} = require('../utils/records');

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
  const officeStart = company?.settings?.officeStart || '09:30';
  const [hours, minutes] = officeStart.split(':').map(Number);
  const checkIn = new Date(checkedInAt);
  const expected = new Date(checkIn);
  expected.setUTCHours(hours || 9, minutes || 30, 0, 0);
  const lateByMinutes = Math.max(0, Math.round((checkIn.getTime() - expected.getTime()) / 60000));
  return {
    isLate: lateByMinutes > 0,
    lateByMinutes,
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

function validateGeofence(company, body) {
  if (body.method !== 'geofence') return null;
  if (body.location?.latitude === undefined || body.location?.longitude === undefined) {
    return 'Location is required for geofence check-in';
  }

  const areas = (company?.attendanceAreas || []).filter((area) => area.active !== false);
  if (!areas.length) return 'No active attendance area is configured for this company';
  const insideArea = areas.some((area) => distanceMeters(body.location, area) <= Number(area.radiusMeters || 150));
  return insideArea ? null : 'You are outside every authorized attendance area';
}

router.get('/today', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const today = dateKey(req.query.date);
    const attendance = data.attendances.find((item) => item.employeeId === req.user._id && item.dateKey === today) || null;
    return ok(res, {
      attendance,
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
    const employees = data.employees.filter((employee) => (
      employee.companyId === req.company._id &&
      employee.status !== 'inactive' &&
      (req.user.role !== 'manager' || employee._id === req.user._id || employee.managerId === req.user._id)
    ));
    const attendances = employees.map((employee) => ({
      employee: employeeRef(employee),
      attendance: data.attendances.find((item) => item.employeeId === employee._id && item.dateKey === day) || null,
    }));
    return ok(res, { date: day, attendances });
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
    const geofenceError = validateGeofence(req.company, body);
    if (geofenceError) return fail(res, 403, geofenceError);
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
          isLate: late.isLate,
          lateByMinutes: late.lateByMinutes,
          notes: body.notes || null,
          createdAt: checkedInAt,
          updatedAt: checkedInAt,
        };
        data.attendances.push(attendance);
      }

      if (!attendance.checkIn) {
        attendance.checkIn = {
          time: checkedInAt,
          location: body.location || null,
          method: body.method || 'manual',
          photo: body.photo || null,
        };
        attendance.status = 'present';
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

router.post('/check-out', async (req, res, next) => {
  try {
    const body = req.body || {};
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

      attendance.checkOut = {
        time: checkedOutAt,
        location: body.location || null,
        method: body.method || 'manual',
        notes: body.notes || null,
      };
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
