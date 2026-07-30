const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');

process.env.NODE_ENV = 'test';

const { createApp } = require('../src/app');
const { JsonStore } = require('../src/store/jsonStore');

const dataFile = path.join(__dirname, `enterprise-smoke-${process.pid}.json`);
let server;
let baseUrl;
// Kept module-scoped so a test can assert on what was actually written, not only
// on what the API chose to return.
let store;

test.before(async () => {
  await fs.rm(dataFile, { force: true });
  store = new JsonStore(dataFile);
  const app = createApp({ store });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // Windows can still hold a handle on the freshly renamed store files, so a failed
  // cleanup must not turn a passing suite red.
  for (const file of [dataFile, `${dataFile}.bak`]) {
    await fs.rm(file, { force: true, maxRetries: 5, retryDelay: 50 }).catch(() => undefined);
  }
});

async function call(pathname, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  return {
    status: response.status,
    data: json.data || {},
    details: json.details || {},
    message: json.message,
  };
}

async function adminToken() {
  const login = await call('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'company@example.com', password: 'password123' },
  });
  assert.equal(login.status, 200);
  return login.data.accessToken;
}

test('org masters, permissions, and employee assignment work together', async () => {
  const token = await adminToken();

  const department = await call('/api/v1/org/departments', {
    method: 'POST', token, body: { name: 'Engineering', code: 'ENG' },
  });
  assert.equal(department.status, 201);

  const duplicate = await call('/api/v1/org/departments', {
    method: 'POST', token, body: { name: 'Engineering Again', code: 'ENG' },
  });
  assert.equal(duplicate.status, 409);

  const designation = await call('/api/v1/org/designations', {
    method: 'POST', token, body: { name: 'Senior Engineer', code: 'SRENG', level: 3, departmentId: department.data.department._id },
  });
  assert.equal(designation.status, 201);

  const location = await call('/api/v1/org/work-locations', {
    method: 'POST', token, body: { name: 'Bhubaneswar HQ', code: 'BBSR', city: 'Bhubaneswar', state: 'Odisha', isPayrollAddress: true },
  });
  assert.equal(location.status, 201);
  assert.equal(location.data.workLocation.isPayrollAddress, true);

  const masters = await call('/api/v1/org', { token });
  assert.equal(masters.status, 200);
  assert.equal(masters.data.departments.length, 1);
  assert.equal(masters.data.hierarchy.length, 1);

  const employee = await call('/api/v1/employees', {
    method: 'POST',
    token,
    body: {
      firstName: 'Org', lastName: 'Member', email: 'org-member@testco.test',
      departmentId: department.data.department._id,
      designationId: designation.data.designation._id,
      workLocationId: location.data.workLocation._id,
      employmentType: 'contract',
      permissionGrants: ['assets.manage'],
    },
  });
  assert.equal(employee.status, 201);
  assert.equal(employee.data.employee.employmentType, 'contract');

  const badReference = await call('/api/v1/employees', {
    method: 'POST', token,
    body: { firstName: 'Bad', email: 'bad-ref@testco.test', departmentId: 'dept_missing' },
  });
  assert.equal(badReference.status, 400);

  const invalidPermission = await call('/api/v1/employees', {
    method: 'POST', token,
    body: { firstName: 'Bad', email: 'bad-perm@testco.test', permissionGrants: ['not.a.permission'] },
  });
  assert.equal(invalidPermission.status, 400);

  const referencedDelete = await call(`/api/v1/org/departments/${department.data.department._id}`, { method: 'DELETE', token });
  assert.equal(referencedDelete.status, 400);

  const permissions = await call('/api/v1/employees/me/permissions', { token });
  assert.equal(permissions.status, 200);
  assert.ok(permissions.data.permissions.includes('payroll.approve'));
});

