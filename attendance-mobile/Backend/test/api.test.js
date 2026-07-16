const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

process.env.NODE_ENV = 'test';

const { createApp } = require('../src/app');
const { JsonStore } = require('../src/store/jsonStore');
const { createSeedData } = require('../src/store/seedData');

let baseUrl;
let dataFile;
let server;

async function request(pathname, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json();
  return { response, json };
}

before(async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qhr-backend-'));
  dataFile = path.join(tempDir, 'test-db.json');
  const store = new JsonStore(dataFile);
  await store.reset(createSeedData());
  const app = createApp({ store });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await fs.rm(path.dirname(dataFile), { recursive: true, force: true });
});

test('health endpoint returns ok', async () => {
  const { response, json } = await request('/health');
  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.data.status, 'ok');
});

test('employee login, me, attendance, leave, and desktop flows work', async () => {
  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    body: {
      companyCode: 'TESTCO',
      employeeId: 'EMP001',
      passcode: '1234',
    },
  });

  assert.equal(login.response.status, 200);
  assert.equal(login.json.data.employee.employeeId, 'EMP001');
  assert.ok(login.json.data.accessToken);
  const token = login.json.data.accessToken;

  const me = await request('/api/v1/auth/me', { token });
  assert.equal(me.response.status, 200);
  assert.equal(me.json.data.user.email, 'employee@testco.com');

  const checkIn = await request('/api/v1/attendance/check-in', {
    method: 'POST',
    token,
    body: {
      method: 'manual',
      location: { latitude: 19.076, longitude: 72.8777, accuracy: 12 },
    },
  });
  assert.equal(checkIn.response.status, 201);
  assert.equal(checkIn.json.data.attendance.status, 'present');

  const leave = await request('/api/v1/leaves/apply', {
    method: 'POST',
    token,
    body: {
      leaveType: 'casual',
      startDate: '2026-07-20',
      endDate: '2026-07-21',
      reason: 'Family work',
    },
  });
  assert.equal(leave.response.status, 201);
  assert.equal(leave.json.data.leave.status, 'pending');

  const heartbeat = await request('/api/v1/desktop-activity/heartbeat', {
    method: 'POST',
    token,
    body: {
      deviceInfo: { deviceId: 'test-device', platform: 'windows' },
    },
  });
  assert.equal(heartbeat.response.status, 200);
  assert.equal(heartbeat.json.data.state.status, 'online');
});

test('company registration and verification are available', async () => {
  const register = await request('/api/v1/companies/register', {
    method: 'POST',
    body: {
      companyName: 'Local Integration Co',
      companyCode: 'LOCALCO',
      adminEmail: 'admin@localco.test',
      adminFirstName: 'Local',
      adminLastName: 'Admin',
    },
  });
  assert.equal(register.response.status, 201);
  assert.equal(register.json.data.company.code, 'LOCALCO');

  const verify = await request('/api/v1/companies/verify', {
    method: 'POST',
    body: {
      companyCode: 'LOCALCO',
      verificationCode: register.json.data.verificationCode,
    },
  });
  assert.equal(verify.response.status, 200);
  assert.equal(verify.json.data.company.isVerified, true);
});

test('admin operations and documented platform modules work together', async () => {
  const login = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'company@example.com', password: 'password123' },
  });
  assert.equal(login.response.status, 200);
  const token = login.json.data.accessToken;

  const dashboard = await request('/api/v1/admin/dashboard', { token });
  assert.equal(dashboard.response.status, 200);
  assert.ok(dashboard.json.data.summary.employees >= 1);

  const employee = await request('/api/v1/employees', {
    method: 'POST', token,
    body: { firstName: 'Integration', lastName: 'User', email: 'integration@testco.test', department: 'QA' },
  });
  assert.equal(employee.response.status, 201);

  const area = await request('/api/v1/attendance-areas', {
    method: 'POST', token,
    body: { name: 'Integration Office', latitude: 20.2961, longitude: 85.8245, radiusMeters: 200 },
  });
  assert.equal(area.response.status, 201);

  const payroll = await request('/api/v1/payroll/generate', {
    method: 'POST', token,
    body: { employeeId: employee.json.data.employee._id, period: '2026-07' },
  });
  assert.equal(payroll.response.status, 201);
  assert.equal(payroll.json.data.payroll.length, 1);

  const project = await request('/api/v1/projects', {
    method: 'POST', token,
    body: { name: 'QHR Integration Project' },
  });
  assert.equal(project.response.status, 201);

  const task = await request('/api/v1/tasks', {
    method: 'POST', token,
    body: { title: 'Verify full workflow', projectId: project.json.data.project._id },
  });
  assert.equal(task.response.status, 201);

  const subscriptions = await request('/api/v1/subscriptions', { token });
  assert.equal(subscriptions.response.status, 200);
  assert.equal(subscriptions.json.data.current.pricePerUser, 19);
});

