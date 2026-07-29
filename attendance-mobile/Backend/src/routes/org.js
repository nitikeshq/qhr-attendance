const express = require('express');

const { authRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const {
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
  permissionRequired,
} = require('../utils/permissions');
const {
  findCompany,
  newId,
  normalizeCode,
  nowIso,
} = require('../utils/records');
const { locationsNeedReconcile, reconcileCompanyLocations } = require('../utils/locationLinks');

const router = express.Router();

router.use(authRequired);

const STATUS_VALUES = ['active', 'inactive'];

function targetCompanyId(req) {
  if (req.user.role === 'super_admin' && req.query.companyId) return req.query.companyId;
  return req.company?._id;
}

function ensureMasters(company) {
  // Geofence-only addresses become real work locations here too, so Organisation
  // shows them without waiting for another endpoint to run first.
  reconcileCompanyLocations(company);
  company.departments ||= [];
  company.designations ||= [];
  company.workLocations ||= [];
  return company;
}

function trimmed(value) {
  return String(value ?? '').trim();
}

function optionalId(value) {
  const id = trimmed(value);
  return id ? id : null;
}

function normalizeStatus(value, fallback = 'active') {
  const status = trimmed(value).toLowerCase();
  return STATUS_VALUES.includes(status) ? status : fallback;
}

function duplicateCode(collection, code, ignoreId) {
  if (!code) return false;
  return collection.some((item) => item._id !== ignoreId && normalizeCode(item.code) === code);
}

function buildHierarchy(departments) {
  const byId = new Map(departments.map((item) => [item._id, item]));
  const nodes = new Map(departments.map((item) => [item._id, { ...item, children: [] }]));
  const roots = [];

  for (const department of departments) {
    const node = nodes.get(department._id);
    const parentId = department.parentDepartmentId;
    const hasValidParent = parentId && parentId !== department._id && byId.has(parentId);
    if (!hasValidParent) {
      roots.push(node);
      continue;
    }
    // Guard against cycles: walk up the chain and fall back to root when we loop.
    let cursor = byId.get(parentId);
    const seen = new Set([department._id]);
    let cyclic = false;
    while (cursor) {
      if (seen.has(cursor._id)) {
        cyclic = true;
        break;
      }
      seen.add(cursor._id);
      cursor = cursor.parentDepartmentId ? byId.get(cursor.parentDepartmentId) : null;
    }
    if (cyclic) {
      roots.push(node);
      continue;
    }
    nodes.get(parentId).children.push(node);
  }

  return roots;
}

function employeeReferences(data, companyId, field, value) {
  return (data.employees || []).some((employee) => employee.companyId === companyId && employee[field] === value);
}

function departmentPayload(body, existing = {}) {
  const payload = { ...existing };
  if (Object.prototype.hasOwnProperty.call(body, 'name')) payload.name = trimmed(body.name);
  if (Object.prototype.hasOwnProperty.call(body, 'code')) payload.code = normalizeCode(body.code);
  if (Object.prototype.hasOwnProperty.call(body, 'parentDepartmentId')) payload.parentDepartmentId = optionalId(body.parentDepartmentId);
  if (Object.prototype.hasOwnProperty.call(body, 'headEmployeeId')) payload.headEmployeeId = optionalId(body.headEmployeeId);
  if (Object.prototype.hasOwnProperty.call(body, 'status')) payload.status = normalizeStatus(body.status, existing.status || 'active');
  return payload;
}

function designationPayload(body, existing = {}) {
  const payload = { ...existing };
  if (Object.prototype.hasOwnProperty.call(body, 'name')) payload.name = trimmed(body.name);
  if (Object.prototype.hasOwnProperty.call(body, 'code')) payload.code = normalizeCode(body.code);
  if (Object.prototype.hasOwnProperty.call(body, 'level')) {
    const level = Number(body.level);
    payload.level = Number.isFinite(level) && level > 0 ? Math.round(level) : 1;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'departmentId')) payload.departmentId = optionalId(body.departmentId);
  if (Object.prototype.hasOwnProperty.call(body, 'status')) payload.status = normalizeStatus(body.status, existing.status || 'active');
  return payload;
}

