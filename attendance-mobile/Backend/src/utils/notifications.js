'use strict';

const { newId, nowIso } = require('./records');

/**
 * Notification store.
 *
 * Notifications are persisted per recipient rather than derived on read, so a
 * read state exists, nothing is lost when the underlying record changes, and the
 * same event can address different people with different wording.
 *
 * Every notification carries a `dedupeKey`. Recurring items (a birthday, a
 * holiday reminder) are generated lazily when someone opens their inbox, and the
 * key is what stops that generation from producing duplicates.
 */

const KINDS = [
  'birthday_self',
  'birthday_team',
  'anniversary_self',
  'anniversary_team',
  'company_anniversary',
  'holiday_announced',
  'holiday_reminder',
  'event_announced',
  'leave_decision',
  'leave_request',
  'wfh_decision',
  'reimbursement_decision',
  'payslip_published',
  'asset_assigned',
  'onboarding_reminder',
  'announcement',
];

const SEVERITIES = ['info', 'success', 'warning', 'critical'];
const MAX_PER_EMPLOYEE = 200;

function ensureNotificationCollections(data) {
  data.notifications ||= [];
  return data;
}

function dateKey(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(key, count) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function activeEmployees(data, companyId) {
  return data.employees.filter((item) => item.companyId === companyId && item.status !== 'inactive');
}

function employeeLabel(employee) {
  return employee.name
    || `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
    || employee.employeeId
    || 'Employee';
}

function ordinal(count) {
  const suffix = count % 100 >= 11 && count % 100 <= 13
    ? 'th'
    : ['th', 'st', 'nd', 'rd'][count % 10] || 'th';
  return `${count}${suffix}`;
}

/**
 * Inserts a notification unless one with the same dedupeKey already exists for
 * that recipient. Returns the record, or null when it was a duplicate.
 */
function pushNotification(data, {
  companyId,
  employeeId,
  kind,
  title,
  body = '',
  severity = 'info',
  link = null,
  dedupeKey = null,
  actorId = null,
  meta = null,
}) {
  ensureNotificationCollections(data);
  if (!companyId || !employeeId || !title) return null;
  if (!KINDS.includes(kind)) return null;

  const key = dedupeKey || `${kind}:${employeeId}:${title}`;
  if (data.notifications.some((item) => item.employeeId === employeeId && item.dedupeKey === key)) {
    return null;
  }

  const notification = {
    _id: newId('notif'),
    companyId,
    employeeId,
    kind,
    title: String(title),
    body: String(body || ''),
    severity: SEVERITIES.includes(severity) ? severity : 'info',
    link: link && link.page ? { page: String(link.page), id: link.id ? String(link.id) : null } : null,
    dedupeKey: key,
    actorId: actorId || null,
    meta: meta || null,
    readAt: null,
    createdAt: nowIso(),
  };
  data.notifications.push(notification);
  return notification;
}

/** Fan-out helper: same message to many recipients, each deduped separately. */
function notifyMany(data, employeeIds, payload) {
  const created = [];
  for (const employeeId of new Set(employeeIds.filter(Boolean))) {
    const notification = pushNotification(data, {
      ...payload,
      employeeId,
      dedupeKey: payload.dedupeKey ? `${payload.dedupeKey}:${employeeId}` : null,
    });
    if (notification) created.push(notification);
  }
  return created;
}

/** Announces something to everyone active in the company. */
function notifyCompany(data, companyId, payload, { exclude = [] } = {}) {
  const skip = new Set(exclude.filter(Boolean));
  const recipients = activeEmployees(data, companyId)
    .filter((item) => item.role !== 'super_admin' && !skip.has(item._id))
    .map((item) => item._id);
  return notifyMany(data, recipients, { ...payload, companyId });
}

/** Trims each employee's inbox so the JSON store cannot grow without bound. */
function pruneNotifications(data, employeeId) {
  ensureNotificationCollections(data);
  const mine = data.notifications
    .filter((item) => item.employeeId === employeeId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  if (mine.length <= MAX_PER_EMPLOYEE) return 0;
  const doomed = new Set(mine.slice(MAX_PER_EMPLOYEE).map((item) => item._id));
  data.notifications = data.notifications.filter((item) => !doomed.has(item._id));
  return doomed.size;
}

/**
 * Recurring occurrence of a month/day inside a window. 29 February falls back to
 * 28 February in non-leap years so the occasion is never skipped.
 */
function occurrenceInYear(sourceDate, year) {
  const key = dateKey(sourceDate);
  if (!key) return '';
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  if (!month || !day) return '';
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(day, daysInMonth);
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

/**
 * Generates the day's calendar notifications for a company: birthday wishes,
 * work anniversaries, the company anniversary, and a reminder for a holiday that
 * lands today or tomorrow.
 *
 * Idempotent. Safe to call on every inbox read — the dedupe keys include the
 * date, so a given greeting is created at most once per person per year.
 */
function generateCalendarNotifications(data, company, today = todayKey()) {
  ensureNotificationCollections(data);
  if (!company || company.status !== 'active') return [];

  const created = [];
  const year = Number(today.slice(0, 4));
  const calendar = company.settings?.calendar || {};
  const showBirthdays = calendar.showBirthdays !== false;
  const showAnniversaries = calendar.showAnniversaries !== false;
  const people = activeEmployees(data, company._id).filter((item) => item.role !== 'super_admin');

  for (const employee of people) {
    const name = employeeLabel(employee);

    if (showBirthdays && occurrenceInYear(employee.dateOfBirth, year) === today) {
      // The person always gets their own wishes, even if they hid the birthday
      // from the shared calendar — hiding is about the company view, not about
      // refusing to be greeted.
      created.push(...[pushNotification(data, {
        companyId: company._id,
        employeeId: employee._id,
        kind: 'birthday_self',
        title: `Happy birthday, ${employee.firstName || name}!`,
        body: `Everyone at ${company.name} wishes you a wonderful year ahead.`,
        severity: 'success',
        link: { page: 'calendar' },
        dedupeKey: `birthday_self:${employee._id}:${today}`,
      })].filter(Boolean));

      if (employee.hideBirthday !== true) {
        created.push(...notifyCompany(data, company._id, {
          kind: 'birthday_team',
          title: `${name}'s birthday is today`,
          body: [employee.designation, employee.department].filter(Boolean).join(' · ') || 'Send them your wishes.',
          severity: 'info',
          link: { page: 'calendar' },
          dedupeKey: `birthday_team:${employee._id}:${today}`,
        }, { exclude: [employee._id] }));
      }
    }

    if (showAnniversaries) {
      const joined = dateKey(employee.dateOfJoining);
      if (joined && occurrenceInYear(joined, year) === today) {
        const years = year - Number(joined.slice(0, 4));
        if (years >= 1) {
          created.push(...[pushNotification(data, {
            companyId: company._id,
            employeeId: employee._id,
            kind: 'anniversary_self',
            title: `Happy ${ordinal(years)} work anniversary!`,
            body: `Thank you for ${years} year${years === 1 ? '' : 's'} with ${company.name}.`,
            severity: 'success',
            link: { page: 'calendar' },
            dedupeKey: `anniversary_self:${employee._id}:${today}`,
          })].filter(Boolean));

          created.push(...notifyCompany(data, company._id, {
            kind: 'anniversary_team',
            title: `${name} completes ${years} year${years === 1 ? '' : 's'} today`,
            body: [employee.designation, employee.department].filter(Boolean).join(' · ') || 'Congratulate them.',
            severity: 'info',
            link: { page: 'calendar' },
            dedupeKey: `anniversary_team:${employee._id}:${today}`,
          }, { exclude: [employee._id] }));
        }
      }
    }
  }

  // Company anniversary, from the founding date on the company profile.
  const founded = dateKey(company.profile?.foundedOn);
  if (founded && occurrenceInYear(founded, year) === today) {
    const years = year - Number(founded.slice(0, 4));
    if (years >= 1) {
      created.push(...notifyCompany(data, company._id, {
        kind: 'company_anniversary',
        title: `${company.name} turns ${years} today`,
        body: `Founded on ${founded}. ${ordinal(years)} anniversary.`,
        severity: 'success',
        link: { page: 'calendar' },
        dedupeKey: `company_anniversary:${company._id}:${today}`,
      }));
    }
  }

  // Holiday landing today or tomorrow.
  const tomorrow = addDays(today, 1);
  for (const holiday of company.holidays || []) {
    const date = dateKey(holiday.date);
    if (date !== today && date !== tomorrow) continue;
    created.push(...notifyCompany(data, company._id, {
      kind: 'holiday_reminder',
      title: date === today ? `Today is a holiday: ${holiday.name}` : `Tomorrow is a holiday: ${holiday.name}`,
      body: holiday.paid === false ? 'Recorded as an unpaid holiday.' : 'Recorded as a paid holiday.',
      severity: 'info',
      link: { page: 'calendar' },
      dedupeKey: `holiday_reminder:${date}:${holiday.name}`,
    }));
  }

  return created.filter(Boolean);
}

function unreadCount(data, employeeId) {
  ensureNotificationCollections(data);
  return data.notifications.filter((item) => item.employeeId === employeeId && !item.readAt).length;
}

function listNotifications(data, employeeId, { limit = 50, unreadOnly = false } = {}) {
  ensureNotificationCollections(data);
  return data.notifications
    .filter((item) => item.employeeId === employeeId && (!unreadOnly || !item.readAt))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 50)));
}

module.exports = {
  KINDS,
  SEVERITIES,
  ensureNotificationCollections,
  generateCalendarNotifications,
  listNotifications,
  notifyCompany,
  notifyMany,
  occurrenceInYear,
  pruneNotifications,
  pushNotification,
  unreadCount,
};