test('projects gate tasks, and the board supports comments, ordering, and watchers', async () => {
  const token = await adminToken();

  const orphanTask = await call('/api/v1/tasks', {
    method: 'POST', token, body: { title: 'Task without a project' },
  });
  assert.equal(orphanTask.status, 400);

  const project = await call('/api/v1/projects', {
    method: 'POST', token, body: { name: 'Attendance Revamp', key: 'ATR' },
  });
  assert.equal(project.status, 201);
  assert.equal(project.data.project.key, 'ATR');
  assert.equal(project.data.project.boardColumns.length, 5);

  const projectId = project.data.project._id;
  const first = await call('/api/v1/tasks', {
    method: 'POST', token, body: { title: 'Design searchable dropdown', projectId, priority: 'high' },
  });
  assert.equal(first.status, 201);
  assert.equal(first.data.task.key, 'ATR-1');

  const second = await call('/api/v1/tasks', {
    method: 'POST', token, body: { title: 'Build kanban board', projectId },
  });
  assert.equal(second.data.task.key, 'ATR-2');

  const moved = await call(`/api/v1/tasks/${second.data.task._id}/move`, {
    method: 'PATCH', token, body: { status: 'in_progress' },
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.task.status, 'in_progress');

  const badStatus = await call(`/api/v1/tasks/${second.data.task._id}/move`, {
    method: 'PATCH', token, body: { status: 'not_a_column' },
  });
  assert.equal(badStatus.status, 400);

  const emptyComment = await call(`/api/v1/tasks/${first.data.task._id}/comments`, {
    method: 'POST', token, body: { body: '   ' },
  });
  assert.equal(emptyComment.status, 400);

  const comment = await call(`/api/v1/tasks/${first.data.task._id}/comments`, {
    method: 'POST', token, body: { body: 'Starting this today' },
  });
  assert.equal(comment.status, 200);
  const commentId = comment.data.comment._id;

  const reply = await call(`/api/v1/tasks/${first.data.task._id}/comments`, {
    method: 'POST', token, body: { body: 'Threaded reply', parentCommentId: commentId },
  });
  assert.equal(reply.status, 200);
  assert.equal(reply.data.comment.parentCommentId, commentId);

  const board = await call(`/api/v1/projects/${projectId}/board`, { token });
  assert.equal(board.status, 200);
  assert.equal(board.data.columns.length, 5);
  const inProgress = board.data.columns.find((entry) => entry.column.id === 'in_progress');
  assert.equal(inProgress.tasks.length, 1);

  const archiveBlocked = await call(`/api/v1/projects/${projectId}`, { method: 'DELETE', token });
  assert.equal(archiveBlocked.status, 409);
});

test('assets can be assigned, acknowledged, and returned', async () => {
  const token = await adminToken();

  const asset = await call('/api/v1/assets', {
    method: 'POST', token, body: { assetTag: 'lap-001', name: 'ThinkPad T14', category: 'laptop' },
  });
  assert.equal(asset.status, 201);
  assert.equal(asset.data.asset.assetTag, 'LAP-001');
  const assetId = asset.data.asset._id;

  const duplicateTag = await call('/api/v1/assets', {
    method: 'POST', token, body: { assetTag: 'LAP-001', name: 'Duplicate' },
  });
  assert.equal(duplicateTag.status, 409);

  const employeeLogin = await call('/api/v1/auth/login', {
    method: 'POST', body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  assert.equal(employeeLogin.status, 200);
  const employeeToken = employeeLogin.data.accessToken;
  const employeeId = employeeLogin.data.employee._id;

  const assigned = await call(`/api/v1/assets/${assetId}/assign`, {
    method: 'POST', token, body: { employeeId, conditionOnAssign: 'good' },
  });
  assert.equal(assigned.status, 201);
  assert.equal(assigned.data.asset.status, 'assigned');

  const doubleAssign = await call(`/api/v1/assets/${assetId}/assign`, {
    method: 'POST', token, body: { employeeId },
  });
  assert.equal(doubleAssign.status, 409);

  const blockedDelete = await call(`/api/v1/assets/${assetId}`, { method: 'DELETE', token });
  assert.equal(blockedDelete.status, 409);

  const mine = await call('/api/v1/assets/my', { token: employeeToken });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.assets.length, 1);

  const acknowledged = await call(`/api/v1/assets/${assetId}/acknowledge`, { method: 'POST', token: employeeToken });
  assert.equal(acknowledged.status, 200);
  assert.ok(acknowledged.data.assignment.acknowledgedAt);

  const returned = await call(`/api/v1/assets/${assetId}/return`, {
    method: 'POST', token, body: { conditionOnReturn: 'damaged' },
  });
  assert.equal(returned.status, 200);
  assert.equal(returned.data.asset.status, 'in_repair');

  const summary = await call('/api/v1/assets/summary', { token });
  assert.equal(summary.status, 200);
  assert.equal(summary.data.total, 1);
});

test('leave approval escalates to HR and restores balance on cancellation', async () => {
  const token = await adminToken();
  const employeeLogin = await call('/api/v1/auth/login', {
    method: 'POST', body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  const employeeToken = employeeLogin.data.accessToken;

  const longLeave = await call('/api/v1/leaves/apply', {
    method: 'POST', token: employeeToken,
    body: { leaveType: 'earned', startDate: '2026-11-02', endDate: '2026-11-06', reason: 'Five day break' },
  });
  assert.equal(longLeave.status, 201);
  assert.equal(longLeave.data.leave.approvalSteps.length, 2);
  const leaveId = longLeave.data.leave._id;

  const managerLogin = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'manager@testco.com', password: 'password123' },
  });
  const managerApproval = await call(`/api/v1/leaves/${leaveId}/approve`, {
    method: 'POST', token: managerLogin.data.accessToken, body: { comments: 'Team is covered' },
  });
  assert.equal(managerApproval.status, 200);
  assert.equal(managerApproval.data.leave.status, 'pending');
  assert.equal(managerApproval.data.leave.currentLevel, 2);

  const hrApproval = await call(`/api/v1/leaves/${leaveId}/approve`, {
    method: 'POST', token, body: { comments: 'Approved by HR' },
  });
  assert.equal(hrApproval.status, 200);
  assert.equal(hrApproval.data.leave.status, 'approved');

  const reapprove = await call(`/api/v1/leaves/${leaveId}/approve`, { method: 'POST', token });
  assert.equal(reapprove.status, 409);

  const history = await call(`/api/v1/leaves/${leaveId}/history`, { token });
  assert.equal(history.status, 200);
  assert.ok(history.data.approvalHistory.length >= 3);

  const balanceAfterApproval = await call('/api/v1/leaves/balance', { token: employeeToken });
  const usedAfterApproval = balanceAfterApproval.data.balance.balances.earned.used;
  assert.equal(usedAfterApproval, 5);

  const cancelled = await call(`/api/v1/leaves/${leaveId}/cancel`, { method: 'POST', token: employeeToken });
  assert.equal(cancelled.status, 200);
  const balanceAfterCancel = await call('/api/v1/leaves/balance', { token: employeeToken });
  assert.equal(balanceAfterCancel.data.balance.balances.earned.used, 0);
});

test('attendance records the matched geofence and groups by location', async () => {
  const token = await adminToken();
  const area = await call('/api/v1/attendance-areas', {
    method: 'POST', token, body: { name: 'Smoke Office', latitude: 20.2961, longitude: 85.8245, radiusMeters: 250 },
  });
  assert.equal(area.status, 201);

  const employeeLogin = await call('/api/v1/auth/login', {
    method: 'POST', body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  const checkIn = await call('/api/v1/attendance/check-in', {
    method: 'POST', token: employeeLogin.data.accessToken,
    body: { method: 'geofence', location: { latitude: 20.2961, longitude: 85.8245, accuracy: 8 } },
  });
  assert.equal(checkIn.status, 201);
  assert.equal(checkIn.data.attendance.areaId, area.data.area._id);
  assert.equal(checkIn.data.attendance.checkIn.areaName, 'Smoke Office');

  const byLocation = await call('/api/v1/attendance/by-location', { token });
  assert.equal(byLocation.status, 200);
  const group = byLocation.data.groups.find((entry) => entry.areaId === area.data.area._id);
  assert.ok(group);
  assert.equal(group.present, 1);

  const filtered = await call(`/api/v1/attendance/team?areaId=${area.data.area._id}`, { token });
  assert.equal(filtered.status, 200);
  assert.ok(filtered.data.attendances.every((row) => row.areaId === area.data.area._id));

  const outside = await call('/api/v1/attendance/team?areaId=area_does_not_exist', { token });
  assert.equal(outside.data.attendances.length, 0);
});

// Runs last on purpose: it relies on the departments, designations, and work location
// created by the org test above, then drives the company all the way to "live".
test('onboarding reports derived progress and gates going live on real data', async () => {
  const token = await adminToken();

  const initial = await call('/api/v1/onboarding', { token });
  assert.equal(initial.status, 200);
  assert.equal(initial.data.status, 'in_progress');
  assert.equal(initial.data.progress.totalRequired, 9);
  assert.ok(initial.data.progress.percent > 0, 'seeded defaults should already count towards progress');
  const stepKeys = initial.data.steps.map((step) => step.key);
  assert.ok(stepKeys.includes('company_profile'));
  assert.ok(stepKeys.includes('review'));

  const profileStep = initial.data.steps.find((step) => step.key === 'company_profile');
  assert.equal(profileStep.complete, true);

  const badStep = await call('/api/v1/onboarding/not_a_step', { method: 'PATCH', token, body: {} });
  assert.equal(badStep.status, 404);

  const incompleteProfile = await call('/api/v1/onboarding/company_profile', {
    method: 'PATCH', token, body: { industry: '' },
  });
  assert.equal(incompleteProfile.status, 400);

  const profile = await call('/api/v1/onboarding/company_profile', {
    method: 'PATCH', token, body: { industry: 'Software Services', city: 'Pune' },
  });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.steps.find((step) => step.key === 'company_profile').complete, true);

  const badPan = await call('/api/v1/onboarding/payroll_identity', {
    method: 'PATCH', token, body: { identity: { pan: 'NOTAPAN' } },
  });
  assert.equal(badPan.status, 400);

  const requiredSkip = await call('/api/v1/onboarding/skip/company_profile', { method: 'POST', token });
  assert.equal(requiredSkip.status, 400);

  const optionalSkip = await call('/api/v1/onboarding/skip/team', { method: 'POST', token });
  assert.equal(optionalSkip.status, 200);
  assert.equal(optionalSkip.data.steps.find((step) => step.key === 'team').skipped, true);

  // Statutory needs an explicit acknowledgement, which PATCH records.
  const statutory = await call('/api/v1/onboarding/statutory', {
    method: 'PATCH', token, body: { statutory: { professionalTaxEnabled: true, professionalTaxMonthly: 200 } },
  });
  assert.equal(statutory.status, 200);
  assert.equal(statutory.data.steps.find((step) => step.key === 'statutory').complete, true);

  const attendance = await call('/api/v1/onboarding/attendance_policy', {
    method: 'PATCH', token, body: { attendancePolicy: { payrollImpact: 'none' } },
  });
  assert.equal(attendance.status, 200);

  const holidays = await call('/api/v1/onboarding/holidays', {
    method: 'PATCH', token, body: { holidays: [{ date: `${new Date().getUTCFullYear()}-12-25`, name: 'Christmas' }] },
  });
  assert.equal(holidays.status, 200);
  assert.equal(holidays.data.steps.find((step) => step.key === 'holidays').complete, true);

  const beforeGoLive = await call('/api/v1/onboarding', { token });
  assert.equal(beforeGoLive.data.canComplete, true);

  const live = await call('/api/v1/onboarding/complete', { method: 'POST', token });
  assert.equal(live.status, 200);
  assert.equal(live.data.status, 'completed');
  assert.equal(live.data.progress.percent, 100);
  assert.ok(live.data.completedAt);

  const reopened = await call('/api/v1/onboarding/reopen', { method: 'POST', token, body: { reason: 'Smoke test' } });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.data.status, 'in_progress');
});

// The QHR Demo tenant is seeded without payroll settings, departments, designations,
// or work locations, so it is a genuine "unfinished setup" fixture.
test('onboarding refuses to go live while required steps are unfinished', async () => {
  const login = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'company-admin@qhr.com', password: 'password123' },
  });
  assert.equal(login.status, 200);
  const token = login.data.accessToken;

  const snapshot = await call('/api/v1/onboarding', { token });
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.data.canComplete, false);

  const premature = await call('/api/v1/onboarding/complete', { method: 'POST', token });
  assert.equal(premature.status, 422);
  assert.ok(Array.isArray(premature.details.missing));
  assert.ok(premature.details.missing.length > 0);
  assert.ok(premature.details.missing.every((item) => item.includes(':')), 'each missing entry is prefixed with its step title');
});

test('managers cannot reach onboarding and HR cannot touch admin-only steps', async () => {
  const managerLogin = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'manager@testco.com', password: 'password123' },
  });
  const managerBlocked = await call('/api/v1/onboarding', { token: managerLogin.data.accessToken });
  assert.equal(managerBlocked.status, 403);

  const hrLogin = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'hr@testco.com', password: 'password123' },
  });
  assert.equal(hrLogin.status, 200);
  const hrToken = hrLogin.data.accessToken;

  const hrRead = await call('/api/v1/onboarding', { token: hrToken });
  assert.equal(hrRead.status, 200);

  const hrProfile = await call('/api/v1/onboarding/company_profile', {
    method: 'PATCH', token: hrToken, body: { industry: 'Software Services' },
  });
  assert.equal(hrProfile.status, 200);

  const hrIdentity = await call('/api/v1/onboarding/payroll_identity', {
    method: 'PATCH', token: hrToken, body: { identity: { legalName: 'HR should not do this' } },
  });
  assert.equal(hrIdentity.status, 403);

  const hrComplete = await call('/api/v1/onboarding/complete', { method: 'POST', token: hrToken });
  assert.equal(hrComplete.status, 403);
});

