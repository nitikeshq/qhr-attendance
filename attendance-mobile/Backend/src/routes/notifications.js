'use strict';

const express = require('express');

const { authRequired } = require('../middleware/auth');
const { fail, ok } = require('../utils/responses');
const { nowIso } = require('../utils/records');
const {
  generateCalendarNotifications,
  listNotifications,
  pruneNotifications,
  unreadCount,
} = require('../utils/notifications');

const router = express.Router();

router.use(authRequired);

/**
 * Inbox. Recurring greetings and holiday reminders are generated here rather than
 * by a scheduler: there is no cron in this deployment, and the dedupe keys make
 * generation idempotent, so opening the inbox is a safe trigger.
 */
router.get('/', async (req, res, next) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1';
    const limit = Number(req.query.limit) || 50;

    const result = await req.app.locals.store.update((data) => {
      const company = data.companies.find((item) => item._id === req.company?._id);
      if (company) {
        generateCalendarNotifications(data, company);
        pruneNotifications(data, req.user._id);
      }
      return {
        notifications: listNotifications(data, req.user._id, { limit, unreadOnly }),
        unread: unreadCount(data, req.user._id),
      };
    });

    return ok(res, result);
  } catch (error) {
    return next(error);
  }
});

/** Cheap poll target for the bell badge. */
router.get('/unread-count', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    return ok(res, { unread: unreadCount(data, req.user._id) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const notification = (data.notifications || []).find((item) => item._id === req.params.id);
      // Scoped to the caller: one employee must not be able to read or dismiss
      // another person's notifications by guessing an id.
      if (!notification || notification.employeeId !== req.user._id) return { missing: true };
      notification.readAt ||= nowIso();
      return { notification, unread: unreadCount(data, req.user._id) };
    });
    if (result.missing) return fail(res, 404, 'Notification not found');
    return ok(res, { notification: result.notification, unread: result.unread });
  } catch (error) {
    return next(error);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      const now = nowIso();
      let marked = 0;
      for (const notification of data.notifications || []) {
        if (notification.employeeId !== req.user._id || notification.readAt) continue;
        notification.readAt = now;
        marked += 1;
      }
      return { marked };
    });
    return ok(res, { marked: result.marked, unread: 0, message: `${result.marked} notification(s) marked as read` });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