test('landing demo and contact forms persist leads', async () => {
  const demo = await request('/api/v1/demo-requests', {
    method: 'POST',
    body: { fullName: 'Demo User', workEmail: 'demo@example.test', companyName: 'Demo Company', employeeCount: '51-200' },
  });
  assert.equal(demo.response.status, 201);

  const contact = await request('/api/v1/contact', {
    method: 'POST',
    body: { name: 'Contact User', email: 'contact@example.test', message: 'Please call me.' },
  });
  assert.equal(contact.response.status, 201);
});

test('registration, admin, and employee apps share one company data flow', async () => {
  const register = await request('/api/v1/companies/register', {
    method: 'POST',
    body: {
      companyName: 'Connected Portal Company',
      companyCode: 'CONNECTCO',
      adminFirstName: 'Portal',
      adminLastName: 'Admin',
      adminEmail: 'portal-admin@connectco.test',
      adminPassword: 'connect123',
    },
  });
  assert.equal(register.response.status, 201);

  const missingCode = await request('/api/v1/companies/verify-email', {
    method: 'POST',
    body: { companyCode: 'CONNECTCO' },
  });
  assert.equal(missingCode.response.status, 400);

  const verify = await request('/api/v1/companies/verify-email', {
    method: 'POST',
    body: { companyCode: 'CONNECTCO', verificationCode: register.json.data.verificationCode },
  });
  assert.equal(verify.response.status, 200);

  const adminLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'portal-admin@connectco.test', password: 'connect123' },
  });
  assert.equal(adminLogin.response.status, 200);
  const adminToken = adminLogin.json.data.accessToken;

  const visibleCompanies = await request('/api/v1/companies', { token: adminToken });
  assert.equal(visibleCompanies.response.status, 200);
  assert.deepEqual(visibleCompanies.json.data.companies.map((company) => company.code), ['CONNECTCO']);

  const area = await request('/api/v1/attendance-areas', {
    method: 'POST', token: adminToken,
    body: { name: 'Connected Office', latitude: 20.2961, longitude: 85.8245, radiusMeters: 120 },
  });
  assert.equal(area.response.status, 201);

  const employee = await request('/api/v1/employees', {
    method: 'POST', token: adminToken,
    body: {
      employeeId: 'MOBILE001', firstName: 'Mobile', lastName: 'User',
      email: 'mobile-user@connectco.test', passcode: '2468', department: 'Field Sales',
    },
  });
  assert.equal(employee.response.status, 201);

  const employeeLogin = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { companyCode: 'CONNECTCO', employeeId: 'MOBILE001', passcode: '2468' },
  });
  assert.equal(employeeLogin.response.status, 200);
  const employeeToken = employeeLogin.json.data.accessToken;

  const forbiddenEmployees = await request('/api/v1/employees', { token: employeeToken });
  assert.equal(forbiddenEmployees.response.status, 403);

  const outsideArea = await request('/api/v1/attendance/check-in', {
    method: 'POST', token: employeeToken,
    body: { method: 'geofence', location: { latitude: 28.6139, longitude: 77.209, accuracy: 10 } },
  });
  assert.equal(outsideArea.response.status, 403);

  const checkIn = await request('/api/v1/attendance/check-in', {
    method: 'POST', token: employeeToken,
    body: { method: 'geofence', location: { latitude: 20.2961, longitude: 85.8245, accuracy: 10 } },
  });
  assert.equal(checkIn.response.status, 201);

  const leave = await request('/api/v1/leaves/apply', {
    method: 'POST', token: employeeToken,
    body: { leaveType: 'casual', startDate: '2026-08-10', endDate: '2026-08-10', reason: 'Connected workflow test' },
  });
  assert.equal(leave.response.status, 201);

  const teamAttendance = await request('/api/v1/attendance/team', { token: adminToken });
  const mobileAttendance = teamAttendance.json.data.attendances.find((item) => item.employee.employeeId === 'MOBILE001');
  assert.ok(mobileAttendance.attendance?.checkIn);

  const pendingLeaves = await request('/api/v1/leaves/approvals/pending', { token: adminToken });
  assert.ok(pendingLeaves.json.data.leaves.some((item) => item._id === leave.json.data.leave._id));

  const payroll = await request('/api/v1/payroll/generate', {
    method: 'POST', token: adminToken,
    body: { employeeId: employee.json.data.employee._id, period: '2026-07' },
  });
  assert.equal(payroll.response.status, 201);

  const approvedPayroll = await request(`/api/v1/payroll/${payroll.json.data.payroll[0]._id}/approve`, {
    method: 'PATCH', token: adminToken,
  });
  assert.equal(approvedPayroll.response.status, 200);
  assert.equal(approvedPayroll.json.data.payroll.status, 'approved');

  const payslips = await request('/api/v1/payroll/my-payslips', { token: employeeToken });
  assert.ok(payslips.json.data.payslips.some((item) => item.period === '2026-07' && item.status === 'approved'));
});

