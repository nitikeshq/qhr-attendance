const { fail } = require('./responses');

const PERMISSION_CATALOG = [
  { key: 'employees.view', label: 'View employees', module: 'employees' },
  { key: 'employees.manage', label: 'Create and edit employees', module: 'employees' },
  { key: 'attendance.view', label: 'View attendance', module: 'attendance' },
  { key: 'attendance.manage', label: 'Edit and regularise attendance', module: 'attendance' },
  { key: 'leave.view', label: 'View leave requests', module: 'leave' },
  { key: 'leave.approve', label: 'Approve or reject leave', module: 'leave' },
  { key: 'wfh.approve', label: 'Approve or reject work from home', module: 'leave' },
  { key: 'payroll.view', label: 'View payroll', module: 'payroll' },
  { key: 'payroll.manage', label: 'Run and edit payroll', module: 'payroll' },
  { key: 'payroll.approve', label: 'Approve and release payroll', module: 'payroll' },
  { key: 'reimbursement.approve', label: 'Approve or reject reimbursements', module: 'reimbursement' },
  { key: 'reimbursement.pay', label: 'Mark reimbursements as paid', module: 'reimbursement' },
  { key: 'work.view', label: 'View work items', module: 'work' },
  { key: 'work.manage', label: 'Assign and edit work items', module: 'work' },
  { key: 'assets.view', label: 'View assets', module: 'assets' },
  { key: 'assets.manage', label: 'Issue and edit assets', module: 'assets' },
  { key: 'org.manage', label: 'Manage departments, designations, and locations', module: 'organisation' },
  { key: 'geofence.manage', label: 'Manage attendance geofences', module: 'organisation' },
  { key: 'settings.manage', label: 'Manage company settings', module: 'settings' },
  { key: 'billing.manage', label: 'Manage subscription and billing', module: 'billing' },
  { key: 'audit.view', label: 'View audit trail', module: 'audit' },
  { key: 'permissions.manage', label: 'Manage roles and custom permissions', module: 'permissions' },
];

const PERMISSIONS = PERMISSION_CATALOG.map((item) => item.key);
const PERMISSION_KEY_SET = new Set(PERMISSIONS);

const ROLE_PERMISSIONS = {
  employee: [
    'work.view',
  ],
  manager: [
    'employees.view',
    'attendance.view',
    'leave.view',
    'leave.approve',
    'wfh.approve',
    'reimbursement.approve',
    'work.view',
    'work.manage',
    'assets.view',
  ],
  hr: [
    'employees.view',
    'employees.manage',
    'attendance.view',
    'attendance.manage',
    'leave.view',
    'leave.approve',
    'wfh.approve',
    'payroll.view',
    'payroll.manage',
    'reimbursement.approve',
    'work.view',
    'work.manage',
    'assets.view',
    'assets.manage',
    'org.manage',
    'geofence.manage',
  ],
  admin: [...PERMISSIONS],
  super_admin: [...PERMISSIONS],
};

function isPermissionKey(key) {
  return PERMISSION_KEY_SET.has(String(key || '').trim());
}

function sanitizePermissionKeys(value) {
  if (!Array.isArray(value)) return [];
  const keys = value.map((item) => String(item || '').trim()).filter(isPermissionKey);
  return [...new Set(keys)];
}

function rolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function effectivePermissions(employee) {
  if (!employee) return new Set();
  const permissions = new Set(rolePermissions(employee.role));
  for (const key of sanitizePermissionKeys(employee.permissionGrants)) {
    permissions.add(key);
  }
  for (const key of sanitizePermissionKeys(employee.permissionRevokes)) {
    permissions.delete(key);
  }
  return permissions;
}

function hasPermission(employee, key) {
  if (!employee || !isPermissionKey(key)) return false;
  return effectivePermissions(employee).has(String(key).trim());
}

function permissionRequired(...keys) {
  const required = keys.flat().map((key) => String(key || '').trim()).filter(Boolean);
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, 401, 'Authentication token is required');
    }
    const permissions = effectivePermissions(req.user);
    const allowed = required.some((key) => permissions.has(key));
    if (!allowed) {
      return fail(res, 403, 'You do not have permission to perform this action');
    }
    return next();
  };
}

module.exports = {
  PERMISSIONS,
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
  effectivePermissions,
  hasPermission,
  isPermissionKey,
  permissionRequired,
  rolePermissions,
  sanitizePermissionKeys,
};
