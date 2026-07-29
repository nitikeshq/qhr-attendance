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
const { calculatePayroll, itemizePayslip, runAutomaticPayroll } = require('../src/utils/payroll');

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

  const overlappingLeave = await request('/api/v1/leaves/apply', {
    method: 'POST',
    token,
    body: {
      leaveType: 'casual',
      startDate: '2026-07-20',
      endDate: '2026-07-21',
      reason: 'Duplicate of the seeded pending request',
    },
  });
  assert.equal(overlappingLeave.response.status, 409);

  const leave = await request('/api/v1/leaves/apply', {
    method: 'POST',
    token,
    body: {
      leaveType: 'casual',
      startDate: '2026-07-27',
      endDate: '2026-07-28',
      reason: 'Family work',
    },
  });
  assert.equal(leave.response.status, 201);
  assert.equal(leave.json.data.leave.status, 'pending');
  assert.equal(leave.json.data.leave.currentLevel, 1);
  assert.ok(leave.json.data.leave.approvalSteps.length >= 1);

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

  const localLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'admin@localco.test', password: 'password123', companyCode: 'LOCALCO' },
  });
  assert.equal(localLogin.response.status, 200);
  const localToken = localLogin.json.data.accessToken;

  const initialPayrollSettings = await request('/api/v1/payroll/settings', { token: localToken });
  assert.equal(initialPayrollSettings.response.status, 200);
  assert.deepEqual(initialPayrollSettings.json.data.settings.earnings, []);
  assert.deepEqual(initialPayrollSettings.json.data.settings.deductions, []);

  const selectedPayrollFields = await request('/api/v1/payroll/settings', {
    method: 'PATCH',
    token: localToken,
    body: {
      salaryTemplate: {
        basic: { calculation: 'percentage_of_gross', value: 45, active: true },
        hra: { calculation: 'percentage_of_basic', value: 0, active: false },
        balanceComponentEnabled: true,
        balanceComponentName: 'Flexi allowance',
      },
      earnings: [
        { code: 'conveyance', name: 'Conveyance allowance', calculation: 'fixed', defaultValue: 1200, active: true },
      ],
      deductions: [],
    },
  });
  assert.equal(selectedPayrollFields.response.status, 200);
  assert.equal(selectedPayrollFields.json.data.settings.salaryTemplate.basic.active, true);
  assert.equal(selectedPayrollFields.json.data.settings.salaryTemplate.basic.value, 45);
  assert.equal(selectedPayrollFields.json.data.settings.salaryTemplate.hra.active, false);
  assert.equal(selectedPayrollFields.json.data.settings.salaryTemplate.balanceComponentEnabled, true);
  assert.equal(selectedPayrollFields.json.data.settings.salaryTemplate.balanceComponentName, 'Flexi allowance');
  assert.deepEqual(selectedPayrollFields.json.data.settings.earnings.map((item) => item.code), ['conveyance']);
  assert.deepEqual(selectedPayrollFields.json.data.settings.deductions, []);
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

  const employeeSalary = await request(`/api/v1/payroll/salary-structures/${employee.json.data.employee._id}`, {
    method: 'PUT', token,
    body: {
      payrollEnabled: true,
      salaryMode: 'custom_formula',
      monthlyGrossTarget: 30000,
      coreRules: {
        basic: { calculation: 'fixed', value: 20000, active: true },
        hra: { calculation: 'fixed', value: 8000, active: true },
      },
      earningOverrides: [
        { code: 'conveyance', name: 'Conveyance allowance', calculation: 'percentage_of_gross', value: 20, active: false },
        { code: 'special_allowance', name: 'Special allowance', calculation: 'fixed', value: 2000, active: true },
      ],
    },
  });
  assert.equal(employeeSalary.response.status, 200);

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

