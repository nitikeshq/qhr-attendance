const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function startOfDay(value) {
  return new Date(`${dateKey(value)}T00:00:00.000Z`);
}

function periodRange(period) {
  if (!PERIOD_PATTERN.test(String(period || ''))) throw new Error('Period must use YYYY-MM format');
  const [year, month] = period.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end, daysInMonth: end.getUTCDate() };
}

function datesBetween(start, end) {
  const result = [];
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return result;
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    result.push(new Date(date));
  }
  return result;
}

function overlapDates(startDate, endDate, periodStart, periodEnd) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate || startDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  return datesBetween(start > periodStart ? start : periodStart, end < periodEnd ? end : periodEnd);
}

function defaultAttendancePolicy(company = {}) {
  const attendanceProration = Boolean(company?.payrollSettings?.attendanceProration);
  return {
    payrollImpact: attendanceProration ? 'attendance_and_leave' : 'leave_only',
    fullDayMinutes: 480,
    halfDayMinutes: 240,
    lateGraceMinutes: 0,
    requireCheckoutForFullDay: false,
    deductUnpaidLeave: true,
    deductUnnoticedAbsence: true,
    deductHalfDay: true,
    holidaysPaid: true,
    paidLeavePayableDays: 1,
    unpaidLeavePayableDays: 0,
    halfDayPayableDays: 0.5,
    unnoticedAbsencePayableDays: 0,
    wfhPayableDays: 1,
    wfhRequiresCheckIn: false,
    untrackedWfhPayableDays: 1,
    countApprovedWfhAsPresent: true,
  };
}

function normalizeAttendancePolicy(company = {}, input = company?.settings?.attendancePolicy || {}) {
  const defaults = defaultAttendancePolicy(company);
  const payrollImpact = ['none', 'leave_only', 'attendance_and_leave'].includes(input.payrollImpact)
    ? input.payrollImpact
    : defaults.payrollImpact;
  const fullDayMinutes = clamp(Number(input.fullDayMinutes ?? defaults.fullDayMinutes), 1, 1440);
  const halfDayMinutes = clamp(Number(input.halfDayMinutes ?? defaults.halfDayMinutes), 1, fullDayMinutes);
  return {
    ...defaults,
    ...input,
    payrollImpact,
    fullDayMinutes,
    halfDayMinutes,
    lateGraceMinutes: clamp(Number(input.lateGraceMinutes ?? defaults.lateGraceMinutes), 0, 180),
    requireCheckoutForFullDay: Boolean(input.requireCheckoutForFullDay),
    deductUnpaidLeave: input.deductUnpaidLeave !== false,
    deductUnnoticedAbsence: input.deductUnnoticedAbsence !== false,
    deductHalfDay: input.deductHalfDay !== false,
    holidaysPaid: input.holidaysPaid !== false,
    paidLeavePayableDays: clamp(Number(input.paidLeavePayableDays ?? defaults.paidLeavePayableDays), 0, 1),
    unpaidLeavePayableDays: clamp(Number(input.unpaidLeavePayableDays ?? defaults.unpaidLeavePayableDays), 0, 1),
    halfDayPayableDays: clamp(Number(input.halfDayPayableDays ?? defaults.halfDayPayableDays), 0, 1),
    unnoticedAbsencePayableDays: clamp(Number(input.unnoticedAbsencePayableDays ?? defaults.unnoticedAbsencePayableDays), 0, 1),
    wfhPayableDays: clamp(Number(input.wfhPayableDays ?? defaults.wfhPayableDays), 0, 1),
    wfhRequiresCheckIn: Boolean(input.wfhRequiresCheckIn),
    untrackedWfhPayableDays: clamp(Number(input.untrackedWfhPayableDays ?? defaults.untrackedWfhPayableDays), 0, 1),
    countApprovedWfhAsPresent: input.countApprovedWfhAsPresent !== false,
  };
}

