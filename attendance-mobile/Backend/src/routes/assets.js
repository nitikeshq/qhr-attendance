const express = require('express');

const { authRequired, roleRequired } = require('../middleware/auth');
const { created, fail, ok } = require('../utils/responses');
const {
  employeeRef,
  findEmployee,
  newId,
  nowIso,
  paginate,
} = require('../utils/records');

const router = express.Router();

router.use(authRequired);

const CATEGORIES = [
  'laptop',
  'desktop',
  'mobile',
  'monitor',
  'accessory',
  'furniture',
  'vehicle',
  'software_license',
  'other',
];
const CONDITIONS = ['new', 'good', 'fair', 'damaged', 'retired'];
const STATUSES = ['available', 'assigned', 'in_repair', 'retired', 'lost'];
const UPDATABLE_FIELDS = [
  'name',
  'category',
  'serialNumber',
  'make',
  'model',
  'workLocationId',
  'condition',
  'status',
  'notes',
];

function ensureCollections(data) {
  data.assets ||= [];
  data.assetAssignments ||= [];
  return data;
}

function text(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function assetTag(value) {
  const trimmed = text(value);
  return trimmed ? trimmed.toUpperCase() : null;
}

function companyWorkLocations(company) {
  return Array.isArray(company?.workLocations) ? company.workLocations : [];
}

function workLocationNameFor(company, workLocationId) {
  if (!workLocationId) return null;
  const match = companyWorkLocations(company).find((location) => (
    location._id === workLocationId || location.id === workLocationId || location.code === workLocationId
  ));
  return match?.name || match?.title || null;
}

function companyAssets(data, companyId) {
  return (data.assets || []).filter((asset) => asset.companyId === companyId);
}

function findAsset(data, assetId, companyId) {
  return (data.assets || []).find((asset) => asset._id === assetId && asset.companyId === companyId) || null;
}

function assetAssignments(data, asset) {
  return (data.assetAssignments || [])
    .filter((item) => item.companyId === asset.companyId && item.assetId === asset._id)
    .sort((a, b) => String(b.assignedAt || '').localeCompare(String(a.assignedAt || '')));
}

function openAssignment(data, asset) {
  return (data.assetAssignments || []).find((item) => (
    item.companyId === asset.companyId &&
    item.assetId === asset._id &&
    item.status === 'assigned'
  )) || null;
}

function serializeAssignment(data, assignment) {
  if (!assignment) return null;
  const employee = (data.employees || []).find((item) => item._id === assignment.employeeId) || null;
  return {
    ...assignment,
    employee: employeeRef(employee),
  };
}

function serializeAsset(data, company, asset) {
  const assignment = openAssignment(data, asset);
  const assignedEmployee = assignment
    ? (data.employees || []).find((item) => item._id === assignment.employeeId) || null
    : null;
  return {
    ...asset,
    assignedTo: employeeRef(assignedEmployee),
    currentAssignment: assignment ? serializeAssignment(data, assignment) : null,
    workLocationName: workLocationNameFor(company, asset.workLocationId),
  };
}

function tagTaken(data, companyId, tag, ignoreAssetId) {
  return companyAssets(data, companyId).some((asset) => (
    asset._id !== ignoreAssetId && assetTag(asset.assetTag) === tag
  ));
}

function activeEmployee(data, employeeId, companyId) {
  const employee = findEmployee(data, employeeId, companyId);
  if (!employee || employee.status === 'inactive') return null;
  return employee;
}

function matchesQuery(asset, search) {
  if (!search) return true;
  return [asset.assetTag, asset.name, asset.serialNumber, asset.make, asset.model]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(search);
}

router.get('/my', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const assignments = (data.assetAssignments || []).filter((item) => (
      item.companyId === req.company._id &&
      item.employeeId === req.user._id &&
      item.status === 'assigned'
    ));
    const assets = assignments
      .map((assignment) => {
        const asset = findAsset(data, assignment.assetId, req.company._id);
        if (!asset) return null;
        return {
          ...serializeAsset(data, req.company, asset),
          assignment,
        };
      })
      .filter(Boolean);

    return ok(res, { assets, total: assets.length });
  } catch (error) {
    return next(error);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const assets = companyAssets(data, req.company._id);
    const byStatus = STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
    const byCategory = CATEGORIES.reduce((acc, category) => ({ ...acc, [category]: 0 }), {});

    for (const asset of assets) {
      const status = STATUSES.includes(asset.status) ? asset.status : 'available';
      const category = CATEGORIES.includes(asset.category) ? asset.category : 'other';
      byStatus[status] += 1;
      byCategory[category] += 1;
    }

    return ok(res, {
      total: assets.length,
      byStatus,
      byCategory,
      assigned: byStatus.assigned,
      available: byStatus.available,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const query = req.query || {};
    const search = String(query.q || '').trim().toLowerCase();
    const category = text(query.category);
    const status = text(query.status);
    const employeeId = text(query.employeeId);
    const workLocationId = text(query.workLocationId);

    let assets = companyAssets(data, req.company._id)
      .filter((asset) => matchesQuery(asset, search))
      .filter((asset) => (category ? asset.category === category : true))
      .filter((asset) => (status ? asset.status === status : true))
      .filter((asset) => (workLocationId ? asset.workLocationId === workLocationId : true))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    if (employeeId) {
      assets = assets.filter((asset) => openAssignment(data, asset)?.employeeId === employeeId);
    }

    const serialized = assets.map((asset) => serializeAsset(data, req.company, asset));
    if (typeof paginate === 'function') {
      const { items, pagination } = paginate(serialized, query);
      return ok(res, { assets: items, pagination, total: serialized.length });
    }
    return ok(res, { assets: serialized, total: serialized.length });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await req.app.locals.store.read();
    const asset = findAsset(data, req.params.id, req.company._id);
    if (!asset) return fail(res, 404, 'Asset not found');

    return ok(res, {
      asset: serializeAsset(data, req.company, asset),
      assignments: assetAssignments(data, asset).map((assignment) => serializeAssignment(data, assignment)),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const tag = assetTag(body.assetTag);
    const name = text(body.name);
    if (!tag || !name) return fail(res, 400, 'assetTag and name are required');

    const category = text(body.category) || 'other';
    if (!CATEGORIES.includes(category)) return fail(res, 400, `category must be one of: ${CATEGORIES.join(', ')}`);

    const condition = text(body.condition) || 'good';
    if (!CONDITIONS.includes(condition)) return fail(res, 400, `condition must be one of: ${CONDITIONS.join(', ')}`);

    const status = text(body.status) || 'available';
    if (!STATUSES.includes(status)) return fail(res, 400, `status must be one of: ${STATUSES.join(', ')}`);

    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      if (tagTaken(data, req.company._id, tag)) return { conflict: 'An asset with this asset tag already exists' };
      const now = nowIso();
      const asset = {
        _id: newId('asset'),
        companyId: req.company._id,
        assetTag: tag,
        name,
        category,
        serialNumber: text(body.serialNumber),
        make: text(body.make),
        model: text(body.model),
        workLocationId: text(body.workLocationId),
        condition,
        status,
        notes: text(body.notes),
        createdBy: req.user._id,
        createdAt: now,
        updatedAt: now,
        currentAssignmentId: null,
      };
      data.assets.push(asset);
      return { asset };
    });

    if (result.conflict) return fail(res, 409, result.conflict);
    return created(res, { asset: result.asset, message: 'Asset created' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (Object.prototype.hasOwnProperty.call(body, 'category') && !CATEGORIES.includes(text(body.category))) {
      return fail(res, 400, `category must be one of: ${CATEGORIES.join(', ')}`);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'condition') && !CONDITIONS.includes(text(body.condition))) {
      return fail(res, 400, `condition must be one of: ${CONDITIONS.join(', ')}`);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'status') && !STATUSES.includes(text(body.status))) {
      return fail(res, 400, `status must be one of: ${STATUSES.join(', ')}`);
    }

    const nextTag = Object.prototype.hasOwnProperty.call(body, 'assetTag') ? assetTag(body.assetTag) : undefined;
    if (nextTag === null) return fail(res, 400, 'assetTag cannot be empty');

    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const asset = findAsset(data, req.params.id, req.company._id);
      if (!asset) return { missing: true };
      if (nextTag && tagTaken(data, req.company._id, nextTag, asset._id)) {
        return { conflict: 'An asset with this asset tag already exists' };
      }

      for (const field of UPDATABLE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
        if (field === 'name') {
          const name = text(body.name);
          if (name) asset.name = name;
          continue;
        }
        if (['category', 'condition', 'status'].includes(field)) {
          asset[field] = text(body[field]);
          continue;
        }
        asset[field] = text(body[field]);
      }
      if (nextTag) asset.assetTag = nextTag;
      asset.updatedAt = nowIso();
      return { asset: serializeAsset(data, req.company, asset) };
    });

    if (result.missing) return fail(res, 404, 'Asset not found');
    if (result.conflict) return fail(res, 409, result.conflict);
    return ok(res, { asset: result.asset, message: 'Asset updated' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const asset = findAsset(data, req.params.id, req.company._id);
      if (!asset) return { missing: true };
      if (asset.status === 'assigned' || openAssignment(data, asset)) {
        return { conflict: 'Asset is currently assigned. Record a return before deleting it.' };
      }
      data.assets = data.assets.filter((item) => item._id !== asset._id);
      data.assetAssignments = data.assetAssignments.filter((item) => item.assetId !== asset._id);
      return { deleted: true, assetId: asset._id };
    });

    if (result.missing) return fail(res, 404, 'Asset not found');
    if (result.conflict) return fail(res, 409, result.conflict);
    return ok(res, { assetId: result.assetId, message: 'Asset deleted' });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/assign', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!text(body.employeeId)) return fail(res, 400, 'employeeId is required');
    const conditionOnAssign = text(body.conditionOnAssign);
    if (conditionOnAssign && !CONDITIONS.includes(conditionOnAssign)) {
      return fail(res, 400, `conditionOnAssign must be one of: ${CONDITIONS.join(', ')}`);
    }

    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const asset = findAsset(data, req.params.id, req.company._id);
      if (!asset) return { missing: true };
      if (asset.status === 'assigned' || openAssignment(data, asset)) {
        return { conflict: 'Asset is already assigned' };
      }
      if (['retired', 'lost'].includes(asset.status)) {
        return { conflict: `Asset is ${asset.status} and cannot be assigned` };
      }

      const employee = activeEmployee(data, body.employeeId, req.company._id);
      if (!employee) return { invalidEmployee: true };

      const now = nowIso();
      const assignment = {
        _id: newId('assetassign'),
        companyId: req.company._id,
        assetId: asset._id,
        employeeId: employee._id,
        assignedBy: req.user._id,
        assignedAt: now,
        expectedReturnAt: text(body.expectedReturnAt),
        returnedAt: null,
        returnedTo: null,
        conditionOnAssign: conditionOnAssign || asset.condition || 'good',
        conditionOnReturn: null,
        acknowledgedAt: null,
        notes: text(body.notes),
        status: 'assigned',
      };
      data.assetAssignments.push(assignment);

      asset.status = 'assigned';
      asset.currentAssignmentId = assignment._id;
      asset.updatedAt = now;

      return {
        asset: serializeAsset(data, req.company, asset),
        assignment: serializeAssignment(data, assignment),
      };
    });

    if (result.missing) return fail(res, 404, 'Asset not found');
    if (result.invalidEmployee) return fail(res, 400, 'Employee not found or inactive');
    if (result.conflict) return fail(res, 409, result.conflict);
    return created(res, { ...result, message: 'Asset assigned' });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/return', roleRequired('hr', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const conditionOnReturn = text(body.conditionOnReturn);
    if (conditionOnReturn && !CONDITIONS.includes(conditionOnReturn)) {
      return fail(res, 400, `conditionOnReturn must be one of: ${CONDITIONS.join(', ')}`);
    }

    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const asset = findAsset(data, req.params.id, req.company._id);
      if (!asset) return { missing: true };
      const assignment = openAssignment(data, asset);
      if (!assignment) return { conflict: 'Asset is not currently assigned' };

      const now = nowIso();
      assignment.status = 'returned';
      assignment.returnedAt = now;
      assignment.returnedTo = req.user._id;
      assignment.conditionOnReturn = conditionOnReturn || assignment.conditionOnAssign || 'good';
      if (text(body.notes)) assignment.notes = text(body.notes);

      asset.condition = assignment.conditionOnReturn;
      asset.status = conditionOnReturn === 'damaged' ? 'in_repair' : 'available';
      asset.currentAssignmentId = null;
      asset.updatedAt = now;

      return {
        asset: serializeAsset(data, req.company, asset),
        assignment: serializeAssignment(data, assignment),
      };
    });

    if (result.missing) return fail(res, 404, 'Asset not found');
    if (result.conflict) return fail(res, 409, result.conflict);
    return ok(res, { ...result, message: 'Asset returned' });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const result = await req.app.locals.store.update((data) => {
      ensureCollections(data);
      const asset = findAsset(data, req.params.id, req.company._id);
      if (!asset) return { missing: true };
      const assignment = openAssignment(data, asset);
      if (!assignment) return { conflict: 'Asset is not currently assigned' };
      if (assignment.employeeId !== req.user._id) return { forbidden: true };

      assignment.acknowledgedAt = assignment.acknowledgedAt || nowIso();
      asset.updatedAt = nowIso();
      return {
        asset: serializeAsset(data, req.company, asset),
        assignment: serializeAssignment(data, assignment),
      };
    });

    if (result.missing) return fail(res, 404, 'Asset not found');
    if (result.forbidden) return fail(res, 403, 'Only the assigned employee can acknowledge this asset');
    if (result.conflict) return fail(res, 409, result.conflict);
    return ok(res, { ...result, message: 'Asset receipt acknowledged' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