test('advanced payroll supports company policy, salary structures, adjustments, publishing, payment, and downloads', async () => {
  const adminLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'company@example.com', password: 'password123' },
  });
  const adminToken = adminLogin.json.data.accessToken;
  const employeeLogin = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  const employeeToken = employeeLogin.json.data.accessToken;

  const settings = await request('/api/v1/payroll/settings', { token: adminToken });
  assert.equal(settings.response.status, 200);
  assert.equal(settings.json.data.settings.statutory.employeePfRate, 12);
  assert.equal(settings.json.data.settings.statutory.employeeEsiRate, 0.75);
  assert.equal(settings.json.data.settings.statutory.gratuityRate, 4.81);
  // No default earnings - admins configure what they need
  assert.ok(Array.isArray(settings.json.data.settings.earnings));

  const savedSettings = await request('/api/v1/payroll/settings', {
    method: 'PATCH', token: adminToken,
    body: {
      identity: { payslipFooter: 'Advanced payroll integration payslip' },
      autoGeneration: { enabled: false, dayOfMonth: 26, period: 'current', submitForApproval: true },
    },
  });
  assert.equal(savedSettings.response.status, 200);
  assert.equal(savedSettings.json.data.settings.identity.legalName, 'Test Company Private Limited');
  assert.equal(savedSettings.json.data.settings.autoGeneration.dayOfMonth, 26);

  const salary = await request('/api/v1/payroll/salary-structures/EMP001', {
    method: 'PUT', token: adminToken,
    body: {
      payrollEnabled: true,
      effectiveFrom: '2026-04-01',
      salaryMode: 'custom_formula',
      monthlyGrossTarget: 34200,
      coreRules: {
        basic: { calculation: 'fixed', value: 20000, active: true },
        hra: { calculation: 'fixed', value: 8000, active: true },
      },
      annualCtc: 430000,
      pfApplicable: true,
      esiApplicable: false,
      professionalTaxMonthly: 200,
      monthlyTds: 700,
      earningOverrides: [
        { code: 'conveyance', name: 'Conveyance allowance', calculation: 'percentage_of_gross', value: 20, active: false },
        { code: 'special_allowance', name: 'Special allowance', calculation: 'fixed', value: 5000, taxable: true, partOfEsiWage: true, active: true },
        { code: 'internet_allowance', name: 'Internet allowance', calculation: 'fixed', value: 1200, taxable: true, partOfEsiWage: true, active: true },
      ],
      deductionOverrides: [{ code: 'meal_recovery', name: 'Meal recovery', calculation: 'fixed', value: 250, active: true }],
      bankName: 'Integration Bank',
      bankAccountLast4: '9876',
      bankIfsc: 'TEST0001234',
      paymentMode: 'bank_transfer',
    },
  });
  assert.equal(salary.response.status, 200);
  assert.equal(salary.json.data.salaryStructure.structure.monthlyGross, 34200);

  const generated = await request('/api/v1/payroll/generate', {
    method: 'POST', token: adminToken,
    body: { employeeId: 'EMP001', period: '2027-01' },
  });
  assert.equal(generated.response.status, 201);
  const payslip = generated.json.data.payroll[0];
  assert.equal(payslip.gross, 34200);
  assert.equal(payslip.deductions, 2950);
  assert.equal(payslip.net, 31250);
  assert.equal(payslip.employerContributionTotal, 1875);
  assert.ok(payslip.earnings.some((item) => item.code === 'internet_allowance' && item.amount === 1200));

  const hiddenDrafts = await request('/api/v1/payroll/my-payslips', { token: employeeToken });
  assert.ok(!hiddenDrafts.json.data.payslips.some((item) => item.period === '2027-01'));

  const adjustment = await request(`/api/v1/payroll/${payslip._id}/adjustments`, {
    method: 'POST', token: adminToken,
    body: { kind: 'earning', name: 'Performance bonus', amount: 1000, notes: 'Integration award' },
  });
  assert.equal(adjustment.response.status, 201);
  assert.equal(adjustment.json.data.payroll.net, 32250);

  const deductionAdjustment = await request(`/api/v1/payroll/${payslip._id}/adjustments`, {
    method: 'POST', token: adminToken,
    body: { kind: 'deduction', name: 'Equipment recovery', amount: 200, notes: 'One-time recovery' },
  });
  assert.equal(deductionAdjustment.response.status, 201);
  assert.equal(deductionAdjustment.json.data.payroll.net, 32050);
  const deductionId = deductionAdjustment.json.data.payroll.adjustments.find((item) => item.name === 'Equipment recovery')._id;
  const removedAdjustment = await request(`/api/v1/payroll/${payslip._id}/adjustments/${deductionId}`, {
    method: 'DELETE', token: adminToken,
  });
  assert.equal(removedAdjustment.response.status, 200);
  assert.equal(removedAdjustment.json.data.payroll.net, 32250);

  const changedGlobalSettings = await request('/api/v1/payroll/settings', {
    method: 'PATCH', token: adminToken,
    body: { statutory: { employeePfRate: 10 } },
  });
  assert.equal(changedGlobalSettings.response.status, 200);
  const recalculated = await request(`/api/v1/payroll/${payslip._id}/recalculate`, {
    method: 'POST', token: adminToken,
    body: {},
  });
  assert.equal(recalculated.response.status, 200);
  assert.equal(recalculated.json.data.payroll.status, 'draft');
  assert.equal(recalculated.json.data.payroll.settingsSnapshot.statutory.employeePfRate, 10);
  assert.equal(recalculated.json.data.payroll.deductions, 2650);
  assert.equal(recalculated.json.data.payroll.net, 32550);
  assert.ok(recalculated.json.data.payroll.adjustments.some((item) => item.name === 'Performance bonus'));

  assert.equal((await request(`/api/v1/payroll/${payslip._id}/submit`, { method: 'POST', token: adminToken })).response.status, 200);
  const approved = await request(`/api/v1/payroll/${payslip._id}/approve`, { method: 'PATCH', token: adminToken });
  assert.equal(approved.response.status, 200);
  assert.ok(approved.json.data.payroll.publishedAt);

  const visiblePayslips = await request('/api/v1/payroll/my-payslips', { token: employeeToken });
  assert.ok(visiblePayslips.json.data.payslips.some((item) => item.period === '2027-01' && item.net === 32550));
  const issuedRecalculation = await request(`/api/v1/payroll/${payslip._id}/recalculate`, {
    method: 'POST', token: adminToken,
    body: { reason: 'Issued payroll must remain immutable' },
  });
  assert.equal(issuedRecalculation.response.status, 409);
  assert.match(issuedRecalculation.json.message, /Issued payroll cannot be recalculated/);
  assert.ok(approved.json.data.payroll.documentId);
  assert.ok(approved.json.data.payroll.contentHash);
  const employeeDetail = await request(`/api/v1/payroll/my-payslips/${payslip._id}`, { token: employeeToken });
  assert.equal(employeeDetail.response.status, 200);
  assert.equal(employeeDetail.json.data.payslip.yearToDate.taxYear, '2026-27');

  const paid = await request(`/api/v1/payroll/${payslip._id}/mark-paid`, {
    method: 'POST', token: adminToken,
    body: { paymentMode: 'bank_transfer', paymentReference: 'UTR-PAYROLL-001', paidAt: '2026-07-07' },
  });
  assert.equal(paid.response.status, 200);
  assert.equal(paid.json.data.payroll.status, 'paid');
  assert.equal(paid.json.data.payroll.paymentReference, 'UTR-PAYROLL-001');
  const paidRecalculation = await request(`/api/v1/payroll/${payslip._id}/recalculate`, {
    method: 'POST', token: adminToken,
    body: { reason: 'Should not recalculate a paid payroll' },
  });
  assert.equal(paidRecalculation.response.status, 409);

  const download = await fetch(`${baseUrl}/api/v1/payroll/${payslip._id}/download`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /payslip-EMP001-2027-01\.html/);
  const downloadHtml = await download.text();
  assert.match(downloadHtml, /Performance bonus/);
  assert.match(downloadHtml, /Employee provident fund/);
  assert.match(downloadHtml, /Professional tax/);
  assert.match(downloadHtml, /Tax deducted at source/);
  assert.match(downloadHtml, /Employer pension contribution/);
  assert.match(downloadHtml, /Company cost for this period/);
  assert.match(downloadHtml, /Amount in words/);
  assert.match(downloadHtml, /Year-to-date summary/);
  assert.match(downloadHtml, /Payment and document details/);
  assert.match(downloadHtml, /Authorised signatory/);
  assert.match(downloadHtml, /Document ID/);
  assert.equal((await request('/api/v1/payroll/settings', {
    method: 'PATCH', token: adminToken,
    body: { statutory: { employeePfRate: 12 } },
  })).response.status, 200);
});

