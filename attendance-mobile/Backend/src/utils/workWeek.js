'use strict';

/**
 * The company work week.
 *
 * Weekly offs used to be a flat list of weekday numbers, and that list was only
 * consulted when `workingDayMethod` was `working_days`. Under the other two
 * methods every date counted as a working day, so a Sunday with no check-in fell
 * through to "unnoticed absence". With absence deductions switched on that
 * silently removed about eight days of pay per person per month.
 *
 * A weekday can now be a full day, a half day, or off, and Saturdays can follow
 * an nth-of-month pattern, which is how most Indian companies actually work.
 */

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_KINDS = ['full', 'half', 'off'];

/** Which occurrence of this weekday the date is: the 2nd Saturday returns 2. */
function weekdayOccurrence(date) {
  return Math.floor((date.getUTCDate() - 1) / 7) + 1;
}

function normalizeKind(value, fallback = 'full') {
  const kind = String(value || '').toLowerCase();
  return DAY_KINDS.includes(kind) ? kind : fallback;
}

/** Accepts 1, '1', [1,3] and returns a sorted, de-duplicated list of 1..5. */
function normalizeOccurrences(value) {
  const list = Array.isArray(value) ? value : [value];
  const cleaned = list
    .map((item) => Math.floor(Number(item)))
    .filter((item) => Number.isFinite(item) && item >= 1 && item <= 5);
  return [...new Set(cleaned)].sort((left, right) => left - right);
}

function normalizeWeekdayRule(value, fallback) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const pattern = String(value.pattern || '').toLowerCase();

    if (pattern === 'nth') {
      const off = normalizeOccurrences(value.off);
      // A pattern that never triggers is just its fallback, so it collapses.
      if (!off.length) return normalizeKind(value.otherwise, 'full');
      return { pattern: 'nth', off, otherwise: normalizeKind(value.otherwise, 'full') };
    }

    if (pattern === 'alternate') {
      // Alternating weeks: off on odd or even occurrences.
      const parity = value.parity === 'even' ? 'even' : 'odd';
      return { pattern: 'alternate', parity, otherwise: normalizeKind(value.otherwise, 'full') };
    }

    return normalizeKind(value.kind, fallback);
  }
  return normalizeKind(value, fallback);
}

/**
 * Builds a complete seven-day week. Falls back to the legacy `workingDays` list
 * so a tenant that never configured a work week keeps its current behaviour.
 */
function normalizeWorkWeek(input, legacyWorkingDays) {
  const source = input && typeof input === 'object' ? input : null;
  const legacy = Array.isArray(legacyWorkingDays) && legacyWorkingDays.length
    ? legacyWorkingDays.map(Number).filter((day) => day >= 0 && day <= 6)
    : null;

  const week = {};
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const fallback = legacy ? (legacy.includes(weekday) ? 'full' : 'off') : (weekday === 0 ? 'off' : 'full');
    const provided = source ? source[weekday] ?? source[String(weekday)] : undefined;
    week[weekday] = provided === undefined ? fallback : normalizeWeekdayRule(provided, fallback);
  }
  return week;
}

/** What this specific date is, once nth-weekday patterns are resolved. */
function classifyDate(workWeek, date) {
  const rule = workWeek?.[date.getUTCDay()];
  if (!rule) return 'full';
  if (typeof rule === 'string') return rule;

  if (rule.pattern === 'nth') {
    return rule.off.includes(weekdayOccurrence(date)) ? 'off' : rule.otherwise;
  }
  if (rule.pattern === 'alternate') {
    const occurrence = weekdayOccurrence(date);
    const isOdd = occurrence % 2 === 1;
    const off = rule.parity === 'odd' ? isOdd : !isOdd;
    return off ? 'off' : rule.otherwise;
  }
  return 'full';
}