test('manager and HR permissions follow the documented role matrix', async () => {
  const managerLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'manager@testco.com', password: 'password123' },
  });
  assert.equal(managerLogin.response.status, 200);
  const managerToken = managerLogin.json.data.accessToken;

  const managerEmployees = await request('/api/v1/employees?limit=100', { token: managerToken });
  assert.equal(managerEmployees.response.status, 200);
  assert.deepEqual(managerEmployees.json.data.employees.map((employee) => employee.employeeId).sort(), ['EMP001', 'MGR001']);

  const managerCreate = await request('/api/v1/employees', {
    method: 'POST', token: managerToken,
    body: { firstName: 'Forbidden', email: 'forbidden-manager@testco.test' },
  });
  assert.equal(managerCreate.response.status, 403);
  assert.equal((await request('/api/v1/payroll', { token: managerToken })).response.status, 403);
  assert.equal((await request('/api/v1/subscriptions', { token: managerToken })).response.status, 403);
  assert.equal((await request('/api/v1/companies/settings', { method: 'PATCH', token: managerToken, body: { gpsTracking: false } })).response.status, 403);

  const teamAttendance = await request('/api/v1/attendance/team', { token: managerToken });
  assert.deepEqual(teamAttendance.json.data.attendances.map((item) => item.employee.employeeId).sort(), ['EMP001', 'MGR001']);
  const managerLeaves = await request('/api/v1/leaves/approvals/pending', { token: managerToken });
  assert.ok(managerLeaves.json.data.leaves.every((leave) => leave.employee.employeeId === 'EMP001'));

  const hrLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'hr@testco.com', password: 'password123' },
  });
  assert.equal(hrLogin.response.status, 200);
  const hrToken = hrLogin.json.data.accessToken;
  const hrCreate = await request('/api/v1/employees', {
    method: 'POST', token: hrToken,
    body: { employeeId: 'ROLE001', firstName: 'Role', lastName: 'Test', email: 'role-test@testco.test', role: 'employee' },
  });
  assert.equal(hrCreate.response.status, 201);
  assert.equal((await request('/api/v1/payroll', { token: hrToken })).response.status, 200);
  assert.equal((await request('/api/v1/subscriptions', { token: hrToken })).response.status, 403);
  const forbiddenAdmin = await request('/api/v1/employees', {
    method: 'POST', token: hrToken,
    body: { firstName: 'Not', lastName: 'Admin', email: 'not-admin@testco.test', role: 'admin' },
  });
  assert.equal(forbiddenAdmin.response.status, 403);
});