function workLocationPayload(body, existing = {}) {
  const payload = { ...existing };
  const stringFields = ['name', 'addressLine', 'city', 'state', 'timezone', 'pfEstablishmentCode', 'esiEmployerCode'];
  for (const field of stringFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) payload[field] = trimmed(body[field]);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'code')) payload.code = normalizeCode(body.code);
  if (Object.prototype.hasOwnProperty.call(body, 'pincode')) payload.pincode = trimmed(body.pincode);
  if (Object.prototype.hasOwnProperty.call(body, 'isPayrollAddress')) payload.isPayrollAddress = body.isPayrollAddress === true || body.isPayrollAddress === 'true';
  if (Object.prototype.hasOwnProperty.call(body, 'status')) payload.status = normalizeStatus(body.status, existing.status || 'active');
  return payload;
}

function applyPayrollAddress(workLocations, activeId) {
  for (const location of workLocations) {
    location.isPayrollAddress = location._id === activeId;
  }
}

/** Single-line address, so every screen renders it the same way. */
function formatLocationAddress(location) {
  return [location.addressLine, location.city, location.state, location.pincode]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Creates, updates or leaves alone the geofence belonging to a work location.
 * The geofence inherits the site's name and address so the two can never drift,
 * and it is linked in both directions.
 */
function syncLocationGeofence(company, workLocation, body) {
  company.attendanceAreas ||= [];
  const existing = company.attendanceAreas.find((item) => item.workLocationId === workLocation._id) || null;

  const hasCoordinates = body.latitude !== undefined && body.latitude !== '' && body.longitude !== undefined && body.longitude !== '';
  const latitude = hasCoordinates ? Number(body.latitude) : existing?.latitude;
  const longitude = hasCoordinates ? Number(body.longitude) : existing?.longitude;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    // No coordinates anywhere: keep the address, just no geofence.
    if (existing) {
      existing.name = workLocation.name;
      existing.address = formatLocationAddress(workLocation);
    }
    return existing
      ? { _id: existing._id, name: existing.name, latitude: existing.latitude, longitude: existing.longitude, radiusMeters: existing.radiusMeters, active: existing.active !== false }
      : null;
  }

  const radiusMeters = Math.max(
    25,
    Math.min(5000, Number(body.radiusMeters ?? body.radius ?? existing?.radiusMeters ?? 150) || 150),
  );

  const area = existing || { _id: newId('area'), workLocationId: workLocation._id, active: true };
  area.name = workLocation.name;
  area.address = formatLocationAddress(workLocation);
  area.latitude = latitude;
  area.longitude = longitude;
  area.radiusMeters = radiusMeters;
  area.workLocationId = workLocation._id;
  if (!existing) company.attendanceAreas.push(area);

  return { _id: area._id, name: area.name, latitude, longitude, radiusMeters, active: area.active !== false };
}

/**
 * Attaches the readable address and the linked geofence to each work location.
 * A site's address and its attendance geofence were previously separate records
 * with no relationship, which is why an address entered in one place never
 * appeared in the other.
 */
function decorateWorkLocations(company) {
  const areas = Array.isArray(company.attendanceAreas) ? company.attendanceAreas : [];
  return (Array.isArray(company.workLocations) ? company.workLocations : []).map((location) => {
    const area = areas.find((item) => item.workLocationId === location._id) || null;
    return {
      ...location,
      address: formatLocationAddress(location),
      geofence: area
        ? {
          _id: area._id,
          name: area.name,
          latitude: area.latitude,
          longitude: area.longitude,
          radiusMeters: area.radiusMeters,
          active: area.active !== false,
        }
        : null,
    };
  });
}

async function withCompany(req, mutator) {
  const companyId = targetCompanyId(req);
  return req.app.locals.store.update((data) => {
    const company = findCompany(data, companyId);
    if (!company) return { error: 'Company not found', status: 404 };
    ensureMasters(company);
    return mutator(data, company);
  });
}

function respond(res, result, payload) {
  if (result.error) return fail(res, result.status || 400, result.error);
  return payload();
}