test('Company Admin can fully edit tenant employees and run payroll in bulk', async () => {
  const login = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'company@example.com', password: 'password123' },
  });
  const token = login.json.data.accessToken;

  const createdEmployee = await request('/api/v1/employees', {
    method: 'POST', token,
    body: {
      employeeId: 'EDIT001', firstName: 'Editable', lastName: 'Employee', email: 'editable@testco.test',
      phone: '+91 90000 12345', department: 'Operations', designation: 'Coordinator', dateOfJoining: '2026-08-01',
    },
  });
  assert.equal(createdEmployee.response.status, 201);
  const employeeId = createdEmployee.json.data.employee._id;

  const unconfigured = await request(`/api/v1/payroll/salary-structures/${employeeId}`, { token });
  assert.equal(unconfigured.response.status, 200);
  assert.equal(unconfigured.json.data.salaryStructure.structure.payrollEnabled, false);
  assert.equal(unconfigured.json.data.salaryStructure.structure.monthlyGross, 0);

  const edited = await request(`/api/v1/employees/${employeeId}`, {
    method: 'PATCH', token,
    body: {
      employeeId: 'EDIT002', firstName: 'Edited', lastName: 'Employee', phone: '+91 90000 54321',
      managerId: 'emp_mgr_001', department: 'Customer Success', designation: 'Senior Coordinator',
      dateOfJoining: '2026-08-02', lastWorkingDate: '', role: 'employee', status: 'active',
    },
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.json.data.employee.employeeId, 'EDIT002');
  assert.equal(edited.json.data.employee.department, 'Customer Success');
  assert.equal(edited.json.data.employee.managerId, 'emp_mgr_001');

  const selfEdit = await request('/api/v1/employees/emp_company_admin', {
    method: 'PATCH', token,
    body: { role: 'admin', phone: '+91 90000 99999' },
  });
  assert.equal(selfEdit.response.status, 200);

  const currentSettings = await request('/api/v1/payroll/settings', { token });
  const formulaSettings = await request('/api/v1/payroll/settings', {
    method: 'PATCH', token,
    body: {
      salaryTemplate: {
        basic: { calculation: 'percentage_of_gross', value: 50 },
        hra: { calculation: 'percentage_of_basic', value: 40 },
        balanceComponentName: 'Special allowance',
      },
      statutory: {
        ...currentSettings.json.data.settings.statutory,
        gratuityEnabled: true,
        gratuityRate: 4.81,
      },
      // Admins manually configure which earnings they want available
      earnings: [
        { code: 'conveyance', name: 'Conveyance allowance', calculation: 'fixed', defaultValue: 0, taxable: true, partOfPfWage: false, partOfEsiWage: true, prorate: true, active: false }, // Available but not active by default
        { code: 'internet_allowance', name: 'Internet allowance', calculation: 'fixed', defaultValue: 0, taxable: true, partOfPfWage: false, partOfEsiWage: true, prorate: true, active: false },
      ],
      // Admins manually configure which deductions they want available
      deductions: [
        { code: 'insurance_recovery', name: 'Insurance recovery', calculation: 'percentage_of_gross', defaultValue: 1, prorate: true, active: true },
      ],
    },
  });
  assert.equal(formulaSettings.response.status, 200);
  assert.equal(formulaSettings.json.data.settings.salaryTemplate.basic.value, 50);
  assert.equal(formulaSettings.json.data.settings.earnings.find((item) => item.code === 'conveyance').calculation, 'fixed');

  const salary = await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
    method: 'PUT', token,
    body: {
      payrollEnabled: true,
      salaryMode: 'company_template',
      monthlyGrossTarget: 20000,
      monthlyTds: 100,
      // Admin manually adds the earnings they want for this employee
      earnings: [
        { code: 'conveyance', name: 'Conveyance allowance', calculation: 'fixed', value: 1000, active: true },
        { code: 'internet_allowance', name: 'Internet allowance', calculation: 'fixed', value: 2000, active: true }
      ]
    },
  });
  assert.equal(salary.response.status, 200);
  const automaticStructure = salary.json.data.salaryStructure.structure;
  assert.equal(automaticStructure.payrollEnabled, true);
  // With fully manual system: Basic (10000) + HRA (4000) + manually added earnings
  assert.equal(automaticStructure.basic, 10000);
  assert.equal(automaticStructure.hra, 4000);
  assert.equal(automaticStructure.specialAllowance, 0); // Not auto-calculated

  // Verify manually added earnings appear
  assert.ok(automaticStructure.preview.earnings.some((item) => item.code === 'conveyance' && item.amount === 1000));
  assert.ok(automaticStructure.preview.earnings.some((item) => item.code === 'internet_allowance' && item.amount === 2000));
  assert.ok(automaticStructure.preview.employeeDeductions.some((item) => item.code === 'provident_fund' && item.amount === 1200));
  assert.ok(automaticStructure.preview.employeeDeductions.some((item) => item.code === 'employee_state_insurance'));
  // Insurance recovery calculated on actual gross
  assert.ok(automaticStructure.preview.employeeDeductions.some((item) => item.code === 'insurance_recovery'));
  assert.ok(automaticStructure.preview.employerContributions.some((item) => item.code === 'gratuity'));
  assert.ok(automaticStructure.preview.statutoryDetails.some((item) => item.code === 'gratuity' && item.applicable));

  const customSalary = await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
    method: 'PUT', token,
    body: {
      salaryMode: 'custom_formula',
      monthlyGrossTarget: 20000,
      coreRules: {
        basic: { calculation: 'percentage_of_gross', value: 45 },
        hra: { calculation: 'percentage_of_basic', value: 50 },
      },
      earnings: [
        { code: 'conveyance', name: 'Conveyance allowance', calculation: 'fixed', value: 600, active: true },
        { code: 'travel_allowance', name: 'Travel allowance', calculation: 'extra', value: 750, taxable: false, partOfPfWage: false, partOfEsiWage: false, active: true }
      ],
    },
  });
  assert.equal(customSalary.response.status, 200);
  const customStructure = customSalary.json.data.salaryStructure.structure;
  assert.equal(customStructure.basic, 9000);
  assert.equal(customStructure.hra, 4500);
  assert.equal(customStructure.specialAllowance, 0); // Not auto-calculated anymore
  assert.equal(customStructure.monthlyGross, 14100);
  assert.equal(customStructure.monthlyCTC, 14850);
  assert.ok(customStructure.preview.earnings.some((item) => item.code === 'conveyance' && item.amount === 600));
  assert.ok(customStructure.preview.earnings.some((item) => item.code === 'travel_allowance' && item.amount === 750));
  assert.ok(customStructure.preview.employeeDeductions.some((item) => item.code === 'provident_fund' && item.amount === 1080));
  assert.ok(customStructure.preview.employerContributions.some((item) => item.code === 'gratuity'));

  const generated = await request('/api/v1/payroll/generate', {
    method: 'POST', token,
    body: { period: '2027-03', replaceDrafts: true },
  });
  assert.equal(generated.response.status, 201);
  assert.ok(generated.json.data.run.employeeCount >= 3);
  assert.ok(generated.json.data.run.skippedCount >= 1);
  assert.ok(generated.json.data.run.skippedEmployees.every((item) => item.reason === 'Salary structure not configured'));
  const customPayslip = generated.json.data.payroll.find((item) => item.employee.employeeId === 'EDIT002');
  // With new logic: Basic (9000) + HRA (4500) + Conveyance (600) = 14100 (no auto special allowance)
  assert.equal(customPayslip.basic, 9000);
  assert.ok(customPayslip.earnings.some((item) => item.code === 'conveyance' && item.amount === 600));
  assert.ok(customPayslip.employerContributions.some((item) => item.code === 'gratuity'));

  const submitted = await request('/api/v1/payroll/bulk/submit', {
    method: 'POST', token, body: { period: '2027-03' },
  });
  assert.equal(submitted.response.status, 200);
  assert.equal(submitted.json.data.count, generated.json.data.run.employeeCount);

  const approved = await request('/api/v1/payroll/bulk/approve', {
    method: 'POST', token, body: { period: '2027-03' },
  });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.json.data.count, generated.json.data.run.employeeCount);

  const employeeLogin = await request('/api/v1/auth/login', {
    method: 'POST', body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  const visible = await request('/api/v1/payroll/my-payslips', { token: employeeLogin.json.data.accessToken });
  assert.ok(visible.json.data.payslips.some((item) => item.period === '2027-03' && item.status === 'approved'));
});