test('payslips print the address of the location the employee is assigned to', async () => {
  const token = await adminToken();

  // Two sites: only one can be the registered payroll address.
  const head = await call('/api/v1/org/work-locations', {
    method: 'POST',
    token,
    body: {
      name: 'Head Office', code: 'PSHQ', addressLine: '12 MG Road', city: 'Bengaluru',
      state: 'Karnataka', pincode: '560001', isPayrollAddress: true, pfEstablishmentCode: 'PFHQ001',
    },
  });
  assert.equal(head.status, 201);

  const branch = await call('/api/v1/org/work-locations', {
    method: 'POST',
    token,
    body: {
      name: 'Pune Branch', code: 'PSPUN', addressLine: '4 Baner Road', city: 'Pune',
      state: 'Maharashtra', pincode: '411045', pfEstablishmentCode: 'PFPUN009',
    },
  });
  assert.equal(branch.status, 201);

  // Marking the branch as payroll address must not leave two of them set.
  const org = await call('/api/v1/org', { token });
  assert.equal(org.status, 200);
  assert.equal(org.data.workLocations.filter((item) => item.isPayrollAddress).length, 1);

  const employees = await call('/api/v1/employees', { token });
  assert.equal(employees.status, 200);
  const subject = employees.data.employees.find((item) => item.employeeId === 'EMP001');
  assert.ok(subject, 'expected the seeded employee to exist');

  const assigned = await call(`/api/v1/org/work-locations/${branch.data.workLocation._id}/assign`, {
    method: 'POST', token, body: { employeeIds: [subject._id] },
  });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.data.assigned, 1);

  // Re-assigning the same person is a no-op rather than an error.
  const repeat = await call(`/api/v1/org/work-locations/${branch.data.workLocation._id}/assign`, {
    method: 'POST', token, body: { employeeIds: [subject._id] },
  });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.data.assigned, 0);
  assert.equal(repeat.data.unchanged, 1);

  const foreign = await call(`/api/v1/org/work-locations/${branch.data.workLocation._id}/assign`, {
    method: 'POST', token, body: { employeeIds: ['emp_does_not_exist'] },
  });
  assert.equal(foreign.status, 404);

  // A location with people on it cannot be deleted out from under them.
  const blockedDelete = await call(`/api/v1/org/work-locations/${branch.data.workLocation._id}`, {
    method: 'DELETE', token,
  });
  assert.equal(blockedDelete.status, 400);

  const period = '2025-07';
  const generated = await call('/api/v1/payroll/generate', {
    method: 'POST', token, body: { period, employeeIds: [subject._id] },
  });
  assert.equal(generated.status, 201, generated.message);

  const payslip = (generated.data.payroll || []).find((item) => item.employeeId === subject._id);
  assert.ok(payslip, 'expected a payslip for the assigned employee');
  assert.equal(payslip.workLocationSnapshot.code, 'PSPUN');
  assert.equal(payslip.workLocationSnapshot.assigned, true);
  // Branch PF code wins over the company-level one.
  assert.equal(payslip.workLocationSnapshot.pfEstablishmentCode, 'PFPUN009');

  const html = await fetch(`${baseUrl}/api/v1/payroll/${payslip._id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(html.status, 200);
  const body = await html.text();
  assert.match(body, /Place of work/);
  assert.match(body, /4 Baner Road, Pune, Maharashtra, 411045/);
  assert.match(body, /Pune Branch \(PSPUN\)/);
  assert.match(body, /PF: PFPUN009/);
});

test('employee CSV import validates before it writes and links managers across rows', async () => {
  const token = await adminToken();

  const template = await fetch(`${baseUrl}/api/v1/imports/employees/template`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(template.status, 200);
  assert.match(template.headers.get('content-type') || '', /text\/csv/);
  const templateText = await template.text();
  assert.match(templateText, /employeeId","firstName/);

  const location = await call('/api/v1/org/work-locations', {
    method: 'POST',
    token,
    body: { name: 'Import Site', code: 'IMPSITE', addressLine: '9 Ring Road', city: 'Indore', state: 'Madhya Pradesh' },
  });
  assert.equal(location.status, 201);

  const header = 'employeeId,firstName,lastName,email,phone,role,department,designation,employmentType,workLocationCode,managerEmail,dateOfJoining,status';
  const csv = [
    header,
    // Manager appears after the report, to prove the second pass resolves it.
    'IMP001,Asha,Nair,asha.nair@importco.test,+91 90000 00001,employee,Operations,Executive,full_time,IMPSITE,bulk.manager@importco.test,2025-05-01,active',
    'IMP002,Bulk,Manager,bulk.manager@importco.test,+91 90000 00002,manager,Operations,Manager,full_time,IMPSITE,,2024-01-15,active',
    // Invalid: no email.
    'IMP003,Broken,,,+91 90000 00003,employee,Operations,Executive,full_time,IMPSITE,,2025-05-01,active',
    // Invalid: unknown work location.
    'IMP004,Wrong,Site,wrong.site@importco.test,,employee,Operations,Executive,full_time,NOSUCHSITE,,2025-05-01,active',
    // Invalid: duplicate email of row 2.
    'IMP005,Copy,Cat,asha.nair@importco.test,,employee,Operations,Executive,full_time,IMPSITE,,2025-05-01,active',
  ].join('\n');

  const dryRun = await call('/api/v1/imports/employees/validate', { method: 'POST', token, body: { csv } });
  assert.equal(dryRun.status, 200, dryRun.message);
  assert.equal(dryRun.data.summary.total, 5);
  assert.equal(dryRun.data.summary.create, 2);
  assert.equal(dryRun.data.summary.invalid, 3);

  // The dry run must not have written anything.
  const beforeCommit = await call('/api/v1/employees', { token });
  assert.equal(beforeCommit.data.employees.some((item) => item.email === 'asha.nair@importco.test'), false);

  const commit = await call('/api/v1/imports/employees/commit', { method: 'POST', token, body: { csv } });
  assert.equal(commit.status, 200, commit.message);
  assert.equal(commit.data.summary.created, 2);
  assert.equal(commit.data.summary.skipped, 3);
  assert.equal(commit.data.summary.managersLinked, 1);

  const after = await call('/api/v1/employees', { token });
  const asha = after.data.employees.find((item) => item.email === 'asha.nair@importco.test');
  const manager = after.data.employees.find((item) => item.email === 'bulk.manager@importco.test');
  assert.ok(asha && manager);
  assert.equal(asha.workLocationId, location.data.workLocation._id);
  assert.equal(asha.managerId, manager._id);
  assert.equal(asha.requiresPasswordChange, true);

  // Re-running the same file updates instead of duplicating.
  const rerun = await call('/api/v1/imports/employees/commit', { method: 'POST', token, body: { csv } });
  assert.equal(rerun.status, 200);
  assert.equal(rerun.data.summary.created, 0);
  assert.equal(rerun.data.summary.updated, 2);

  const finalList = await call('/api/v1/employees', { token });
  assert.equal(finalList.data.employees.filter((item) => item.email === 'asha.nair@importco.test').length, 1);

  const headerOnly = await call('/api/v1/imports/employees/validate', { method: 'POST', token, body: { csv: header } });
  assert.equal(headerOnly.status, 400);

  const badColumns = await call('/api/v1/imports/employees/validate', {
    method: 'POST', token, body: { csv: 'name,mail\nAsha,asha@x.test' },
  });
  assert.equal(badColumns.status, 400);
  assert.match(badColumns.message, /firstName/);
});

test('managers cannot import employees or reassign work locations', async () => {
  const login = await call('/api/v1/auth/admin-login', {
    method: 'POST',
    body: { email: 'manager@testco.com', password: 'password123' },
  });
  assert.equal(login.status, 200);
  const token = login.data.accessToken;

  const blockedImport = await call('/api/v1/imports/employees/validate', {
    method: 'POST', token, body: { csv: 'firstName,email\nAsha,asha@x.test' },
  });
  assert.equal(blockedImport.status, 403);

  const blockedAssign = await call('/api/v1/org/work-locations/wloc_missing/assign', {
    method: 'POST', token, body: { employeeIds: ['emp_1'] },
  });
  assert.equal(blockedAssign.status, 403);
});

/** Raises a tenant's paid seats, because every new account consumes one. */
async function grantSeats(companyCode, paidSeats) {
  const token = await superToken();
  const overview = await call('/api/v1/admin/billing-overview', { token });
  const tenant = overview.data.subscriptions.find((item) => item.companyCode === companyCode);
  assert.ok(tenant, `expected tenant ${companyCode}`);
  const patched = await call(`/api/v1/admin/companies/${tenant.companyId}`, {
    method: 'PATCH', token, body: { paidSeats, subscriptionStatus: 'active', billingMode: 'manual_offline' },
  });
  assert.equal(patched.status, 200, patched.message);
}

async function superToken() {
  const login = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'admin@qhr.com', password: 'admin123' },
  });
  assert.equal(login.status, 200);
  return login.data.accessToken;
}

test('purchased seats are the entire allowance and Super Admin owns the plan catalogue', async () => {
  const token = await superToken();

  const catalogue = await call('/api/v1/admin/subscription-plans', { token });
  assert.equal(catalogue.status, 200);
  // Paid plans bundle nothing, so N purchased seats means exactly N accounts.
  for (const plan of catalogue.data.plans.filter((item) => Number(item.pricePerUser) > 0)) {
    assert.equal(plan.includedSeats, 0, `${plan.name} must not bundle seats`);
  }
  // A free tier is expressed as includedSeats, which is what makes it usable.
  const freePlan = catalogue.data.plans.find((item) => Number(item.pricePerUser) === 0);
  assert.ok(freePlan, 'expected a free plan');
  assert.ok(freePlan.includedSeats >= 1);

  const overview = await call('/api/v1/admin/billing-overview', { token });
  assert.equal(overview.status, 200);
  const tenant = overview.data.subscriptions.find((item) => item.companyCode === 'TESTCO');
  assert.ok(tenant);
  assert.equal(tenant.totalSeats, tenant.includedSeats + tenant.paidSeats);

  // Setting 10 paid seats gives 10 usable accounts, not 11.
  const resized = await call(`/api/v1/admin/companies/${tenant.companyId}`, {
    method: 'PATCH', token, body: { paidSeats: 10, includedSeats: 0, subscriptionStatus: 'active', billingMode: 'manual_offline' },
  });
  assert.equal(resized.status, 200, resized.message);
  const after = await call('/api/v1/admin/billing-overview', { token });
  const updated = after.data.subscriptions.find((item) => item.companyCode === 'TESTCO');
  assert.equal(updated.paidSeats, 10);
  assert.equal(updated.includedSeats, 0);
  assert.equal(updated.totalSeats, 10);

  // Plan CRUD so pricing and features are editable without a redeploy.
  const createdPlan = await call('/api/v1/admin/subscription-plans', {
    method: 'POST',
    token,
    body: {
      name: 'Growth Test', pricePerUser: 39, includedSeats: 0, annualDiscountPercent: 15,
      description: 'Test plan', features: ['One', 'Two'], userLimit: 500, sortOrder: 9,
    },
  });
  assert.equal(createdPlan.status, 201, createdPlan.message);
  assert.equal(createdPlan.data.plan.code, 'growth-test');
  assert.deepEqual(createdPlan.data.plan.features, ['One', 'Two']);

  const duplicate = await call('/api/v1/admin/subscription-plans', {
    method: 'POST', token, body: { name: 'Growth Test', pricePerUser: 39 },
  });
  assert.equal(duplicate.status, 400);

  const patched = await call(`/api/v1/admin/subscription-plans/${createdPlan.data.plan._id}`, {
    method: 'PATCH', token, body: { pricePerUser: 44, features: ['One', 'Two', 'Three'], highlighted: true },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.plan.pricePerUser, 44);
  assert.equal(patched.data.plan.features.length, 3);
  assert.equal(patched.data.plan.highlighted, true);

  // A free plan with zero seats would lock everyone out.
  const badFree = await call(`/api/v1/admin/subscription-plans/${createdPlan.data.plan._id}`, {
    method: 'PATCH', token, body: { pricePerUser: 0, includedSeats: 0 },
  });
  assert.equal(badFree.status, 400);
  assert.match(badFree.message, /at least one seat/i);

  const removed = await call(`/api/v1/admin/subscription-plans/${createdPlan.data.plan._id}`, {
    method: 'DELETE', token,
  });
  assert.equal(removed.status, 200);

  // A plan a tenant is actually on must not be deletable.
  const plans = await call('/api/v1/admin/subscription-plans', { token });
  const inUse = plans.data.plans.find((item) => item.name === updated.plan)
    || plans.data.plans.find((item) => item.name === tenant.plan);
  if (inUse) {
    const blocked = await call(`/api/v1/admin/subscription-plans/${inUse._id}`, { method: 'DELETE', token });
    assert.equal(blocked.status, 409);
  }
});

test('company admins cannot edit the plan catalogue', async () => {
  const token = await adminToken();
  const blockedRead = await call('/api/v1/admin/subscription-plans', { token });
  assert.equal(blockedRead.status, 403);
  const blockedWrite = await call('/api/v1/admin/subscription-plans', {
    method: 'POST', token, body: { name: 'Sneaky', pricePerUser: 0, includedSeats: 99 },
  });
  assert.equal(blockedWrite.status, 403);
});

test('the company calendar merges holidays, events, birthdays and anniversaries', async () => {
  const token = await adminToken();

  const employees = await call('/api/v1/employees', { token });
  const subject = employees.data.employees.find((item) => item.employeeId === 'EMP001');
  assert.ok(subject);

  // Leap-day birthday: must still surface in a non-leap year rather than vanish.
  const dated = await call(`/api/v1/employees/${subject._id}`, {
    method: 'PATCH', token, body: { dateOfBirth: '1992-02-29', dateOfJoining: '2021-03-15' },
  });
  assert.equal(dated.status, 200, dated.message);

  const holiday = await call('/api/v1/calendar/holidays', {
    method: 'POST', token, body: { date: '2027-01-26', name: 'Republic Day', paid: true },
  });
  assert.equal(holiday.status, 201, holiday.message);

  const duplicateHoliday = await call('/api/v1/calendar/holidays', {
    method: 'POST', token, body: { date: '2027-01-26', name: 'Duplicate' },
  });
  assert.equal(duplicateHoliday.status, 409);

  const event = await call('/api/v1/calendar/events', {
    method: 'POST',
    token,
    body: { title: 'Town hall', startDate: '2027-03-10', endDate: '2027-03-11', kind: 'meeting', location: 'Head office' },
  });
  assert.equal(event.status, 201, event.message);

  const badRange = await call('/api/v1/calendar/events', {
    method: 'POST', token, body: { title: 'Backwards', startDate: '2027-03-10', endDate: '2027-03-01' },
  });
  assert.equal(badRange.status, 400);

  const feed = await call('/api/v1/calendar?from=2027-01-01&to=2027-12-31', { token });
  assert.equal(feed.status, 200, feed.message);

  const kinds = feed.data.events.reduce((totals, item) => ({ ...totals, [item.kind]: (totals[item.kind] || 0) + 1 }), {});
  assert.ok(kinds.holiday >= 1);
  // Two-day event appears on both days it covers.
  assert.equal(feed.data.events.filter((item) => item.kind === 'event' && item.title === 'Town hall').length, 2);

  const birthday = feed.data.events.find((item) => item.kind === 'birthday' && item.employeeId === subject._id);
  assert.ok(birthday, 'expected the leap-day birthday to be projected');
  assert.equal(birthday.date, '2027-02-28');

  const anniversary = feed.data.events.find((item) => item.kind === 'anniversary' && item.employeeId === subject._id);
  assert.ok(anniversary);
  assert.equal(anniversary.date, '2027-03-15');
  assert.equal(anniversary.years, 6);

  // Employees may keep their own birthday private.
  const employeeLogin = await call('/api/v1/auth/login', {
    method: 'POST', body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  assert.equal(employeeLogin.status, 200);
  const employeeToken = employeeLogin.data.accessToken;

  const employeeFeed = await call('/api/v1/calendar?from=2027-01-01&to=2027-12-31', { token: employeeToken });
  assert.equal(employeeFeed.status, 200, 'employees must be able to read the shared calendar');

  const hidden = await call('/api/v1/calendar/my-visibility', {
    method: 'PATCH', token: employeeToken, body: { hideBirthday: true },
  });
  assert.equal(hidden.status, 200);

  const afterHiding = await call('/api/v1/calendar?from=2027-01-01&to=2027-12-31', { token });
  assert.equal(afterHiding.data.events.some((item) => item.kind === 'birthday' && item.employeeId === subject._id), false);

  // Employees must not be able to edit the shared calendar.
  const blocked = await call('/api/v1/calendar/events', {
    method: 'POST', token: employeeToken, body: { title: 'Nope', startDate: '2027-04-01' },
  });
  assert.equal(blocked.status, 403);

  // Turning birthdays off company-wide hides them for everyone.
  const settings = await call('/api/v1/calendar/settings', {
    method: 'PATCH', token, body: { showAnniversaries: false },
  });
  assert.equal(settings.status, 200);
  const withoutAnniversaries = await call('/api/v1/calendar?from=2027-01-01&to=2027-12-31', { token });
  assert.equal(withoutAnniversaries.data.events.some((item) => item.kind === 'anniversary'), false);

  const oversized = await call('/api/v1/calendar?from=2027-01-01&to=2029-12-31', { token });
  assert.equal(oversized.status, 400);

  const removedHoliday = await call(`/api/v1/calendar/holidays/${holiday.data.holiday._id}`, { method: 'DELETE', token });
  assert.equal(removedHoliday.status, 200);
  const removedEvent = await call(`/api/v1/calendar/events/${event.data.event._id}`, { method: 'DELETE', token });
  assert.equal(removedEvent.status, 200);
});

test('registration prefills onboarding, and saved company details read back', async () => {
  const suffix = `${Date.now()}`.slice(-6);
  const code = `PRE${suffix}`;
  const email = `pre.${suffix}@regress.test`;

  const registered = await call('/api/v1/companies/register', {
    method: 'POST',
    body: {
      companyName: `Prefill Co ${suffix}`,
      companyCode: code,
      industry: 'Retail',
      address: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      adminFirstName: 'Pre',
      adminLastName: 'Fill',
      adminEmail: email,
      adminPhone: '+91 90000 00000',
      adminPassword: 'Str0ng!Passw0rd',
      termsAccepted: true,
    },
  });
  assert.equal(registered.status, 201, registered.message);
  await call('/api/v1/companies/verify-email', {
    method: 'POST', body: { companyCode: code, verificationCode: registered.data.verificationCode },
  });
  const login = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { companyCode: code, email, password: 'Str0ng!Passw0rd' },
  });
  assert.equal(login.status, 200);
  const token = login.data.accessToken;

  // Everything the public wizard collected must already be in the checklist.
  let snapshot = await call('/api/v1/onboarding', { token });
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.data.data.profile.name, `Prefill Co ${suffix}`);
  assert.equal(snapshot.data.data.profile.email, email);
  assert.equal(snapshot.data.data.profile.registeredAddress, '12 MG Road');
  assert.equal(snapshot.data.data.profile.city, 'Bengaluru');
  assert.equal(snapshot.data.data.profile.industry, 'Retail');
  // The registered address also becomes the first work location.
  assert.equal(snapshot.data.data.workLocations.length, 1);
  assert.equal(snapshot.data.data.workLocations[0].isPayrollAddress, true);

  // Saving then re-reading must show the new values without going live.
  const saved = await call('/api/v1/onboarding/company_profile', {
    method: 'PATCH',
    token,
    body: {
      name: `Prefill Renamed ${suffix}`,
      email,
      phone: '+91 91111 11111',
      registeredAddress: '99 New Street',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
      industry: 'Manufacturing',
      timezone: 'Asia/Kolkata',
      officeStart: '09:30',
      officeEnd: '18:30',
    },
  });
  assert.equal(saved.status, 200, saved.message);
  snapshot = await call('/api/v1/onboarding', { token });
  assert.equal(snapshot.data.data.profile.name, `Prefill Renamed ${suffix}`);
  assert.equal(snapshot.data.data.profile.phone, '+91 91111 11111');
  assert.equal(snapshot.data.data.profile.city, 'Pune');
  assert.equal(snapshot.data.data.profile.registeredAddress, '99 New Street');
  assert.equal(snapshot.data.data.profile.industry, 'Manufacturing');

  // A designation can map to a department created in the same save.
  const org = await call('/api/v1/onboarding/org_structure', {
    method: 'PATCH',
    token,
    body: {
      departments: [{ name: 'Engineering', code: 'ENGX', status: 'active' }],
      designations: [{ name: 'Engineer', code: 'ENGRX', level: 1, departmentRef: 'Engineering', status: 'active' }],
    },
  });
  assert.equal(org.status, 200, org.message);
  snapshot = await call('/api/v1/onboarding', { token });
  const department = snapshot.data.data.departments.find((item) => item.name === 'Engineering');
  const designation = snapshot.data.data.designations.find((item) => item.name === 'Engineer');
  assert.ok(department && designation);
  assert.equal(designation.departmentId, department._id, 'designation should resolve the new department');

  const unknownRef = await call('/api/v1/onboarding/org_structure', {
    method: 'PATCH',
    token,
    body: {
      departments: [{ name: 'Engineering', code: 'ENGX', status: 'active' }],
      designations: [{ name: 'Ghost', code: 'GHOST', departmentRef: 'Nowhere' }],
    },
  });
  assert.equal(unknownRef.status, 400);
});

test('employees are created with a one-time password and a resolved work location', async () => {
  const token = await adminToken();

  const employees = await call('/api/v1/employees', { token });
  const suffix = `${Date.now()}`.slice(-6);

  const org = await call('/api/v1/org', { token });
  const locations = (org.data.workLocations || []).filter((item) => item.status !== 'inactive');
  assert.ok(locations.length > 1, 'this tenant should have several sites by now');

  // With more than one site the choice must be explicit, not guessed.
  const ambiguous = await call('/api/v1/employees', {
    method: 'POST',
    token,
    body: { employeeId: `AMB${suffix}`, firstName: 'No', lastName: 'Location', email: `amb.${suffix}@regress.test` },
  });
  assert.equal(ambiguous.status, 400);
  assert.match(ambiguous.message, /work location/i);

  const created = await call('/api/v1/employees', {
    method: 'POST',
    token,
    body: {
      employeeId: `OTP${suffix}`,
      firstName: 'One',
      lastName: 'Time',
      email: `one.time.${suffix}@regress.test`,
      phone: '+91 90000 00009',
      workLocationId: locations[0]._id,
      addressLine1: '4 Baner Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
      permanentSameAsCurrent: true,
      emergencyContactName: 'Asha Rao',
      emergencyContactPhone: '+91 90000 00010',
      gender: 'female',
      dateOfBirth: '1995-03-12',
    },
  });
  assert.equal(created.status, 201, created.message);

  // The password is generated, satisfies the policy, and is returned exactly once.
  const password = created.data.credentials.oneTimePassword;
  assert.ok(password.length >= 10, 'password should be at least 10 characters');
  assert.match(password, /[a-z]/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /\d/);
  assert.match(password, /[^A-Za-z0-9]/);
  assert.equal(created.data.credentials.mustChangeOnFirstLogin, true);
  assert.equal(created.data.employee.requiresPasswordChange, true);
  assert.equal(created.data.employee.profile.city, 'Pune');
  assert.equal(created.data.employee.profile.permanentCity, 'Pune');
  assert.equal(created.data.employee.profile.emergencyContactName, 'Asha Rao');
  assert.equal(created.data.employee.workLocationId, locations[0]._id);

  const signedIn = await call('/api/v1/auth/login', {
    method: 'POST',
    body: { companyCode: 'TESTCO', employeeId: `OTP${suffix}`, password },
  });
  assert.equal(signedIn.status, 200, signedIn.message);
  assert.equal(signedIn.data.requiresPasswordChange, true);

  const reset = await call(`/api/v1/employees/${created.data.employee._id}/reset-password`, { method: 'POST', token });
  assert.equal(reset.status, 200, reset.message);
  assert.notEqual(reset.data.credentials.oneTimePassword, password);

  // Resetting revokes the old credential outright.
  const stale = await call('/api/v1/auth/login', {
    method: 'POST',
    body: { companyCode: 'TESTCO', employeeId: `OTP${suffix}`, password },
  });
  assert.equal(stale.status, 401);

  const fresh = await call('/api/v1/auth/login', {
    method: 'POST',
    body: { companyCode: 'TESTCO', employeeId: `OTP${suffix}`, password: reset.data.credentials.oneTimePassword },
  });
  assert.equal(fresh.status, 200);

  // Aadhaar: only the last four digits may be stored.
  const oversharing = await call(`/api/v1/employees/${created.data.employee._id}`, {
    method: 'PATCH', token, body: { aadhaarLast4: '123412341234' },
  });
  assert.equal(oversharing.status, 400);
  assert.match(oversharing.message, /last 4 digits/i);

  const removed = await call(`/api/v1/employees/${created.data.employee._id}`, { method: 'DELETE', token });
  assert.equal(removed.status, 200);
  // Whether the delete is hard or a deactivation, the credential must stop working.
  const afterDelete = await call('/api/v1/auth/login', {
    method: 'POST',
    body: { companyCode: 'TESTCO', employeeId: `OTP${suffix}`, password: reset.data.credentials.oneTimePassword },
  });
  assert.equal(afterDelete.status, 401);
  assert.ok(employees.status === 200);
});

test('notifications are generated from employee data, deduped, and scoped per person', async () => {
  const token = await adminToken();

  const employees = await call('/api/v1/employees', { token });
  const subject = employees.data.employees.find((item) => item.employeeId === 'EMP001');
  const other = employees.data.employees.find((item) => item.employeeId !== 'EMP001' && item.role !== 'super_admin');
  assert.ok(subject && other);

  // Birthdays come from the employee record. Nothing is entered by hand, so
  // setting today's month/day is enough to trigger the greeting.
  const today = new Date().toISOString().slice(0, 10);
  const monthDay = today.slice(4);
  const dated = await call(`/api/v1/employees/${subject._id}`, {
    method: 'PATCH', token, body: { dateOfBirth: `1990${monthDay}`, dateOfJoining: `2020${monthDay}`, hideBirthday: false },
  });
  assert.equal(dated.status, 200, dated.message);

  // An earlier test switches anniversaries off company-wide; greetings correctly
  // follow that setting, so turn both back on for this scenario.
  const settings = await call('/api/v1/calendar/settings', {
    method: 'PATCH', token, body: { showBirthdays: true, showAnniversaries: true },
  });
  assert.equal(settings.status, 200);

  const employeeLogin = await call('/api/v1/auth/login', {
    method: 'POST', body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  assert.equal(employeeLogin.status, 200);
  const employeeToken = employeeLogin.data.accessToken;

  const inbox = await call('/api/v1/notifications', { token: employeeToken });
  assert.equal(inbox.status, 200, inbox.message);
  const kinds = inbox.data.notifications.map((item) => item.kind);
  assert.ok(kinds.includes('birthday_self'), 'the employee should receive their own birthday wishes');
  assert.ok(kinds.includes('anniversary_self'), 'the employee should receive work anniversary wishes');
  assert.ok(inbox.data.unread > 0);

  // Colleagues see the heads-up, the celebrant does not get a duplicate.
  const adminInbox = await call('/api/v1/notifications', { token });
  assert.ok(adminInbox.data.notifications.some((item) => item.kind === 'birthday_team'));
  assert.equal(inbox.data.notifications.filter((item) => item.kind === 'birthday_team').length, 0);

  // Generation is idempotent: opening the inbox again must not duplicate.
  const before = inbox.data.notifications.filter((item) => item.kind === 'birthday_self').length;
  const again = await call('/api/v1/notifications', { token: employeeToken });
  assert.equal(again.data.notifications.filter((item) => item.kind === 'birthday_self').length, before);

  // Hiding the birthday stops the company-wide message but not the personal one.
  const hidden = await call('/api/v1/calendar/my-visibility', {
    method: 'PATCH', token: employeeToken, body: { hideBirthday: true },
  });
  assert.equal(hidden.status, 200);

  // Adding a holiday later must reach everyone.
  const holidayDate = `${Number(today.slice(0, 4)) + 2}-08-15`;
  const holiday = await call('/api/v1/calendar/holidays', {
    method: 'POST', token, body: { date: holidayDate, name: 'Independence Day', paid: true },
  });
  assert.equal(holiday.status, 201, holiday.message);
  const afterHoliday = await call('/api/v1/notifications', { token: employeeToken });
  assert.ok(
    afterHoliday.data.notifications.some((item) => item.kind === 'holiday_announced' && item.title.includes('Independence Day')),
    'a newly added holiday should notify employees',
  );

  // Read state is per person and cannot be changed by someone else.
  const target = afterHoliday.data.notifications[0];
  const foreign = await call(`/api/v1/notifications/${target._id}/read`, { method: 'PATCH', token });
  assert.equal(foreign.status, 404, 'one employee must not mark another persons notification read');

  const marked = await call(`/api/v1/notifications/${target._id}/read`, { method: 'PATCH', token: employeeToken });
  assert.equal(marked.status, 200);
  assert.ok(marked.data.notification.readAt);

  const readAll = await call('/api/v1/notifications/read-all', { method: 'POST', token: employeeToken });
  assert.equal(readAll.status, 200);
  const count = await call('/api/v1/notifications/unread-count', { token: employeeToken });
  assert.equal(count.data.unread, 0);

  await call(`/api/v1/calendar/holidays/${holiday.data.holiday._id}`, { method: 'DELETE', token });
});

test('a leave decision notifies the person who asked for it', async () => {
  const token = await adminToken();
  const employeeLogin = await call('/api/v1/auth/login', {
    method: 'POST', body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  const employeeToken = employeeLogin.data.accessToken;

  const applied = await call('/api/v1/leaves/apply', {
    method: 'POST',
    token: employeeToken,
    body: { leaveType: 'casual', startDate: '2029-04-02', endDate: '2029-04-02', reason: 'Notification check' },
  });
  assert.equal(applied.status, 201, applied.message);

  const decided = await call(`/api/v1/leaves/${applied.data.leave._id}/approve`, {
    method: 'POST', token, body: { action: 'approve', comments: 'Enjoy' },
  });
  assert.equal(decided.status, 200, decided.message);

  const inbox = await call('/api/v1/notifications', { token: employeeToken });
  const decision = inbox.data.notifications.find((item) => item.kind === 'leave_decision');
  assert.ok(decision, 'the requester should be told the outcome');
  assert.match(decision.title, /approved/i);
  assert.equal(decision.link.page, 'leaves');
  assert.match(decision.body, /Enjoy/);
});

test('the company anniversary is derived from the founding date', async () => {
  const token = await adminToken();
  const saved = await call('/api/v1/onboarding/company_profile', {
    method: 'PATCH',
    token,
    body: {
      name: 'Test Co', email: 'company@example.com', registeredAddress: '1 Test Road',
      city: 'Pune', state: 'Maharashtra', pincode: '411045', industry: 'IT services',
      timezone: 'Asia/Kolkata', officeStart: '09:30', officeEnd: '18:30',
      foundedOn: '2018-06-11',
    },
  });
  assert.equal(saved.status, 200, saved.message);

  const feed = await call('/api/v1/calendar?from=2030-01-01&to=2030-12-31', { token });
  assert.equal(feed.status, 200);
  assert.equal(feed.data.company.foundedOn, '2018-06-11');
  const anniversary = feed.data.events.find((item) => item.kind === 'company_anniversary');
  assert.ok(anniversary, 'expected a company anniversary event');
  assert.equal(anniversary.date, '2030-06-11');
  assert.equal(anniversary.years, 12);

  const rejected = await call('/api/v1/onboarding/company_profile', {
    method: 'PATCH',
    token,
    body: {
      name: 'Test Co', email: 'company@example.com', registeredAddress: '1 Test Road',
      city: 'Pune', state: 'Maharashtra', pincode: '411045', industry: 'IT services',
      timezone: 'Asia/Kolkata', officeStart: '09:30', officeEnd: '18:30',
      foundedOn: '11-06-2018',
    },
  });
  assert.equal(rejected.status, 400);
});

// The QHR Demo tenant is seeded with an attendance geofence and no work
// locations, which is exactly the state that used to report "no location
// available" everywhere a site had to be chosen.
test('an address recorded only as a geofence becomes a usable work location', async () => {
  // Seats first: every account creation below is charged for, sample or not.
  await grantSeats('QHR', 12);

  const login = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'company-admin@qhr.com', password: 'password123' },
  });
  assert.equal(login.status, 200);
  const token = login.data.accessToken;

  const org = await call('/api/v1/org', { token });
  assert.equal(org.status, 200);
  assert.ok(org.data.workLocations.length >= 1, 'the geofence address should surface as a work location');

  const derived = org.data.workLocations.find((item) => item.derivedFromGeofence === true);
  assert.ok(derived, 'expected the backfilled site to be marked as derived');
  // Linked both ways, so the address and the check-in boundary cannot drift.
  assert.ok(derived.geofence, 'the derived site keeps the geofence it came from');
  assert.ok(derived.address, 'the derived site exposes a readable address');
  // Exactly one registered address, which is what payroll needs.
  assert.equal(org.data.workLocations.filter((item) => item.isPayrollAddress).length, 1);

  const areas = await call('/api/v1/attendance-areas', { token });
  assert.equal(areas.status, 200);
  assert.ok(areas.data.areas.every((area) => area.workLocation), 'every geofence now belongs to a site');

  // Repeating the read must not create a second copy.
  const again = await call('/api/v1/org', { token });
  assert.equal(again.data.workLocations.length, org.data.workLocations.length);

  // A derived site is not a deliberate placement decision, so employee creation
  // resolves it silently instead of demanding a choice.
  const employee = await call('/api/v1/employees', {
    method: 'POST', token,
    body: { firstName: 'Derived', lastName: 'Placement', email: 'derived.placement@qhr.test', dateOfJoining: '2026-02-01' },
  });
  assert.equal(employee.status, 201, employee.message);
  assert.ok(employee.data.employee.workLocationId, 'the employee lands on a site without being asked');

  // Reviewing the site clears the derived flag, and it counts as real from then on.
  const reviewed = await call(`/api/v1/org/work-locations/${derived._id}`, {
    method: 'PATCH', token,
    body: { name: derived.name, addressLine: '1 Reviewed Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400069' },
  });
  assert.equal(reviewed.status, 200, reviewed.message);
  assert.equal(reviewed.data.workLocation.derivedFromGeofence, undefined);
  assert.equal(reviewed.data.workLocation.address, '1 Reviewed Road, Mumbai, Maharashtra, 400069');
  // The geofence stayed attached and followed the address rather than keeping
  // the stale one it was created with.
  assert.ok(reviewed.data.workLocation.geofence, 'the reviewed site keeps its geofence');
  assert.equal(reviewed.data.workLocation.geofence.name, derived.name);
});

// Demo records must not be loadable into a tenant workspace: seeing "sample"
// rows next to real payroll data reads as unfinished software.
test('there is no endpoint for loading demo data into a workspace', async () => {
  const token = await adminToken();

  for (const method of ['GET', 'POST', 'DELETE']) {
    const response = await call('/api/v1/sample-data', { method, token, ...(method === 'POST' ? { body: {} } : {}) });
    assert.equal(response.status, 404, `${method} /sample-data should not exist`);
  }
});

test('geofences can be edited, relinked, and deleted without losing the address', async () => {
  const token = await adminToken();

  const site = await call('/api/v1/org/work-locations', {
    method: 'POST',
    token,
    body: {
      name: 'Editable Site', code: 'EDITSITE', addressLine: '7 Fence Road', city: 'Nagpur',
      state: 'Maharashtra', pincode: '440001', latitude: 21.1458, longitude: 79.0882, radiusMeters: 300,
    },
  });
  assert.equal(site.status, 201, site.message);
  const siteId = site.data.workLocation._id;
  // Coordinates on the site create the boundary, so the address is entered once.
  assert.ok(site.data.workLocation.geofence, 'coordinates on a site create its geofence');
  const areaId = site.data.workLocation.geofence._id;
  assert.equal(site.data.workLocation.geofence.radiusMeters, 300);

  const listed = await call('/api/v1/attendance-areas', { token });
  const area = listed.data.areas.find((item) => item._id === areaId);
  assert.ok(area, 'the new geofence is listed');
  assert.equal(area.workLocation.code, 'EDITSITE');

  // Editing what people actually change: radius and whether check-in is accepted.
  const resized = await call(`/api/v1/attendance-areas/${areaId}`, {
    method: 'PATCH', token, body: { radiusMeters: 450, active: false },
  });
  assert.equal(resized.status, 200, resized.message);
  assert.equal(resized.data.area.radiusMeters, 450);
  assert.equal(resized.data.area.active, false);
  // A linked geofence keeps the site's address rather than drifting from it.
  assert.equal(resized.data.area.address, '7 Fence Road, Nagpur, Maharashtra, 440001');

  const badRadius = await call(`/api/v1/attendance-areas/${areaId}`, {
    method: 'PATCH', token, body: { radiusMeters: 9 },
  });
  assert.equal(badRadius.status, 400);

  const badLatitude = await call(`/api/v1/attendance-areas/${areaId}`, {
    method: 'PATCH', token, body: { latitude: 991 },
  });
  assert.equal(badLatitude.status, 400);

  const badLink = await call(`/api/v1/attendance-areas/${areaId}`, {
    method: 'PATCH', token, body: { workLocationId: 'wloc_missing' },
  });
  assert.equal(badLink.status, 400);

  // Unknown fields must not be written straight onto the record.
  const injected = await call(`/api/v1/attendance-areas/${areaId}`, {
    method: 'PATCH', token, body: { companyId: 'company_somebody_else', _id: 'area_hijacked' },
  });
  assert.equal(injected.status, 200);
  assert.equal(injected.data.area._id, areaId);
  assert.equal(injected.data.area.companyId, undefined);

  // Detaching leaves a deliberately standalone boundary, which the backfill
  // must then leave alone instead of inventing a site for it.
  const detached = await call(`/api/v1/attendance-areas/${areaId}`, {
    method: 'PATCH', token, body: { workLocationId: '', name: 'Standalone Fence', address: '7 Fence Road' },
  });
  assert.equal(detached.status, 200);
  assert.equal(detached.data.area.workLocationId, null);
  assert.equal(detached.data.area.name, 'Standalone Fence');

  const locationsBefore = (await call('/api/v1/org', { token })).data.workLocations.length;
  const afterRead = await call('/api/v1/attendance-areas', { token });
  assert.equal(afterRead.data.areas.find((item) => item._id === areaId).workLocation, null);
  const locationsAfter = (await call('/api/v1/org', { token })).data.workLocations.length;
  assert.equal(locationsAfter, locationsBefore, 'a standalone geofence does not spawn a site');

  const relinked = await call(`/api/v1/attendance-areas/${areaId}`, {
    method: 'PATCH', token, body: { workLocationId: siteId },
  });
  assert.equal(relinked.status, 200);
  assert.equal(relinked.data.area.workLocation.code, 'EDITSITE');
  assert.equal(relinked.data.area.name, 'Editable Site', 'a linked geofence adopts the site name');

  const removed = await call(`/api/v1/attendance-areas/${areaId}`, { method: 'DELETE', token });
  assert.equal(removed.status, 200);

  const missing = await call(`/api/v1/attendance-areas/${areaId}`, { method: 'DELETE', token });
  assert.equal(missing.status, 404);

  // The site and its address survive: only the boundary went.
  const survivors = await call('/api/v1/org', { token });
  const survivor = survivors.data.workLocations.find((item) => item._id === siteId);
  assert.ok(survivor, 'the work location outlives its geofence');
  assert.equal(survivor.address, '7 Fence Road, Nagpur, Maharashtra, 440001');
  assert.equal(survivor.geofence, null);
});

test('only HR and admins can change geofences', async () => {
  const login = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'manager@testco.com', password: 'password123' },
  });
  const token = login.data.accessToken;

  const blockedEdit = await call('/api/v1/attendance-areas/area_any', { method: 'PATCH', token, body: { radiusMeters: 100 } });
  assert.equal(blockedEdit.status, 403);

  const blockedDelete = await call('/api/v1/attendance-areas/area_any', { method: 'DELETE', token });
  assert.equal(blockedDelete.status, 403);
});

// The tenant dashboard used to report `employees.length * 19`: a hardcoded
// per-head price that ignored the plan, the cycle, and the paid seat count, so
// the number on screen disagreed with the invoice.
test('the tenant dashboard reports the real subscription cost, not a per-head guess', async () => {
  const admin = await superToken();
  const overview = await call('/api/v1/admin/billing-overview', { token: admin });
  const tenant = overview.data.subscriptions.find((item) => item.companyCode === 'TESTCO');
  assert.ok(tenant, 'expected the TESTCO tenant');

  const token = await adminToken();
  const dashboard = await call('/api/v1/admin/dashboard', { token });
  assert.equal(dashboard.status, 200);

  const summary = dashboard.data.summary;
  assert.equal(summary.monthlyRevenue, undefined, 'a tenant has no revenue, only a subscription');

  const expected = tenant.billingCycle === 'yearly'
    ? Math.round((tenant.renewalAmount / 12) * 100) / 100
    : tenant.renewalAmount;
  assert.equal(summary.monthlySubscription, expected, 'the dashboard must agree with billing');
  assert.equal(summary.totalSeats, tenant.totalSeats);
  assert.equal(summary.billingCycle, tenant.billingCycle);

  // The figure must follow the seat count rather than the headcount.
  const employees = await call('/api/v1/employees?limit=200', { token });
  const headcount = employees.data.employees.filter((item) => item.status !== 'inactive').length;
  if (headcount !== summary.totalSeats) {
    assert.notEqual(summary.monthlySubscription, headcount * 19, 'the old per-head calculation is back');
  }

  await grantSeats('TESTCO', tenant.paidSeats + 3);
  const resized = await call('/api/v1/admin/dashboard', { token });
  assert.equal(resized.data.summary.totalSeats, tenant.totalSeats + 3, 'buying seats moves the tile');
  assert.ok(resized.data.summary.monthlySubscription > summary.monthlySubscription, 'and moves the amount with it');

  await grantSeats('TESTCO', tenant.paidSeats);
});

// Registration verification used to return the code in its own response and
// accepted any code when none was stored, so it verified nothing at all.
test('company verification is hashed, expiring, attempt-limited, and never echoed', async () => {
  const registration = await call('/api/v1/companies/register', {
    method: 'POST',
    body: {
      name: 'Verify Guard Co', code: 'VGUARD', email: 'owner@vguard.test',
      adminName: 'Vera Guard', adminEmail: 'owner@vguard.test', adminPassword: 'Str0ng!Passw0rd',
    },
  });
  assert.equal(registration.status, 201, registration.message);
  assert.match(String(registration.data.message), /verification code/i);
  assert.equal(registration.data.verificationSentTo, 'owner@vguard.test');

  // Exposed only because NODE_ENV is test; production omits it entirely.
  const code = registration.data.verificationCode;
  assert.ok(code, 'the test environment exposes the code so the flow can be driven');
  assert.match(String(code), /^\d{6}$/);

  // The code is queued for delivery rather than handed back to the caller.
  let data = await store.read();
  const company = data.companies.find((item) => item.code === 'VGUARD');
  assert.ok(company, 'expected the registered company');
  assert.equal(company.verificationCode, undefined, 'no plaintext code may remain on the record');
  assert.ok(company.verification.codeHash.startsWith('pbkdf2$'), 'the code is stored hashed');
  assert.ok(company.verification.expiresAt, 'the code expires');

  const queued = (data.outboundEmails || []).filter((item) => item.companyId === company._id);
  assert.equal(queued.length, 1, 'the code is queued as an email');
  assert.equal(queued[0].to, 'owner@vguard.test');
  assert.ok(queued[0].body.includes(String(code)), 'the email carries the code');

  const wrong = await call('/api/v1/companies/verify-email', {
    method: 'POST', body: { companyCode: 'VGUARD', verificationCode: '000000' },
  });
  assert.equal(wrong.status, 400);
  assert.match(wrong.message, /attempt\(s\) left/);

  const right = await call('/api/v1/companies/verify-email', {
    method: 'POST', body: { companyCode: 'VGUARD', verificationCode: code },
  });
  assert.equal(right.status, 200, right.message);
  assert.equal(right.data.company.isVerified, true);

  // The code is consumed, and repeating the call stays harmless.
  data = await store.read();
  const verified = data.companies.find((item) => item.code === 'VGUARD');
  assert.equal(verified.verification, undefined, 'the code is cleared once used');
  const again = await call('/api/v1/companies/verify-email', {
    method: 'POST', body: { companyCode: 'VGUARD', verificationCode: code },
  });
  assert.equal(again.status, 200, 'verifying an already-verified company is idempotent');
});

test('a company with no outstanding code cannot be verified by any code', async () => {
  const registration = await call('/api/v1/companies/register', {
    method: 'POST',
    body: {
      name: 'No Code Co', code: 'NOCODE', email: 'owner@nocode.test',
      adminName: 'Nora Code', adminEmail: 'owner@nocode.test', adminPassword: 'Str0ng!Passw0rd',
    },
  });
  assert.equal(registration.status, 201, registration.message);

  // Strip the outstanding code, which is the state older records were left in.
  await store.update((data) => {
    const company = data.companies.find((item) => item.code === 'NOCODE');
    delete company.verification;
    delete company.verificationCode;
    return {};
  });

  const attempt = await call('/api/v1/companies/verify-email', {
    method: 'POST', body: { companyCode: 'NOCODE', verificationCode: '123456' },
  });
  assert.equal(attempt.status, 400);
  assert.match(attempt.message, /No verification code is outstanding/);

  const missing = await call('/api/v1/companies/verify-email', {
    method: 'POST', body: { companyCode: 'NOCODE' },
  });
  assert.equal(missing.status, 400);
  assert.match(missing.message, /required/i);
});

test('too many wrong codes locks verification until a new code is issued', async () => {
  const registration = await call('/api/v1/companies/register', {
    method: 'POST',
    body: {
      name: 'Lockout Co', code: 'LOCKCO', email: 'owner@lockco.test',
      adminName: 'Lock Owner', adminEmail: 'owner@lockco.test', adminPassword: 'Str0ng!Passw0rd',
    },
  });
  assert.equal(registration.status, 201, registration.message);
  const code = registration.data.verificationCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await call('/api/v1/companies/verify-email', {
      method: 'POST', body: { companyCode: 'LOCKCO', verificationCode: '111111' },
    });
    assert.equal(response.status, 400);
  }

  // Even the correct code is refused once the attempt budget is spent.
  const blocked = await call('/api/v1/companies/verify-email', {
    method: 'POST', body: { companyCode: 'LOCKCO', verificationCode: code },
  });
  assert.equal(blocked.status, 429);
  assert.match(blocked.message, /Too many incorrect attempts/);

  // A resend straight after registration is refused: the cooldown stops the
  // endpoint being used to spam an address.
  const tooSoon = await call('/api/v1/companies/resend-verification', {
    method: 'POST', body: { companyCode: 'LOCKCO' },
  });
  assert.equal(tooSoon.status, 429);
  assert.match(tooSoon.message, /before requesting another code/);

  // Backdate the last send to step past the cooldown rather than weakening it.
  await store.update((data) => {
    const company = data.companies.find((item) => item.code === 'LOCKCO');
    company.verification.sentAt = new Date(Date.now() - 120000).toISOString();
    return {};
  });

  // Resending clears the lock and invalidates the previous code.
  const resent = await call('/api/v1/companies/resend-verification', {
    method: 'POST', body: { companyCode: 'LOCKCO' },
  });
  assert.equal(resent.status, 200, resent.message);
  const fresh = resent.data.verificationCode;
  assert.ok(fresh && fresh !== code, 'a resend issues a different code');

  const stale = await call('/api/v1/companies/verify-email', {
    method: 'POST', body: { companyCode: 'LOCKCO', verificationCode: code },
  });
  assert.equal(stale.status, 400, 'the superseded code no longer works');

  const accepted = await call('/api/v1/companies/verify-email', {
    method: 'POST', body: { companyCode: 'LOCKCO', verificationCode: fresh },
  });
  assert.equal(accepted.status, 200, accepted.message);
});

test('resend does not reveal whether a company exists', async () => {
  const unknown = await call('/api/v1/companies/resend-verification', {
    method: 'POST', body: { companyCode: 'NOSUCHTENANT' },
  });
  assert.equal(unknown.status, 200, 'an unknown code must not 404, or it becomes an enumeration tool');
  assert.equal(unknown.data.verificationCode, undefined);
  assert.match(String(unknown.data.message), /If that company is awaiting verification/);
});


// Weekly offs were only honoured when workingDayMethod was 'working_days'. Under
// the other two methods a Sunday with no check-in became an unnoticed absence, so
// enabling absence deductions removed roughly eight days of pay per person.
test('weekly offs are paid, not absences, under every payable-day method', async () => {
  const token = await adminToken();

  const saved = await call('/api/v1/attendance/work-week', {
    method: 'PATCH',
    token,
    body: {
      workWeek: {
        0: 'off',
        1: 'full', 2: 'full', 3: 'full', 4: 'full', 5: 'full',
        // 2nd and 4th Saturday off, the rest worked as half days.
        6: { pattern: 'nth', off: [2, 4], otherwise: 'half' },
      },
    },
  });
  assert.equal(saved.status, 200, saved.message);
  assert.deepEqual(saved.data.workingDays, [1, 2, 3, 4, 5, 6], 'Saturday still works on some weeks');
  assert.ok(saved.data.workWeekSummary.some((line) => /Saturday: 2nd and 4th off/.test(line)));
  assert.ok(saved.data.workWeekSummary.some((line) => /Sunday: weekly off/.test(line)));

  // March 2026: Sundays on 1, 8, 15, 22, 29; Saturdays on 7, 14, 21, 28.
  const preview = await call('/api/v1/attendance/work-week/preview?period=2026-03', { token });
  assert.equal(preview.status, 200, preview.message);
  assert.equal(preview.data.calendarDays, 31);
  assert.equal(preview.data.weeklyOffDays, 7, '5 Sundays plus the 2nd and 4th Saturday');
  assert.equal(preview.data.halfDays, 2, 'the 1st and 3rd Saturday are half days');

  const byDate = new Map(preview.data.days.map((day) => [day.date, day.kind]));
  assert.equal(byDate.get('2026-03-01'), 'off', 'Sunday');
  assert.equal(byDate.get('2026-03-07'), 'half', '1st Saturday');
  assert.equal(byDate.get('2026-03-14'), 'off', '2nd Saturday');
  assert.equal(byDate.get('2026-03-21'), 'half', '3rd Saturday');
  assert.equal(byDate.get('2026-03-28'), 'off', '4th Saturday');
  assert.equal(byDate.get('2026-03-16'), 'full', 'an ordinary Monday');

  // The denominator follows workingDayMethod and is reported separately from the
  // roster, because statutory practice often uses a flat 30.
  assert.equal(preview.data.workingDayMethod, 'calendar_days');
  assert.equal(preview.data.payableDayBasis, 31);

  // With absence deductions on, a month of untouched weekends must still pay in
  // full. This is the regression the whole change exists to prevent.
  const policy = await call('/api/v1/attendance/policy', {
    method: 'PATCH', token, body: { attendancePolicy: { payrollImpact: 'attendance_and_leave' } },
  });
  assert.equal(policy.status, 200, policy.message);

  const employees = await call('/api/v1/employees?limit=100', { token });
  const subject = employees.data.employees.find((item) => item.employeeId === 'EMP001');
  assert.ok(subject, 'expected the seeded employee');

  const team = await call('/api/v1/attendance/team?date=2026-03-16&period=2026-03', { token });
  assert.equal(team.status, 200);
  const row = team.data.attendances.find((item) => item.employee.employeeId === 'EMP001');
  assert.ok(row, 'expected a row for the employee');
  assert.equal(row.summary.weeklyOffDays, 7, 'the summary counts weekly offs in every method');
  assert.equal(row.summary.unnoticedAbsenceDays > 0, true, 'working days with no record are still absences');

  // Team rows expose the requested day directly, so each kind is checked by date.
  // A weekly off must pay in full and never register as loss of pay.
  for (const date of ['2026-03-01', '2026-03-14', '2026-03-28']) {
    const dayRow = await call(`/api/v1/attendance/team?date=${date}&period=2026-03`, { token });
    const entry = dayRow.data.attendances.find((item) => item.employee.employeeId === 'EMP001');
    assert.equal(entry.day.status, 'weekly_off', `${date} is a weekly off`);
    assert.equal(entry.day.payableDays, 1, `${date} pays a full day`);
    assert.equal(entry.day.lossOfPayDays, 0, `${date} is never loss of pay`);
  }

  // A worked Saturday is still a working day, so an absence there is real.
  const workedSaturday = await call('/api/v1/attendance/team?date=2026-03-07&period=2026-03', { token });
  const saturday = workedSaturday.data.attendances.find((item) => item.employee.employeeId === 'EMP001');
  assert.notEqual(saturday.day.status, 'weekly_off', 'the 1st Saturday is worked');

  // Restore the seeded configuration so later tests are unaffected.
  await call('/api/v1/attendance/policy', {
    method: 'PATCH', token, body: { attendancePolicy: { payrollImpact: 'leave_only' } },
  });
  await call('/api/v1/attendance/work-week', {
    method: 'PATCH', token, body: { workWeek: { 0: 'off', 1: 'full', 2: 'full', 3: 'full', 4: 'full', 5: 'full', 6: 'off' } },
  });
});

test('an nth-weekday pattern with no occurrences collapses to a plain day', async () => {
  const token = await adminToken();
  const saved = await call('/api/v1/attendance/work-week', {
    method: 'PATCH',
    token,
    body: { workWeek: { 0: 'off', 6: { pattern: 'nth', off: [], otherwise: 'half' } } },
  });
  assert.equal(saved.status, 200, saved.message);
  assert.equal(saved.data.workWeek[6], 'half', 'a pattern that never triggers is just its fallback');

  const restored = await call('/api/v1/attendance/work-week', {
    method: 'PATCH', token, body: { workWeek: { 0: 'off', 1: 'full', 2: 'full', 3: 'full', 4: 'full', 5: 'full', 6: 'off' } },
  });
  assert.equal(restored.status, 200);
});

test('only an admin can change the work week', async () => {
  const hr = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'hr@testco.com', password: 'password123' },
  });
  assert.equal(hr.status, 200);

  const read = await call('/api/v1/attendance/policy', { token: hr.data.accessToken });
  assert.equal(read.status, 200, 'HR can see the work week');

  const blocked = await call('/api/v1/attendance/work-week', {
    method: 'PATCH', token: hr.data.accessToken, body: { workWeek: { 0: 'full' } },
  });
  assert.equal(blocked.status, 403, 'changing what everyone is paid is admin-only');
});

// Generation used to be the first moment any figure existed, so nothing could be
// confirmed before committing a month.
test('payroll can be previewed without writing anything', async () => {
  const token = await adminToken();
  const period = '2027-05';

  const before = await call('/api/v1/payroll', { token });
  const countBefore = (before.data.payroll || []).filter((item) => item.period === period).length;
  assert.equal(countBefore, 0, 'nothing exists for this period yet');

  const preview = await call(`/api/v1/payroll/preview?period=${period}`, { token });
  assert.equal(preview.status, 200, preview.message);
  assert.equal(preview.data.period, period);
  assert.ok(Array.isArray(preview.data.rows) && preview.data.rows.length > 0, 'a row per employee');
  assert.ok(preview.data.counts.employees > 0);
  assert.ok(Object.prototype.hasOwnProperty.call(preview.data, 'ready'));
  assert.ok(Object.prototype.hasOwnProperty.call(preview.data.totals, 'net'));

  // Each payable row carries the figures and the day counts behind them.
  const payable = preview.data.rows.find((row) => !row.skipped);
  assert.ok(payable, 'expected at least one payable employee');
  assert.ok(payable.figures.net >= 0);
  assert.ok(payable.attendance.scheduledDays > 0);
  assert.ok(Object.prototype.hasOwnProperty.call(payable.attendance, 'payableDays'));

  // Employees without a salary structure are reported up front rather than being
  // discovered in the run summary afterwards.
  const skipped = preview.data.rows.filter((row) => row.skipped);
  assert.ok(skipped.every((row) => row.skipReason === 'Salary structure not configured'));

  const after = await call('/api/v1/payroll', { token });
  const countAfter = (after.data.payroll || []).filter((item) => item.period === period).length;
  assert.equal(countAfter, 0, 'a preview must not persist anything');
});

test('the preview flags a stale period and an unfinished one', async () => {
  const token = await adminToken();

  const past = await call('/api/v1/payroll/preview?period=2024-02', { token });
  assert.equal(past.status, 200);
  assert.ok(
    past.data.company.warnings.some((item) => item.code === 'period.stale'),
    'an old month is computed with current statutory settings, which is worth saying',
  );

  const future = await call('/api/v1/payroll/preview?period=2099-01', { token });
  assert.equal(future.status, 200);
  assert.ok(future.data.company.warnings.some((item) => item.code === 'period.future'));

  const malformed = await call('/api/v1/payroll/preview?period=nonsense', { token });
  assert.equal(malformed.status, 400);
});

test('the exceptions view returns only employees who differ from a clean month', async () => {
  const token = await adminToken();
  const period = '2027-06';

  const all = await call(`/api/v1/payroll/preview?period=${period}&view=all`, { token });
  const exceptions = await call(`/api/v1/payroll/preview?period=${period}&view=exceptions`, { token });
  assert.equal(exceptions.status, 200);
  assert.equal(exceptions.data.view, 'exceptions');
  assert.ok(exceptions.data.rows.length <= all.data.rows.length);
  assert.ok(
    exceptions.data.rows.every((row) => row.reasons.length > 0 || row.blockers.length > 0),
    'every row in the exceptions view has a stated reason',
  );
  // The counts describe the whole run even when the rows are filtered.
  assert.equal(exceptions.data.counts.employees, all.data.counts.employees);
  assert.equal(exceptions.data.counts.exceptions + exceptions.data.counts.clean, all.data.counts.employees);
});

test('a leave still awaiting a decision blocks approval of that period', async () => {
  const token = await adminToken();
  const period = '2027-08';

  const employees = await call('/api/v1/employees?limit=100', { token });
  const subject = employees.data.employees.find((item) => item.employeeId === 'EMP001');
  assert.ok(subject, 'expected the seeded employee');

  const generated = await call('/api/v1/payroll/generate', {
    method: 'POST', token, body: { period, employeeId: subject._id, replaceDrafts: true },
  });
  assert.equal(generated.status, 201, generated.message);

  const employeeLogin = await call('/api/v1/auth/login', {
    method: 'POST', body: { companyCode: 'TESTCO', employeeId: 'EMP001', passcode: '1234' },
  });
  const applied = await call('/api/v1/leaves/apply', {
    method: 'POST', token: employeeLogin.data.accessToken,
    body: { leaveType: 'casual', startDate: '2027-08-10', endDate: '2027-08-10', reason: 'Undecided while payroll is approved' },
  });
  assert.equal(applied.status, 201, applied.message);

  // The preview names it as a blocker before anyone tries.
  const preview = await call(`/api/v1/payroll/preview?period=${period}`, { token });
  const row = preview.data.rows.find((item) => item.employee.employeeId === 'EMP001');
  assert.ok(row.blockers.some((item) => item.code === 'leave.pending'));
  assert.equal(preview.data.ready, false, 'the run is not ready while a decision is outstanding');

  const blocked = await call('/api/v1/payroll/bulk/approve', { method: 'POST', token, body: { period } });
  assert.equal(blocked.status, 409, 'approval freezes the month, so it must not proceed');
  assert.match(blocked.message, /still pending/);

  // Force is available for the case where the current figures are accepted.
  const forced = await call('/api/v1/payroll/bulk/approve', { method: 'POST', token, body: { period, force: true } });
  assert.equal(forced.status, 200, forced.message);

  await call(`/api/v1/leaves/${applied.data.leave._id}/cancel`, { method: 'POST', token: employeeLogin.data.accessToken });
});

test('readiness reports company-level blockers that stop every payslip', async () => {
  // The QHR Demo tenant is seeded without payroll identity, so it is a genuine
  // "not ready" fixture rather than one contrived for the test.
  const login = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'company-admin@qhr.com', password: 'password123' },
  });
  assert.equal(login.status, 200);

  const preview = await call('/api/v1/payroll/preview?period=2027-05', { token: login.data.accessToken });
  assert.equal(preview.status, 200, preview.message);
  const codes = preview.data.company.blockers.map((item) => item.code);
  assert.ok(codes.includes('identity.registeredAddress'), 'a payslip cannot be issued without a statutory address');
  assert.equal(preview.data.ready, false);
  // Every blocker says where to go and fix it.
  assert.ok(preview.data.company.blockers.every((item) => item.fix));
});

test('managers cannot preview payroll', async () => {
  const login = await call('/api/v1/auth/admin-login', {
    method: 'POST', body: { email: 'manager@testco.com', password: 'password123' },
  });
  const blocked = await call('/api/v1/payroll/preview?period=2027-05', { token: login.data.accessToken });
  assert.equal(blocked.status, 403);
});