test('employee requests and manager approvals are connected and scoped', async () => {
  const employeeLogin = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  const employeeToken = employeeLogin.json.data.accessToken;
  const wfh = await request('/api/v1/wfh', {
    method: 'POST', token: employeeToken,
    body: { date: '2026-09-01', reason: 'Focused remote work' },
  });
  assert.equal(wfh.response.status, 201);
  const grievance = await request('/api/v1/grievances', {
    method: 'POST', token: employeeToken,
    body: { subject: 'Role workflow', description: 'Verify manager visibility' },
  });
  assert.equal(grievance.response.status, 201);
  assert.equal((await request('/api/v1/wfh/pending', { token: employeeToken })).response.status, 403);
  assert.equal((await request('/api/v1/grievances/all', { token: employeeToken })).response.status, 403);

  const managerLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'manager@testco.com', password: 'password123' },
  });
  const managerToken = managerLogin.json.data.accessToken;
  const pendingWfh = await request('/api/v1/wfh/pending', { token: managerToken });
  assert.ok(pendingWfh.json.data.wfhRequests.some((item) => item._id === wfh.json.data.wfhRequest._id));
  const approveWfh = await request(`/api/v1/wfh/${wfh.json.data.wfhRequest._id}/review`, {
    method: 'PATCH', token: managerToken, body: { action: 'approve' },
  });
  assert.equal(approveWfh.response.status, 200);
  assert.equal(approveWfh.json.data.wfhRequest.status, 'approved');

  const visibleGrievances = await request('/api/v1/grievances/all', { token: managerToken });
  assert.ok(visibleGrievances.json.data.grievances.some((item) => item._id === grievance.json.data.grievance._id));
  const resolve = await request(`/api/v1/grievances/${grievance.json.data.grievance._id}/resolve`, {
    method: 'PATCH', token: managerToken, body: { resolution: 'Manager handled the request' },
  });
  assert.equal(resolve.response.status, 200);
  assert.equal(resolve.json.data.grievance.status, 'resolved');
});