test('employee salary structures inherit company payroll defaults until explicitly overridden', async () => {
  const login = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'company@example.com', password: 'password123' },
  });
  assert.equal(login.response.status, 200);
  const token = login.json.data.accessToken;
  const current = await request('/api/v1/payroll/settings', { token });
  const originalSettings = current.json.data.settings;
  const originalConveyance = originalSettings.earnings.find((item) => item.code === 'conveyance');
  let employeeId = null;
  const conveyance = {
    ...(originalConveyance || {}),
    code: 'conveyance',
    name: 'Conveyance allowance',
    calculation: 'fixed',
    defaultValue: 1000,
    taxable: true,
    partOfPfWage: false,
    partOfEsiWage: true,
    prorate: true,
    active: true,
  };
  const earningsWithoutConveyance = originalSettings.earnings.filter((item) => item.code !== 'conveyance');

  try {
    const companyDefaults = await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: {
        salaryTemplate: {
          ...originalSettings.salaryTemplate,
          basic: { calculation: 'percentage_of_gross', value: 50, active: true },
        },
        statutory: { ...originalSettings.statutory, gratuityEnabled: true },
        earnings: [conveyance, ...earningsWithoutConveyance],
      },
    });
    assert.equal(companyDefaults.response.status, 200);

    const created = await request('/api/v1/employees', {
      method: 'POST', token,
      body: {
        employeeId: 'INHERIT001', firstName: 'Global', lastName: 'Defaults',
        email: 'global-defaults@testco.test', department: 'Finance', dateOfJoining: '2026-07-01',
      },
    });
    assert.equal(created.response.status, 201);
    employeeId = created.json.data.employee._id;

    const configured = await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
      method: 'PUT', token,
      body: {
        payrollEnabled: true,
        salaryMode: 'company_template',
        monthlyGrossTarget: 20000,
        earningOverrides: [],
        deductionOverrides: [],
        statutoryOverrides: {},
      },
    });
    assert.equal(configured.response.status, 200);
    let structure = configured.json.data.salaryStructure.structure;
    assert.equal(structure.earningOverrides.length, 0);
    assert.equal(structure.earnings.find((item) => item.code === 'conveyance').value, 1000);
    assert.equal(structure.preview.earnings.find((item) => item.code === 'conveyance').amount, 1000);
    assert.equal(structure.gratuityApplicable, true);

    const changedDefaults = await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: {
        salaryTemplate: {
          ...originalSettings.salaryTemplate,
          basic: { calculation: 'percentage_of_gross', value: 55, active: true },
        },
        earnings: [{ ...conveyance, defaultValue: 1500 }, ...earningsWithoutConveyance],
      },
    });
    assert.equal(changedDefaults.response.status, 200);

    let inherited = await request(`/api/v1/payroll/salary-structures/${employeeId}`, { token });
    structure = inherited.json.data.salaryStructure.structure;
    assert.equal(structure.basic, 11000);
    assert.equal(structure.earnings.find((item) => item.code === 'conveyance').value, 1500);

    const basicOverride = await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
      method: 'PUT', token,
      body: {
        coreRuleOverrides: {
          basic: { calculation: 'percentage_of_gross', value: 45, active: true },
        },
      },
    });
    assert.equal(basicOverride.response.status, 200);
    assert.equal(basicOverride.json.data.salaryStructure.structure.coreRuleOverrides.basic.value, 45);

    await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: {
        salaryTemplate: {
          ...originalSettings.salaryTemplate,
          basic: { calculation: 'percentage_of_gross', value: 45, active: true },
          hra: { calculation: 'percentage_of_basic', value: 50, active: true },
        },
      },
    });
    inherited = await request(`/api/v1/payroll/salary-structures/${employeeId}`, { token });
    structure = inherited.json.data.salaryStructure.structure;
    assert.equal(Object.keys(structure.coreRuleOverrides).length, 0);
    assert.equal(structure.basic, 9000);
    assert.equal(structure.hra, 4500);

    await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: { salaryTemplate: { basic: { calculation: 'percentage_of_gross', value: 58, active: true } } },
    });
    inherited = await request(`/api/v1/payroll/salary-structures/${employeeId}`, { token });
    assert.equal(inherited.json.data.salaryStructure.structure.basic, 11600);

    await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
      method: 'PUT', token,
      body: { coreRuleOverrides: { basic: { calculation: 'percentage_of_gross', value: 45, active: true } } },
    });
    await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: { salaryTemplate: { basic: { calculation: 'percentage_of_gross', value: 60, active: true } } },
    });
    inherited = await request(`/api/v1/payroll/salary-structures/${employeeId}`, { token });
    structure = inherited.json.data.salaryStructure.structure;
    assert.equal(structure.basic, 9000);
    assert.equal(structure.hra, 4500);
    assert.equal(structure.coreRuleOverrides.basic.value, 45);

    const resetBasic = await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
      method: 'PUT', token,
      body: { coreRuleOverrides: {} },
    });
    assert.equal(resetBasic.response.status, 200);
    assert.equal(resetBasic.json.data.salaryStructure.structure.basic, 12000);
    assert.equal(resetBasic.json.data.salaryStructure.structure.hra, 6000);

    const employeeOverride = await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
      method: 'PUT', token,
      body: {
        earningOverrides: [{ ...conveyance, value: 625 }],
        statutoryOverrides: { gratuityApplicable: false },
      },
    });
    assert.equal(employeeOverride.response.status, 200);
    assert.equal(employeeOverride.json.data.salaryStructure.structure.earningOverrides[0].value, 625);
    assert.equal(employeeOverride.json.data.salaryStructure.structure.gratuityApplicable, false);

    await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: { earnings: [{ ...conveyance, defaultValue: 1800 }, ...earningsWithoutConveyance] },
    });
    inherited = await request(`/api/v1/payroll/salary-structures/${employeeId}`, { token });
    assert.equal(inherited.json.data.salaryStructure.structure.earnings.find((item) => item.code === 'conveyance').value, 625);

    const reset = await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
      method: 'PUT', token,
      body: { earningOverrides: [], statutoryOverrides: {} },
    });
    assert.equal(reset.response.status, 200);
    structure = reset.json.data.salaryStructure.structure;
    assert.equal(structure.earnings.find((item) => item.code === 'conveyance').value, 1800);
    assert.equal(structure.gratuityApplicable, true);
  } finally {
    if (employeeId) await request(`/api/v1/employees/${employeeId}`, { method: 'DELETE', token });
    await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: {
        salaryTemplate: originalSettings.salaryTemplate,
        statutory: originalSettings.statutory,
        earnings: originalSettings.earnings,
        deductions: originalSettings.deductions,
      },
    });
  }
});

