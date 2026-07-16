require('dotenv').config();

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const { JsonStore } = require('./store/jsonStore');
const { fail, ok } = require('./utils/responses');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const companiesRoutes = require('./routes/companies');
const desktopActivityRoutes = require('./routes/desktopActivity');
const employeesRoutes = require('./routes/employees');
const grievancesRoutes = require('./routes/grievances');
const leavesRoutes = require('./routes/leaves');
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

function createApp(options = {}) {
  const app = express();
  app.locals.store = options.store || new JsonStore();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({
    limit: '10mb',
    type: (req) => {
      const contentType = req.headers['content-type'];
      return !contentType || contentType.includes('json') || contentType.includes('text/plain');
    },
  }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(process.env.NODE_ENV === 'test' ? 'tiny' : 'dev', {
    skip: () => process.env.NODE_ENV === 'test',
  }));

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
  app.use('/api/v1/wfh', wfhRoutes);
  app.use('/api/v1/grievances', grievancesRoutes);
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

  app.get('/api/v1/holidays', async (req, res, next) => {
    try {
      const data = await req.app.locals.store.read();
      const holidays = data.companies.flatMap((company) => company.holidays.map((holiday) => ({
        ...holiday,
        companyId: company._id,
        companyCode: company.code,
      })));
      return ok(res, { holidays });
    } catch (error) {
      return next(error);
    }
  });

  app.use((req, res) => fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
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
