const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { fail, ok } = require('../utils/responses');
const {
  findCompany,
  newId,
  normalizeCode,
  nowIso,
} = require('../utils/records');
const {
  normalizeAttendancePolicy,
  normalizeHolidays,
  normalizeLeaveTypes,
} = require('../utils/attendancePolicy');
const { normalizePayrollSettings } = require('../utils/payroll');
const {
  ONBOARDING_STEPS,
  ensureOnboarding,
  onboardingSnapshot,
} = require('../utils/onboarding');

const router = express.Router();

router.use(authRequired);
router.use(roleRequired('hr', 'admin'));

const ADMIN_ONLY_STEPS = ['payroll_identity', 'statutory'];
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const STATUS_VALUES = ['active', 'inactive'];

function trimmed(value) {
  return String(value ?? '').trim();
}

function normalizeStatus(value, fallback = 'active') {
  const status = trimmed(value).toLowerCase();
  return STATUS_VALUES.includes(status) ? status : fallback;
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function has(body, key) {
  return Object.prototype.hasOwnProperty.call(body || {}, key);
}

function stepDefinition(key) {
  return ONBOARDING_STEPS.find((step) => step.key === key) || null;
}

function ensureCompanyCollections(company) {
  company.settings ||= {};
  company.departments ||= [];
  company.designations ||= [];
  company.workLocations ||= [];
  company.attendanceAreas ||= [];
  company.leaveTypes ||= [];
  company.holidays ||= [];
  ensureOnboarding(company);
  return company;
}

function recordOnboardingAudit(data, req, action, details = {}) {
  data.auditLogs ||= [];
  data.auditLogs.push({
    _id: newId('audit'),
    actorId: req.user._id,
    actorName: req.user.name,
    actorRole: req.user.role,
    action,
    companyId: req.company._id,
    details,
    createdAt: nowIso(),
  });
}

async function withCompany(req, mutator) {
  return req.app.locals.store.update((data) => {
    const company = findCompany(data, req.company._id);
    if (!company) return { error: 'Company not found', status: 404 };
    ensureCompanyCollections(company);
    const result = mutator(data, company) || {};
    if (result.error) return result;
    company.updatedAt = nowIso();
    return { ...result, snapshot: onboardingSnapshot(company, data) };
  });
}

function duplicateCode(collection, code, ignoreId) {
  if (!code) return false;
  return collection.some((item) => item._id !== ignoreId && normalizeCode(item.code) === code);
}

function codeFromName(name) {
  return normalizeCode(trimmed(name).replace(/\s+/g, '').slice(0, 8));
}

function companyFormData(data, company) {
  const employeeCount = (data.employees || []).filter((employee) => (
    employee.companyId === company._id && employee.status !== 'inactive' && employee.role !== 'super_admin'
  )).length;
  return {
    // The wizard edits name/email/phone/domain alongside the address block, but
    // those live on the company record itself. Merge them in so the form can
    // prefill from registration and read back what it just saved.
    profile: {
      name: trimmed(company.name),
      email: trimmed(company.email),
      phone: trimmed(company.phone),
      domain: trimmed(company.domain),
      code: trimmed(company.code),
      ...(company.profile || {}),
    },
    settings: company.settings || {},
    payrollSettings: company.payrollSettings || null,
    workLocations: Array.isArray(company.workLocations) ? company.workLocations : [],
    departments: Array.isArray(company.departments) ? company.departments : [],
    designations: Array.isArray(company.designations) ? company.designations : [],
    leaveTypes: Array.isArray(company.leaveTypes) ? company.leaveTypes : [],
    holidays: Array.isArray(company.holidays) ? company.holidays : [],
    attendanceAreas: Array.isArray(company.attendanceAreas) ? company.attendanceAreas : [],
    employeeCount,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const company = findCompany(data, req.company._id);
    if (!company) return fail(res, 404, 'Company not found');
    const view = { ...company, profile: company.profile || {}, onboarding: company.onboarding || {} };
    return ok(res, {
      ...onboardingSnapshot(view, data),
      data: companyFormData(data, view),
    });
  } catch (error) {
    return next(error);
  }
});