router.get('/', async (req, res, next) => {
  try {
    const companyId = targetCompanyId(req);
    const data = await req.app.locals.store.read();
    let company = findCompany(data, companyId);
    if (!company) return fail(res, 404, 'Company not found');

    // Lazy backfill. A tenant whose only address was recorded as an attendance
    // geofence used to report "no work locations", because the two were
    // unrelated arrays. Opening Organisation now materialises the missing side
    // and persists it, so employee placement and payslips see it as well. The
    // write only happens when something is actually missing.
    if (locationsNeedReconcile(company)) {
      const result = await req.app.locals.store.update((draft) => {
        const target = findCompany(draft, companyId);
        if (!target) return { error: 'Company not found', status: 404 };
        ensureMasters(target);
        target.updatedAt = nowIso();
        return { company: target };
      });
      if (result.error) return fail(res, result.status || 404, result.error);
      company = result.company;
    }

    const departments = Array.isArray(company.departments) ? company.departments : [];
    const designations = Array.isArray(company.designations) ? company.designations : [];
    return ok(res, {
      departments,
      designations,
      // Every consumer needs the readable address and the geofence that belongs
      // to the site, so both are resolved here rather than in each caller.
      workLocations: decorateWorkLocations(company),
      hierarchy: buildHierarchy(departments),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/permissions', permissionRequired('permissions.manage'), (req, res) => ok(res, {
  catalog: PERMISSION_CATALOG,
  roleDefaults: ROLE_PERMISSIONS,
}));

router.post('/departments', permissionRequired('org.manage'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await withCompany(req, (data, company) => {
      const payload = departmentPayload(body, { status: 'active', parentDepartmentId: null, headEmployeeId: null });
      if (!payload.name) return { error: 'Department name is required' };
      if (duplicateCode(company.departments, payload.code, null)) return { error: 'Department code already exists', status: 409 };
      if (payload.parentDepartmentId && !company.departments.some((item) => item._id === payload.parentDepartmentId)) {
        return { error: 'Parent department not found' };
      }
      const department = {
        _id: newId('dept'),
        name: payload.name,
        code: payload.code || normalizeCode(payload.name.slice(0, 8)),
        parentDepartmentId: payload.parentDepartmentId || null,
        headEmployeeId: payload.headEmployeeId || null,
        status: payload.status || 'active',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      company.departments.push(department);
      company.updatedAt = nowIso();
      return { department };
    });

    return respond(res, result, () => created(res, { department: result.department, message: 'Department created successfully' }));
  } catch (error) {
    return next(error);
  }
});

router.patch('/departments/:id', permissionRequired('org.manage'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await withCompany(req, (data, company) => {
      const department = company.departments.find((item) => item._id === req.params.id);
      if (!department) return { error: 'Department not found', status: 404 };
      const payload = departmentPayload(body, department);
      if (!payload.name) return { error: 'Department name is required' };
      if (duplicateCode(company.departments, payload.code, department._id)) return { error: 'Department code already exists', status: 409 };
      if (payload.parentDepartmentId) {
        if (payload.parentDepartmentId === department._id) return { error: 'A department cannot be its own parent' };
        if (!company.departments.some((item) => item._id === payload.parentDepartmentId)) return { error: 'Parent department not found' };
      }
      Object.assign(department, payload, { updatedAt: nowIso() });
      company.updatedAt = nowIso();
      return { department };
    });

    return respond(res, result, () => ok(res, { department: result.department, message: 'Department updated successfully' }));
  } catch (error) {
    return next(error);
  }
});

router.delete('/departments/:id', permissionRequired('org.manage'), async (req, res, next) => {
  try {
    const result = await withCompany(req, (data, company) => {
      const index = company.departments.findIndex((item) => item._id === req.params.id);
      if (index === -1) return { error: 'Department not found', status: 404 };
      const department = company.departments[index];
      if (company.departments.some((item) => item.parentDepartmentId === department._id)) {
        return { error: 'Remove or reassign child departments before deleting this department' };
      }
      if (company.designations.some((item) => item.departmentId === department._id)) {
        return { error: 'Designations are still linked to this department' };
      }
      if (employeeReferences(data, company._id, 'departmentId', department._id)) {
        return { error: 'Employees are still assigned to this department' };
      }
      company.departments.splice(index, 1);
      company.updatedAt = nowIso();
      return { department };
    });

    return respond(res, result, () => ok(res, { message: 'Department deleted successfully' }));
  } catch (error) {
    return next(error);
  }
});

router.post('/designations', permissionRequired('org.manage'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await withCompany(req, (data, company) => {
      const payload = designationPayload(body, { status: 'active', level: 1, departmentId: null });
      if (!payload.name) return { error: 'Designation name is required' };
      if (duplicateCode(company.designations, payload.code, null)) return { error: 'Designation code already exists', status: 409 };
      if (payload.departmentId && !company.departments.some((item) => item._id === payload.departmentId)) {
        return { error: 'Department not found' };
      }
      const designation = {
        _id: newId('desig'),
        name: payload.name,
        code: payload.code || normalizeCode(payload.name.slice(0, 8)),
        level: payload.level || 1,
        departmentId: payload.departmentId || null,
        status: payload.status || 'active',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      company.designations.push(designation);
      company.updatedAt = nowIso();
      return { designation };
    });

    return respond(res, result, () => created(res, { designation: result.designation, message: 'Designation created successfully' }));
  } catch (error) {
    return next(error);
  }
});

router.patch('/designations/:id', permissionRequired('org.manage'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await withCompany(req, (data, company) => {
      const designation = company.designations.find((item) => item._id === req.params.id);
      if (!designation) return { error: 'Designation not found', status: 404 };
      const payload = designationPayload(body, designation);
      if (!payload.name) return { error: 'Designation name is required' };
      if (duplicateCode(company.designations, payload.code, designation._id)) return { error: 'Designation code already exists', status: 409 };
      if (payload.departmentId && !company.departments.some((item) => item._id === payload.departmentId)) {
        return { error: 'Department not found' };
      }
      Object.assign(designation, payload, { updatedAt: nowIso() });
      company.updatedAt = nowIso();
      return { designation };
    });

    return respond(res, result, () => ok(res, { designation: result.designation, message: 'Designation updated successfully' }));
  } catch (error) {
    return next(error);
  }
});

