require('dotenv').config();

const { randomUUID } = require('crypto');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const { authRequired } = require('./middleware/auth');
const { corsOptions, createRateLimiter, positiveInteger } = require('./middleware/security');
const { JsonStore } = require('./store/jsonStore');
const { fail, ok } = require('./utils/responses');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const companiesRoutes = require('./routes/companies');
const desktopActivityRoutes = require('./routes/desktopActivity');
const employeesRoutes = require('./routes/employees');
const grievancesRoutes = require('./routes/grievances');
const leavesRoutes = require('./routes/leaves');
const orgRoutes = require('./routes/org');
const importsRoutes = require('./routes/imports');
const calendarRoutes = require('./routes/calendar');
const notificationRoutes = require('./routes/notifications');
const assetsRoutes = require('./routes/assets');
const onboardingRoutes = require('./routes/onboarding');
const reimbursementsRoutes = require('./routes/reimbursements');
const wfhRoutes = require('./routes/wfh');
const {
  adminRouter,
  areasRouter,
  payrollRouter,
  projectsRouter,
  publicRouter,
  subscriptionsRouter,
  tasksRouter,
} = require('./routes/platform');

morgan.token('request-id', (req) => req.id || '-');

function createApp(options = {}) {
  const app = express();
  app.locals.store = options.store || new JsonStore();

  const trustProxy = String(process.env.TRUST_PROXY || '').trim();
  if (trustProxy) app.set('trust proxy', trustProxy === 'true' ? 1 : positiveInteger(trustProxy, 1));

  const rateLimitWindowMs = positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  const apiRateLimiter = createRateLimiter({
    windowMs: rateLimitWindowMs,
    max: positiveInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 300),
    scope: 'api',
  });
  const authRateLimiter = createRateLimiter({
    windowMs: positiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MS, rateLimitWindowMs),
    max: positiveInteger(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS, 10),
    scope: 'auth',
  });

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const supplied = String(req.get('x-request-id') || '').trim();
    const requestId = /^[A-Za-z0-9._-]{1,100}$/.test(supplied) ? supplied : randomUUID();
    req.id = requestId;
    res.locals.requestId = requestId;
    res.set('X-Request-Id', requestId);
    return next();
  });
  app.use(helmet());
  app.use(cors(corsOptions()));
  app.use(express.json({
    limit: process.env.MAX_JSON_BODY || '10mb',
    type: (req) => {
      const contentType = req.headers['content-type'];
      return !contentType || contentType.includes('json') || contentType.includes('text/plain');
    },
  }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(':method :url :status :response-time ms request-id=:request-id', {
    skip: () => process.env.NODE_ENV === 'test',
  }));
  app.use('/api/v1', apiRateLimiter);
  app.use('/api/v1/auth/login', authRateLimiter);
  app.use('/api/v1/auth/admin-login', authRateLimiter);
  app.use('/api/v1/auth/refresh', authRateLimiter);
  app.use('/api/v1/auth/refresh-token', authRateLimiter);

  app.get('/health', async (req, res, next) => {
    try {
      await req.app.locals.store.init();
      return ok(res, {
        status: 'ok',
        service: 'qhr-attendance-backend',
        persistence: 'json-file',
        time: new Date().toISOString(),
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/v1', (req, res) => ok(res, {
    name: 'QHR Attendance API',
    version: 'v1',
  }));

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/companies', companiesRoutes);
  app.use('/api/v1/company', companiesRoutes);
  app.use('/api/v1/employees', employeesRoutes);
  app.use('/api/v1/attendance', attendanceRoutes);
  app.use('/api/v1/leaves', leavesRoutes);
  app.use('/api/v1/reimbursements', reimbursementsRoutes);
  app.use('/api/v1/wfh', wfhRoutes);
  app.use('/api/v1/grievances', grievancesRoutes);
  app.use('/api/v1/org', orgRoutes);
  app.use('/api/v1/imports', importsRoutes);
  app.use('/api/v1/calendar', calendarRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/assets', assetsRoutes);
  app.use('/api/v1/onboarding', onboardingRoutes);
  app.use('/api/v1/desktop-activity', desktopActivityRoutes);
  app.use('/api/v1', publicRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/payroll', payrollRouter);
  app.use('/api/v1/salary', payrollRouter);
  app.use('/api/v1/projects', projectsRouter);
  app.use('/api/v1/tasks', tasksRouter);
  app.use('/api/v1/attendance-areas', areasRouter);
  app.use('/api/v1/subscriptions', subscriptionsRouter);

  app.get('/api/v1/leave-types', (req, res, next) => {
    req.url = '/types';
    return leavesRoutes(req, res, next);
  });

  app.get('/api/v1/holidays', authRequired, async (req, res, next) => {
    try {
      const data = await req.app.locals.store.read();
      const company = data.companies.find((item) => item._id === req.user.companyId);
      const holidays = (company?.holidays || []).map((holiday) => ({ ...holiday }));
      return ok(res, { holidays });
    } catch (error) {
      return next(error);
    }
  });

  app.use((req, res) => fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    if (status >= 500) {
      console.error(JSON.stringify({
        level: 'error',
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        error: error.name || 'Error',
        message: error.message || 'Internal server error',
        stack: error.stack,
      }));
    }
    const message = status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message || 'Internal server error';
    return fail(res, status, message);
  });

  return app;
}

const defaultApp = createApp();

module.exports = defaultApp;
module.exports.createApp = createApp;
