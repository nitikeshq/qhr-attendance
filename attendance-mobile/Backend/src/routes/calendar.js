'use strict';

const express = require('express');

const { authRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const { permissionRequired } = require('../utils/permissions');
const { newId, nowIso } = require('../utils/records');
const { notifyCompany } = require('../utils/notifications');

const router = express.Router();

router.use(authRequired);

const EVENT_KINDS = ['company', 'meeting', 'training', 'deadline', 'celebration', 'other'];
const MAX_RANGE_DAYS = 400;

function dateKey(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function isIsoDate(value) {
  const key = dateKey(value);
  if (!key) return false;
  const parsed = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key;
}

function addDays(key, count) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
}

function calendarSettings(company) {
  const source = company?.settings?.calendar || {};
  return {
    showBirthdays: source.showBirthdays !== false,
    showAnniversaries: source.showAnniversaries !== false,
    showLeave: source.showLeave === true,
  };
}

function ensureCalendar(company) {
  company.calendarEvents ||= [];
  company.holidays ||= [];
  company.settings ||= {};
  company.settings.calendar ||= { showBirthdays: true, showAnniversaries: true, showLeave: false };
  return company;
}

/** Stable id for holidays, which are stored as a plain date/name array. */
function holidayId(holiday) {
  return holiday._id || `hol_${dateKey(holiday.date)}`;
}

function employeeLabel(employee) {
  return employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeId || 'Employee';
}

/**
 * Projects a recurring month/day anniversary (birthday or work anniversary) onto
 * every occurrence inside the requested window. Feb 29 falls back to Feb 28 in
 * non-leap years so the event is never silently dropped.
 */
function recurringOccurrences(sourceDate, from, to) {
  const key = dateKey(sourceDate);
  if (!key) return [];
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  if (!month || !day) return [];

  const occurrences = [];
  const firstYear = Number(from.slice(0, 4));
  const lastYear = Number(to.slice(0, 4));
  for (let year = firstYear; year <= lastYear; year += 1) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const safeDay = Math.min(day, daysInMonth);
    const occurrence = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
    if (occurrence >= from && occurrence <= to) occurrences.push(occurrence);
  }
  return occurrences;
}

function ordinal(count) {
  const suffix = count % 100 >= 11 && count % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][count % 10] || 'th';
  return `${count}${suffix}`;
}

/**
 * Builds the unified feed: company holidays, custom events, birthdays and work
 * anniversaries. Birthdays honour both the company setting and each employee's
 * own opt-out, so nobody is published without consent.
 */