test('PF and ESI bases, thresholds, caps, and field-level employee overrides calculate independently', async () => {
  const login = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'company@example.com', password: 'password123' },
  });
  assert.equal(login.response.status, 200);
  const token = login.json.data.accessToken;
  const current = await request('/api/v1/payroll/settings', { token });
  const originalSettings = current.json.data.settings;
  let employeeId = null;

  try {
    const saved = await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: {
        statutory: {
          ...originalSettings.statutory,
          pfEnabled: true,
          employeePfRate: 12,
          employerPfRate: 13,
          epsRate: 8.33,
          edliRate: 0.5,
          pfWageBasis: 'gross',
          pfCeilingTrigger: 20000,
          pfWageCeiling: 15000,
          restrictPfToCeiling: true,
          esiEnabled: true,
          employeeEsiRate: 0.75,
          employerEsiRate: 3.25,
          esiWageBasis: 'gross',
          esiGrossCeiling: 35000,
        },
        earnings: [],
        deductions: [],
      },
    });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.json.data.settings.statutory.pfWageBasis, 'gross');
    assert.equal(saved.json.data.settings.statutory.pfCeilingTrigger, 20000);
    assert.equal(saved.json.data.settings.statutory.esiWageBasis, 'gross');

    const created = await request('/api/v1/employees', {
      method: 'POST', token,
      body: {
        employeeId: 'STAT001', firstName: 'Statutory', lastName: 'Policy',
        email: 'statutory-policy@testco.test', department: 'Finance', dateOfJoining: '2026-07-01',
      },
    });
    assert.equal(created.response.status, 201);
    employeeId = created.json.data.employee._id;

    let salary = await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
      method: 'PUT', token,
      body: {
        payrollEnabled: true,
        salaryMode: 'custom_formula',
        monthlyGrossTarget: 30000,
        coreRules: {
          basic: { calculation: 'percentage_of_gross', value: 60, active: true },
          hra: { calculation: 'percentage_of_gross', value: 40, active: true },
        },
        earningOverrides: [],
        deductionOverrides: [],
        statutoryOverrides: {},
        statutoryPolicyOverrides: {},
      },
    });
    assert.equal(salary.response.status, 200);
    let structure = salary.json.data.salaryStructure.structure;
    assert.equal(structure.monthlyGross, 30000);
    assert.equal(structure.statutoryPolicyOverrides && Object.keys(structure.statutoryPolicyOverrides).length, 0);
    assert.equal(structure.preview.employeeDeductions.find((item) => item.code === 'provident_fund').amount, 1800);
    assert.equal(structure.preview.employeeDeductions.find((item) => item.code === 'employee_state_insurance').amount, 225);

    await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: { statutory: { restrictPfToCeiling: false } },
    });
    let uncapped = await request(`/api/v1/payroll/salary-structures/${employeeId}`, { token });
    assert.equal(uncapped.json.data.salaryStructure.structure.preview.employeeDeductions.find((item) => item.code === 'provident_fund').amount, 3600);
    await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: { statutory: { restrictPfToCeiling: true } },
    });
    uncapped = await request(`/api/v1/payroll/salary-structures/${employeeId}`, { token });
    assert.equal(uncapped.json.data.salaryStructure.structure.preview.employeeDeductions.find((item) => item.code === 'provident_fund').amount, 1800);

    salary = await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
      method: 'PUT', token,
      body: {
        statutoryPolicyOverrides: {
          employeePfRate: 8,
          pfWageBasis: 'basic',
          pfCeilingTrigger: 40000,
          employeeEsiRate: 1,
          esiWageBasis: 'basic',
        },
      },
    });
    assert.equal(salary.response.status, 200);
    structure = salary.json.data.salaryStructure.structure;
    assert.equal(structure.statutoryPolicyOverrides.employeePfRate, 8);
    assert.equal(structure.statutoryPolicy.employerPfRate, 13);
    assert.equal(structure.preview.employeeDeductions.find((item) => item.code === 'provident_fund').amount, 1440);
    assert.equal(structure.preview.employeeDeductions.find((item) => item.code === 'employee_state_insurance').amount, 180);

    await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: { statutory: { employeePfRate: 11, employerPfRate: 14, employeeEsiRate: 0.8 } },
    });
    const inherited = await request(`/api/v1/payroll/salary-structures/${employeeId}`, { token });
    structure = inherited.json.data.salaryStructure.structure;
    assert.equal(structure.statutoryPolicy.employeePfRate, 8);
    assert.equal(structure.statutoryPolicy.employerPfRate, 14);
    assert.equal(structure.statutoryPolicy.employeeEsiRate, 1);

    const reset = await request(`/api/v1/payroll/salary-structures/${employeeId}`, {
      method: 'PUT', token,
      body: { statutoryPolicyOverrides: {} },
    });
    assert.equal(reset.response.status, 200);
    structure = reset.json.data.salaryStructure.structure;
    assert.equal(Object.keys(structure.statutoryPolicyOverrides).length, 0);
    assert.equal(structure.statutoryPolicy.employeePfRate, 11);
    assert.equal(structure.statutoryPolicy.employerPfRate, 14);
    assert.equal(structure.statutoryPolicy.employeeEsiRate, 0.8);
    assert.equal(structure.statutoryPolicy.pfWageBasis, 'gross');
  } finally {
    if (employeeId) await request(`/api/v1/employees/${employeeId}`, { method: 'DELETE', token });
    await request('/api/v1/payroll/settings', {
      method: 'PATCH', token,
      body: {
        statutory: originalSettings.statutory,
        earnings: originalSettings.earnings,
        deductions: originalSettings.deductions,
      },
    });
  }
});

test('generated payroll uses the effective employee statutory policy', () => {
  const data = createSeedData();
  const company = data.companies.find((item) => item._id === 'company_testco');
  const employee = data.employees.find((item) => item._id === 'emp_001');
  const settings = {
    ...company.payrollSettings,
    attendanceProration: false,
    earnings: [],
    deductions: [],
    statutory: {
      ...company.payrollSettings.statutory,
      pfEnabled: true,
      employeePfRate: 12,
      employerPfRate: 13,
      pfWageBasis: 'gross',
      pfCeilingTrigger: 20000,
      pfWageCeiling: 15000,
      restrictPfToCeiling: true,
      esiEnabled: true,
      employeeEsiRate: 0.75,
      employerEsiRate: 3.25,
      esiWageBasis: 'gross',
      esiGrossCeiling: 35000,
    },
  };
  const salary = {
    payrollEnabled: true,
    salaryMode: 'custom_formula',
    monthlyGrossTarget: 30000,
    coreRules: {
      basic: { calculation: 'percentage_of_gross', value: 60, active: true },
      hra: { calculation: 'percentage_of_gross', value: 40, active: true },
    },
    earningOverrides: [],
    deductionOverrides: [],
    statutoryOverrides: {},
    statutoryPolicyOverrides: { employeePfRate: 10 },
  };
  const payroll = calculatePayroll(data, company, employee, '2027-04', settings, salary, []);
  assert.equal(payroll.gross, 30000);
  assert.equal(payroll.employeeDeductions.find((item) => item.code === 'provident_fund').amount, 1500);
  assert.equal(payroll.employeeDeductions.find((item) => item.code === 'employee_state_insurance').amount, 225);
  assert.equal(payroll.salarySnapshot.statutoryPolicy.employeePfRate, 10);
  assert.equal(payroll.salarySnapshot.statutoryPolicy.employerPfRate, 13);
});

