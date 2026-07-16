function emailConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
}

function messageBody(notification) {
  const details = notification.details || {};
  const lines = [
    notification.subject,
    '',
    `Company: ${notification.companyName}`,
    details.amount !== undefined ? `Amount: INR ${Number(details.amount).toFixed(2)}` : null,
    details.renewalAt ? `Renewal date: ${new Date(details.renewalAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` : null,
    details.graceEndsAt ? `Access pause date: ${new Date(details.graceEndsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` : null,
    details.automaticSuspension === false ? 'This manual billing account will not be automatically suspended.' : null,
    details.freeAdminAccess ? 'The free Company Admin remains available for billing and payment.' : null,
    '',
    'Please sign in to the QHR Company Admin portal to review the invoice and payment options.',
  ].filter((line) => line !== null);
  return lines.join('\n');
}

async function sendWithSendGrid(notification) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: notification.recipient }] }],
      from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || 'QHR Billing' },
      subject: notification.subject,
      content: [{ type: 'text/plain', value: messageBody(notification) }],
    }),
  });
  if (!response.ok) throw new Error(`SendGrid delivery failed (${response.status})`);
}

async function flushBillingEmails(store, at = new Date()) {
  if (!emailConfigured()) return { configured: false, sent: 0, failed: 0 };
  const data = await store.read();
  const pending = (data.billingNotifications || [])
    .filter((item) => item.status === 'pending' && new Date(item.scheduledFor).getTime() <= at.getTime())
    .slice(0, 25);
  const result = { configured: true, sent: 0, failed: 0 };

  for (const notification of pending) {
    try {
      await sendWithSendGrid(notification);
      await store.update((current) => {
        const item = current.billingNotifications.find((entry) => entry._id === notification._id);
        if (!item) return;
        item.status = 'sent';
        item.sentAt = new Date().toISOString();
        item.attempts = (item.attempts || 0) + 1;
        item.updatedAt = new Date().toISOString();
      });
      result.sent += 1;
    } catch (error) {
      await store.update((current) => {
        const item = current.billingNotifications.find((entry) => entry._id === notification._id);
        if (!item) return;
        item.attempts = (item.attempts || 0) + 1;
        item.lastError = error.message;
        item.status = item.attempts >= 5 ? 'failed' : 'pending';
        item.updatedAt = new Date().toISOString();
      });
      result.failed += 1;
    }
  }
  return result;
}

module.exports = { emailConfigured, flushBillingEmails };