test('Super Admin operates all tenants, leads, subscriptions, and suspension', async () => {
  const login = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'admin@qhr.com', password: 'admin123' },
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.json.data.user.role, 'super_admin');
  const token = login.json.data.accessToken;

  const dashboard = await request('/api/v1/admin/platform-dashboard', { token });
  assert.equal(dashboard.response.status, 200);
  assert.ok(dashboard.json.data.summary.companies >= 2);
  assert.ok(dashboard.json.data.summary.employees >= 2);

  const subscriptions = await request('/api/v1/admin/tenant-subscriptions', { token });
  assert.equal(subscriptions.response.status, 200);
  assert.ok(subscriptions.json.data.subscriptions.length >= 2);
  const companies = await request('/api/v1/companies', { token });
  assert.equal(companies.response.status, 200);
  assert.ok(companies.json.data.companies.length >= 2);
  const platformEmployees = await request('/api/v1/employees?limit=100', { token });
  assert.equal(platformEmployees.response.status, 200);
  assert.ok(platformEmployees.json.data.employees.some((employee) => employee.company.code === 'QHR'));
  assert.ok(platformEmployees.json.data.employees.some((employee) => employee.company.code === 'TESTCO'));
  const leads = await request('/api/v1/admin/leads', { token });
  assert.equal(leads.response.status, 200);
  assert.ok(leads.json.data.demoRequests.length >= 1);
  assert.ok(leads.json.data.contactMessages.length >= 1);

  const testCompany = dashboard.json.data.companies.find((company) => company.code === 'TESTCO');
  const companyDetail = await request(`/api/v1/admin/companies/${testCompany._id}`, { token });
  assert.equal(companyDetail.response.status, 200);
  assert.equal(companyDetail.json.data.company.code, 'TESTCO');
  assert.ok(companyDetail.json.data.employees.some((employee) => employee.employeeId === 'EMP001'));

  const editCompany = await request(`/api/v1/admin/companies/${testCompany._id}`, {
    method: 'PATCH', token,
    body: { name: 'Test Company Updated', phone: '+91 90000 11111', domain: 'updated.testco.example' },
  });
  assert.equal(editCompany.response.status, 200);
  assert.equal(editCompany.json.data.company.name, 'Test Company Updated');
  assert.equal(editCompany.json.data.company.domain, 'updated.testco.example');

  const createTenantEmployee = await request('/api/v1/employees', {
    method: 'POST', token,
    body: {
      companyId: testCompany._id,
      employeeId: 'PLATFORM001',
      firstName: 'Platform',
      lastName: 'Managed',
      email: 'platform-managed@testco.test',
      role: 'employee',
      department: 'Operations',
      designation: 'Coordinator',
      passcode: '9876',
    },
  });
  assert.equal(createTenantEmployee.response.status, 201);
  assert.equal(createTenantEmployee.json.data.employee.company.code, 'TESTCO');
  const managedEmployeeId = createTenantEmployee.json.data.employee._id;

  const editTenantEmployee = await request(`/api/v1/employees/${managedEmployeeId}`, {
    method: 'PATCH', token,
    body: { role: 'manager', designation: 'Operations Manager' },
  });
  assert.equal(editTenantEmployee.response.status, 200);
  assert.equal(editTenantEmployee.json.data.employee.role, 'manager');
  assert.equal((await request(`/api/v1/employees/${managedEmployeeId}`, { method: 'DELETE', token })).response.status, 200);
  const updatedDetail = await request(`/api/v1/admin/companies/${testCompany._id}`, { token });
  const deactivatedEmployee = updatedDetail.json.data.employees.find((employee) => employee._id === managedEmployeeId);
  assert.equal(deactivatedEmployee.status, 'inactive');
  assert.ok(updatedDetail.json.data.auditLogs.some((entry) => entry.action === 'company.updated'));
  assert.ok(updatedDetail.json.data.auditLogs.some((entry) => entry.action === 'employee.deactivated'));
  const platformAudit = await request('/api/v1/admin/audit-logs', { token });
  assert.equal(platformAudit.response.status, 200);
  assert.ok(platformAudit.json.data.auditLogs.some((entry) => entry.employeeName === 'Platform Managed'));
  const tenantAdminLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'company@example.com', password: 'password123' },
  });
  assert.equal((await request('/api/v1/admin/audit-logs', { token: tenantAdminLogin.json.data.accessToken })).response.status, 403);

  assert.equal((await request('/api/v1/admin/dashboard', { token })).response.status, 403);
  assert.equal((await request('/api/v1/leaves/approvals/pending', { token })).response.status, 403);
  assert.equal((await request('/api/v1/wfh/pending', { token })).response.status, 403);
  assert.equal((await request('/api/v1/grievances/all', { token })).response.status, 403);
  assert.equal((await request('/api/v1/payroll', { token })).response.status, 403);

  const suspend = await request(`/api/v1/admin/companies/${testCompany._id}`, {
    method: 'PATCH', token, body: { status: 'suspended' },
  });
  assert.equal(suspend.response.status, 200);
  assert.equal(suspend.json.data.company.status, 'suspended');
  const blockedLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'company@example.com', password: 'password123' },
  });
  assert.equal(blockedLogin.response.status, 403);
  const publicCompanies = await request('/api/v1/auth/companies');
  assert.ok(!publicCompanies.json.data.companies.some((company) => company.code === 'TESTCO'));

  const reactivate = await request(`/api/v1/admin/companies/${testCompany._id}`, {
    method: 'PATCH', token,
    body: { status: 'active', plan: 'Enterprise', pricePerUser: 49, subscriptionStatus: 'active' },
  });
  assert.equal(reactivate.response.status, 200);
  assert.equal(reactivate.json.data.company.subscription.plan, 'Enterprise');
  assert.equal((await request('/api/v1/auth/admin-login', { method: 'POST', body: { email: 'company@example.com', password: 'password123' } })).response.status, 200);

  const archiveTarget = dashboard.json.data.companies.find((company) => company.code === 'LOCALCO');
  const archive = await request(`/api/v1/admin/companies/${archiveTarget._id}`, { method: 'DELETE', token });
  assert.equal(archive.response.status, 200);
  assert.equal(archive.json.data.company.status, 'archived');
  assert.equal((await request('/api/v1/auth/admin-login', { method: 'POST', body: { email: 'admin@localco.test', password: 'password123' } })).response.status, 403);
});