test('automatic payroll generation is duplicate-safe', () => {
  const data = createSeedData();
  const company = data.companies.find((item) => item.code === 'TESTCO');
  company.payrollSettings.autoGeneration = { enabled: true, dayOfMonth: 25, period: 'current', submitForApproval: true };
  const at = new Date('2027-02-27T06:00:00.000Z');
  const first = runAutomaticPayroll(data, at);
  const second = runAutomaticPayroll(data, at);
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
  assert.equal(first[0].period, '2027-02');
  assert.equal(first[0].status, 'pending_approval');
});

test('attendance policy, WFH assignment, and unpaid leave feed payroll loss-of-pay', async () => {
  const login = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'company@example.com', password: 'password123' },
  });
  assert.equal(login.response.status, 200);
  const token = login.json.data.accessToken;

  const savedPolicy = await request('/api/v1/attendance/policy', {
    method: 'PATCH', token,
    body: {
      attendancePolicy: {
        payrollImpact: 'attendance_and_leave',
        fullDayMinutes: 480,
        halfDayMinutes: 240,
        deductUnpaidLeave: true,
        deductUnnoticedAbsence: true,
        deductHalfDay: true,
        wfhPayableDays: 1,
        wfhRequiresCheckIn: false,
        untrackedWfhPayableDays: 1,
      },
    },
  });
  assert.equal(savedPolicy.response.status, 200);
  assert.equal(savedPolicy.json.data.policy.payrollImpact, 'attendance_and_leave');

  const currentSettings = await request('/api/v1/payroll/settings', { token });
  const simplePayroll = await request('/api/v1/payroll/settings', {
    method: 'PATCH', token,
    body: {
      workingDayMethod: 'calendar_days',
      attendanceProration: true,
      statutory: {
        ...currentSettings.json.data.settings.statutory,
        pfEnabled: false,
        esiEnabled: false,
        professionalTaxEnabled: false,
        labourWelfareFundEnabled: false,
        gratuityEnabled: false,
        tdsEnabled: false,
      },
      earnings: [],
      deductions: [],
    },
  });
  assert.equal(simplePayroll.response.status, 200);

  const createdEmployee = await request('/api/v1/employees', {
    method: 'POST', token,
    body: {
      employeeId: 'ATT001',
      firstName: 'Attendance',
      lastName: 'Worker',
      email: 'attendance-worker@testco.test',
      passcode: '1234',
      dateOfJoining: '2026-07-01',
      department: 'Operations',
    },
  });
  assert.equal(createdEmployee.response.status, 201);
  const employee = createdEmployee.json.data.employee;

  const editedEmployee = await request(`/api/v1/employees/${employee._id}`, {
    method: 'PATCH', token,
    body: { lastWorkingDate: '2026-07-04' },
  });
  assert.equal(editedEmployee.response.status, 200);

  const salary = await request(`/api/v1/payroll/salary-structures/${employee._id}`, {
    method: 'PUT', token,
    body: {
      payrollEnabled: true,
      basic: 30000,
      hra: 0,
      specialAllowance: 0,
      earnings: [],
      deductions: [],
      pfApplicable: false,
      esiApplicable: false,
      professionalTaxApplicable: false,
      gratuityApplicable: false,
    },
  });
  assert.equal(salary.response.status, 200);
  assert.equal(salary.json.data.salaryStructure.structure.monthlyGross, 30000);

  const fullDay = await request('/api/v1/attendance/status', {
    method: 'PATCH', token,
    body: { employeeId: employee._id, date: '2026-07-01', status: 'present', workDuration: 480 },
  });
  assert.equal(fullDay.response.status, 200);
  const halfDay = await request('/api/v1/attendance/status', {
    method: 'PATCH', token,
    body: { employeeId: employee._id, date: '2026-07-02', status: 'half_day', workDuration: 240 },
  });
  assert.equal(halfDay.response.status, 200);

  const wfh = await request('/api/v1/wfh/assign', {
    method: 'POST', token,
    body: { employeeId: employee._id, startDate: '2026-07-03', endDate: '2026-07-03', workFromLocation: 'Home', reason: 'Payroll attendance policy test' },
  });
  assert.equal(wfh.response.status, 201);

  const employeeLogin = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { companyCode: 'TESTCO', employeeId: 'ATT001', passcode: '1234' },
  });
  assert.equal(employeeLogin.response.status, 200);
  const leave = await request('/api/v1/leaves/apply', {
    method: 'POST', token: employeeLogin.json.data.accessToken,
    body: { leaveType: 'unpaid', startDate: '2026-07-04', endDate: '2026-07-04', reason: 'Unpaid absence' },
  });
  assert.equal(leave.response.status, 201);
  const approvedLeave = await request(`/api/v1/leaves/${leave.json.data.leave._id}/approve`, {
    method: 'POST', token,
    body: { action: 'approve' },
  });
  assert.equal(approvedLeave.response.status, 200);

  const team = await request('/api/v1/attendance/team?date=2026-07-03&period=2026-07', { token });
  assert.equal(team.response.status, 200);
  const row = team.json.data.attendances.find((item) => item.employee.employeeId === 'ATT001');
  assert.equal(row.day.status, 'work_from_home');
  assert.equal(row.summary.eligibleDays, 4);
  assert.equal(row.summary.payableDays, 2.5);
  assert.equal(row.summary.lossOfPayDays, 1.5);
  assert.equal(row.summary.halfDayDays, 1);
  assert.equal(row.summary.workFromHomeDays, 1);
  assert.equal(row.summary.unpaidLeaveDays, 1);

  const generated = await request('/api/v1/payroll/generate', {
    method: 'POST', token,
    body: { employeeId: employee._id, period: '2026-07', replaceDrafts: true },
  });
  assert.equal(generated.response.status, 201);
  const payslip = generated.json.data.payroll[0];
  assert.equal(payslip.attendanceSummary.payrollImpact, 'attendance_and_leave');
  assert.equal(payslip.attendanceSummary.payableDays, 2.5);
  assert.equal(payslip.attendanceSummary.lossOfPayDays, 1.5);
  assert.equal(payslip.gross, 2419.35);
  assert.equal(payslip.net, 2419.35);
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

  const mobileSalary = await request(`/api/v1/payroll/salary-structures/${employee.json.data.employee._id}`, {
    method: 'PUT', token: adminToken,
    body: { payrollEnabled: true, basic: 18000, hra: 7200, specialAllowance: 2800 },
  });
  assert.equal(mobileSalary.response.status, 200);

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
  assert.deepEqual(managerEmployees.json.data.employees.map((employee) => employee.employeeId).sort(), ['EDIT002', 'EMP001', 'MGR001']);

  const managerCreate = await request('/api/v1/employees', {
    method: 'POST', token: managerToken,
    body: { firstName: 'Forbidden', email: 'forbidden-manager@testco.test' },
  });
  assert.equal(managerCreate.response.status, 403);
  assert.equal((await request('/api/v1/payroll', { token: managerToken })).response.status, 403);
  assert.equal((await request('/api/v1/subscriptions', { token: managerToken })).response.status, 403);
  assert.equal((await request('/api/v1/companies/settings', { method: 'PATCH', token: managerToken, body: { gpsTracking: false } })).response.status, 403);

  const teamAttendance = await request('/api/v1/attendance/team', { token: managerToken });
  assert.deepEqual(teamAttendance.json.data.attendances.map((item) => item.employee.employeeId).sort(), ['EDIT002', 'EMP001', 'MGR001']);
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
  assert.equal((await request(`/api/v1/employees/${hrCreate.json.data.employee._id}`, { method: 'PATCH', token: hrToken, body: { status: 'inactive' } })).response.status, 403);
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

  const automaticAdminLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'company@example.com', password: 'password123' },
  });
  assert.equal(automaticAdminLogin.response.status, 200);
  const automaticToken = automaticAdminLogin.json.data.accessToken;
  const automaticBilling = await request('/api/v1/subscriptions', { token: automaticToken });
  assert.equal(automaticBilling.response.status, 200);
  assert.equal(automaticBilling.json.data.current.billingMode, 'automatic');
  assert.ok(automaticBilling.json.data.paymentGateways.some((gateway) => gateway.code === 'cashfree' && gateway.enabled));
  const professionalPlan = automaticBilling.json.data.plans.find((plan) => plan._id === 'plan_professional');
  const minimumSeats = Math.max(0, automaticBilling.json.data.current.activeUsers - automaticBilling.json.data.current.includedSeats);
  const planOrder = await request('/api/v1/subscriptions/plan-change', {
    method: 'POST', token: automaticToken,
    body: { planId: professionalPlan._id, paidSeats: minimumSeats, billingCycle: 'yearly' },
  });
  assert.equal(planOrder.response.status, 201);
  assert.equal(planOrder.json.data.invoice.kind, 'subscription_purchase');
  assert.equal(planOrder.json.data.invoice.total, professionalPlan.pricePerUser * minimumSeats * 12 * 0.9);
  const checkout = await request('/api/v1/subscriptions/checkout', {
    method: 'POST', token: automaticToken, body: { invoiceId: planOrder.json.data.invoice._id },
  });
  assert.equal(checkout.response.status, 200);
  assert.equal(checkout.json.data.invoice.status, 'paid');
  assert.equal(checkout.json.data.payment.status, 'cleared');
  assert.match(checkout.json.data.payment.reference, /^CASHFREE-TEST-/);
  assert.equal(checkout.json.data.current.plan, 'Professional');
  assert.equal(checkout.json.data.current.billingCycle, 'yearly');

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

  const pausedAdminLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'company@example.com', password: 'password123' },
  });
  assert.equal(pausedAdminLogin.response.status, 200);
  const pausedToken = pausedAdminLogin.json.data.accessToken;
  const pausedBilling = await request('/api/v1/subscriptions', { token: pausedToken });
  const overdueRenewal = pausedBilling.json.data.invoices.find((invoice) => invoice.kind === 'renewal' && invoice.amountDue > 0);
  assert.ok(overdueRenewal);
  const debtPayment = await request('/api/v1/subscriptions/checkout', {
    method: 'POST', token: pausedToken, body: { invoiceId: overdueRenewal._id },
  });
  assert.equal(debtPayment.response.status, 200);
  assert.equal(debtPayment.json.data.invoice.status, 'paid');
  assert.equal(debtPayment.json.data.current.status, 'paused');
  assert.match(debtPayment.json.data.message, /purchase a new prepaid term/i);

  const starterPlan = pausedBilling.json.data.plans.find((plan) => plan._id === 'plan_starter');
  const reactivationSeats = Math.max(0, pausedBilling.json.data.current.activeUsers - pausedBilling.json.data.current.includedSeats);
  const reactivationOrder = await request('/api/v1/subscriptions/plan-change', {
    method: 'POST', token: pausedToken,
    body: { planId: starterPlan._id, paidSeats: reactivationSeats, billingCycle: 'monthly' },
  });
  assert.equal(reactivationOrder.response.status, 201);
  const reactivationPayment = await request('/api/v1/subscriptions/checkout', {
    method: 'POST', token: pausedToken, body: { invoiceId: reactivationOrder.json.data.invoice._id },
  });
  assert.equal(reactivationPayment.response.status, 200);
  assert.equal(reactivationPayment.json.data.current.status, 'active');
  assert.equal(reactivationPayment.json.data.current.plan, 'Starter');
  assert.ok(new Date(reactivationPayment.json.data.current.currentPeriodStart).getTime() > new Date('2026-06-17T00:00:00.000Z').getTime());

  await request(`/api/v1/admin/companies/${testco.companyId}`, {
    method: 'PATCH', token,
    body: { billingMode: 'automatic', subscriptionStatus: 'active', nextRenewalAt: '2026-08-01T00:00:00.000Z' },
  });
});