function buildFeed(data, company, viewer, from, to) {
  const settings = calendarSettings(company);
  const events = [];

  for (const holiday of company.holidays || []) {
    const date = dateKey(holiday.date);
    if (!date || date < from || date > to) continue;
    events.push({
      _id: holidayId(holiday),
      kind: 'holiday',
      date,
      title: holiday.name || 'Holiday',
      subtitle: holiday.paid === false ? 'Unpaid holiday' : 'Paid holiday',
      paid: holiday.paid !== false,
      editable: true,
    });
  }

  for (const event of company.calendarEvents || []) {
    const start = dateKey(event.startDate);
    if (!start) continue;
    const end = dateKey(event.endDate) || start;
    // Multi-day events surface on each day they cover inside the window.
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      if (cursor < from || cursor > to) continue;
      events.push({
        _id: event._id,
        kind: 'event',
        eventKind: event.kind || 'company',
        date: cursor,
        title: event.title,
        subtitle: event.location || event.description || '',
        description: event.description || '',
        // Returned in its own field as well, so an editor can prefill it instead
        // of guessing which half of `subtitle` was the location.
        location: event.location || '',
        allDay: event.allDay !== false,
        startTime: event.startTime || '',
        endTime: event.endTime || '',
        spansMultipleDays: end !== start,
        startDate: start,
        endDate: end,
        editable: true,
      });
    }
  }

  const employees = data.employees.filter((item) => item.companyId === company._id && item.status !== 'inactive');

  if (settings.showBirthdays) {
    for (const employee of employees) {
      if (employee.hideBirthday === true) continue;
      const source = dateKey(employee.dateOfBirth);
      if (!source) continue;
      for (const date of recurringOccurrences(source, from, to)) {
        events.push({
          _id: `bday_${employee._id}_${date}`,
          kind: 'birthday',
          date,
          title: `${employeeLabel(employee)}'s birthday`,
          subtitle: [employee.designation, employee.department].filter(Boolean).join(' · '),
          employeeId: employee._id,
          isSelf: employee._id === viewer?._id,
          editable: false,
        });
      }
    }
  }

  // Company anniversary, derived from the founding date on the company profile.
  const foundedOn = dateKey(company.profile?.foundedOn);
  if (foundedOn) {
    for (const date of recurringOccurrences(foundedOn, from, to)) {
      const years = Number(date.slice(0, 4)) - Number(foundedOn.slice(0, 4));
      if (years < 1) continue;
      events.push({
        _id: `company_anniv_${date}`,
        kind: 'company_anniversary',
        date,
        title: `${company.name} — ${ordinal(years)} anniversary`,
        subtitle: `Founded ${foundedOn}`,
        years,
        editable: false,
      });
    }
  }

  if (settings.showAnniversaries) {
    for (const employee of employees) {
      const source = dateKey(employee.dateOfJoining);
      if (!source) continue;
      for (const date of recurringOccurrences(source, from, to)) {
        const years = Number(date.slice(0, 4)) - Number(source.slice(0, 4));
        if (years < 1) continue;
        events.push({
          _id: `anniv_${employee._id}_${date}`,
          kind: 'anniversary',
          date,
          title: `${employeeLabel(employee)} — ${ordinal(years)} work anniversary`,
          subtitle: [employee.designation, employee.department].filter(Boolean).join(' · '),
          employeeId: employee._id,
          years,
          isSelf: employee._id === viewer?._id,
          editable: false,
        });
      }
    }
  }

  const order = { holiday: 0, company_anniversary: 1, event: 2, birthday: 3, anniversary: 4 };
  return events.sort((left, right) => (
    left.date.localeCompare(right.date)
    || (order[left.kind] ?? 9) - (order[right.kind] ?? 9)
    || String(left.title).localeCompare(String(right.title))
  ));
}

function readRange(query) {
  const today = new Date().toISOString().slice(0, 10);
  const from = isIsoDate(query.from) ? dateKey(query.from) : `${today.slice(0, 4)}-01-01`;
  const to = isIsoDate(query.to) ? dateKey(query.to) : `${today.slice(0, 4)}-12-31`;
  if (to < from) return { error: 'The end of the range cannot be before the start' };
  if (daysBetween(from, to) > MAX_RANGE_DAYS) return { error: `Request at most ${MAX_RANGE_DAYS} days at a time` };
  return { from, to };
}

/** Everyone in the company can read the calendar; it is shared information. */
router.get('/', async (req, res, next) => {
  try {
    const range = readRange(req.query || {});
    if (range.error) return fail(res, 400, range.error);

    const data = await req.app.locals.store.read();
    const company = data.companies.find((item) => item._id === req.company?._id);
    if (!company) return fail(res, 404, 'Company not found');

    const events = buildFeed(data, company, req.user, range.from, range.to);
    const today = new Date().toISOString().slice(0, 10);
    return ok(res, {
      from: range.from,
      to: range.to,
      settings: calendarSettings(company),
      counts: {
        holiday: events.filter((item) => item.kind === 'holiday').length,
        event: events.filter((item) => item.kind === 'event').length,
        birthday: events.filter((item) => item.kind === 'birthday').length,
        anniversary: events.filter((item) => item.kind === 'anniversary').length,
        company_anniversary: events.filter((item) => item.kind === 'company_anniversary').length,
      },
      company: {
        name: company.name,
        foundedOn: dateKey(company.profile?.foundedOn),
      },
      upcoming: events.filter((item) => item.date >= today).slice(0, 12),
      events,
    });
  } catch (error) {
    return next(error);
  }
});

async function withCompany(req, mutator) {
  return req.app.locals.store.update((data) => {
    const company = data.companies.find((item) => item._id === req.company?._id);
    if (!company) return { error: 'Company not found', status: 404 };
    ensureCalendar(company);
    const result = mutator(data, company);
    if (!result?.error) company.updatedAt = nowIso();
    return result;
  });
}