function normalizeLeaveTypes(input, fallback = []) {
  const source = Array.isArray(input) ? input : fallback;
  return source.map((item) => {
    const code = String(item?.code || item?.name || 'leave').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const isUnpaid = code === 'unpaid' || item?.paid === false || item?.payrollTreatment === 'unpaid';
    return {
      code: code || 'leave',
      name: String(item?.name || code || 'Leave type'),
      annualAllowance: Math.max(0, amount(item?.annualAllowance)),
      color: item?.color || '#6366F1',
      paid: !isUnpaid,
      payrollTreatment: isUnpaid ? 'unpaid' : 'paid',
    };
  });
}

function normalizeHolidays(input, fallback = []) {
  const source = Array.isArray(input) ? input : fallback;
  return source
    .map((item) => ({
      date: dateKey(item?.date || item),
      name: String(item?.name || 'Holiday'),
      paid: item?.paid !== false,
    }))
    .filter((item) => item.date);
}

function leaveTreatment(company, leave) {
  const leaveTypes = normalizeLeaveTypes(company?.leaveTypes || []);
  const type = leaveTypes.find((item) => item.code === String(leave.leaveType || '').toLowerCase());
  const unpaid = leave.leaveType === 'unpaid' || type?.paid === false || type?.payrollTreatment === 'unpaid';
  return unpaid ? 'unpaid' : 'paid';
}

function scheduledDatesForPeriod(company, settings, start, end) {
  const allDates = datesBetween(start, end);
  const holidays = new Set(normalizeHolidays(company?.holidays || []).map((item) => item.date));
  if (settings.workingDayMethod === 'working_days') {
    const workingDays = Array.isArray(settings.workingDays) && settings.workingDays.length ? settings.workingDays.map(Number) : [1, 2, 3, 4, 5];
    return allDates.filter((date) => workingDays.includes(date.getUTCDay()) && !holidays.has(dateKey(date)));
  }
  return allDates;
}

function attendanceStatusForDay(attendance, policy) {
  if (!attendance) return null;
  if (attendance.status === 'work_from_home') return 'work_from_home';
  if (attendance.status === 'half_day') return 'half_day';
  if (attendance.status === 'absent') return 'absent';
  if (attendance.status === 'present' || attendance.checkIn) {
    const minutes = Number(attendance.workDuration || 0);
    if (policy.requireCheckoutForFullDay || minutes > 0) {
      if (minutes >= policy.fullDayMinutes) return 'present';
      if (minutes >= policy.halfDayMinutes) return 'half_day';
      if (attendance.status === 'present' && !policy.requireCheckoutForFullDay) return 'present';
      return 'short_day';
    }
    return 'present';
  }
  return attendance.status || null;
}

