const { createApp } = require('./app');
const { flushBillingEmails } = require('./services/billingEmail');
const { flushEmails } = require('./services/mailer');
const { migrateVerificationCodes } = require('./utils/verification');
const { runBillingCycle } = require('./utils/billing');
const { runAutomaticPayroll } = require('./utils/payroll');

const port = Number(process.env.PORT || 5001);
const host = process.env.HOST || '0.0.0.0';
const app = createApp();

app.locals.store.init()
  .then(async () => {
    await app.locals.store.update((data) => {
      // Any plaintext registration code left in the file is hashed and expired
      // before the server starts accepting requests.
      migrateVerificationCodes(data);
      runBillingCycle(data);
      runAutomaticPayroll(data);
    });
    await flushBillingEmails(app.locals.store);
    await flushEmails(app.locals.store);
    app.listen(port, host, () => {
      console.log(`QHR backend listening on http://${host}:${port}`);
    });
    const billingTimer = setInterval(() => {
      app.locals.store.update((data) => {
        runBillingCycle(data);
        runAutomaticPayroll(data);
      })
        .then(() => flushBillingEmails(app.locals.store))
        .then(() => flushEmails(app.locals.store))
        .catch((error) => { console.error('Billing cycle failed:', error); });
    }, Number(process.env.BILLING_CYCLE_INTERVAL_MS || 3600000));
    billingTimer.unref();
  })
  .catch((error) => {
    console.error('Failed to initialize backend store:', error);
    process.exit(1);
  });