function eventPayload(body, existing = {}) {
  const title = Object.prototype.hasOwnProperty.call(body, 'title')
    ? String(body.title || '').trim()
    : existing.title;
  if (!title) return { error: 'Event title is required' };

  const startDate = Object.prototype.hasOwnProperty.call(body, 'startDate')
    ? dateKey(body.startDate)
    : existing.startDate;
  if (!isIsoDate(startDate)) return { error: 'A valid start date (YYYY-MM-DD) is required' };

  let endDate = Object.prototype.hasOwnProperty.call(body, 'endDate')
    ? (body.endDate ? dateKey(body.endDate) : startDate)
    : (existing.endDate || startDate);
  if (!isIsoDate(endDate)) endDate = startDate;
  if (endDate < startDate) return { error: 'The end date cannot be before the start date' };
  if (daysBetween(startDate, endDate) > 90) return { error: 'An event can span at most 90 days' };

  const kind = Object.prototype.hasOwnProperty.call(body, 'kind')
    ? String(body.kind || 'company')
    : (existing.kind || 'company');
  if (!EVENT_KINDS.includes(kind)) return { error: `Event type must be one of ${EVENT_KINDS.join(', ')}` };

  return {
    payload: {
      title,
      startDate,
      endDate,
      kind,
      description: Object.prototype.hasOwnProperty.call(body, 'description') ? String(body.description || '').trim() : (existing.description || ''),
      location: Object.prototype.hasOwnProperty.call(body, 'location') ? String(body.location || '').trim() : (existing.location || ''),
      allDay: Object.prototype.hasOwnProperty.call(body, 'allDay') ? body.allDay !== false : (existing.allDay !== false),
      startTime: Object.prototype.hasOwnProperty.call(body, 'startTime') ? String(body.startTime || '').trim() : (existing.startTime || ''),
      endTime: Object.prototype.hasOwnProperty.call(body, 'endTime') ? String(body.endTime || '').trim() : (existing.endTime || ''),
    },
  };
}