router.delete('/designations/:id', permissionRequired('org.manage'), async (req, res, next) => {
  try {
    const result = await withCompany(req, (data, company) => {
      const index = company.designations.findIndex((item) => item._id === req.params.id);
      if (index === -1) return { error: 'Designation not found', status: 404 };
      const designation = company.designations[index];
      if (employeeReferences(data, company._id, 'designationId', designation._id)) {
        return { error: 'Employees are still assigned to this designation' };
      }
      company.designations.splice(index, 1);
      company.updatedAt = nowIso();
      return { designation };
    });

    return respond(res, result, () => ok(res, { message: 'Designation deleted successfully' }));
  } catch (error) {
    return next(error);
  }
});

router.post('/work-locations', permissionRequired('org.manage'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await withCompany(req, (data, company) => {
      const payload = workLocationPayload(body, {
        addressLine: '',
        city: '',
        state: '',
        pincode: '',
        timezone: company.settings?.timezone || 'Asia/Kolkata',
        isPayrollAddress: false,
        pfEstablishmentCode: '',
        esiEmployerCode: '',
        status: 'active',
      });
      if (!payload.name) return { error: 'Work location name is required' };
      if (duplicateCode(company.workLocations, payload.code, null)) return { error: 'Work location code already exists', status: 409 };
      const workLocation = {
        _id: newId('wloc'),
        name: payload.name,
        code: payload.code || normalizeCode(payload.name.slice(0, 8)),
        addressLine: payload.addressLine || '',
        city: payload.city || '',
        state: payload.state || '',
        pincode: payload.pincode || '',
        timezone: payload.timezone || 'Asia/Kolkata',
        isPayrollAddress: payload.isPayrollAddress === true,
        pfEstablishmentCode: payload.pfEstablishmentCode || '',
        esiEmployerCode: payload.esiEmployerCode || '',
        status: payload.status || 'active',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      company.workLocations.push(workLocation);
      if (workLocation.isPayrollAddress) applyPayrollAddress(company.workLocations, workLocation._id);

      // Coordinates turn the site into an attendance geofence in the same step,
      // so the address is entered once and reused rather than duplicated.
      const geofence = syncLocationGeofence(company, workLocation, body);
      company.updatedAt = nowIso();
      return { workLocation, geofence };
    });

    return respond(res, result, () => created(res, {
      workLocation: { ...result.workLocation, address: formatLocationAddress(result.workLocation), geofence: result.geofence },
      message: result.geofence
        ? 'Work location created with an attendance geofence'
        : 'Work location created successfully',
    }));
  } catch (error) {
    return next(error);
  }
});