test('billing ledger supports manual verification and automatic-only subscription pausing', async () => {
  const superLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'admin@qhr.com', password: 'admin123' },
  });
  assert.equal(superLogin.response.status, 200);
  const superToken = superLogin.json.data.accessToken;

  const overview = await request('/api/v1/admin/billing-overview', { token: superToken });
  assert.equal(overview.response.status, 200);
  assert.ok(overview.json.data.summary.collectedAmount > 0);
  assert.ok(overview.json.data.summary.pendingAmount > 0);
  const automaticSubscription = overview.json.data.subscriptions.find((item) => item.billingMode === 'automatic');
  assert.ok(automaticSubscription);
  assert.equal(automaticSubscription.renewalAmount, automaticSubscription.pricePerUser * automaticSubscription.paidSeats);
  assert.ok(overview.json.data.subscriptions.some((item) => item.billingMode === 'manual_offline'));
  const tenantSubscriptions = await request('/api/v1/admin/tenant-subscriptions', { token: superToken });
  assert.equal(tenantSubscriptions.json.data.paymentGateways.length, 2);
  const payuDefault = await request('/api/v1/admin/billing/gateways/payu', {
    method: 'PATCH', token: superToken, body: { enabled: true, isDefault: true, mode: 'test' },
  });
  assert.equal(payuDefault.response.status, 200);
  assert.equal(payuDefault.json.data.gateway.isDefault, true);
  await request('/api/v1/admin/billing/gateways/cashfree', {
    method: 'PATCH', token: superToken, body: { enabled: true, isDefault: true, mode: 'test' },
  });

  const qhrAdminLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'company-admin@qhr.com', password: 'password123' },
  });
  assert.equal(qhrAdminLogin.response.status, 200);
  const qhrAdminToken = qhrAdminLogin.json.data.accessToken;
  const companyBilling = await request('/api/v1/subscriptions', { token: qhrAdminToken });
  assert.equal(companyBilling.response.status, 200);
  assert.equal(companyBilling.json.data.current.billingMode, 'manual_offline');
  assert.equal(companyBilling.json.data.current.automaticSuspensionEnabled, false);
  const invoice = companyBilling.json.data.invoices.find((item) => item.amountDue > 0);
  assert.ok(invoice);

  const submitted = await request('/api/v1/subscriptions/manual-payments', {
    method: 'POST', token: qhrAdminToken,
    body: { invoiceId: invoice._id, amount: 5, method: 'bank_transfer', reference: 'UTR-TEST-PARTIAL' },
  });
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.json.data.payment.status, 'pending_verification');

  const confirmed = await request(`/api/v1/admin/billing/payments/${submitted.json.data.payment._id}`, {
    method: 'PATCH', token: superToken, body: { status: 'cleared' },
  });
  assert.equal(confirmed.response.status, 200);
  assert.equal(confirmed.json.data.invoice.amountPaid, invoice.amountPaid + 5);
  assert.equal(confirmed.json.data.invoice.status, 'partially_paid');

  const companies = overview.json.data.subscriptions;
  const qhr = companies.find((item) => item.companyCode === 'QHR');
  const testco = companies.find((item) => item.companyCode === 'TESTCO');
  const manualPauseAttempt = await request(`/api/v1/admin/companies/${qhr.companyId}`, {
    method: 'PATCH', token: superToken,
    body: { billingMode: 'manual_offline', subscriptionStatus: 'paused' },
  });
  assert.equal(manualPauseAttempt.response.status, 200);
  assert.equal(manualPauseAttempt.json.data.company.subscription.status, 'active');
  assert.equal(manualPauseAttempt.json.data.company.subscription.automaticSuspensionEnabled, false);

  const automaticPause = await request(`/api/v1/admin/companies/${testco.companyId}`, {
    method: 'PATCH', token: superToken,
    body: { billingMode: 'automatic', subscriptionStatus: 'paused' },
  });
  assert.equal(automaticPause.response.status, 200);
  assert.equal(automaticPause.json.data.company.subscription.status, 'paused');

  const employeeLogin = await request('/api/v1/auth/login', {
    method: 'POST', body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  assert.equal(employeeLogin.response.status, 200);
  assert.equal((await request('/api/v1/auth/me', { token: employeeLogin.json.data.accessToken })).response.status, 403);
  const freeAdminLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'company@example.com', password: 'password123' },
  });
  assert.equal(freeAdminLogin.response.status, 200);
  assert.equal((await request('/api/v1/auth/me', { token: freeAdminLogin.json.data.accessToken })).response.status, 200);

  const restore = await request(`/api/v1/admin/companies/${testco.companyId}`, {
    method: 'PATCH', token: superToken,
    body: { billingMode: 'automatic', subscriptionStatus: 'active' },
  });
  assert.equal(restore.response.status, 200);
});

