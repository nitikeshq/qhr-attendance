const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  const suffix = crypto.randomBytes(5).toString('hex');
  return `${prefix}_${Date.now().toString(36)}_${suffix}`;
}

function makeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function startOfDayIso(value = new Date()) {
  return `${dateKey(value)}T00:00:00.000Z`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetweenInclusive(startDate, endDate, isHalfDay = false) {
  if (isHalfDay) return 0.5;
  const start = new Date(startOfDayIso(startDate));
  const end = new Date(startOfDayIso(endDate || startDate));
  const diff = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(diff / 86400000) + 1;
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function publicCompany(company) {
  if (!company) return null;
  const { verificationCode, ...safeCompany } = company;
  return safeCompany;
}

function employeeRef(employee) {
  if (!employee) return null;
  return {
    _id: employee._id,
    employeeId: employee.employeeId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    role: employee.role,
  };
}

function publicEmployee(employee, company) {
  if (!employee) return null;
  const { passwordHash, passcodeHash, ...safeEmployee } = employee;
  return {
    ...safeEmployee,
    company: publicCompany(company),
  };
}

function findCompany(data, companyId) {
  return data.companies.find((company) => company._id === companyId);
}

function findEmployee(data, employeeIdOrObjectId, companyId) {
  const needle = normalizeCode(employeeIdOrObjectId);
  return data.employees.find((employee) => {
    const sameCompany = !companyId || employee.companyId === companyId;
    return sameCompany && (employee._id === employeeIdOrObjectId || normalizeCode(employee.employeeId) === needle);
  });
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { page, limit };
}

function paginate(items, query) {
  const { page, limit } = parsePagination(query);
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);
  return {
    items: paged,
    pagination: {
      page,
      limit,
      total: items.length,
      pages: Math.max(1, Math.ceil(items.length / limit)),
    },
  };
}

function calculateWorkDuration(checkIn, checkOut) {
  if (!checkIn?.time || !checkOut?.time) return 0;
  const minutes = Math.round((new Date(checkOut.time).getTime() - new Date(checkIn.time).getTime()) / 60000);
  return Math.max(0, minutes);
}

module.exports = {
  addDays,
  calculateWorkDuration,
  dateKey,
  daysBetweenInclusive,
  employeeRef,
  findCompany,
  findEmployee,
  makeToken,
  newId,
  normalizeCode,
  nowIso,
  paginate,
  publicCompany,
  publicEmployee,
  startOfDayIso,
};