router.post('/events', permissionRequired('settings.manage'), async (req, res, next) => {
  try {
    const parsed = eventPayload(req.body || {});
    if (parsed.error) return fail(res, 400, parsed.error);

    const result = await withCompany(req, (data, company) => {
      const event = {
        _id: newId('cevent'),
        ...parsed.payload,
        createdBy: req.user._id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      company.calendarEvents.push(event);
      notifyCompany(data, company._id, {
        kind: 'event_announced',
        title: event.title,
        body: [
          event.startDate === event.endDate ? event.startDate : `${event.startDate} to ${event.endDate}`,
          event.location,
        ].filter(Boolean).join(' · '),
        severity: 'info',
        link: { page: 'calendar' },
        dedupeKey: `event_announced:${event._id}`,
        actorId: req.user._id,
      });
      return { event };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return created(res, { event: result.event, message: `${result.event.title} added to the calendar` });
  } catch (error) {
    return next(error);
  }
});

router.patch('/events/:id', permissionRequired('settings.manage'), async (req, res, next) => {
  try {
    const result = await withCompany(req, (data, company) => {
      const event = company.calendarEvents.find((item) => item._id === req.params.id);
      if (!event) return { error: 'Calendar event not found', status: 404 };
      const parsed = eventPayload(req.body || {}, event);
      if (parsed.error) return { error: parsed.error };
      Object.assign(event, parsed.payload, { updatedAt: nowIso() });
      return { event };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, { event: result.event, message: 'Calendar event updated' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/events/:id', permissionRequired('settings.manage'), async (req, res, next) => {
  try {
    const result = await withCompany(req, (data, company) => {
      const index = company.calendarEvents.findIndex((item) => item._id === req.params.id);
      if (index === -1) return { error: 'Calendar event not found', status: 404 };
      const [event] = company.calendarEvents.splice(index, 1);
      return { event };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, { message: `${result.event.title} removed from the calendar` });
  } catch (error) {
    return next(error);
  }
});

/* ----------------------------- holiday calendar ---------------------------- */
/* Holidays already drive attendance and payroll, so they are edited here as a
   first-class list rather than by replacing the whole array. */

router.post('/holidays', permissionRequired('settings.manage'), async (req, res, next) => {
  try {
    const date = dateKey(req.body?.date);
    const name = String(req.body?.name || '').trim();
    if (!isIsoDate(date)) return fail(res, 400, 'A valid holiday date (YYYY-MM-DD) is required');
    if (!name) return fail(res, 400, 'Holiday name is required');

    const result = await withCompany(req, (data, company) => {
      if (company.holidays.some((item) => dateKey(item.date) === date)) {
        return { error: 'A holiday is already recorded on that date', status: 409 };
      }
      const holiday = { _id: `hol_${date}`, date, name, paid: req.body?.paid !== false };
      company.holidays.push(holiday);
      company.holidays.sort((left, right) => dateKey(left.date).localeCompare(dateKey(right.date)));
      // A holiday added later has to reach everyone, which is the whole point of
      // being able to add one after setup.
      notifyCompany(data, company._id, {
        kind: 'holiday_announced',
        title: `New holiday: ${holiday.name}`,
        body: `${date} has been added to the company holiday calendar.`,
        severity: 'info',
        link: { page: 'calendar' },
        dedupeKey: `holiday_announced:${date}:${holiday.name}`,
        actorId: req.user._id,
      });
      return { holiday };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return created(res, { holiday: result.holiday, message: `${result.holiday.name} added to the holiday calendar` });
  } catch (error) {
    return next(error);
  }
});

router.patch('/holidays/:id', permissionRequired('settings.manage'), async (req, res, next) => {
  try {
    const result = await withCompany(req, (data, company) => {
      const holiday = company.holidays.find((item) => holidayId(item) === req.params.id);
      if (!holiday) return { error: 'Holiday not found', status: 404 };
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'date')) {
        const date = dateKey(req.body.date);
        if (!isIsoDate(date)) return { error: 'A valid holiday date (YYYY-MM-DD) is required' };
        if (company.holidays.some((item) => dateKey(item.date) === date && holidayId(item) !== req.params.id)) {
          return { error: 'A holiday is already recorded on that date', status: 409 };
        }
        holiday.date = date;
        holiday._id = `hol_${date}`;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
        const name = String(req.body.name || '').trim();
        if (!name) return { error: 'Holiday name is required' };
        holiday.name = name;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'paid')) holiday.paid = req.body.paid !== false;
      company.holidays.sort((left, right) => dateKey(left.date).localeCompare(dateKey(right.date)));
      return { holiday };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, { holiday: result.holiday, message: 'Holiday updated' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/holidays/:id', permissionRequired('settings.manage'), async (req, res, next) => {
  try {
    const result = await withCompany(req, (data, company) => {
      const index = company.holidays.findIndex((item) => holidayId(item) === req.params.id);
      if (index === -1) return { error: 'Holiday not found', status: 404 };
      const [holiday] = company.holidays.splice(index, 1);
      return { holiday };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, { message: `${result.holiday.name} removed from the holiday calendar` });
  } catch (error) {
    return next(error);
  }
});

router.patch('/settings', permissionRequired('settings.manage'), async (req, res, next) => {
  try {
    const result = await withCompany(req, (data, company) => {
      const body = req.body || {};
      const settings = company.settings.calendar;
      if (Object.prototype.hasOwnProperty.call(body, 'showBirthdays')) settings.showBirthdays = body.showBirthdays !== false;
      if (Object.prototype.hasOwnProperty.call(body, 'showAnniversaries')) settings.showAnniversaries = body.showAnniversaries !== false;
      if (Object.prototype.hasOwnProperty.call(body, 'showLeave')) settings.showLeave = body.showLeave === true;
      return { settings: calendarSettings(company) };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, { settings: result.settings, message: 'Calendar settings saved' });
  } catch (error) {
    return next(error);
  }
});

/** Lets an employee keep their own birthday off the shared calendar. */
router.patch('/my-visibility', async (req, res, next) => {
  try {
    const hide = req.body?.hideBirthday === true;
    const result = await req.app.locals.store.update((data) => {
      const employee = data.employees.find((item) => item._id === req.user._id);
      if (!employee) return { error: 'Employee not found', status: 404 };
      employee.hideBirthday = hide;
      employee.updatedAt = nowIso();
      return { hideBirthday: employee.hideBirthday };
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, {
      hideBirthday: result.hideBirthday,
      message: hide ? 'Your birthday is hidden from the company calendar' : 'Your birthday will appear on the company calendar',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
