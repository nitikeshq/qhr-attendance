'use strict';

/**
 * Outbound email.
 *
 * Until now the only transport in the product was inside the billing service, so
 * nothing user-facing could be delivered: a registration code, a one-time
 * password, or a payslip notice had no way to reach a person.
 *
 * Mail is queued into the data file rather than sent inline. A store mutation has
 * to stay fast and rollback-safe, and a network call inside one would either
 * block the queue or leave a half-applied write when it fails. `flushEmails`
 * drains the queue afterwards, so a delivery failure never loses the record of
 * what should have been sent.
 */

const { newId, nowIso } = require('../utils/records');

const MAX_ATTEMPTS = 5;

function emailConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
}

function ensureEmailCollections(data) {
  data.outboundEmails ||= [];
  return data;
}

/**
 * Records an email to be delivered. Returns the queued record so callers can log
 * or audit it. `dedupeKey` makes re-queuing the same message a no-op, which is
 * what stops a retried request from sending twice.
 */
function queueEmail(data, { to, subject, body, kind = 'notice', companyId = null, dedupeKey = null, meta = {} }) {
  ensureEmailCollections(data);

  const recipient = String(to || '').trim().toLowerCase();
  if (!recipient || !recipient.includes('@')) return null;

  if (dedupeKey && data.outboundEmails.some((item) => item.dedupeKey === dedupeKey && item.status !== 'failed')) {
    return null;
  }

  const record = {
    _id: newId('email'),
    companyId,
    kind,
    to: recipient,
    subject: String(subject || 'QHR notification'),
    body: String(body || ''),
    dedupeKey,
    meta,
    status: 'pending',
    attempts: 0,
    lastError: null,
    queuedAt: nowIso(),
    sentAt: null,
  };
  data.outboundEmails.push(record);
  return record;
}

async function sendWithSendGrid(record) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: record.to }] }],
      from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || 'QHR' },
      subject: record.subject,
      content: [{ type: 'text/plain', value: record.body }],
    }),
  });
  if (!response.ok) throw new Error(`SendGrid delivery failed (${response.status})`);
}

/**
 * Attempts delivery of everything pending. With no transport configured the
 * queue is left untouched and reported, so the absence of email is visible
 * instead of silent.
 */
async function flushEmails(store) {
  const data = await store.read();
  ensureEmailCollections(data);
  const pending = data.outboundEmails.filter((item) => item.status === 'pending' && item.attempts < MAX_ATTEMPTS);
  if (!pending.length) return { configured: emailConfigured(), sent: 0, failed: 0, pending: 0 };

  if (!emailConfigured()) {
    return { configured: false, sent: 0, failed: 0, pending: pending.length };
  }

  let sent = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      await sendWithSendGrid(item);
      await store.update((draft) => {
        const record = (draft.outboundEmails || []).find((entry) => entry._id === item._id);
        if (record) {
          record.status = 'sent';
          record.sentAt = nowIso();
          record.attempts += 1;
          record.lastError = null;
        }
        return {};
      });
      sent += 1;
    } catch (error) {
      await store.update((draft) => {
        const record = (draft.outboundEmails || []).find((entry) => entry._id === item._id);
        if (record) {
          record.attempts += 1;
          record.lastError = error.message;
          if (record.attempts >= MAX_ATTEMPTS) record.status = 'failed';
        }
        return {};
      });
      failed += 1;
    }
  }
  return { configured: true, sent, failed, pending: pending.length - sent - failed };
}

module.exports = {
  MAX_ATTEMPTS,
  emailConfigured,
  ensureEmailCollections,
  flushEmails,
  queueEmail,
};
