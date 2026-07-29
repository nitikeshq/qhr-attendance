'use strict';

const { newId, nowIso, normalizeCode } = require('./records');

/**
 * Work location <-> geofence reconciliation.
 *
 * These started life as two unrelated arrays: `company.workLocations` (address,
 * used by payroll and employee placement) and `company.attendanceAreas` (a
 * lat/long radius used by check-in). A tenant could therefore have an address
 * recorded as a geofence and still be told "no work locations available"
 * everywhere a location was needed.
 *
 * This backfills the missing side and links the two, so one address is visible
 * everywhere it is required. It is idempotent and safe to run on every read.
 */

const SCHEMA_VERSION = 1;

function trimmed(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

/** Best-effort split of a free-text address into the fields a location needs. */
function splitAddress(address) {
  const parts = trimmed(address).split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return { addressLine: '', city: '', state: '', pincode: '' };

  let pincode = '';
  const last = parts[parts.length - 1];
  if (/^\d{4,8}$/.test(last)) {
    pincode = last;
    parts.pop();
  }
  // Read from the end: the last two parts of an Indian address are city and
  // state. With too few parts to tell, everything stays on the street line
  // rather than being guessed into the wrong field.
  const state = parts.length > 2 ? parts.pop() : '';
  const city = parts.length > 1 ? parts.pop() : '';
  return { addressLine: parts.join(', '), city, state, pincode };
}

function codeFor(company, name, taken) {
  const base = normalizeCode(trimmed(name).replace(/\s+/g, '').slice(0, 6)) || 'SITE';
  let candidate = base;
  let counter = 2;
  while (taken.has(candidate)) {
    candidate = normalizeCode(`${base}${counter}`);
    counter += 1;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * Creates a work location for every geofence that has none, links them both
 * ways, and guarantees exactly one payroll address when locations exist.
 */
function reconcileCompanyLocations(company) {
  company.workLocations ||= [];
  company.attendanceAreas ||= [];

  const locations = company.workLocations;
  const areas = company.attendanceAreas;
  let changed = false;

  const taken = new Set(locations.map((item) => normalizeCode(item.code)).filter(Boolean));

  for (const area of areas) {
    // Deliberately standalone: somebody chose to have a boundary with no site,
    // and that choice is not overridden here.
    if (area.standalone === true) continue;
    // Already linked and the target still exists: nothing to do.
    if (area.workLocationId && locations.some((item) => item._id === area.workLocationId)) continue;

    // A location with the same name is almost certainly the same site.
    const byName = locations.find((item) => trimmed(item.name).toLowerCase() === trimmed(area.name).toLowerCase());
    if (byName) {
      area.workLocationId = byName._id;
      changed = true;
      continue;
    }

    const parsed = splitAddress(area.address);
    const location = {
      _id: newId('wloc'),
      name: trimmed(area.name) || 'Work location',
      code: codeFor(company, area.name, taken),
      addressLine: parsed.addressLine,
      city: parsed.city,
      state: parsed.state,
      pincode: parsed.pincode,
      timezone: company.settings?.timezone || 'Asia/Kolkata',
      isPayrollAddress: false,
      pfEstablishmentCode: '',
      esiEmployerCode: '',
      status: area.active === false ? 'inactive' : 'active',
      // Marks the record as derived, not hand-entered, so it is obvious why it exists.
      derivedFromGeofence: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    locations.push(location);
    area.workLocationId = location._id;
    changed = true;
  }

  // Keep a linked geofence's name and address in step with its site.
  for (const area of areas) {
    if (!area.workLocationId) continue;
    const location = locations.find((item) => item._id === area.workLocationId);
    if (!location) continue;
    const address = [location.addressLine, location.city, location.state, location.pincode]
      .map(trimmed).filter(Boolean).join(', ');
    if (address && area.address !== address) {
      area.address = address;
      changed = true;
    }
  }

  // Payroll needs exactly one registered address.
  const active = locations.filter((item) => item.status !== 'inactive');
  const flagged = active.filter((item) => item.isPayrollAddress === true);
  if (active.length > 0 && flagged.length === 0) {
    active[0].isPayrollAddress = true;
    changed = true;
  } else if (flagged.length > 1) {
    flagged.slice(1).forEach((item) => { item.isPayrollAddress = false; });
    changed = true;
  }

  return changed;
}

/**
 * Cheap read-only check for whether `reconcileCompanyLocations` would change
 * anything. Lets a GET decide to take the write path only when it must, instead
 * of persisting the data file on every read.
 */
function locationsNeedReconcile(company) {
  const locations = Array.isArray(company.workLocations) ? company.workLocations : [];
  const areas = Array.isArray(company.attendanceAreas) ? company.attendanceAreas : [];

  for (const area of areas) {
    if (area.standalone === true) continue;
    if (!area.workLocationId || !locations.some((item) => item._id === area.workLocationId)) return true;
    const location = locations.find((item) => item._id === area.workLocationId);
    const address = [location.addressLine, location.city, location.state, location.pincode]
      .map(trimmed).filter(Boolean).join(', ');
    if (address && area.address !== address) return true;
  }

  const active = locations.filter((item) => item.status !== 'inactive');
  const flagged = active.filter((item) => item.isPayrollAddress === true);
  if (active.length > 0 && flagged.length !== 1) return true;

  return false;
}

function ensureLocationLinks(data) {
  data.meta ||= {};
  let changed = false;
  for (const company of data.companies || []) {
    if (reconcileCompanyLocations(company)) {
      company.updatedAt = nowIso();
      changed = true;
    }
  }
  if (changed) data.meta.locationSchemaVersion = SCHEMA_VERSION;
  return changed;
}

module.exports = {
  ensureLocationLinks,
  locationsNeedReconcile,
  reconcileCompanyLocations,
  splitAddress,
};
