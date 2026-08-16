'use strict';

/**
 * What an employee is allowed to see about their own record.
 *
 * `buildAttendanceSummary` already computes every counter payroll relies on, but
 * it was only ever reachable through manager and HR routes. The employee-facing
 * endpoints returned a local helper whose `absentDays` was the literal `0`, so a
 * person could not see their own absences, leave usage or loss of pay — the exact
 * figures that decide their salary.
 *
 * These helpers reuse the payroll computation unchanged, so what an employee sees
 * and what payroll pays can never disagree.
 */

const { buildAttendanceSummary, PERIOD_PATTERN } = require('./attendancePolicy');

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

/** The counters worth showing a person, without the day-by-day detail. */
function headlineCounts(summary) {
  return {
    scheduledDays: amount(summary.scheduledDays),
    eligibleDays: amount(summary.eligibleDays),
    presentDays: amount(summary.presentDays),
    fullPresentDays: amount(summary.fullPresentDays),
    halfDays: amount(summary.halfDayDays),
    workFromHomeDays: amount(summary.workFromHomeDays),
    paidLeaveDays: amount(summary.paidLeaveDays),
    unpaidLeaveDays: amount(summary.unpaidLeaveDays),
    holidayDays: amount(summary.holidayDays),
    weeklyOffDays: amount(summary.weeklyOffDays),
    absentDays: amount(summary.unnoticedAbsenceDays),
    lossOfPayDays: amount(summary.lossOfPayDays),
    payableDays: amount(summary.payableDays),
  };
}

/** Late arrivals are a coaching signal, so they are counted separately. */
function lateCounts(summary) {
  const lateDays = (summary.days || []).filter((day) => day.isLate);
  return {
    lateDays: lateDays.length,
    lateMinutes: lateDays.reduce((total, day) => total + Number(day.lateByMinutes || 0), 0),
  };
}

function monthSummary(data, company, employee, period) {
  if (!PERIOD_PATTERN.test(String(period || ''))) throw new Error('Period must use YYYY-MM format');
  const summary = buildAttendanceSummary(data, company, employee, period, company.payrollSettings || {});
  return {
    period,
    ...headlineCounts(summary),
    ...lateCounts(summary),
    payrollImpact: summary.payrollImpact,
    days: summary.days,
  };
}

/**
 * Twelve months of the same computation, plus a year total.
 *
 * Months after today are still returned so a chart has a stable twelve-column
 * shape, but they are marked `future` so the app can render them muted instead of
 * implying somebody was absent all of next December.
 */
function yearSummary(data, company, employee, year) {
  const parsed = Number(year);
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2200) throw new Error('Year must be a four-digit year');
  const todayKey = new Date().toISOString().slice(0, 7);

  const months = [];
  for (let month = 1; month <= 12; month += 1) {
    const period = `${parsed}-${String(month).padStart(2, '0')}`;
    const summary = buildAttendanceSummary(data, company, employee, period, company.payrollSettings || {});
    months.push({
      period,
      month,
      label: new Date(Date.UTC(parsed, month - 1, 1)).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
      future: period > todayKey,
      ...headlineCounts(summary),
      ...lateCounts(summary),
    });
  }

  const countedKeys = [
    'scheduledDays', 'eligibleDays', 'presentDays', 'fullPresentDays', 'halfDays', 'workFromHomeDays',
    'paidLeaveDays', 'unpaidLeaveDays', 'holidayDays', 'weeklyOffDays', 'absentDays', 'lossOfPayDays',
    'payableDays', 'lateDays', 'lateMinutes',
  ];
  const totals = {};
  for (const key of countedKeys) {
    totals[key] = amount(months.filter((item) => !item.future).reduce((sum, item) => sum + Number(item[key] || 0), 0));
  }

  return { year: parsed, months, totals };
}

/** Leave taken in a year, grouped by type, from approved leave only. */
function leaveUsageForYear(data, company, employee, year, leaveTypes = []) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const usage = new Map(leaveTypes.map((type) => [type.code, {
    code: type.code,
    name: type.name,
    paid: type.paid !== false,
    allowance: amount(type.annualAllowance),
    taken: 0,
    color: type.color || null,
  }]));

  for (const leave of data.leaves || []) {
    if (leave.employeeId !== employee._id || leave.status !== 'approved') continue;
    const start = String(leave.startDate || '').slice(0, 10);
    if (!start || start < from || start > to) continue;
    const code = String(leave.leaveType || '').trim().toLowerCase();
    const existing = usage.get(code) || {
      code, name: code || 'Leave', paid: true, allowance: 0, taken: 0, color: null,
    };
    existing.taken = amount(existing.taken + Number(leave.days || 0));
    usage.set(code, existing);
  }

  const rows = [...usage.values()].map((row) => ({
    ...row,
    remaining: amount(Math.max(0, row.allowance - row.taken)),
    overAllowance: amount(Math.max(0, row.taken - row.allowance)),
  }));

  return {
    year: Number(year),
    types: rows,
    totalTaken: amount(rows.reduce((sum, row) => sum + row.taken, 0)),
    totalAllowance: amount(rows.reduce((sum, row) => sum + row.allowance, 0)),
  };
}

module.exports = {
  headlineCounts,
  leaveUsageForYear,
  monthSummary,
  yearSummary,
};