/** The weekday numbers that are never a working day, for a quick summary. */
function alwaysOffWeekdays(workWeek) {
  return Object.keys(workWeek || {})
    .map(Number)
    .filter((weekday) => workWeek[weekday] === 'off');
}

/** Plain-English description of one weekday's rule, for the settings screen. */
function describeWeekday(workWeek, weekday) {
  const rule = workWeek?.[weekday];
  const label = WEEKDAY_LABELS[weekday];
  if (rule === 'off') return `${label}: weekly off`;
  if (rule === 'half') return `${label}: half day`;
  if (rule === 'full' || !rule) return `${label}: full day`;

  const ordinals = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' };
  if (rule.pattern === 'nth') {
    const which = rule.off.map((item) => ordinals[item] || `${item}th`).join(' and ');
    return `${label}: ${which} off, otherwise ${rule.otherwise === 'half' ? 'half day' : 'full day'}`;
  }
  if (rule.pattern === 'alternate') {
    return `${label}: alternate ${rule.parity} weeks off, otherwise ${rule.otherwise === 'half' ? 'half day' : 'full day'}`;
  }
  return `${label}: full day`;
}

/**
 * Day-by-day classification for a period, so a settings preview and the payroll
 * readiness check can describe the same month without recomputing it differently.
 */
function describePeriod(workWeek, dates, holidayKeys = new Set()) {
  let working = 0;
  let half = 0;
  let off = 0;
  let holidays = 0;
  const days = dates.map((date) => {
    const key = date.toISOString().slice(0, 10);
    if (holidayKeys.has(key)) {
      holidays += 1;
      return { date: key, kind: 'holiday' };
    }
    const kind = classifyDate(workWeek, date);
    if (kind === 'off') off += 1;
    else if (kind === 'half') { half += 1; working += 1; }
    else working += 1;
    return { date: key, kind };
  });
  return { days, workingDays: working, halfDays: half, weeklyOffDays: off, holidayDays: holidays };
}

/**
 * When salary is actually paid for a period.
 *
 * `paymentDay` was only ever a number, so a pay day landing on a Sunday or a
 * public holiday stayed there and the register promised money on a day no bank
 * transfer would be made. Standard practice is to bring it forward to the previous
 * working day, which is what this does. It never moves the date later, because
 * paying late is a worse failure than paying early.
 */
function paymentDateForPeriod(workWeek, period, paymentDay, holidayKeys = new Set()) {
  const [year, month] = String(period).split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const requestedDay = Math.min(Math.max(Math.floor(Number(paymentDay) || 1), 1), daysInMonth);
  const requested = new Date(Date.UTC(year, month - 1, requestedDay));

  let candidate = new Date(requested);
  // A whole month of weekly offs and holidays cannot exceed 31 steps.
  for (let step = 0; step < 31; step += 1) {
    const key = candidate.toISOString().slice(0, 10);
    const isClosed = holidayKeys.has(key) || classifyDate(workWeek, candidate) === 'off';
    if (!isClosed) {
      const shifted = candidate.getTime() !== requested.getTime();
      return {
        date: key,
        requestedDate: requested.toISOString().slice(0, 10),
        shifted,
        reason: shifted
          ? `Moved earlier to the previous working day; ${requested.toISOString().slice(0, 10)} is ${holidayKeys.has(requested.toISOString().slice(0, 10)) ? 'a holiday' : 'a weekly off'}.`
          : null,
      };
    }
    candidate = new Date(candidate.getTime() - 86400000);
  }
  return {
    date: requested.toISOString().slice(0, 10),
    requestedDate: requested.toISOString().slice(0, 10),
    shifted: false,
    reason: 'Every day in range is a weekly off or holiday, so the configured day stands.',
  };
}

module.exports = {
  DAY_KINDS,
  WEEKDAY_LABELS,
  alwaysOffWeekdays,
  classifyDate,
  describePeriod,
  describeWeekday,
  normalizeWorkWeek,
  paymentDateForPeriod,
  weekdayOccurrence,
};