router.patch('/work-locations/:id', permissionRequired('org.manage'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await withCompany(req, (data, company) => {
      const workLocation = company.workLocations.find((item) => item._id === req.params.id);
      if (!workLocation) return { error: 'Work location not found', status: 404 };
      const payload = workLocationPayload(body, workLocation);
      if (!payload.name) return { error: 'Work location name is required' };
      if (duplicateCode(company.workLocations, payload.code, workLocation._id)) return { error: 'Work location code already exists', status: 409 };
      Object.assign(workLocation, payload, { updatedAt: nowIso() });
      // Editing an inferred location means somebody has reviewed it, so it stops
      // being treated as a guess and counts as a real site from here on.
      delete workLocation.derivedFromGeofence;
      if (workLocation.isPayrollAddress === true) applyPayrollAddress(company.workLocations, workLocation._id);
      const geofence = syncLocationGeofence(company, workLocation, body);
      company.updatedAt = nowIso();
      return { workLocation, geofence };
    });

    return respond(res, result, () => ok(res, {
      workLocation: { ...result.workLocation, address: formatLocationAddress(result.workLocation), geofence: result.geofence },
      message: 'Work location updated successfully',
    }));
  } catch (error) {
    return next(error);
  }
});

/**
 * Bulk-assigns employees to a work location. Companies running several sites need
 * to place staff per site in one action rather than editing people one by one,
 * and the assignment is what drives the place of work printed on the payslip.
 */
router.post('/work-locations/:id/assign', permissionRequired('org.manage'), async (req, res, next) => {
  try {
    const requested = Array.isArray(req.body?.employeeIds) ? req.body.employeeIds : [];
    if (!requested.length) return fail(res, 400, 'Provide at least one employee to assign');

    const result = await withCompany(req, (data, company) => {
      const workLocation = company.workLocations.find((item) => item._id === req.params.id);
      if (!workLocation) return { error: 'Work location not found', status: 404 };
      if (workLocation.status === 'inactive') return { error: 'Cannot assign employees to an inactive work location' };

      const wanted = new Set(requested.map((id) => String(id)));
      const employees = data.employees.filter((item) => item.companyId === company._id && wanted.has(String(item._id)));
      const found = new Set(employees.map((item) => String(item._id)));
      const notFound = [...wanted].filter((id) => !found.has(id));
      if (notFound.length) {
        return { error: `${notFound.length} employee(s) do not belong to this company`, status: 404 };
      }

      let assigned = 0;
      let unchanged = 0;
      for (const employee of employees) {
        if (employee.workLocationId === workLocation._id) {
          unchanged += 1;
          continue;
        }
        employee.workLocationId = workLocation._id;
        employee.updatedAt = nowIso();
        assigned += 1;
      }
      company.updatedAt = nowIso();
      return { workLocation, assigned, unchanged };
    });

    return respond(res, result, () => ok(res, {
      workLocation: result.workLocation,
      assigned: result.assigned,
      unchanged: result.unchanged,
      message: `${result.assigned} employee(s) assigned to ${result.workLocation.name}${result.unchanged ? `, ${result.unchanged} already assigned` : ''}`,
    }));
  } catch (error) {
    return next(error);
  }
});

router.delete('/work-locations/:id', permissionRequired('org.manage'), async (req, res, next) => {
  try {
    const result = await withCompany(req, (data, company) => {
      const index = company.workLocations.findIndex((item) => item._id === req.params.id);
      if (index === -1) return { error: 'Work location not found', status: 404 };
      const workLocation = company.workLocations[index];
      if (employeeReferences(data, company._id, 'workLocationId', workLocation._id)) {
        return { error: 'Employees are still assigned to this work location' };
      }
      company.workLocations.splice(index, 1);
      company.updatedAt = nowIso();
      return { workLocation };
    });

    return respond(res, result, () => ok(res, { message: 'Work location deleted successfully' }));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