function saveCompanyProfile(req, company) {
  const body = req.body || {};
  const profile = company.profile || {};
  const settings = company.settings;
  const next = {
    name: trimmed(has(body, 'name') ? body.name : company.name),
    email: trimmed(has(body, 'email') ? body.email : company.email).toLowerCase(),
    registeredAddress: trimmed(has(body, 'registeredAddress') ? body.registeredAddress : profile.registeredAddress),
    city: trimmed(has(body, 'city') ? body.city : profile.city),
    state: trimmed(has(body, 'state') ? body.state : profile.state),
    pincode: trimmed(has(body, 'pincode') ? body.pincode : profile.pincode),
    industry: trimmed(has(body, 'industry') ? body.industry : profile.industry),
    foundedOn: trimmed(has(body, 'foundedOn') ? body.foundedOn : profile.foundedOn),
    timezone: trimmed(has(body, 'timezone') ? body.timezone : settings.timezone),
    officeStart: trimmed(has(body, 'officeStart') ? body.officeStart : settings.officeStart),
    officeEnd: trimmed(has(body, 'officeEnd') ? body.officeEnd : settings.officeEnd),
  };

  const labels = {
    name: 'Company name',
    email: 'Company email',
    registeredAddress: 'Registered address',
    city: 'City',
    state: 'State',
    pincode: 'Pincode',
    industry: 'Industry',
    timezone: 'Timezone',
    officeStart: 'Office start time',
    officeEnd: 'Office end time',
  };
  const missing = Object.keys(labels).filter((field) => !next[field]).map((field) => labels[field]);
  if (missing.length) {
    return { error: `These fields are required: ${missing.join(', ')}` };
  }

  company.name = next.name;
  company.email = next.email;
  if (has(body, 'phone')) company.phone = trimmed(body.phone) || null;
  if (has(body, 'domain')) company.domain = trimmed(body.domain) || null;
  // Optional, so it is validated only when provided. Drives the company
  // anniversary on the shared calendar.
  if (next.foundedOn && !/^\d{4}-\d{2}-\d{2}$/.test(next.foundedOn)) {
    return { error: 'Founded on must be formatted YYYY-MM-DD' };
  }
  company.profile = {
    ...profile,
    registeredAddress: next.registeredAddress,
    city: next.city,
    state: next.state,
    pincode: next.pincode,
    industry: next.industry,
    foundedOn: next.foundedOn,
  };
  company.settings.timezone = next.timezone;
  company.settings.officeStart = next.officeStart;
  company.settings.officeEnd = next.officeEnd;
  return { message: 'Company profile saved' };
}

function savePayrollIdentity(req, company) {
  const body = req.body || {};
  const current = normalizePayrollSettings(company);
  const identityInput = body.identity && typeof body.identity === 'object' ? body.identity : body;
  const upperFields = ['pan', 'tan', 'gstin', 'pfEstablishmentCode', 'esiEmployerCode'];
  const identity = { ...current.identity };
  for (const field of ['legalName', 'registeredAddress', 'state', 'payslipFooter']) {
    if (has(identityInput, field)) identity[field] = trimmed(identityInput[field]);
  }
  for (const field of upperFields) {
    if (has(identityInput, field)) identity[field] = trimmed(identityInput[field]).toUpperCase();
  }

  const required = {
    legalName: 'Registered legal name',
    registeredAddress: 'Registered address',
    state: 'Registered state',
    pan: 'Company PAN',
  };
  const missing = Object.keys(required).filter((field) => !trimmed(identity[field])).map((field) => required[field]);
  if (missing.length) {
    return { error: `These fields are required: ${missing.join(', ')}` };
  }
  if (!PAN_PATTERN.test(identity.pan)) {
    return { error: 'PAN must be 10 characters in the format AAAAA1111A' };
  }

  company.payrollSettings = normalizePayrollSettings(company, {
    ...current,
    currency: has(body, 'currency') ? trimmed(body.currency).toUpperCase() : current.currency,
    payFrequency: 'monthly',
    paymentDay: has(body, 'paymentDay') ? numberOr(body.paymentDay, current.paymentDay) : current.paymentDay,
    identity,
    updatedAt: nowIso(),
    updatedBy: req.user._id,
  });
  return { message: 'Payroll identity saved' };
}