test('paid seats are the whole allowance, with no bundled free admin seat', async () => {
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

test('legacy payslips keep approved totals and expose itemized current-policy references', () => {
  const data = createSeedData();
  const company = data.companies.find((item) => item._id === 'company_testco');
  company.payrollSettings.statutory.gratuityEnabled = true;
  company.payrollSettings.statutory.gratuityRate = 4.81;
  const legacy = {
    _id: 'legacy_payroll_detail_test',
    companyId: 'company_testco',
    employeeId: 'emp_001',
    period: '2026-07',
    basic: 18000,
    hra: 6000,
    allowances: 6000,
    deductions: 2800,
    gross: 30000,
    net: 27200,
    status: 'approved',
  };

  const detailed = itemizePayslip(data, legacy);
  assert.ok(detailed.earnings.some((item) => item.code === 'conveyance' && item.amount === 6000));
  assert.equal(detailed.employeeDeductions[0].code, 'legacy_deductions');
  assert.equal(detailed.employeeDeductions[0].amount, 2800);
  assert.ok(detailed.statutoryReference.employeeDeductions.some((item) => item.code === 'provident_fund'));
  assert.ok(detailed.statutoryReference.employerContributions.some((item) => item.code === 'gratuity' && item.amount === 865.8));
  assert.match(detailed.legacyDetailWarning, /historical payslip/i);
});

test('employee salary entry, manual TDS, and reimbursements flow through payroll without duplicates', async () => {
  const superLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'admin@qhr.com', password: 'admin123' },
  });
  await request('/api/v1/admin/companies/company_testco', {
    method: 'PATCH', token: superLogin.json.data.accessToken, body: { paidSeats: 100 },
  });
  const adminLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'company@example.com', password: 'password123' },
  });
  const adminToken = adminLogin.json.data.accessToken;
  await request('/api/v1/payroll/settings', {
    method: 'PATCH', token: adminToken, body: { statutory: { tdsEnabled: true } },
  });
  await request('/api/v1/attendance/policy', {
    method: 'PATCH', token: adminToken, body: { attendancePolicy: { payrollImpact: 'none' } },
  });

  const createdEmployee = await request('/api/v1/employees', {
    method: 'POST',
    token: adminToken,
    body: {
      employeeId: 'RMB001',
      firstName: 'Reena',
      lastName: 'Bose',
      email: 'reena-reimbursement@testco.test',
      passcode: '2468',
      managerId: 'emp_mgr_001',
      department: 'Engineering',
      designation: 'QA Engineer',
      salary: {
        payrollEnabled: true,
        salaryMode: 'company_template',
        effectiveFrom: '2027-12-01',
        monthlyGrossTarget: 50000,
        monthlyTds: 1750,
        paymentMode: 'bank_transfer',
        bankName: 'Test Bank',
        bankAccountLast4: '9876',
        bankIfsc: 'TEST0001234',
        recurringExtra: { name: 'Internet reimbursement', amount: 1200 },
      },
    },
  });
  assert.equal(createdEmployee.response.status, 201);
  const employee = createdEmployee.json.data.employee;
  assert.equal(employee.salary.monthlyGrossTarget, 50000);
  assert.equal(employee.salary.monthlyTds, 1750);
  assert.equal(employee.salary.preview.gross, employee.salary.monthlyGross);
  assert.equal(employee.salary.preview.paidAfterGross, 1200);
  assert.equal(employee.salary.preview.totalEarnings, employee.salary.monthlyGross + 1200);
  assert.equal(employee.salary.preview.employeeDeductions.find((item) => item.code === 'tds').amount, 1750);
  assert.ok(employee.salary.earningOverrides.some((item) => item.code === 'employee_recurring_extra' && item.value === 1200));

  const employeeLogin = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { companyCode: 'TESTCO', employeeId: 'RMB001', passcode: '2468' },
  });
  const employeeToken = employeeLogin.json.data.accessToken;
  const submittedClaim = await request('/api/v1/reimbursements', {
    method: 'POST',
    token: employeeToken,
    body: {
      category: 'travel',
      expenseDate: '2027-12-15',
      amount: 800,
      merchant: 'Metro Rail',
      projectOrCostCenter: 'Project Phoenix',
      description: 'Client-site travel expense',
      attachments: [{ name: 'Travel receipt', url: 'https://example.test/receipt-001' }],
    },
  });
  assert.equal(submittedClaim.response.status, 201);
  assert.equal(submittedClaim.json.data.reimbursement.status, 'pending_manager');
  const claimId = submittedClaim.json.data.reimbursement._id;

  const managerLogin = await request('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'manager@testco.com', password: 'password123' },
  });
  const managerReview = await request(`/api/v1/reimbursements/${claimId}/review`, {
    method: 'PATCH', token: managerLogin.json.data.accessToken, body: { action: 'approve' },
  });
  assert.equal(managerReview.response.status, 200);
  assert.equal(managerReview.json.data.reimbursement.status, 'pending_finance');

  const financeReview = await request(`/api/v1/reimbursements/${claimId}/review`, {
    method: 'PATCH', token: adminToken,
    body: { action: 'approve', approvedAmount: 750, paymentMethod: 'through_payroll', payrollPeriod: '2028-01' },
  });
  assert.equal(financeReview.response.status, 200);
  assert.equal(financeReview.json.data.reimbursement.status, 'approved');

  let generated = await request('/api/v1/payroll/generate', {
    method: 'POST', token: adminToken,
    body: { employeeId: employee._id, period: '2028-01' },
  });
  assert.equal(generated.response.status, 201);
  let payslip = generated.json.data.payroll[0];
  assert.equal(payslip.salaryGross, employee.salary.monthlyGross);
  assert.equal(payslip.reimbursementTotal, 1950);
  assert.equal(payslip.employeeDeductions.find((item) => item.code === 'tds').amount, 1750);
  assert.equal(payslip.adjustments.filter((item) => item.reimbursementClaimId === claimId).length, 1);

  generated = await request('/api/v1/payroll/generate', {
    method: 'POST', token: adminToken,
    body: { employeeId: employee._id, period: '2028-01', replaceDrafts: true },
  });
  payslip = generated.json.data.payroll[0];
  assert.equal(payslip.adjustments.filter((item) => item.reimbursementClaimId === claimId).length, 1);

  const approved = await request(`/api/v1/payroll/${payslip._id}/approve`, {
    method: 'PATCH', token: adminToken,
  });
  assert.equal(approved.response.status, 200);
  const paid = await request(`/api/v1/payroll/${payslip._id}/mark-paid`, {
    method: 'POST', token: adminToken,
    body: { paymentReference: 'PAYROLL-UTR-001', paidAt: '2026-07-07' },
  });
  assert.equal(paid.response.status, 200);
  const employeeClaims = await request('/api/v1/reimbursements/my?limit=100', { token: employeeToken });
  const paidClaim = employeeClaims.json.data.reimbursements.find((item) => item._id === claimId);
  assert.equal(paidClaim.status, 'paid');
  assert.equal(paidClaim.paymentReference, 'PAYROLL-UTR-001');

  const separateClaim = await request('/api/v1/reimbursements', {
    method: 'POST', token: employeeToken,
    body: { category: 'meals', expenseDate: '2027-12-20', amount: 300, description: 'Approved client meeting meal' },
  });
  const separateId = separateClaim.json.data.reimbursement._id;
  await request(`/api/v1/reimbursements/${separateId}/review`, {
    method: 'PATCH', token: managerLogin.json.data.accessToken, body: { action: 'approve' },
  });
  const separateApproved = await request(`/api/v1/reimbursements/${separateId}/review`, {
    method: 'PATCH', token: adminToken,
    body: { action: 'approve', approvedAmount: 300, paymentMethod: 'separate_payment' },
  });
  assert.equal(separateApproved.json.data.reimbursement.status, 'approved');
  const separatePaid = await request(`/api/v1/reimbursements/${separateId}/mark-paid`, {
    method: 'POST', token: adminToken, body: { paymentReference: 'EXPENSE-UTR-002', paidAt: '2026-07-07' },
  });
  assert.equal(separatePaid.response.status, 200);
  assert.equal(separatePaid.json.data.reimbursement.status, 'paid');
  assert.equal(separatePaid.json.data.reimbursement.linkedPayrollId, null);
});
