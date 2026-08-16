'use strict';

/**
 * The option lists employees choose from when raising a request.
 *
 * Reimbursement and grievance categories used to be free text: the mobile app
 * shipped a placeholder reading "Category: travel, meals, mobile" and stored
 * whatever was typed. That produced "Travel", "travel", "travelling" and
 * "cab" as four different categories, none of which a company had agreed to,
 * and made reporting by category meaningless.
 *
 * Categories are now a company-owned list with a stable `code`, so records group
 * correctly, plus an optional `allowOther` escape for the genuinely unexpected
 * claim. When "Other" is used the employee's wording is kept in `categoryLabel`
 * rather than inventing a new code.
 */

function trimmed(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

/** Slug shared with leave types, so every option list keys the same way. */
function optionCode(value, fallback = 'other') {
  const code = trimmed(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return code || fallback;
}

/**
 * Travel is split from general expenses on purpose.
 *
 * A cab receipt and a personal-vehicle journey are different claims: one is a
 * reimbursement of money already spent, the other is an allowance calculated from
 * distance at a company rate. Treating them as one category made mileage
 * impossible to compute and impossible to report on.
 */
function defaultTravelPolicy() {
  return {
    // Per-kilometre rates by mode, used when an employee claims distance rather
    // than a receipt amount.
    mileageRates: [
      { code: 'two_wheeler', name: 'Two wheeler', ratePerKm: 4, active: true },
      { code: 'car', name: 'Car', ratePerKm: 12, active: true },
    ],
    dailyAllowances: [
      { code: 'local', name: 'Local travel', amountPerDay: 0, active: true },
      { code: 'outstation', name: 'Outstation', amountPerDay: 800, active: true },
      { code: 'international', name: 'International', amountPerDay: 2500, active: true },
    ],
    requireReceiptAboveAmount: 1000,
    allowMileageClaims: true,
  };
}

function normalizeTravelPolicy(company = {}, input = {}) {
  const current = company.travelPolicy || {};
  const defaults = defaultTravelPolicy();
  const pick = (key) => (Object.prototype.hasOwnProperty.call(input, key) ? input[key] : current[key]);

  const rates = normalizeOptionList(pick('mileageRates'), defaults.mileageRates).map((item, index) => {
    const source = (Array.isArray(pick('mileageRates')) ? pick('mileageRates') : defaults.mileageRates)[index] || {};
    return { ...item, ratePerKm: Math.max(0, Number(source.ratePerKm) || 0) };
  });
  const allowances = normalizeOptionList(pick('dailyAllowances'), defaults.dailyAllowances).map((item, index) => {
    const source = (Array.isArray(pick('dailyAllowances')) ? pick('dailyAllowances') : defaults.dailyAllowances)[index] || {};
    return { ...item, amountPerDay: Math.max(0, Number(source.amountPerDay) || 0) };
  });

  const threshold = pick('requireReceiptAboveAmount');
  return {
    mileageRates: rates.length ? rates : defaults.mileageRates,
    dailyAllowances: allowances.length ? allowances : defaults.dailyAllowances,
    requireReceiptAboveAmount: Number.isFinite(Number(threshold)) ? Math.max(0, Number(threshold)) : defaults.requireReceiptAboveAmount,
    allowMileageClaims: pick('allowMileageClaims') !== false,
  };
}

/** Distance at the company rate, so mileage is never entered as a free-text amount. */
function calculateMileage(travelPolicy, modeCode, distanceKm) {
  const km = Math.max(0, Number(distanceKm) || 0);
  if (!km) return { ok: false, reason: 'Distance travelled is required for a mileage claim' };
  const mode = (travelPolicy.mileageRates || []).find((item) => item.code === optionCode(modeCode, ''));
  if (!mode) {
    const names = (travelPolicy.mileageRates || []).filter((item) => item.active).map((item) => item.name).join(', ');
    return { ok: false, reason: `Choose a travel mode: ${names}` };
  }
  return {
    ok: true,
    amount: Math.round(km * Number(mode.ratePerKm) * 100) / 100,
    detail: { mode: mode.code, modeName: mode.name, distanceKm: km, ratePerKm: Number(mode.ratePerKm) },
  };
}

function defaultReimbursementCategories() {
  return [
    { code: 'travel_local', name: 'Local travel', description: 'Cabs, fares and fuel within the city', active: true },
    { code: 'travel_outstation', name: 'Outstation travel', description: 'Trains, flights and intercity travel', active: true },
    { code: 'travel_mileage', name: 'Personal vehicle mileage', description: 'Distance claimed at the company rate per km', active: true },
    { code: 'travel', name: 'Travel (other)', description: 'Fares, cabs, fuel and tolls', active: true },
    { code: 'accommodation', name: 'Accommodation', description: 'Hotel and lodging on work trips', active: true },
    { code: 'meals', name: 'Meals and entertainment', description: 'Client and team meals', active: true },
    { code: 'mobile_internet', name: 'Mobile and internet', description: 'Work phone and broadband bills', active: true },
    { code: 'office_supplies', name: 'Office supplies', description: 'Stationery and small equipment', active: true },
    { code: 'training', name: 'Training and certification', description: 'Courses, exams and books', active: true },
    { code: 'medical', name: 'Medical', description: 'Reimbursable medical expenses', active: true },
  ];
}

function defaultGrievanceCategories() {
  return [
    { code: 'payroll', name: 'Salary and payslip', description: 'Pay, deductions or payslip queries', active: true },
    { code: 'attendance', name: 'Attendance and leave', description: 'Wrong attendance or leave record', active: true },
    { code: 'facilities', name: 'Workplace and facilities', description: 'Seating, equipment, safety', active: true },
    { code: 'manager', name: 'Manager or team', description: 'Reporting, workload or team concerns', active: true },
    { code: 'harassment', name: 'Harassment or misconduct', description: 'Handled confidentially by HR', active: true },
    { code: 'it_support', name: 'IT and access', description: 'Accounts, devices and software', active: true },
  ];
}

/**
 * Normalizes one option list. Later duplicates of a code are dropped rather than
 * merged, so a company editing its list cannot silently end up with two options
 * that write the same value.
 */
function normalizeOptionList(input, fallback = []) {
  const source = Array.isArray(input) ? input : fallback;
  const seen = new Set();
  const list = [];
  for (const item of source) {
    if (item === null || item === undefined) continue;
    const isText = typeof item === 'string';
    const name = trimmed(isText ? item : item.name || item.code);
    if (!name) continue;
    const code = optionCode(isText ? item : item.code || item.name);
    if (seen.has(code)) continue;
    seen.add(code);
    list.push({
      code,
      name,
      description: trimmed(isText ? '' : item.description),
      // Retiring an option must not rewrite history, so it is deactivated rather
      // than deleted: existing claims keep a resolvable label.
      active: isText ? true : item.active !== false,
    });
  }
  return list;
}

function normalizeRequestOptions(company = {}, input = {}) {
  const current = company.requestOptions || {};
  const reimbursementInput = Object.prototype.hasOwnProperty.call(input, 'reimbursementCategories')
    ? input.reimbursementCategories
    : current.reimbursementCategories;
  const grievanceInput = Object.prototype.hasOwnProperty.call(input, 'grievanceCategories')
    ? input.grievanceCategories
    : current.grievanceCategories;
  const allowOther = (key, fallback) => {
    if (Object.prototype.hasOwnProperty.call(input, key)) return input[key] !== false;
    if (Object.prototype.hasOwnProperty.call(current, key)) return current[key] !== false;
    return fallback;
  };

  return {
    reimbursementCategories: normalizeOptionList(reimbursementInput, defaultReimbursementCategories()),
    grievanceCategories: normalizeOptionList(grievanceInput, defaultGrievanceCategories()),
    allowOtherReimbursementCategory: allowOther('allowOtherReimbursementCategory', true),
    allowOtherGrievanceCategory: allowOther('allowOtherGrievanceCategory', true),
  };
}

/**
 * Resolves a submitted category against the company list.
 *
 * Returns the stored `code` plus the label to display. An inactive option is still
 * accepted when it is what the employee picked from a stale screen, because
 * rejecting it would lose the claim; a code that was never configured is only
 * accepted when the company allows "Other".
 */
function resolveCategory(list, allowOther, submitted, submittedLabel = '') {
  const options = Array.isArray(list) ? list : [];
  const code = optionCode(submitted, '');
  if (!code) return { ok: false, reason: 'A category is required' };

  const match = options.find((item) => item.code === code);
  if (match) return { ok: true, code: match.code, label: match.name, custom: false };

  if (code === 'other' || allowOther) {
    const label = trimmed(submittedLabel) || trimmed(submitted);
    if (!label) return { ok: false, reason: 'Describe the category when choosing Other' };
    return { ok: true, code: 'other', label, custom: true };
  }

  const names = options.filter((item) => item.active).map((item) => item.name).join(', ');
  return { ok: false, reason: `Choose one of the configured categories: ${names}` };
}

module.exports = {
  calculateMileage,
  defaultGrievanceCategories,
  defaultReimbursementCategories,
  defaultTravelPolicy,
  normalizeOptionList,
  normalizeRequestOptions,
  normalizeTravelPolicy,
  optionCode,
  resolveCategory,
};