function saveWorkLocations(req, company) {
  const body = req.body || {};
  if (!Array.isArray(body.workLocations)) {
    return { error: 'workLocations must be an array' };
  }
  const existingById = new Map(company.workLocations.map((item) => [item._id, item]));
  const locations = [];
  for (const input of body.workLocations) {
    const existing = existingById.get(trimmed(input?._id)) || {};
    const name = trimmed(input?.name || existing.name);
    if (!name) return { error: 'Every work location needs a name' };
    const code = normalizeCode(input?.code || existing.code) || codeFromName(name);
    if (duplicateCode(locations, code, null)) {
      return { error: `Work location code ${code} is duplicated`, status: 409 };
    }
    locations.push({
      _id: trimmed(input?._id) || existing._id || newId('wloc'),
      name,
      code,
      addressLine: trimmed(input?.addressLine ?? existing.addressLine),
      city: trimmed(input?.city ?? existing.city),
      state: trimmed(input?.state ?? existing.state),
      pincode: trimmed(input?.pincode ?? existing.pincode),
      timezone: trimmed(input?.timezone ?? existing.timezone) || company.settings.timezone || 'Asia/Kolkata',
      isPayrollAddress: input?.isPayrollAddress === true || input?.isPayrollAddress === 'true',
      pfEstablishmentCode: trimmed(input?.pfEstablishmentCode ?? existing.pfEstablishmentCode).toUpperCase(),
      esiEmployerCode: trimmed(input?.esiEmployerCode ?? existing.esiEmployerCode).toUpperCase(),
      status: normalizeStatus(input?.status, existing.status || 'active'),
      createdAt: existing.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
  }

  if (locations.length === 0) {
    return { error: 'At least one work location is required' };
  }
  const flagged = locations.filter((location) => location.isPayrollAddress);
  if (flagged.length === 0) {
    if (locations.length > 1) {
      return { error: 'Mark exactly one work location as the payroll address' };
    }
    locations[0].isPayrollAddress = true;
  } else if (flagged.length > 1) {
    return { error: 'Only one work location can be the payroll address' };
  }

  company.workLocations = locations;
  return { message: 'Work locations saved' };
}

function saveOrgStructure(req, company) {
  const body = req.body || {};
  const departmentsInput = Array.isArray(body.departments) ? body.departments : null;
  const designationsInput = Array.isArray(body.designations) ? body.designations : null;
  if (!departmentsInput && !designationsInput) {
    return { error: 'Provide departments and/or designations to save' };
  }

  let departments = company.departments;
  if (departmentsInput) {
    const existingById = new Map(company.departments.map((item) => [item._id, item]));
    departments = [];
    for (const input of departmentsInput) {
      const existing = existingById.get(trimmed(input?._id)) || {};
      const name = trimmed(input?.name || existing.name);
      if (!name) return { error: 'Every department needs a name' };
      const code = normalizeCode(input?.code || existing.code) || codeFromName(name);
      if (duplicateCode(departments, code, null)) {
        return { error: `Department code ${code} is duplicated`, status: 409 };
      }
      departments.push({
        _id: trimmed(input?._id) || existing._id || newId('dept'),
        name,
        code,
        parentDepartmentId: trimmed(input?.parentDepartmentId ?? existing.parentDepartmentId) || null,
        headEmployeeId: trimmed(input?.headEmployeeId ?? existing.headEmployeeId) || null,
        status: normalizeStatus(input?.status, existing.status || 'active'),
        createdAt: existing.createdAt || nowIso(),
        updatedAt: nowIso(),
      });
    }
  }

  let designations = company.designations;
  if (designationsInput) {
    const existingById = new Map(company.designations.map((item) => [item._id, item]));
    const departmentIds = new Set(departments.map((item) => item._id));
    designations = [];
    for (const input of designationsInput) {
      const existing = existingById.get(trimmed(input?._id)) || {};
      const name = trimmed(input?.name || existing.name);
      if (!name) return { error: 'Every designation needs a name' };
      const code = normalizeCode(input?.code || existing.code) || codeFromName(name);
      if (duplicateCode(designations, code, null)) {
        return { error: `Designation code ${code} is duplicated`, status: 409 };
      }
      // Departments and designations are saved in the same request, so a brand
      // new department has no id yet on the client. Accept a name or code
      // reference and resolve it against the departments we just built.
      let departmentId = trimmed(input?.departmentId ?? existing.departmentId) || null;
      if (!departmentId) {
        const reference = trimmed(input?.departmentRef || input?.departmentName || input?.departmentCode);
        if (reference) {
          const needle = reference.toLowerCase();
          const matched = departments.find((item) => (
            item.name.toLowerCase() === needle || String(item.code || '').toLowerCase() === needle
          ));
          if (!matched) return { error: `Designation ${name} refers to a department that does not exist` };
          departmentId = matched._id;
        }
      }
      if (departmentId && !departmentIds.has(departmentId)) {
        return { error: `Designation ${name} refers to a department that does not exist` };
      }
      const level = Number(input?.level ?? existing.level);
      designations.push({
        _id: trimmed(input?._id) || existing._id || newId('desig'),
        name,
        code,
        level: Number.isFinite(level) && level > 0 ? Math.round(level) : 1,
        departmentId,
        status: normalizeStatus(input?.status, existing.status || 'active'),
        createdAt: existing.createdAt || nowIso(),
        updatedAt: nowIso(),
      });
    }
  }

  if (departments.length === 0) return { error: 'At least one department is required' };
  if (designations.length === 0) return { error: 'At least one designation is required' };

  company.departments = departments;
  company.designations = designations;
  return { message: 'Departments and designations saved' };
}

function saveStatutory(req, company) {
  const body = req.body || {};
  const current = normalizePayrollSettings(company);
  const statutoryInput = body.statutory && typeof body.statutory === 'object' ? body.statutory : body;
  company.payrollSettings = normalizePayrollSettings(company, {
    ...current,
    statutory: { ...current.statutory, ...statutoryInput },
    updatedAt: nowIso(),
    updatedBy: req.user._id,
  });
  company.onboarding.reviewed = { ...company.onboarding.reviewed, statutory: true };
  return { message: 'Statutory setup saved' };
}

function saveAttendancePolicy(req, company) {
  const body = req.body || {};
  const policyInput = body.attendancePolicy && typeof body.attendancePolicy === 'object' ? body.attendancePolicy : body;
  company.settings.attendancePolicy = normalizeAttendancePolicy(company, {
    ...(company.settings.attendancePolicy || {}),
    ...policyInput,
  });
  for (const flag of ['gpsTracking', 'autoCheckIn', 'requirePhotoAttendance']) {
    if (has(body, flag)) company.settings[flag] = body[flag] === true || body[flag] === 'true';
  }

  if (has(body, 'attendanceAreas')) {
    if (!Array.isArray(body.attendanceAreas)) {
      return { error: 'attendanceAreas must be an array' };
    }
    const existingById = new Map(company.attendanceAreas.map((item) => [item._id, item]));
    const areas = [];
    for (const input of body.attendanceAreas) {
      const existing = existingById.get(trimmed(input?._id)) || {};
      const name = trimmed(input?.name || existing.name);
      if (!name) return { error: 'Every attendance area needs a name' };
      const latitude = numberOr(input?.latitude ?? existing.latitude, null);
      const longitude = numberOr(input?.longitude ?? existing.longitude, null);
      if (latitude === null || longitude === null) {
        return { error: `Attendance area ${name} needs a numeric latitude and longitude` };
      }
      areas.push({
        _id: trimmed(input?._id) || existing._id || newId('area'),
        name,
        address: trimmed(input?.address ?? existing.address),
        latitude,
        longitude,
        radiusMeters: Math.max(1, Math.round(numberOr(input?.radiusMeters ?? input?.radius ?? existing.radiusMeters, 150))),
        active: input?.active === undefined ? existing.active !== false : input.active !== false,
      });
    }
    company.attendanceAreas = areas;
  }

  const activeAreas = company.attendanceAreas.filter((area) => area.active !== false);
  if (company.settings.gpsTracking === true && activeAreas.length === 0) {
    return { error: 'Add at least one attendance area or turn GPS tracking off' };
  }
  return { message: 'Attendance policy saved' };
}

function saveLeavePolicy(req, company) {
  const body = req.body || {};
  const input = Array.isArray(body.leaveTypes) ? body.leaveTypes : null;
  if (!input) return { error: 'leaveTypes must be an array' };
  company.leaveTypes = normalizeLeaveTypes(input, company.leaveTypes || []);
  return { message: 'Leave policy saved' };
}

function saveHolidays(req, company) {
  const body = req.body || {};
  const input = Array.isArray(body.holidays) ? body.holidays : null;
  if (!input) return { error: 'holidays must be an array' };
  company.holidays = normalizeHolidays(input, company.holidays || []);
  return { message: 'Holiday calendar saved' };
}

function saveTeam() {
  return { message: 'Team step reviewed. Employees are added from the employee directory.' };
}

const STEP_HANDLERS = {
  company_profile: saveCompanyProfile,
  payroll_identity: savePayrollIdentity,
  work_locations: saveWorkLocations,
  org_structure: saveOrgStructure,
  statutory: saveStatutory,
  attendance_policy: saveAttendancePolicy,
  leave_policy: saveLeavePolicy,
  holidays: saveHolidays,
  team: saveTeam,
};

router.patch('/:step', async (req, res, next) => {
  try {
    const key = trimmed(req.params.step);
    const definition = stepDefinition(key);
    const handler = STEP_HANDLERS[key];
    if (!definition || !handler) return fail(res, 404, `Unknown onboarding step "${key}"`);
    if (ADMIN_ONLY_STEPS.includes(key) && req.user.role !== 'admin') {
      return fail(res, 403, `Only a Company Admin can update the ${definition.title.toLowerCase()} step`);
    }

    const result = await withCompany(req, (data, company) => handler(req, company, data));
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, { ...result.snapshot, step: key, message: result.message });
  } catch (error) {
    return next(error);
  }
});

router.post('/skip/:step', async (req, res, next) => {
  try {
    const key = trimmed(req.params.step);
    const definition = stepDefinition(key);
    if (!definition) return fail(res, 404, `Unknown onboarding step "${key}"`);
    if (definition.required) return fail(res, 400, `${definition.title} is required and cannot be skipped`);

    const result = await withCompany(req, (data, company) => {
      if (!company.onboarding.skippedSteps.includes(key)) company.onboarding.skippedSteps.push(key);
      return {};
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, { ...result.snapshot, step: key, message: `${definition.title} skipped for now` });
  } catch (error) {
    return next(error);
  }
});

router.post('/complete', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return fail(res, 403, 'Only a Company Admin can complete onboarding');
    }

    const data = await req.app.locals.store.read();
    const company = findCompany(data, req.company._id);
    if (!company) return fail(res, 404, 'Company not found');
    const preview = onboardingSnapshot({ ...company, onboarding: company.onboarding || {} }, data);
    if (!preview.canComplete) {
      const missing = preview.steps
        .filter((step) => step.required && step.key !== 'review' && !step.complete)
        .flatMap((step) => step.missing.map((item) => `${step.title}: ${item}`));
      return fail(res, 422, 'Finish the required onboarding steps before going live', { missing });
    }

    const result = await withCompany(req, (mutable, item) => {
      item.onboarding.completedAt = nowIso();
      item.onboarding.completedBy = req.user._id;
      item.status = 'active';
      item.isVerified = true;
      recordOnboardingAudit(mutable, req, 'company.onboarding_completed', { steps: preview.progress });
      return {};
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, { ...result.snapshot, message: 'Onboarding completed. Your company is live.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/reopen', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return fail(res, 403, 'Only a Company Admin can reopen onboarding');
    }
    const result = await withCompany(req, (data, company) => {
      company.onboarding.completedAt = null;
      company.onboarding.completedBy = null;
      recordOnboardingAudit(data, req, 'company.onboarding_reopened', { reason: trimmed(req.body?.reason) || null });
      return {};
    });
    if (result.error) return fail(res, result.status || 400, result.error);
    return ok(res, { ...result.snapshot, message: 'Onboarding reopened' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