test('billing cycle queues reminders and never auto-pauses manual billing companies', async () => {
  const login = await request('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'admin@qhr.com', password: 'admin123' },
  });
  const token = login.json.data.accessToken;
  const overview = await request('/api/v1/admin/billing-overview', { token });
  const qhr = overview.json.data.subscriptions.find((item) => item.companyCode === 'QHR');
  const testco = overview.json.data.subscriptions.find((item) => item.companyCode === 'TESTCO');

  await request(`/api/v1/admin/companies/${qhr.companyId}`, {
    method: 'PATCH', token,
    body: { billingMode: 'manual_offline', subscriptionStatus: 'active', nextRenewalAt: '2026-06-01T00:00:00.000Z' },
  });
  await request(`/api/v1/admin/companies/${testco.companyId}`, {
    method: 'PATCH', token,
    body: { billingMode: 'automatic', subscriptionStatus: 'active', nextRenewalAt: '2026-06-01T00:00:00.000Z' },
  });

  const cycle = await request('/api/v1/admin/billing/run-cycle', {
    method: 'POST', token, body: { at: '2026-06-17T00:00:00.000Z' },
  });
  assert.equal(cycle.response.status, 200);
  assert.equal(cycle.json.data.stats.paused, 1);
  assert.ok(cycle.json.data.stats.notificationsQueued >= 2);

  const qhrDetail = await request(`/api/v1/admin/companies/${qhr.companyId}`, { token });
  const testcoDetail = await request(`/api/v1/admin/companies/${testco.companyId}`, { token });
  assert.equal(qhrDetail.json.data.billing.subscription.status, 'active');
  assert.equal(qhrDetail.json.data.billing.subscription.automaticSuspensionEnabled, false);
  assert.equal(testcoDetail.json.data.billing.subscription.status, 'paused');
  assert.equal(testcoDetail.json.data.billing.subscription.automaticSuspensionEnabled, true);

  await request(`/api/v1/admin/companies/${testco.companyId}`, {
    method: 'PATCH', token,
    body: { billingMode: 'automatic', subscriptionStatus: 'active', nextRenewalAt: '2026-08-01T00:00:00.000Z' },
  });
});

test('paid-seat allowance is enforced while the designated Company Admin remains free', async () => {
  const login = await request('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'admin@qhr.com', password: 'admin123' },
  });
  const token = login.json.data.accessToken;
  const overview = await request('/api/v1/admin/billing-overview', { token });
  const qhr = overview.json.data.subscriptions.find((item) => item.companyCode === 'QHR');

  const blocked = await request('/api/v1/employees', {
    method: 'POST', token,
    body: { companyId: qhr.companyId, employeeId: 'SEAT001', firstName: 'Seat', lastName: 'Blocked', email: 'seat-blocked@qhr.test', passcode: '1234' },
  });
  assert.equal(blocked.response.status, 409);
  assert.match(blocked.json.message, /No paid seats are available/);

  await request(`/api/v1/admin/companies/${qhr.companyId}`, {
    method: 'PATCH', token, body: { paidSeats: qhr.paidSeats + 1 },
  });
  const createdEmployee = await request('/api/v1/employees', {
    method: 'POST', token,
    body: { companyId: qhr.companyId, employeeId: 'SEAT001', firstName: 'Seat', lastName: 'Allowed', email: 'seat-allowed@qhr.test', passcode: '1234' },
  });
  assert.equal(createdEmployee.response.status, 201);
  assert.equal((await request(`/api/v1/employees/${createdEmployee.json.data.employee._id}`, { method: 'DELETE', token })).response.status, 200);
  await request(`/api/v1/admin/companies/${qhr.companyId}`, {
    method: 'PATCH', token, body: { paidSeats: qhr.paidSeats },
  });
});