function buildAttendanceSummary(data, company, employee, period, payrollSettings = {}) {
  const settings = {
    workingDayMethod: payrollSettings.workingDayMethod || 'calendar_days',
    workingDays: payrollSettings.workingDays || [1, 2, 3, 4, 5],
    attendanceProration: Boolean(payrollSettings.attendanceProration),
  };
  const policy = normalizeAttendancePolicy(company);
  const { start, end, daysInMonth } = periodRange(period);
  const scheduledDates = scheduledDatesForPeriod(company, settings, start, end);
  const scheduledKeys = new Set(scheduledDates.map(dateKey));
  const joiningDate = employee?.dateOfJoining ? startOfDay(employee.dateOfJoining) : start;
  const leavingDate = employee?.lastWorkingDate ? startOfDay(employee.lastWorkingDate) : end;
  const eligibleDates = scheduledDates.filter((date) => date >= joiningDate && date <= leavingDate);
  const eligibleKeys = new Set(eligibleDates.map(dateKey));
  const rawHolidayKeys = new Set(normalizeHolidays(company?.holidays || []).map((item) => item.date));
  const dailyScale = settings.workingDayMethod === 'fixed_30' && scheduledDates.length ? 30 / scheduledDates.length : 1;
  const configuredDays = settings.workingDayMethod === 'fixed_30' ? 30 : scheduledDates.length;

  const attendanceByDay = new Map((data.attendances || [])
    .filter((item) => item.employeeId === employee._id && String(item.dateKey || item.date).slice(0, 7) === period)
    .map((item) => [String(item.dateKey || item.date).slice(0, 10), item]));

  const leaveByDay = new Map();
  for (const leave of (data.leaves || []).filter((item) => item.employeeId === employee._id && item.status === 'approved')) {
    const treatment = leaveTreatment(company, leave);
    const leaveDates = overlapDates(leave.startDate, leave.endDate, start, end);
    const fraction = leave.isHalfDay ? 0.5 : 1;
    for (const date of leaveDates) {
      const key = dateKey(date);
      if (!eligibleKeys.has(key)) continue;
      const current = leaveByDay.get(key) || { paid: 0, unpaid: 0, leaveIds: [] };
      current[treatment] = clamp(current[treatment] + fraction, 0, 1);
      current.leaveIds.push(leave._id);
      leaveByDay.set(key, current);
    }
  }

  const wfhByDay = new Map();
  for (const request of (data.wfhRequests || []).filter((item) => item.employeeId === employee._id && item.status === 'approved')) {
    for (const date of overlapDates(request.startDate || request.date, request.endDate || request.startDate || request.date, start, end)) {
      const key = dateKey(date);
      if (!eligibleKeys.has(key)) continue;
      const current = wfhByDay.get(key) || [];
      current.push(request._id);
      wfhByDay.set(key, current);
    }
  }

  const counters = {
    presentDays: 0,
    fullPresentDays: 0,
    halfDayDays: 0,
    workFromHomeDays: 0,
    trackedWfhDays: 0,
    untrackedWfhDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    holidayDays: 0,
    weeklyOffDays: 0,
    unnoticedAbsenceDays: 0,
    payableDays: 0,
  };

  const days = eligibleDates.map((date) => {
    const key = dateKey(date);
    const attendance = attendanceByDay.get(key) || null;
    const attendanceStatus = attendanceStatusForDay(attendance, policy);
    const leave = leaveByDay.get(key) || { paid: 0, unpaid: 0, leaveIds: [] };
    const hasWfh = wfhByDay.has(key) || attendanceStatus === 'work_from_home';
    const trackedWfh = hasWfh && Boolean(attendance?.checkIn || attendance?.workDuration);
    let status = 'unnoticed_absence';
    let payable = 0;
    let source = 'attendance';

    if (hasWfh) {
      status = 'work_from_home';
      source = 'wfh';
      payable = policy.wfhRequiresCheckIn && !trackedWfh ? policy.untrackedWfhPayableDays : policy.wfhPayableDays;
      counters.workFromHomeDays += dailyScale;
      if (trackedWfh) counters.trackedWfhDays += dailyScale;
      else counters.untrackedWfhDays += dailyScale;
      if (policy.countApprovedWfhAsPresent) counters.presentDays += dailyScale;
    } else if (attendanceStatus === 'present') {
      status = 'present';
      payable = 1;
      counters.presentDays += dailyScale;
      counters.fullPresentDays += dailyScale;
    } else if (attendanceStatus === 'half_day' || attendanceStatus === 'short_day') {
      status = attendanceStatus === 'short_day' ? 'short_day' : 'half_day';
      payable = policy.deductHalfDay ? policy.halfDayPayableDays : 1;
      counters.presentDays += amount(policy.halfDayPayableDays * dailyScale);
      counters.halfDayDays += dailyScale;
    } else if (attendanceStatus === 'absent') {
      status = 'absent';
      payable = policy.deductUnnoticedAbsence ? policy.unnoticedAbsencePayableDays : 1;
      counters.unnoticedAbsenceDays += dailyScale;
    } else if (leave.unpaid > 0) {
      status = leave.unpaid >= 1 ? 'unpaid_leave' : 'partial_unpaid_leave';
      source = 'leave';
      payable = policy.deductUnpaidLeave ? (1 - leave.unpaid + leave.unpaid * policy.unpaidLeavePayableDays) : 1;
      counters.unpaidLeaveDays += amount(leave.unpaid * dailyScale);
    } else if (leave.paid > 0) {
      status = leave.paid >= 1 ? 'paid_leave' : 'partial_paid_leave';
      source = 'leave';
      payable = 1 - leave.paid + leave.paid * policy.paidLeavePayableDays;
      counters.paidLeaveDays += amount(leave.paid * dailyScale);
    } else if (rawHolidayKeys.has(key) && policy.holidaysPaid) {
      status = 'holiday';
      source = 'holiday';
      payable = 1;
      counters.holidayDays += dailyScale;
    } else {
      payable = policy.deductUnnoticedAbsence ? policy.unnoticedAbsencePayableDays : 1;
      counters.unnoticedAbsenceDays += dailyScale;
    }

    const scaledPayable = amount(clamp(payable, 0, 1) * dailyScale);
    counters.payableDays += scaledPayable;

    return {
      date: key,
      status,
      source,
      payableDays: scaledPayable,
      lossOfPayDays: amount(Math.max(0, dailyScale - scaledPayable)),
      attendanceId: attendance?._id || null,
      leaveIds: leave.leaveIds,
      wfhRequestIds: wfhByDay.get(key) || [],
      checkIn: attendance?.checkIn || null,
      checkOut: attendance?.checkOut || null,
      workDuration: attendance?.workDuration || 0,
      isLate: Boolean(attendance?.isLate),
      lateByMinutes: attendance?.lateByMinutes || 0,
    };
  });

  const eligibleDays = amount(eligibleDates.length * dailyScale);
  const leaveOnlyUnpaidLoss = policy.deductUnpaidLeave ? counters.unpaidLeaveDays : 0;
  const payableDays = policy.payrollImpact === 'none'
    ? eligibleDays
    : policy.payrollImpact === 'leave_only'
      ? clamp(amount(eligibleDays - leaveOnlyUnpaidLoss), 0, eligibleDays)
      : clamp(amount(counters.payableDays), 0, eligibleDays);
  const lossOfPayDays = amount(Math.max(0, eligibleDays - payableDays));
  const allDates = datesBetween(start, end);
  const weeklyOffDays = amount(allDates.filter((date) => !scheduledKeys.has(dateKey(date)) && !rawHolidayKeys.has(dateKey(date))).length * dailyScale);
  const holidayDays = amount(allDates.filter((date) => rawHolidayKeys.has(dateKey(date))).length * dailyScale);

  return {
    calendarDays: daysInMonth,
    scheduledDays: amount(configuredDays),
    eligibleDays,
    presentDays: amount(counters.presentDays),
    fullPresentDays: amount(counters.fullPresentDays),
    halfDayDays: amount(counters.halfDayDays),
    workFromHomeDays: amount(counters.workFromHomeDays),
    trackedWfhDays: amount(counters.trackedWfhDays),
    untrackedWfhDays: amount(counters.untrackedWfhDays),
    paidLeaveDays: amount(counters.paidLeaveDays),
    unpaidLeaveDays: amount(counters.unpaidLeaveDays),
    holidayDays,
    weeklyOffDays,
    unnoticedAbsenceDays: amount(counters.unnoticedAbsenceDays),
    lossOfPayDays,
    deductionDays: lossOfPayDays,
    payableDays,
    policyPayableDays: amount(counters.payableDays),
    prorationApplied: policy.payrollImpact !== 'none' && (settings.attendanceProration || payableDays !== eligibleDays || eligibleDays !== configuredDays),
    payrollImpact: policy.payrollImpact,
    policy,
    days,
  };
}

module.exports = {
  PERIOD_PATTERN,
  buildAttendanceSummary,
  dateKey,
  datesBetween,
  defaultAttendancePolicy,
  normalizeAttendancePolicy,
  normalizeHolidays,
  normalizeLeaveTypes,
  periodRange,
};
