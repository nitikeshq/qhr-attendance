const crypto = require('crypto');

const { newId, nowIso } = require('./records');
const { buildAttendanceSummary } = require('./attendancePolicy');
const {
  ensureReimbursementCollections,
  payrollAdjustmentsForEmployee,
} = require('./reimbursements');

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function componentCode(value, fallback = 'component') {
  const normalized = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function normalizeCalculation(value, fallback = 'fixed') {
  if (value === 'extra') return 'fixed';
  return ['fixed', 'percentage_of_basic', 'percentage_of_gross'].includes(value) ? value : fallback;
}

function normalizeTreatment(item, kind = 'earning') {
  if (kind !== 'earning') return 'included_in_gross';
  return item?.treatment === 'after_gross' || item?.calculation === 'extra'
    ? 'after_gross'
    : 'included_in_gross';
}

function isAfterGross(item) {
  return normalizeTreatment(item, 'earning') === 'after_gross';
}

function normalizeWageBasis(value, fallback = 'eligible_earnings') {
  return ['basic', 'gross', 'eligible_earnings'].includes(value) ? value : fallback;
}

function formulaValue(calculation, value, basic, gross) {
  if (calculation === 'percentage_of_basic') return amount(basic * value / 100);
  if (calculation === 'percentage_of_gross') return amount(gross * value / 100);
  return amount(value);
}

// Historical runs were stored with flat *Total fields and no runNumber/source.
// Normalize them on read so clients always receive one consistent shape.
function normalizeLegacyRun(run) {
  if (!run || typeof run !== 'object') return run;
  if (!run.totals || typeof run.totals !== 'object') {
    const salaryGross = amount(run.grossTotal);
    const paidAfterGross = amount(run.paidAfterGrossTotal);
    run.totals = {
      gross: salaryGross,
      salaryGross,
      paidAfterGross,
      totalEarnings: amount(salaryGross + paidAfterGross),
      deductions: amount(run.deductionTotal),
      net: amount(run.netTotal),
      employerContributions: amount(run.employerContributionTotal),
      ctc: amount(run.companyCostTotal || salaryGross + paidAfterGross),
    };
  }
  run.runNumber ||= `RUN-${run.period || 'UNKNOWN'}-LEGACY`;
  run.source ||= 'manual';
  if (!Number.isFinite(Number(run.employeeCount))) run.employeeCount = 0;
  if (!Number.isFinite(Number(run.createdCount))) run.createdCount = run.employeeCount || 0;
  if (!Number.isFinite(Number(run.existingCount))) run.existingCount = 0;
  if (!Number.isFinite(Number(run.skippedCount))) run.skippedCount = 0;
  run.skippedEmployees ||= [];
  return run;
}

function ensurePayrollCollections(data) {
  data.payroll ||= [];
  data.payrollRuns ||= [];
  data.payrollAuditLogs ||= [];
  data.salaryRevisions ||= [];
  data.paymentBatches ||= [];
  data.payrollRuns.forEach(normalizeLegacyRun);
  ensureReimbursementCollections(data);
}

function salaryMaterialSnapshot(salary) {
  const snapshot = JSON.parse(JSON.stringify(salary || {}));
  delete snapshot.updatedAt;
  delete snapshot.updatedBy;
  delete snapshot.preview;
  return snapshot;
}

function salaryMaterialKey(salary) {
  const sortObject = (value) => {
    if (Array.isArray(value)) return value.map(sortObject);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = sortObject(value[key]);
      return result;
    }, {});
  };
  return JSON.stringify(sortObject(salaryMaterialSnapshot(salary)));
}

function appendSalaryRevision(data, employee, salary, actorId = null, reason = 'Salary structure updated') {
  ensurePayrollCollections(data);
  const revisions = data.salaryRevisions.filter((item) => item.companyId === employee.companyId && item.employeeId === employee._id);
  const latest = revisions.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
  if (latest && salaryMaterialKey(latest.salarySnapshot) === salaryMaterialKey(salary)) return null;
  const revision = {
    _id: newId('salary_revision'),
    companyId: employee.companyId,
    employeeId: employee._id,
    effectiveFrom: String(salary.effectiveFrom || employee.dateOfJoining || nowIso()).slice(0, 10),
    reason: String(reason || 'Salary structure updated').trim() || 'Salary structure updated',
    salarySnapshot: JSON.parse(JSON.stringify(salary)),
    createdBy: actorId,
    createdAt: nowIso(),
  };
  data.salaryRevisions.push(revision);
  return revision;
}

function salaryRevisionForPeriod(data, employee, period) {
  ensurePayrollCollections(data);
  const periodEnd = periodRange(period).end.toISOString().slice(0, 10);
  const revision = data.salaryRevisions
    .filter((item) => item.companyId === employee.companyId && item.employeeId === employee._id && String(item.effectiveFrom).slice(0, 10) <= periodEnd)
    .sort((left, right) => String(right.effectiveFrom).localeCompare(String(left.effectiveFrom)) || String(right.createdAt).localeCompare(String(left.createdAt)))[0] || null;
  return {
    revision,
    salary: revision ? JSON.parse(JSON.stringify(revision.salarySnapshot)) : employee.salary,
  };
}

/**
 * Picks the work location whose address belongs on an employee's payslip.
 * A company can operate several sites, so the *place of work* follows the
 * employee's assigned location. When an employee has not been assigned one we
 * fall back to the location marked as the payroll address, which onboarding
 * guarantees exists and is unique.
 */
function resolveWorkLocation(company, employee) {
  const locations = Array.isArray(company?.workLocations) ? company.workLocations : [];
  if (!locations.length) return null;
  const assignedId = employee?.workLocationId || null;
  const assigned = assignedId ? locations.find((item) => item._id === assignedId) : null;
  return assigned || locations.find((item) => item.isPayrollAddress === true) || null;
}

/**
 * Freezes the place of work onto the payslip. Branch PF/ESI establishment codes
 * legitimately differ per site, so the location's codes win when present and the
 * company-level codes are the fallback.
 */
function workLocationSnapshotFor(company, employee, identity = {}) {
  const location = resolveWorkLocation(company, employee);
  if (!location) return null;
  const address = [location.addressLine, location.city, location.state, location.pincode]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
  return {
    _id: location._id,
    name: String(location.name || ''),
    code: String(location.code || ''),
    address,
    addressLine: String(location.addressLine || ''),
    city: String(location.city || ''),
    state: String(location.state || ''),
    pincode: String(location.pincode || ''),
    timezone: String(location.timezone || ''),
    isPayrollAddress: location.isPayrollAddress === true,
    // false means the employee had no location and we used the payroll address.
    assigned: Boolean(employee?.workLocationId && location._id === employee.workLocationId),
    pfEstablishmentCode: String(location.pfEstablishmentCode || identity.pfEstablishmentCode || ''),
    esiEmployerCode: String(location.esiEmployerCode || identity.esiEmployerCode || ''),
  };
}

function payrollIdentitySnapshots(company, employee, salary, settings) {
  const identity = settings.identity || {};
  return {
    workLocationSnapshot: workLocationSnapshotFor(company, employee, identity),
    employeeSnapshot: {
      _id: employee._id,
      employeeId: employee.employeeId,
      name: employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
      firstName: employee.firstName || '',
      lastName: employee.lastName || '',
      email: employee.email || '',
      role: employee.role || 'employee',
      department: employee.department || '',
      designation: employee.designation || '',
      employmentType: employee.employmentType || '',
      workLocationId: employee.workLocationId || null,
      dateOfJoining: employee.dateOfJoining || null,
      lastWorkingDate: employee.lastWorkingDate || null,
      pan: salary.pan || '',
      uan: salary.uan || '',
      esiNumber: salary.esiNumber || '',
      bankName: salary.bankName || '',
      bankAccountLast4: String(salary.bankAccountLast4 || '').replace(/\D/g, '').slice(-4),
      bankIfsc: salary.bankIfsc || '',
      paymentMode: salary.paymentMode || 'bank_transfer',
    },
    companySnapshot: {
      _id: company._id,
      code: company.code,
      name: identity.legalName || company.name || '',
      legalName: identity.legalName || company.name || '',
      address: identity.registeredAddress || '',
      registeredAddress: identity.registeredAddress || '',
      state: identity.state || '',
      pan: identity.pan || '',
      tan: identity.tan || '',
      gstin: identity.gstin || '',
      pfEstablishmentCode: identity.pfEstablishmentCode || '',
      esiEmployerCode: identity.esiEmployerCode || '',
    },
  };
}

function defaultPayrollSettings(company = {}) {
  return {
    currency: 'INR',
    payFrequency: 'monthly',
    workingDayMethod: 'calendar_days',
    workingDays: [1, 2, 3, 4, 5],
    attendanceProration: false,
    approvalMode: 'admin_approval',
    publishOnApproval: true,
    paymentDay: 7,
    salaryRounding: 'nearest_rupee',
    identity: {
      legalName: company.name || '',
      registeredAddress: '',
      state: '',
      pan: '',
      tan: '',
      gstin: '',
      pfEstablishmentCode: '',
      esiEmployerCode: '',
      payslipFooter: 'This is a system-generated payslip.',
    },
    autoGeneration: {
      enabled: false,
      dayOfMonth: 25,
      period: 'current',
      submitForApproval: false,
    },
    salaryTemplate: {
      basic: { calculation: 'percentage_of_gross', value: 50, active: true },
      hra: { calculation: 'percentage_of_basic', value: 40, active: true },
      balanceComponentEnabled: false,
      balanceComponentName: 'Special allowance',
    },
    statutory: {
      pfEnabled: false,
      employeePfRate: 12,
      employerPfRate: 12,
      epsRate: 8.33,
      edliRate: 0.5,
      pfWageBasis: 'eligible_earnings',
      pfCeilingTrigger: 15000,
      pfWageCeiling: 15000,
      restrictPfToCeiling: true,
      esiEnabled: false,
      employeeEsiRate: 0.75,
      employerEsiRate: 3.25,
      esiWageBasis: 'eligible_earnings',
      esiGrossCeiling: 21000,
      professionalTaxEnabled: false,
      professionalTaxMonthly: 0,
      labourWelfareFundEnabled: false,
      employeeLabourWelfareFund: 0,
      employerLabourWelfareFund: 0,
      gratuityEnabled: false,
      gratuityRate: 4.81,
      tdsEnabled: false,
      tdsMethod: 'employee_monthly_override',
    },
    earnings: [
      // Default options that users can activate/remove/customize
      {
        code: 'conveyance',
        name: 'Conveyance Allowance',
        calculation: 'fixed',
        defaultValue: 0,
        taxable: true,
        partOfPfWage: false,
        partOfEsiWage: true,
        prorate: true,
        active: false, // Available but not active by default - user can activate
        removable: true // User can delete from list
      },
      {
        code: 'medical_allowance',
        name: 'Medical Allowance',
        calculation: 'fixed',
        defaultValue: 0,
        taxable: true,
        partOfPfWage: false,
        partOfEsiWage: true,
        prorate: true,
        active: false,
        removable: true
      },
      {
        code: 'special_allowance',
        name: 'Special Allowance',
        calculation: 'fixed',
        defaultValue: 0,
        taxable: true,
        partOfPfWage: false,
        partOfEsiWage: true,
        prorate: true,
        active: false,
        removable: true
      }
    ],
    deductions: [
      // Default options that users can activate/remove/customize
      {
        code: 'professional_tax',
        name: 'Professional Tax',
        calculation: 'fixed',
        defaultValue: 0,
        prorate: false,
        active: false,
        removable: true
      },
      {
        code: 'loan_recovery',
        name: 'Loan Recovery',
        calculation: 'fixed',
        defaultValue: 0,
        prorate: true,
        active: false,
        removable: true
      }
    ],
    updatedAt: null,
    updatedBy: null,
  };
}

function normalizeDefinition(item, kind) {
  const name = String(item?.name || item?.label || (kind === 'earning' ? 'Custom earning' : 'Custom deduction')).trim();
  const treatment = normalizeTreatment(item, kind);
  return {
    code: componentCode(item?.code || name, kind),
    name,
    calculation: normalizeCalculation(item?.calculation),
    treatment,
    defaultValue: Math.max(0, amount(item?.defaultValue ?? item?.value)),
    taxable: kind === 'earning' ? item?.taxable !== false : false,
    partOfPfWage: kind === 'earning' && treatment !== 'after_gross' && Boolean(item?.partOfPfWage),
    partOfEsiWage: kind === 'earning' && treatment !== 'after_gross' ? item?.partOfEsiWage !== false : false,
    prorate: item?.prorate !== false,
    active: item?.active !== false,
    removable: item?.removable !== false,
  };
}

function normalizeDefinitions(defaultItems, inputItems, kind) {
  const supplied = Array.isArray(inputItems) ? inputItems.map((item) => normalizeDefinition(item, kind)) : [];
  if (Array.isArray(inputItems)) return supplied;
  return [];
}

function normalizePayrollSettings(company, input = company?.payrollSettings || {}) {
  const defaults = defaultPayrollSettings(company);
  const statutoryInput = input.statutory || {};
  const autoInput = input.autoGeneration || {};
  const identityInput = input.identity || {};
  const salaryTemplateInput = input.salaryTemplate || {};
  const workingDays = Array.isArray(input.workingDays)
    ? [...new Set(input.workingDays.map(Number).filter((day) => day >= 0 && day <= 6))]
    : defaults.workingDays;

  return {
    ...defaults,
    ...input,
    currency: String(input.currency || defaults.currency).toUpperCase(),
    payFrequency: 'monthly',
    workingDayMethod: ['calendar_days', 'working_days', 'fixed_30'].includes(input.workingDayMethod) ? input.workingDayMethod : defaults.workingDayMethod,
    workingDays: workingDays.length ? workingDays : defaults.workingDays,
    attendanceProration: Boolean(input.attendanceProration),
    approvalMode: input.approvalMode === 'hr_then_admin' ? 'hr_then_admin' : 'admin_approval',
    publishOnApproval: input.publishOnApproval !== false,
    paymentDay: clamp(Number(input.paymentDay || defaults.paymentDay), 1, 28),
    identity: {
      ...defaults.identity,
      ...identityInput,
      legalName: String(identityInput.legalName || company?.name || '').trim(),
      registeredAddress: String(identityInput.registeredAddress || '').trim(),
      state: String(identityInput.state || '').trim(),
      pan: String(identityInput.pan || '').trim().toUpperCase(),
      tan: String(identityInput.tan || '').trim().toUpperCase(),
      gstin: String(identityInput.gstin || '').trim().toUpperCase(),
      pfEstablishmentCode: String(identityInput.pfEstablishmentCode || '').trim().toUpperCase(),
      esiEmployerCode: String(identityInput.esiEmployerCode || '').trim().toUpperCase(),
      payslipFooter: String(identityInput.payslipFooter || defaults.identity.payslipFooter).trim(),
    },
    autoGeneration: {
      ...defaults.autoGeneration,
      ...autoInput,
      enabled: Boolean(autoInput.enabled),
      dayOfMonth: clamp(Number(autoInput.dayOfMonth || defaults.autoGeneration.dayOfMonth), 1, 28),
      period: autoInput.period === 'previous' ? 'previous' : 'current',
      submitForApproval: Boolean(autoInput.submitForApproval),
    },
    salaryTemplate: {
      basic: normalizeCoreRule(salaryTemplateInput.basic, defaults.salaryTemplate.basic, 'basic'),
      hra: normalizeCoreRule(salaryTemplateInput.hra, defaults.salaryTemplate.hra, 'hra'),
      balanceComponentEnabled: Boolean(salaryTemplateInput.balanceComponentEnabled),
      balanceComponentName: String(salaryTemplateInput.balanceComponentName || defaults.salaryTemplate.balanceComponentName).trim() || defaults.salaryTemplate.balanceComponentName,
    },
    statutory: {
      ...defaults.statutory,
      ...statutoryInput,
      pfEnabled: Boolean(statutoryInput.pfEnabled),
      employeePfRate: amount(statutoryInput.employeePfRate ?? defaults.statutory.employeePfRate),
      employerPfRate: amount(statutoryInput.employerPfRate ?? defaults.statutory.employerPfRate),
      epsRate: amount(statutoryInput.epsRate ?? defaults.statutory.epsRate),
      edliRate: amount(statutoryInput.edliRate ?? defaults.statutory.edliRate),
      pfWageBasis: normalizeWageBasis(statutoryInput.pfWageBasis, defaults.statutory.pfWageBasis),
      pfCeilingTrigger: amount(statutoryInput.pfCeilingTrigger ?? statutoryInput.pfWageCeiling ?? defaults.statutory.pfCeilingTrigger),
      pfWageCeiling: amount(statutoryInput.pfWageCeiling ?? defaults.statutory.pfWageCeiling),
      restrictPfToCeiling: statutoryInput.restrictPfToCeiling !== false,
      esiEnabled: Boolean(statutoryInput.esiEnabled),
      employeeEsiRate: amount(statutoryInput.employeeEsiRate ?? defaults.statutory.employeeEsiRate),
      employerEsiRate: amount(statutoryInput.employerEsiRate ?? defaults.statutory.employerEsiRate),
      esiWageBasis: normalizeWageBasis(statutoryInput.esiWageBasis, defaults.statutory.esiWageBasis),
      esiGrossCeiling: amount(statutoryInput.esiGrossCeiling ?? defaults.statutory.esiGrossCeiling),
      professionalTaxEnabled: Boolean(statutoryInput.professionalTaxEnabled),
      professionalTaxMonthly: amount(statutoryInput.professionalTaxMonthly),
      labourWelfareFundEnabled: Boolean(statutoryInput.labourWelfareFundEnabled),
      employeeLabourWelfareFund: amount(statutoryInput.employeeLabourWelfareFund),
      employerLabourWelfareFund: amount(statutoryInput.employerLabourWelfareFund),
      gratuityEnabled: Boolean(statutoryInput.gratuityEnabled),
      gratuityRate: amount(statutoryInput.gratuityRate ?? defaults.statutory.gratuityRate),
      tdsEnabled: Boolean(statutoryInput.tdsEnabled),
      tdsMethod: 'employee_monthly_override',
    },
    earnings: normalizeDefinitions(defaults.earnings, input.earnings, 'earning'),
    deductions: normalizeDefinitions(defaults.deductions, input.deductions, 'deduction'),
  };
}

function normalizeSalaryComponent(item, definition, kind) {
  const source = { ...(definition || {}), ...(item || {}) };
  const name = String(source.name || source.label || (kind === 'earning' ? 'Custom earning' : 'Custom deduction')).trim();
  const treatment = normalizeTreatment(source, kind);
  return {
    code: componentCode(source.code || name, kind),
    name,
    calculation: normalizeCalculation(source.calculation),
    treatment,
    value: Math.max(0, amount(source.value ?? source.amount ?? source.defaultValue)),
    taxable: kind === 'earning' ? source.taxable !== false : false,
    partOfPfWage: kind === 'earning' && treatment !== 'after_gross' && Boolean(source.partOfPfWage),
    partOfEsiWage: kind === 'earning' && treatment !== 'after_gross' ? source.partOfEsiWage !== false : false,
    prorate: source.prorate !== false,
    active: source.active !== false,
  };
}

function salaryComponentMatchesDefinition(component, definition, kind) {
  const normalizedComponent = normalizeSalaryComponent(component, definition, kind);
  const normalizedDefinition = normalizeSalaryComponent(null, definition, kind);
  return [
    'code',
    'name',
    'calculation',
    'treatment',
    'value',
    'taxable',
    'partOfPfWage',
    'partOfEsiWage',
    'prorate',
    'active',
  ].every((key) => normalizedComponent[key] === normalizedDefinition[key]);
}

function normalizeComponentOverrides(input, definitions, kind, overrideKey, legacyKey) {
  const definitionsByCode = new Map(definitions.map((item) => [item.code, item]));
  const hasExplicitOverrides = Array.isArray(input[overrideKey]);
  const supplied = hasExplicitOverrides
    ? input[overrideKey]
    : Array.isArray(input[legacyKey]) ? input[legacyKey] : [];

  return supplied
    .map((item) => {
      const code = componentCode(item?.code || item?.name, kind);
      const definition = definitionsByCode.get(code) || null;
      return {
        definition,
        component: normalizeSalaryComponent(item, definition, kind),
      };
    })
    .filter(({ definition, component }) => (
      !definition || !salaryComponentMatchesDefinition(component, definition, kind)
    ))
    .map(({ component }) => component);
}

function resolveSalaryComponents(definitions, overrides, kind) {
  const activeDefinitions = definitions.filter((item) => item.active);
  const definitionsByCode = new Map(definitions.map((item) => [item.code, item]));
  const overridesByCode = new Map(overrides.map((item) => [item.code, item]));
  const resolved = activeDefinitions.map((definition) => (
    normalizeSalaryComponent(overridesByCode.get(definition.code), definition, kind)
  ));

  for (const override of overrides) {
    if (activeDefinitions.some((definition) => definition.code === override.code)) continue;
    if (override.active === false) continue;
    resolved.push(normalizeSalaryComponent(override, definitionsByCode.get(override.code), kind));
  }
  return resolved;
}

function normalizeStatutoryOverrides(input, settings) {
  const defaults = {
    pfApplicable: Boolean(settings.statutory.pfEnabled),
    esiApplicable: Boolean(settings.statutory.esiEnabled),
    professionalTaxApplicable: Boolean(settings.statutory.professionalTaxEnabled),
    labourWelfareFundApplicable: Boolean(settings.statutory.labourWelfareFundEnabled),
    gratuityApplicable: Boolean(settings.statutory.gratuityEnabled),
    professionalTaxMonthly: amount(settings.statutory.professionalTaxMonthly),
    labourWelfareFundMonthly: amount(settings.statutory.employeeLabourWelfareFund),
  };
  const supplied = input.statutoryOverrides && typeof input.statutoryOverrides === 'object'
    ? input.statutoryOverrides
    : null;
  const overrides = {};

  for (const key of ['pfApplicable', 'esiApplicable', 'professionalTaxApplicable', 'labourWelfareFundApplicable', 'gratuityApplicable']) {
    if (supplied && Object.prototype.hasOwnProperty.call(supplied, key)) {
      if (Boolean(supplied[key]) !== defaults[key]) overrides[key] = Boolean(supplied[key]);
    } else if (!supplied && Object.prototype.hasOwnProperty.call(input, key) && Boolean(input[key]) !== defaults[key]) {
      overrides[key] = Boolean(input[key]);
    }
  }
  for (const key of ['professionalTaxMonthly', 'labourWelfareFundMonthly']) {
    if (supplied && Object.prototype.hasOwnProperty.call(supplied, key)) {
      const normalized = Math.max(0, amount(supplied[key]));
      if (normalized !== defaults[key]) overrides[key] = normalized;
    } else if (!supplied && amount(input[key]) > 0 && amount(input[key]) !== defaults[key]) {
      overrides[key] = Math.max(0, amount(input[key]));
    }
  }

  return { defaults, overrides };
}

const STATUTORY_POLICY_FIELDS = [
  'employeePfRate',
  'employerPfRate',
  'epsRate',
  'edliRate',
  'pfWageBasis',
  'pfCeilingTrigger',
  'pfWageCeiling',
  'restrictPfToCeiling',
  'employeeEsiRate',
  'employerEsiRate',
  'esiWageBasis',
  'esiGrossCeiling',
  'gratuityRate',
];

function normalizeStatutoryPolicyValue(key, value, fallback) {
  if (key === 'pfWageBasis' || key === 'esiWageBasis') return normalizeWageBasis(value, fallback);
  if (key === 'restrictPfToCeiling') return Boolean(value);
  return Math.max(0, amount(value));
}

function normalizeStatutoryPolicyOverrides(input, settings) {
  const supplied = input.statutoryPolicyOverrides && typeof input.statutoryPolicyOverrides === 'object'
    ? input.statutoryPolicyOverrides
    : {};
  const overrides = {};

  for (const key of STATUTORY_POLICY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(supplied, key)) continue;
    const normalized = normalizeStatutoryPolicyValue(key, supplied[key], settings.statutory[key]);
    if (normalized !== settings.statutory[key]) overrides[key] = normalized;
  }

  return {
    overrides,
    policy: { ...settings.statutory, ...overrides },
  };
}

function statutoryWageBase(basis, values) {
  if (basis === 'basic') return amount(values.basic);
  if (basis === 'gross') return amount(values.gross);
  return amount(values.eligibleEarnings);
}

function cappedPfBase(wage, monthlyGross, statutory) {
  if (!statutory.restrictPfToCeiling) return amount(wage);
  const trigger = amount(statutory.pfCeilingTrigger || statutory.pfWageCeiling);
  return monthlyGross > trigger ? Math.min(amount(wage), amount(statutory.pfWageCeiling)) : amount(wage);
}

function normalizeCoreRule(rule, fallback, kind) {
  let calculation = normalizeCalculation(rule?.calculation, fallback.calculation);
  if (kind === 'basic' && calculation === 'percentage_of_basic') calculation = 'percentage_of_gross';
  return {
    calculation,
    value: Math.max(0, amount(rule?.value ?? fallback.value)),
    active: rule?.active === undefined ? fallback.active !== false : rule.active !== false,
  };
}

function normalizeCoreRuleOverrides(input, templateRules) {
  const supplied = input.coreRuleOverrides && typeof input.coreRuleOverrides === 'object'
    ? input.coreRuleOverrides
    : {};
  const overrides = {};

  for (const kind of ['basic', 'hra']) {
    if (!Object.prototype.hasOwnProperty.call(supplied, kind)) continue;
    const rule = normalizeCoreRule(supplied[kind], templateRules[kind], kind);
    const companyRule = templateRules[kind];
    if (rule.calculation !== companyRule.calculation || rule.value !== companyRule.value || rule.active !== companyRule.active) {
      overrides[kind] = rule;
    }
  }
  return overrides;
}

function salaryStructurePreview(settings, salary) {
  const earnings = [
    payrollLine('basic', 'Basic salary', salary.basic, { partOfPfWage: true, partOfEsiWage: true }),
    payrollLine('hra', 'House rent allowance', salary.hra, { partOfPfWage: false, partOfEsiWage: true }),
    payrollLine('special_allowance', salary.balanceComponentName || 'Special allowance', salary.specialAllowance, { partOfPfWage: false, partOfEsiWage: true }),
    ...salary.earnings.filter((item) => item.active).map((item) => payrollLine(item.code, item.name, formulaValue(item.calculation, item.value, salary.basic, salary.monthlyGross), { partOfPfWage: item.partOfPfWage, partOfEsiWage: item.partOfEsiWage, reimbursement: isAfterGross(item), treatment: item.treatment })),
  ].filter((item) => item.amount !== 0);
  const recurringDeductions = salary.deductions.filter((item) => item.active).map((item) => payrollLine(item.code, item.name, formulaValue(item.calculation, item.value, salary.basic, salary.monthlyGross))).filter((item) => item.amount !== 0);
  const totalEarnings = amount(earnings.reduce((sum, item) => sum + item.amount, 0));
  const paidAfterGross = amount(earnings.filter((item) => item.reimbursement).reduce((sum, item) => sum + item.amount, 0));
  const salaryGross = amount(totalEarnings - paidAfterGross);
  const selectedPfWage = amount(earnings.filter((item) => item.partOfPfWage).reduce((sum, item) => sum + item.amount, 0));
  const selectedEsiWage = amount(earnings.filter((item) => item.partOfEsiWage && !item.reimbursement).reduce((sum, item) => sum + item.amount, 0));
  const statutory = salary.statutoryPolicy || settings.statutory;
  const pfWage = statutoryWageBase(statutory.pfWageBasis, {
    basic: salary.basic,
    gross: salaryGross,
    eligibleEarnings: selectedPfWage,
  });
  const esiWage = statutoryWageBase(statutory.esiWageBasis, {
    basic: salary.basic,
    gross: salaryGross,
    eligibleEarnings: selectedEsiWage,
  });
  const pfEligible = statutory.pfEnabled && salary.pfApplicable;
  const pfBase = pfEligible ? cappedPfBase(pfWage, salary.monthlyGross, statutory) : 0;
  const employeePf = pfEligible ? amount(pfBase * statutory.employeePfRate / 100) : 0;
  const employerPfTotal = pfEligible ? amount(pfBase * statutory.employerPfRate / 100) : 0;
  const eps = pfEligible ? Math.min(employerPfTotal, amount(pfBase * statutory.epsRate / 100)) : 0;
  const employerEpf = amount(employerPfTotal - eps);
  const edli = pfEligible ? amount(pfBase * statutory.edliRate / 100) : 0;
  const esiEligible = statutory.esiEnabled && salary.esiApplicable && salary.monthlyGross <= statutory.esiGrossCeiling;
  const employeeEsi = esiEligible ? amount(esiWage * statutory.employeeEsiRate / 100) : 0;
  const employerEsi = esiEligible ? amount(esiWage * statutory.employerEsiRate / 100) : 0;
  const gratuityEligible = statutory.gratuityEnabled && salary.gratuityApplicable;
  const gratuity = gratuityEligible ? amount(salary.basic * statutory.gratuityRate / 100) : 0;
  const employeeDeductions = [
    ...recurringDeductions,
    payrollLine('provident_fund', 'Employee provident fund', employeePf),
    payrollLine('employee_state_insurance', 'Employee state insurance', employeeEsi),
    payrollLine('professional_tax', 'Professional tax', statutory.professionalTaxEnabled && salary.professionalTaxApplicable ? salary.professionalTaxMonthly ?? statutory.professionalTaxMonthly : 0),
    payrollLine('labour_welfare_fund', 'Labour welfare fund', statutory.labourWelfareFundEnabled && salary.labourWelfareFundApplicable ? salary.labourWelfareFundMonthly ?? statutory.employeeLabourWelfareFund : 0),
    payrollLine('tds', 'Tax deducted at source', statutory.tdsEnabled ? salary.monthlyTds : 0),
  ].filter((item) => item.amount !== 0);
  const employerContributions = [
    payrollLine('employer_epf', 'Employer EPF', employerEpf),
    payrollLine('employer_eps', 'Employer pension contribution', eps),
    payrollLine('edli', 'Deposit-linked insurance', edli),
    payrollLine('employer_esi', 'Employer state insurance', employerEsi),
    payrollLine('employer_lwf', 'Employer welfare fund', statutory.labourWelfareFundEnabled && salary.labourWelfareFundApplicable ? statutory.employerLabourWelfareFund : 0),
    payrollLine('gratuity', 'Gratuity provision', gratuity),
  ].filter((item) => item.amount !== 0);
  const totalDeductions = amount(employeeDeductions.reduce((sum, item) => sum + item.amount, 0));
  const employerContributionTotal = amount(employerContributions.reduce((sum, item) => sum + item.amount, 0));
  const professionalTax = statutory.professionalTaxEnabled && salary.professionalTaxApplicable ? salary.professionalTaxMonthly ?? statutory.professionalTaxMonthly : 0;
  const employeeLwf = statutory.labourWelfareFundEnabled && salary.labourWelfareFundApplicable ? salary.labourWelfareFundMonthly ?? statutory.employeeLabourWelfareFund : 0;
  const employerLwf = statutory.labourWelfareFundEnabled && salary.labourWelfareFundApplicable ? statutory.employerLabourWelfareFund : 0;
  const tds = statutory.tdsEnabled ? salary.monthlyTds : 0;
  const statutoryDetails = [
    statutoryDetail('provident_fund', 'EPF / EPS / EDLI', statutory.pfEnabled, pfEligible, employeePf, amount(employerPfTotal + edli)),
    statutoryDetail('employee_state_insurance', 'Employee state insurance', statutory.esiEnabled, esiEligible, employeeEsi, employerEsi, statutory.esiEnabled && salary.esiApplicable && salary.monthlyGross > statutory.esiGrossCeiling ? 'Gross salary is above the ESI wage ceiling' : ''),
    statutoryDetail('professional_tax', 'Professional tax', statutory.professionalTaxEnabled, salary.professionalTaxApplicable && professionalTax > 0, professionalTax),
    statutoryDetail('labour_welfare_fund', 'Labour welfare fund', statutory.labourWelfareFundEnabled, salary.labourWelfareFundApplicable && (employeeLwf > 0 || employerLwf > 0), employeeLwf, employerLwf),
    statutoryDetail('tds', 'Tax deducted at source', statutory.tdsEnabled, tds > 0, tds),
    statutoryDetail('gratuity', 'Gratuity provision', statutory.gratuityEnabled, gratuityEligible, 0, gratuity),
  ];
  return {
    earnings,
    employeeDeductions,
    employerContributions,
    gross: salaryGross,
    salaryGross,
    paidAfterGross,
    reimbursementTotal: paidAfterGross,
    totalEarnings,
    totalDeductions,
    net: amount(Math.max(0, totalEarnings - totalDeductions)),
    employerContributionTotal,
    companyCost: amount(totalEarnings + employerContributionTotal),
    statutoryDetails,
  };
}

function normalizeSalaryStructure(employee, settings, input = employee?.salary || {}) {
  const hasStoredSalary = Boolean(employee?.salary);
  const hasManualAmounts = input.basic !== undefined || input.hra !== undefined || input.specialAllowance !== undefined || input.allowances !== undefined;
  const salaryMode = input.salaryMode === 'company_template'
    ? 'company_template'
    : input.salaryMode === 'custom_formula' || hasStoredSalary || hasManualAmounts ? 'custom_formula' : 'company_template';
  const legacyBasic = amount(input.basic);
  const legacyHra = amount(input.hra);
  // Only use special allowance if explicitly provided - NOT calculated automatically
  const legacySpecialAllowance = input.specialAllowance !== undefined || input.allowances !== undefined 
    ? amount(input.specialAllowance ?? input.allowances) 
    : 0;
  const earningOverrides = normalizeComponentOverrides(input, settings.earnings, 'earning', 'earningOverrides', 'earnings');
  const deductionOverrides = normalizeComponentOverrides(input, settings.deductions, 'deduction', 'deductionOverrides', 'deductions');
  const earnings = resolveSalaryComponents(settings.earnings, earningOverrides, 'earning');
  const deductions = resolveSalaryComponents(settings.deductions, deductionOverrides, 'deduction');
  const { defaults: statutoryDefaults, overrides: statutoryOverrides } = normalizeStatutoryOverrides(input, settings);
  const {
    overrides: statutoryPolicyOverrides,
    policy: statutoryPolicy,
  } = normalizeStatutoryPolicyOverrides(input, settings);

  const suppliedTarget = amount(input.monthlyGrossTarget ?? input.monthlySalary ?? input.monthlyGross);
  const legacyCustomGross = earnings.filter((item) => item.active).reduce((sum, item) => (
    sum + formulaValue(item.calculation, item.value, legacyBasic, suppliedTarget)
  ), 0);
  const inferredLegacyTarget = hasStoredSalary || hasManualAmounts ? amount(legacyBasic + legacyHra + legacySpecialAllowance + legacyCustomGross) : 0;
  const monthlyGrossTarget = suppliedTarget || inferredLegacyTarget;
  const templateRules = {
    basic: normalizeCoreRule(settings.salaryTemplate.basic, { calculation: 'percentage_of_gross', value: 50 }, 'basic'),
    hra: normalizeCoreRule(settings.salaryTemplate.hra, { calculation: 'percentage_of_basic', value: 40 }, 'hra'),
  };
  const coreRuleOverrides = normalizeCoreRuleOverrides(input, templateRules);
  const storedRules = input.coreRules || {};
  const coreRules = salaryMode === 'company_template'
    ? {
        basic: coreRuleOverrides.basic || templateRules.basic,
        hra: coreRuleOverrides.hra || templateRules.hra,
      }
    : {
        basic: normalizeCoreRule(storedRules.basic, { calculation: 'fixed', value: legacyBasic }, 'basic'),
        hra: normalizeCoreRule(storedRules.hra, { calculation: 'fixed', value: legacyHra }, 'hra'),
      };
  const basic = monthlyGrossTarget > 0 && coreRules.basic.active ? formulaValue(coreRules.basic.calculation, coreRules.basic.value, 0, monthlyGrossTarget) : 0;
  const hra = monthlyGrossTarget > 0 && coreRules.hra.active ? formulaValue(coreRules.hra.calculation, coreRules.hra.value, basic, monthlyGrossTarget) : 0;
  // Salary gross excludes components explicitly paid after gross.
  const customGross = monthlyGrossTarget > 0 ? earnings.filter((item) => item.active && !isAfterGross(item)).reduce((sum, item) => (
    sum + formulaValue(item.calculation, item.value, basic, monthlyGrossTarget)
  ), 0) : 0;
  const committedGross = amount(basic + hra + customGross);

  // Paid-after-gross additions keep their own fixed/percentage formula.
  const extraEarnings = earnings.filter((item) => item.active && isAfterGross(item)).reduce((sum, item) => (
    sum + formulaValue(item.calculation, item.value, basic, monthlyGrossTarget)
  ), 0);
  
  const balanceComponentEnabled = salaryMode === 'company_template'
    ? Boolean(settings.salaryTemplate.balanceComponentEnabled)
    : input.balanceComponentEnabled === undefined ? Boolean(settings.salaryTemplate.balanceComponentEnabled) : Boolean(input.balanceComponentEnabled);

  // Special allowance is only auto-filled when the company or employee formula explicitly enables the balancing component.
  const specialAllowance = legacySpecialAllowance || (balanceComponentEnabled && monthlyGrossTarget > 0 ? Math.max(0, amount(monthlyGrossTarget - committedGross)) : 0);
  
  // Monthly gross = Basic + HRA + earnings (excluding 'extra') + Special Allowance
  // CTC/Total = Monthly gross + extra earnings
  const monthlyGross = amount(committedGross + specialAllowance);
  const monthlyCTC = amount(monthlyGross + extraEarnings);
  const compositionDifference = amount(monthlyGross - monthlyGrossTarget);
  const normalized = {
    payrollEnabled: input.payrollEnabled === undefined ? Boolean(employee?.salary) : input.payrollEnabled !== false,
    effectiveFrom: input.effectiveFrom || employee?.dateOfJoining || new Date().toISOString().slice(0, 10),
    salaryMode,
    monthlyGrossTarget,
    coreRules,
    coreRuleOverrides: salaryMode === 'company_template' ? coreRuleOverrides : {},
    balanceComponentEnabled,
    balanceComponentName: String(settings.salaryTemplate.balanceComponentName || 'Special allowance'),
    basic,
    hra,
    specialAllowance,
    earnings,
    deductions,
    earningOverrides,
    deductionOverrides,
    statutoryOverrides,
    statutoryPolicyOverrides,
    statutoryPolicy,
    inheritanceVersion: 1,
    pfApplicable: statutoryOverrides.pfApplicable ?? statutoryDefaults.pfApplicable,
    esiApplicable: statutoryOverrides.esiApplicable ?? statutoryDefaults.esiApplicable,
    professionalTaxApplicable: statutoryOverrides.professionalTaxApplicable ?? statutoryDefaults.professionalTaxApplicable,
    labourWelfareFundApplicable: statutoryOverrides.labourWelfareFundApplicable ?? statutoryDefaults.labourWelfareFundApplicable,
    gratuityApplicable: statutoryOverrides.gratuityApplicable ?? statutoryDefaults.gratuityApplicable,
    professionalTaxMonthly: statutoryOverrides.professionalTaxMonthly ?? statutoryDefaults.professionalTaxMonthly,
    labourWelfareFundMonthly: statutoryOverrides.labourWelfareFundMonthly ?? statutoryDefaults.labourWelfareFundMonthly,
    monthlyTds: amount(input.monthlyTds),
    uan: String(input.uan || ''),
    esiNumber: String(input.esiNumber || ''),
    pan: String(input.pan || ''),
    bankName: String(input.bankName || ''),
    bankAccountLast4: String(input.bankAccountLast4 || '').replace(/\D/g, '').slice(-4),
    bankIfsc: String(input.bankIfsc || '').toUpperCase(),
    paymentMode: input.paymentMode || 'bank_transfer',
    monthlyGross,
    monthlyCTC, // Total including extra earnings
    annualCtc: amount(input.annualCtc || monthlyCTC * 12),
    compositionDifference,
    calculationWarning: compositionDifference > 0 ? `Configured components exceed monthly gross by ${compositionDifference}` : null,
    notes: String(input.notes || ''),
    updatedAt: input.updatedAt || null,
    updatedBy: input.updatedBy || null,
  };
  normalized.preview = salaryStructurePreview(settings, normalized);
  return normalized;
}

function periodRange(period) {
  if (!PERIOD_PATTERN.test(String(period || ''))) throw new Error('Payroll period must use YYYY-MM format');
  const [year, month] = period.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end, daysInMonth: end.getUTCDate() };
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function datesBetween(start, end) {
  const result = [];
  for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) result.push(new Date(date));
  return result;
}

function overlapDates(startDate, endDate, periodStart, periodEnd) {
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${String(endDate || startDate).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  return datesBetween(start > periodStart ? start : periodStart, end < periodEnd ? end : periodEnd);
}

// The duplicate attendanceSummary() that lived here was dead code: nothing
// called it, and it carried its own copy of the scheduled-day rule, so it would
// have drifted from attendancePolicy.js. buildAttendanceSummary is the only one.

function calculateComponentValue(component, basic, gross) {
  return formulaValue(component.calculation, component.value, basic, gross);
}

function payrollLine(code, name, value, metadata = {}) {
  return { code, name, amount: amount(value), ...metadata };
}

function statutoryDetail(code, name, enabled, applicable, employeeAmount = 0, employerAmount = 0, reason = '') {
  return {
    code,
    name,
    enabled: Boolean(enabled),
    applicable: Boolean(enabled && applicable),
    status: !enabled ? 'not_enabled' : applicable ? 'applied' : 'not_applicable',
    reason,
    employeeAmount: amount(employeeAmount),
    employerAmount: amount(employerAmount),
  };
}

function calculatePayroll(data, company, employee, period, settingsInput, salaryInput, adjustments = []) {
  const settings = normalizePayrollSettings(company, settingsInput);
  const salary = normalizeSalaryStructure(employee, settings, salaryInput);
  const attendance = buildAttendanceSummary(data, company, employee, period, settings);
  const ratio = attendance.scheduledDays ? clamp(attendance.payableDays / attendance.scheduledDays, 0, 1) : 1;
  const prorate = (value, enabled = true) => amount(value * (enabled ? ratio : 1));

  const earnings = [
    payrollLine('basic', 'Basic salary', prorate(salary.basic), { source: 'salary', taxable: true, partOfPfWage: true, partOfEsiWage: true }),
    payrollLine('hra', 'House rent allowance', prorate(salary.hra), { source: 'salary', taxable: true, partOfPfWage: false, partOfEsiWage: true }),
    payrollLine('special_allowance', salary.balanceComponentName || 'Special allowance', prorate(salary.specialAllowance), { source: 'salary', taxable: true, partOfPfWage: false, partOfEsiWage: true }),
    ...salary.earnings.filter((item) => item.active).map((item) => payrollLine(item.code, item.name, prorate(calculateComponentValue(item, salary.basic, salary.monthlyGross), item.prorate), { source: 'salary', taxable: item.taxable, partOfPfWage: item.partOfPfWage, partOfEsiWage: item.partOfEsiWage, reimbursement: isAfterGross(item), treatment: item.treatment })),
  ].filter((item) => item.amount !== 0);

  const recurringDeductions = salary.deductions.filter((item) => item.active).map((item) => payrollLine(item.code, item.name, prorate(calculateComponentValue(item, salary.basic, salary.monthlyGross), item.prorate), { source: 'salary' })).filter((item) => item.amount !== 0);
  const fullMonthlyGross = amount(salary.basic + salary.hra + salary.specialAllowance + salary.earnings.filter((item) => item.active && !isAfterGross(item)).reduce((sum, item) => sum + calculateComponentValue(item, salary.basic, salary.monthlyGross), 0));
  const grossBeforeAdjustments = amount(earnings.reduce((sum, item) => sum + item.amount, 0));
  const regularGrossBeforeAdjustments = amount(earnings.filter((item) => !item.reimbursement).reduce((sum, item) => sum + item.amount, 0));
  const basicPay = earnings.find((item) => item.code === 'basic')?.amount || 0;
  const selectedPfWage = amount(earnings.filter((item) => item.partOfPfWage).reduce((sum, item) => sum + item.amount, 0));
  const selectedEsiWage = amount(earnings.filter((item) => item.partOfEsiWage && !item.reimbursement).reduce((sum, item) => sum + item.amount, 0));
  const statutory = salary.statutoryPolicy || settings.statutory;
  const pfWage = statutoryWageBase(statutory.pfWageBasis, {
    basic: basicPay,
    gross: regularGrossBeforeAdjustments,
    eligibleEarnings: selectedPfWage,
  });
  const esiWage = statutoryWageBase(statutory.esiWageBasis, {
    basic: basicPay,
    gross: regularGrossBeforeAdjustments,
    eligibleEarnings: selectedEsiWage,
  });
  const pfEligible = statutory.pfEnabled && salary.pfApplicable;
  const pfBase = pfEligible ? cappedPfBase(pfWage, fullMonthlyGross, statutory) : 0;
  const employeePf = pfEligible ? amount(pfBase * statutory.employeePfRate / 100) : 0;
  const employerPfTotal = pfEligible ? amount(pfBase * statutory.employerPfRate / 100) : 0;
  const eps = pfEligible ? Math.min(employerPfTotal, amount(pfBase * statutory.epsRate / 100)) : 0;
  const employerEpf = amount(employerPfTotal - eps);
  const edli = pfEligible ? amount(pfBase * statutory.edliRate / 100) : 0;
  const esiEligible = statutory.esiEnabled && salary.esiApplicable && fullMonthlyGross <= statutory.esiGrossCeiling;
  const employeeEsi = esiEligible ? amount(esiWage * statutory.employeeEsiRate / 100) : 0;
  const employerEsi = esiEligible ? amount(esiWage * statutory.employerEsiRate / 100) : 0;
  const professionalTax = statutory.professionalTaxEnabled && salary.professionalTaxApplicable ? amount(salary.professionalTaxMonthly ?? statutory.professionalTaxMonthly) : 0;
  const employeeLwf = statutory.labourWelfareFundEnabled && salary.labourWelfareFundApplicable ? amount(salary.labourWelfareFundMonthly ?? statutory.employeeLabourWelfareFund) : 0;
  const employerLwf = statutory.labourWelfareFundEnabled && salary.labourWelfareFundApplicable ? amount(statutory.employerLabourWelfareFund) : 0;
  const gratuityEligible = statutory.gratuityEnabled && salary.gratuityApplicable;
  const gratuityBase = earnings.find((item) => item.code === 'basic')?.amount || 0;
  const gratuity = gratuityEligible ? amount(gratuityBase * statutory.gratuityRate / 100) : 0;
  const tds = statutory.tdsEnabled ? amount(salary.monthlyTds) : 0;
  const employeeDeductions = [
    ...recurringDeductions,
    payrollLine('provident_fund', 'Employee provident fund', employeePf, { source: 'statutory' }),
    payrollLine('employee_state_insurance', 'Employee state insurance', employeeEsi, { source: 'statutory' }),
    payrollLine('professional_tax', 'Professional tax', professionalTax, { source: 'statutory' }),
    payrollLine('labour_welfare_fund', 'Labour welfare fund', employeeLwf, { source: 'statutory' }),
    payrollLine('tds', 'Tax deducted at source', tds, { source: 'statutory' }),
  ].filter((item) => item.amount !== 0);
  const employerContributions = [
    payrollLine('employer_epf', 'Employer EPF', employerEpf, { source: 'statutory' }),
    payrollLine('employer_eps', 'Employer pension contribution', eps, { source: 'statutory' }),
    payrollLine('edli', 'Deposit-linked insurance', edli, { source: 'statutory' }),
    payrollLine('employer_esi', 'Employer state insurance', employerEsi, { source: 'statutory' }),
    payrollLine('employer_lwf', 'Employer welfare fund', employerLwf, { source: 'statutory' }),
    payrollLine('gratuity', 'Gratuity provision', gratuity, { source: 'statutory' }),
  ].filter((item) => item.amount !== 0);
  const statutoryDetails = [
    statutoryDetail('provident_fund', 'EPF / EPS / EDLI', statutory.pfEnabled, pfEligible, employeePf, amount(employerPfTotal + edli)),
    statutoryDetail('employee_state_insurance', 'Employee state insurance', statutory.esiEnabled, esiEligible, employeeEsi, employerEsi, statutory.esiEnabled && salary.esiApplicable && fullMonthlyGross > statutory.esiGrossCeiling ? 'Gross salary is above the ESI wage ceiling' : ''),
    statutoryDetail('professional_tax', 'Professional tax', statutory.professionalTaxEnabled, salary.professionalTaxApplicable && professionalTax > 0, professionalTax),
    statutoryDetail('labour_welfare_fund', 'Labour welfare fund', statutory.labourWelfareFundEnabled, salary.labourWelfareFundApplicable && (employeeLwf > 0 || employerLwf > 0), employeeLwf, employerLwf),
    statutoryDetail('tds', 'Tax deducted at source', statutory.tdsEnabled, tds > 0, tds),
    statutoryDetail('gratuity', 'Gratuity provision', statutory.gratuityEnabled, gratuityEligible, 0, gratuity),
  ];

  const normalizedAdjustments = adjustments.map((item) => ({
    _id: item._id || newId('payroll_adjustment'),
    kind: ['earning', 'deduction', 'reimbursement'].includes(item.kind) ? item.kind : 'earning',
    code: componentCode(item.code || item.name, 'adjustment'),
    name: String(item.name || 'Payroll adjustment'),
    amount: Math.abs(amount(item.amount)),
    notes: String(item.notes || ''),
    reimbursementClaimId: item.reimbursementClaimId || null,
    createdBy: item.createdBy || null,
    createdAt: item.createdAt || nowIso(),
  })).filter((item) => item.amount > 0);
  for (const item of normalizedAdjustments) {
    const line = payrollLine(item.code, item.name, item.amount, { source: 'adjustment', adjustmentId: item._id, notes: item.notes, reimbursementClaimId: item.reimbursementClaimId || null });
    if (item.kind === 'deduction') employeeDeductions.push(line);
    else earnings.push({ ...line, reimbursement: item.kind === 'reimbursement', taxable: item.kind !== 'reimbursement' });
  }

  const totalEarnings = amount(earnings.reduce((sum, item) => sum + item.amount, 0));
  const paidAfterGross = amount(earnings.filter((item) => item.reimbursement).reduce((sum, item) => sum + item.amount, 0));
  const salaryGross = amount(totalEarnings - paidAfterGross);
  const deductions = amount(employeeDeductions.reduce((sum, item) => sum + item.amount, 0));
  const employerContributionTotal = amount(employerContributions.reduce((sum, item) => sum + item.amount, 0));
  const net = amount(Math.max(0, totalEarnings - deductions));
  const basic = earnings.find((item) => item.code === 'basic')?.amount || 0;
  const hra = earnings.find((item) => item.code === 'hra')?.amount || 0;

  return {
    basic,
    hra,
    allowances: amount(salaryGross - basic - hra),
    deductions,
    gross: salaryGross,
    salaryGross,
    paidAfterGross,
    reimbursementTotal: paidAfterGross,
    totalEarnings,
    net,
    earnings,
    employeeDeductions,
    employerContributions,
    statutoryDetails,
    employerContributionTotal,
    ctcForPeriod: amount(totalEarnings + employerContributionTotal),
    attendanceSummary: attendance,
    adjustments: normalizedAdjustments,
    salarySnapshot: salary,
    settingsSnapshot: settings,
    calculation: {
      prorationRatio: amount(ratio),
      fullMonthlyGross,
      grossBeforeAdjustments,
      pfWage,
      esiWage,
      pfEligible,
      esiEligible,
    },
  };
}

function createRunNumber(company, period, sequence) {
  return `${company.code || 'PAY'}-${period.replace('-', '')}-${String(sequence).padStart(3, '0')}`;
}

function generatePayrollForCompany(data, options) {
  ensurePayrollCollections(data);
  const { company, period, actorId = null, source = 'manual', employeeId = null, replaceDrafts = false, submitForApproval = false } = options;
  periodRange(period);
  const settings = normalizePayrollSettings(company);
  const employees = data.employees.filter((employee) => employee.companyId === company._id && employee.status !== 'inactive' && employee.role !== 'super_admin' && (!employeeId || employee._id === employeeId));
  const run = {
    _id: newId('payroll_run'),
    companyId: company._id,
    runNumber: createRunNumber(company, period, data.payrollRuns.filter((item) => item.companyId === company._id && item.period === period).length + 1),
    period,
    source,
    status: submitForApproval ? 'pending_approval' : 'draft',
    employeeCount: 0,
    createdCount: 0,
    existingCount: 0,
    skippedCount: 0,
    skippedEmployees: [],
    totals: { gross: 0, salaryGross: 0, paidAfterGross: 0, totalEarnings: 0, deductions: 0, net: 0, employerContributions: 0, ctc: 0 },
    createdBy: actorId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const records = [];

  for (const employee of employees) {
    const selectedRevision = salaryRevisionForPeriod(data, employee, period);
    const salary = normalizeSalaryStructure(employee, settings, selectedRevision.salary);
    if (!salary.payrollEnabled) {
      run.skippedCount += 1;
      run.skippedEmployees.push({ employeeId: employee.employeeId, name: employee.name, reason: 'Salary structure not configured' });
      continue;
    }
    const existingIndex = data.payroll.findIndex((item) => item.employeeId === employee._id && item.period === period);
    const existing = existingIndex >= 0 ? data.payroll[existingIndex] : null;
    if (existing && !(replaceDrafts && ['draft', 'pending_approval'].includes(existing.status))) {
      run.existingCount += 1;
      records.push(existing);
      continue;
    }
    const payrollId = existing?._id || newId('payroll');
    const adjustments = payrollAdjustmentsForEmployee(
      data,
      employee._id,
      period,
      payrollId,
      existing?.adjustments || [],
      actorId,
    );
    const calculated = calculatePayroll(data, company, employee, period, settings, salary, adjustments);
    const identitySnapshots = payrollIdentitySnapshots(company, employee, calculated.salarySnapshot, settings);
    const item = {
      ...(existing || {}),
      _id: payrollId,
      companyId: company._id,
      employeeId: employee._id,
      runId: run._id,
      payrollNumber: `${company.code || 'PAY'}-${period.replace('-', '')}-${employee.employeeId}`,
      period,
      ...calculated,
      ...identitySnapshots,
      salaryRevisionId: selectedRevision.revision?._id || null,
      salaryRevisionEffectiveFrom: selectedRevision.revision?.effectiveFrom || calculated.salarySnapshot.effectiveFrom || null,
      status: submitForApproval ? 'pending_approval' : 'draft',
      paymentStatus: 'unpaid',
      generatedBy: actorId,
      generatedAt: nowIso(),
      createdAt: existing?.createdAt || nowIso(),
      updatedAt: nowIso(),
      approvedBy: null,
      approvedAt: null,
      publishedAt: null,
      paidAt: null,
      paymentReference: null,
    };
    if (existingIndex >= 0) data.payroll[existingIndex] = item;
    else data.payroll.push(item);
    run.createdCount += 1;
    records.push(item);
  }

  run.employeeCount = records.length;
  run.totals = records.reduce((totals, item) => ({
    gross: amount(totals.gross + (item.salaryGross ?? item.gross)),
    salaryGross: amount(totals.salaryGross + (item.salaryGross ?? item.gross)),
    paidAfterGross: amount(totals.paidAfterGross + (item.paidAfterGross ?? item.reimbursementTotal ?? 0)),
    totalEarnings: amount(totals.totalEarnings + (item.totalEarnings ?? item.gross)),
    deductions: amount(totals.deductions + item.deductions),
    net: amount(totals.net + item.net),
    employerContributions: amount(totals.employerContributions + (item.employerContributionTotal || 0)),
    ctc: amount(totals.ctc + (item.ctcForPeriod || item.totalEarnings || item.gross)),
  }), run.totals);
  data.payrollRuns.push(run);
  return { run, payroll: records };
}

function recalculateAdjustments(payslip) {
  const baseEarnings = (payslip.earnings || []).filter((item) => item.source !== 'adjustment');
  const baseDeductions = (payslip.employeeDeductions || []).filter((item) => item.source !== 'adjustment');
  const earnings = [...baseEarnings];
  const employeeDeductions = [...baseDeductions];
  for (const item of payslip.adjustments || []) {
    const line = payrollLine(item.code, item.name, item.amount, { source: 'adjustment', adjustmentId: item._id, notes: item.notes, reimbursementClaimId: item.reimbursementClaimId || null });
    if (item.kind === 'deduction') employeeDeductions.push(line);
    else earnings.push({ ...line, reimbursement: item.kind === 'reimbursement', taxable: item.kind !== 'reimbursement' });
  }
  payslip.earnings = earnings;
  payslip.employeeDeductions = employeeDeductions;
  payslip.totalEarnings = amount(earnings.reduce((sum, item) => sum + item.amount, 0));
  payslip.paidAfterGross = amount(earnings.filter((item) => item.reimbursement).reduce((sum, item) => sum + item.amount, 0));
  payslip.reimbursementTotal = payslip.paidAfterGross;
  payslip.salaryGross = amount(payslip.totalEarnings - payslip.paidAfterGross);
  payslip.gross = payslip.salaryGross;
  payslip.deductions = amount(employeeDeductions.reduce((sum, item) => sum + item.amount, 0));
  payslip.net = amount(Math.max(0, payslip.totalEarnings - payslip.deductions));
  payslip.allowances = amount(payslip.salaryGross - (payslip.basic || 0) - (payslip.hra || 0));
  payslip.ctcForPeriod = amount(payslip.totalEarnings + (payslip.employerContributionTotal || 0));
  payslip.updatedAt = nowIso();
  return payslip;
}

function payrollTaxYear(period) {
  const [year, month] = period.split('-').map(Number);
  const startYear = month >= 4 ? year : year - 1;
  return { label: `${startYear}-${String(startYear + 1).slice(-2)}`, start: `${startYear}-04`, end: `${startYear + 1}-03` };
}

function yearToDate(data, payslip) {
  const taxYear = payrollTaxYear(payslip.period);
  const records = data.payroll.filter((item) => item.employeeId === payslip.employeeId && item.period >= taxYear.start && item.period <= payslip.period && ['approved', 'paid'].includes(item.status));
  return {
    taxYear: taxYear.label,
    gross: amount(records.reduce((sum, item) => sum + (item.salaryGross ?? item.gross), 0)),
    salaryGross: amount(records.reduce((sum, item) => sum + (item.salaryGross ?? item.gross), 0)),
    paidAfterGross: amount(records.reduce((sum, item) => sum + (item.paidAfterGross ?? item.reimbursementTotal ?? 0), 0)),
    totalEarnings: amount(records.reduce((sum, item) => sum + (item.totalEarnings ?? item.gross), 0)),
    deductions: amount(records.reduce((sum, item) => sum + item.deductions, 0)),
    net: amount(records.reduce((sum, item) => sum + item.net, 0)),
    tds: amount(records.reduce((sum, item) => sum + ((item.employeeDeductions || []).find((line) => line.code === 'tds')?.amount || 0), 0)),
  };
}

function payrollSummary(records, period = null) {
  const filtered = period ? records.filter((item) => item.period === period) : records;
  return {
    period,
    employees: new Set(filtered.map((item) => item.employeeId)).size,
    records: filtered.length,
    gross: amount(filtered.reduce((sum, item) => sum + (item.salaryGross ?? item.gross), 0)),
    salaryGross: amount(filtered.reduce((sum, item) => sum + (item.salaryGross ?? item.gross), 0)),
    paidAfterGross: amount(filtered.reduce((sum, item) => sum + (item.paidAfterGross ?? item.reimbursementTotal ?? 0), 0)),
    totalEarnings: amount(filtered.reduce((sum, item) => sum + (item.totalEarnings ?? item.gross), 0)),
    deductions: amount(filtered.reduce((sum, item) => sum + item.deductions, 0)),
    net: amount(filtered.reduce((sum, item) => sum + item.net, 0)),
    employerContributions: amount(filtered.reduce((sum, item) => sum + (item.employerContributionTotal || 0), 0)),
    ctc: amount(filtered.reduce((sum, item) => sum + (item.ctcForPeriod || item.totalEarnings || item.gross), 0)),
    draft: filtered.filter((item) => item.status === 'draft').length,
    pendingApproval: filtered.filter((item) => item.status === 'pending_approval').length,
    approved: filtered.filter((item) => item.status === 'approved').length,
    paid: filtered.filter((item) => item.status === 'paid').length,
  };
}

function previousPeriod(period) {
  const { start } = periodRange(period);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return start.toISOString().slice(0, 7);
}

function zonedDateParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter((item) => item.type !== 'literal').map((item) => [item.type, item.value]));
  return { period: `${parts.year}-${parts.month}`, day: Number(parts.day) };
}

function runAutomaticPayroll(data, at = new Date()) {
  ensurePayrollCollections(data);
  const runs = [];
  for (const company of data.companies || []) {
    if (['suspended', 'archived'].includes(company.status)) continue;
    const settings = normalizePayrollSettings(company);
    if (!settings.autoGeneration.enabled) continue;
    const local = zonedDateParts(at, company.settings?.timezone);
    if (local.day < settings.autoGeneration.dayOfMonth) continue;
    const period = settings.autoGeneration.period === 'previous' ? previousPeriod(local.period) : local.period;
    const duplicate = data.payrollRuns.some((item) => item.companyId === company._id && item.period === period && item.source === 'automatic');
    if (duplicate) continue;
    runs.push(generatePayrollForCompany(data, {
      company,
      period,
      source: 'automatic',
      submitForApproval: settings.autoGeneration.submitForApproval,
    }).run);
  }
  return runs;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function indianNumberWords(value) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const belowThousand = (number) => {
    const parts = [];
    if (number >= 100) {
      parts.push(`${ones[Math.floor(number / 100)]} Hundred`);
      number %= 100;
    }
    if (number >= 20) {
      parts.push(tens[Math.floor(number / 10)]);
      number %= 10;
    }
    if (number > 0) parts.push(ones[number]);
    return parts.join(' ');
  };
  let rupees = Math.max(0, Math.floor(amount(value)));
  if (!rupees) return 'Zero Rupees Only';
  const groups = [
    [10000000, 'Crore'],
    [100000, 'Lakh'],
    [1000, 'Thousand'],
  ];
  const parts = [];
  for (const [divisor, label] of groups) {
    if (rupees >= divisor) {
      parts.push(`${belowThousand(Math.floor(rupees / divisor))} ${label}`);
      rupees %= divisor;
    }
  }
  if (rupees) parts.push(belowThousand(rupees));
  return `${parts.join(' ')} Rupees Only`;
}

function payslipContentHash(payslip) {
  const content = {
    companyId: payslip.companyId,
    employeeId: payslip.employeeId,
    payrollNumber: payslip.payrollNumber,
    period: payslip.period,
    employeeSnapshot: payslip.employeeSnapshot,
    companySnapshot: payslip.companySnapshot,
    salaryRevisionId: payslip.salaryRevisionId,
    salaryRevisionEffectiveFrom: payslip.salaryRevisionEffectiveFrom,
    salarySnapshot: payslip.salarySnapshot,
    settingsSnapshot: payslip.settingsSnapshot,
    attendanceSummary: payslip.attendanceSummary,
    earnings: payslip.earnings,
    employeeDeductions: payslip.employeeDeductions,
    employerContributions: payslip.employerContributions,
    statutoryDetails: payslip.statutoryDetails,
    gross: payslip.gross,
    paidAfterGross: payslip.paidAfterGross ?? payslip.reimbursementTotal ?? 0,
    totalEarnings: payslip.totalEarnings ?? payslip.gross,
    deductions: payslip.deductions,
    net: payslip.net,
    employerContributionTotal: payslip.employerContributionTotal,
    ctcForPeriod: payslip.ctcForPeriod,
  };
  return crypto.createHash('sha256').update(salaryMaterialKey(content)).digest('hex');
}

function issuePayslip(payslip, issuedBy = null) {
  if (payslip.issuedAt && payslip.contentHash && payslip.documentId) return payslip;
  payslip.contentHash = payslipContentHash(payslip);
  payslip.documentId = `QHR-${payslip.contentHash.slice(0, 16).toUpperCase()}`;
  payslip.issueVersion = Math.max(1, Number(payslip.issueVersion) || 1);
  payslip.issuedAt = nowIso();
  payslip.issuedBy = issuedBy;
  return payslip;
}

function payslipDocumentId(payslip) {
  if (payslip.documentId) return payslip.documentId;
  const source = [payslip.companyId, payslip.employeeId, payslip._id, payslip.period, amount(payslip.net), payslip.salaryRevisionId || 'legacy'].join('|');
  return `QHR-${crypto.createHash('sha256').update(source).digest('hex').slice(0, 16).toUpperCase()}`;
}

function maskedAccount(last4) {
  const digits = String(last4 || '').replace(/\D/g, '').slice(-4);
  return digits ? `XXXX${digits}` : '';
}

function itemizePayslip(data, payslip) {
  const company = data.companies.find((item) => item._id === payslip.companyId) || {};
  const employee = data.employees.find((item) => item._id === payslip.employeeId) || {};
  const settings = payslip.settingsSnapshot || normalizePayrollSettings(company);
  const salary = payslip.salarySnapshot || normalizeSalaryStructure(employee, settings);
  const preview = salary.preview || salaryStructurePreview(settings, salary);
  const grossMatches = Math.abs(amount(preview.gross) - amount(payslip.gross)) < 0.01;
  const coreMatches = Math.abs(amount(salary.basic) - amount(payslip.basic)) < 0.01
    && Math.abs(amount(salary.hra) - amount(payslip.hra)) < 0.01;
  const missingEarnings = !Array.isArray(payslip.earnings);
  const missingDeductions = !Array.isArray(payslip.employeeDeductions);
  const missingEmployerContributions = !Array.isArray(payslip.employerContributions);
  if (!missingEarnings && !missingDeductions && !missingEmployerContributions && Array.isArray(payslip.statutoryDetails)) return payslip;

  const detailed = { ...payslip };
  const reconstructed = [];
  if (missingEarnings) {
    if (grossMatches && coreMatches && preview.earnings.length) {
      detailed.earnings = preview.earnings.map((line) => ({ ...line, source: 'reconstructed' }));
      reconstructed.push('earnings');
    } else {
      detailed.earnings = [
        payrollLine('basic', 'Basic salary', payslip.basic, { source: 'legacy' }),
        payrollLine('hra', 'House rent allowance', payslip.hra, { source: 'legacy' }),
        payrollLine('legacy_allowances', salary.balanceComponentName || 'Legacy allowances', payslip.allowances, { source: 'legacy' }),
      ].filter((line) => line.amount !== 0);
    }
  }

  if (missingDeductions) {
    const previewDeductionTotal = amount(preview.employeeDeductions.reduce((sum, line) => sum + line.amount, 0));
    if (grossMatches && Math.abs(previewDeductionTotal - amount(payslip.deductions)) < 0.01) {
      detailed.employeeDeductions = preview.employeeDeductions.map((line) => ({ ...line, source: 'reconstructed' }));
      reconstructed.push('deductions');
    } else {
      detailed.employeeDeductions = amount(payslip.deductions) > 0
        ? [payrollLine('legacy_deductions', 'Legacy deductions (detail unavailable)', payslip.deductions, { source: 'legacy' })]
        : [];
    }
  }

  if (!Array.isArray(detailed.statutoryDetails)) detailed.statutoryDetails = preview.statutoryDetails || [];
  if (grossMatches && (missingDeductions || missingEmployerContributions)
    && (preview.employeeDeductions.length || preview.employerContributions.length)) {
    detailed.statutoryReference = {
      employeeDeductions: preview.employeeDeductions || [],
      employerContributions: preview.employerContributions || [],
      statutoryDetails: preview.statutoryDetails || [],
      note: 'Reference from the employee current salary structure and company statutory settings. It does not replace unmatched amounts in this approved historical payslip.',
    };
  }
  if (missingEarnings || missingDeductions || missingEmployerContributions) {
    const reconstructedText = reconstructed.length ? ` Matching ${reconstructed.join(' and ')} were reconstructed.` : '';
    detailed.legacyDetailWarning = `This historical payslip was saved before line-level payroll snapshots were available.${reconstructedText} Unmatched historical totals remain unchanged.`;
  }
  return detailed;
}

function buildPayslipHtmlBase(data, payslip) {
  const liveCompany = data.companies.find((item) => item._id === payslip.companyId) || {};
  const liveEmployee = data.employees.find((item) => item._id === payslip.employeeId) || {};
  const settings = payslip.settingsSnapshot || normalizePayrollSettings(liveCompany);
  const employee = payslip.employeeSnapshot || liveEmployee;
  const company = payslip.companySnapshot || {
    legalName: settings.identity.legalName || liveCompany.name,
    registeredAddress: settings.identity.registeredAddress,
    pan: settings.identity.pan,
    tan: settings.identity.tan,
  };
  const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: settings.currency || 'INR', maximumFractionDigits: 2 });
  const lines = (items) => items.filter((item) => !item.reimbursement).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td class="number">${escapeHtml(currency.format(item.amount))}</td></tr>`).join('');
  const attendance = payslip.attendanceSummary || {};
  const ytd = yearToDate(data, payslip);
  const range = periodRange(payslip.period);
  const periodStart = range.start.toISOString().slice(0, 10);
  const periodEnd = range.end.toISOString().slice(0, 10);
  const generatedDate = String(payslip.generatedAt || payslip.createdAt || '').slice(0, 10) || '-';
  const account = maskedAccount(employee.bankAccountLast4 || payslip.salarySnapshot?.bankAccountLast4);
  const paymentMode = employee.paymentMode || payslip.paymentMode || payslip.salarySnapshot?.paymentMode || '';
  const documentId = payslipDocumentId(payslip);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Payslip ${escapeHtml(payslip.period)}</title><style>body{font-family:Arial,sans-serif;color:#2f2923;margin:0;background:#f5f0e8}.sheet{max-width:820px;margin:24px auto;background:#fff;padding:36px;border:1px solid #ddd5c8}.header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #e07b39;padding-bottom:20px}.brand h1,.brand p,.meta p{margin:0 0 6px}.meta{text-align:right}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;margin:22px 0}.label{color:#6b625a;font-size:12px;text-transform:uppercase}.value{font-weight:700;margin-top:3px}table{border-collapse:collapse;width:100%;margin-top:14px}th,td{padding:10px;border-bottom:1px solid #eee;text-align:left}.number{text-align:right}.columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}.total{margin-top:22px;background:#fbead8;padding:18px;display:flex;justify-content:space-between;font-size:22px;font-weight:700}.words{font-size:13px;margin-top:8px;text-align:right}.footer{margin-top:24px;color:#6b625a;font-size:12px;text-align:center}@media(max-width:640px){.sheet{margin:0;padding:20px}.header,.columns{display:block}.meta{text-align:left;margin-top:15px}.grid{grid-template-columns:1fr}.columns table{margin-bottom:20px}}@media print{body{background:#fff}.sheet{border:0;margin:0;max-width:none}}</style></head><body><main class="sheet"><header class="header"><div class="brand"><h1>${escapeHtml(company.legalName || liveCompany.name)}</h1><p>${escapeHtml(company.registeredAddress || '')}</p><p>${company.pan ? `PAN: ${escapeHtml(company.pan)}` : ''}${company.tan ? ` | TAN: ${escapeHtml(company.tan)}` : ''}</p></div><div class="meta"><h2>PAYSLIP</h2><p>${escapeHtml(periodStart)} to ${escapeHtml(periodEnd)}</p><p>${escapeHtml(payslip.payrollNumber || payslip._id)}</p><p>Document: ${escapeHtml(documentId)}</p></div></header><section class="grid"><div><div class="label">Employee</div><div class="value">${escapeHtml(employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim())}</div></div><div><div class="label">Employee ID</div><div class="value">${escapeHtml(employee.employeeId)}</div></div><div><div class="label">Department / Designation</div><div class="value">${escapeHtml(employee.department)} / ${escapeHtml(employee.designation)}</div></div><div><div class="label">Generated date</div><div class="value">${escapeHtml(generatedDate)}</div></div><div><div class="label">Paid days</div><div class="value">${escapeHtml(attendance.payableDays ?? '-')} / ${escapeHtml(attendance.scheduledDays ?? '-')}</div></div><div><div class="label">LOP / unpaid leave</div><div class="value">${escapeHtml(attendance.lossOfPayDays ?? 0)} / ${escapeHtml(attendance.unpaidLeaveDays ?? 0)}</div></div><div><div class="label">PAN / UAN / ESI</div><div class="value">${escapeHtml(employee.pan || '-')} / ${escapeHtml(employee.uan || '-')} / ${escapeHtml(employee.esiNumber || '-')}</div></div><div><div class="label">Payment</div><div class="value">${escapeHtml(paymentMode || '-')} · ${escapeHtml(employee.bankName || '-')} ${escapeHtml(account)} ${escapeHtml(employee.bankIfsc || '')}</div></div><div><div class="label">Payment status</div><div class="value">${escapeHtml(payslip.paymentStatus || 'unpaid')}</div></div><div><div class="label">Paid date / reference</div><div class="value">${escapeHtml(String(payslip.paidAt || '').slice(0, 10) || '-')} / ${escapeHtml(payslip.paymentReference || '-')}</div></div><div><div class="label">Salary revision</div><div class="value">${escapeHtml(payslip.salaryRevisionId || 'Legacy/current fallback')} · ${escapeHtml(payslip.salaryRevisionEffectiveFrom || '-')}</div></div></section><section class="columns"><div><h3>Earnings</h3><table><tbody>${lines(payslip.earnings || [])}<tr><th>Gross earnings</th><th class="number">${escapeHtml(currency.format(payslip.gross))}</th></tr></tbody></table></div><div><h3>Deductions</h3><table><tbody>${lines(payslip.employeeDeductions || [])}<tr><th>Total deductions</th><th class="number">${escapeHtml(currency.format(payslip.deductions))}</th></tr></tbody></table></div></section><div class="total"><span>Net pay</span><span>${escapeHtml(currency.format(payslip.net))}</span></div><div class="words">${escapeHtml(indianNumberWords(payslip.net))}</div><table><thead><tr><th colspan="4">Year to date (${escapeHtml(ytd.taxYear)})</th></tr></thead><tbody><tr><td>Gross</td><td>${escapeHtml(currency.format(ytd.gross))}</td><td>Deductions</td><td>${escapeHtml(currency.format(ytd.deductions))}</td></tr><tr><td>Net</td><td>${escapeHtml(currency.format(ytd.net))}</td><td>TDS</td><td>${escapeHtml(currency.format(ytd.tds))}</td></tr></tbody></table><p class="footer">${escapeHtml(settings.identity.payslipFooter)} · ${escapeHtml(documentId)}</p></main></body></html>`;
}

function buildLegacyPayslipHtml(data, payslip) {
  payslip = itemizePayslip(data, payslip);
  const company = data.companies.find((item) => item._id === payslip.companyId) || {};
  const settings = payslip.settingsSnapshot || normalizePayrollSettings(company);
  const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: settings.currency || 'INR', maximumFractionDigits: 2 });
  const contributionRows = (payslip.employerContributions || [])
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td class="number">${escapeHtml(currency.format(item.amount))}</td></tr>`)
    .join('');
  const employerSection = contributionRows
    ? `<section style="margin-top:22px"><h3>Employer contributions</h3><p style="color:#6b625a;font-size:12px">Company-paid statutory contributions. These amounts do not reduce employee net pay.</p><table><tbody>${contributionRows}<tr><th>Total employer contributions</th><th class="number">${escapeHtml(currency.format(payslip.employerContributionTotal || 0))}</th></tr><tr><th>Company cost for this period</th><th class="number">${escapeHtml(currency.format(payslip.ctcForPeriod || payslip.gross))}</th></tr></tbody></table></section>`
    : '';
  const reimbursementRows = (payslip.earnings || []).filter((item) => item.reimbursement)
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td class="number">${escapeHtml(currency.format(item.amount))}</td></tr>`)
    .join('');
  const reimbursementSection = reimbursementRows
    ? `<section style="margin-top:22px"><h3>Paid after gross</h3><p style="color:#6b625a;font-size:12px">Approved reimbursements and additions shown separately from salary gross.</p><table><tbody>${reimbursementRows}<tr><th>Total paid after gross</th><th class="number">${escapeHtml(currency.format(payslip.paidAfterGross ?? payslip.reimbursementTotal ?? 0))}</th></tr><tr><th>Total earnings</th><th class="number">${escapeHtml(currency.format(payslip.totalEarnings ?? payslip.gross))}</th></tr></tbody></table></section>`
    : '';
  const statutoryRows = (payslip.statutoryDetails || [])
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.applicable ? 'Applied' : item.reason || 'Not applicable')}</td><td class="number">${escapeHtml(currency.format(item.employeeAmount || 0))}</td><td class="number">${escapeHtml(currency.format(item.employerAmount || 0))}</td></tr>`)
    .join('');
  const statutorySection = statutoryRows
    ? `<section style="margin-top:22px"><h3>Statutory applicability</h3><table><thead><tr><th>Component</th><th>Status</th><th class="number">Employee</th><th class="number">Employer</th></tr></thead><tbody>${statutoryRows}</tbody></table></section>`
    : '';
  const referenceRows = [
    ...(payslip.statutoryReference?.employeeDeductions || []).map((item) => ({ ...item, name: `${item.name} (employee)` })),
    ...(payslip.statutoryReference?.employerContributions || []).map((item) => ({ ...item, name: `${item.name} (employer)` })),
  ].map((item) => `<tr><td>${escapeHtml(item.name)}</td><td class="number">${escapeHtml(currency.format(item.amount))}</td></tr>`).join('');
  const referenceSection = referenceRows
    ? `<section style="margin-top:22px"><h3>Current statutory setup reference</h3><p style="color:#6b625a;font-size:12px">${escapeHtml(payslip.statutoryReference.note)}</p><table><tbody>${referenceRows}</tbody></table></section>`
    : '';
  const legacyNotice = payslip.legacyDetailWarning
    ? `<p style="margin-top:18px;padding:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px">${escapeHtml(payslip.legacyDetailWarning)}</p>`
    : '';
  return buildPayslipHtmlBase(data, payslip)
    .replace('<h3>Earnings</h3>', '<h3>Earnings and additions</h3>')
    .replace(`<tr><th>Gross earnings</th><th class="number">${escapeHtml(currency.format(payslip.gross))}</th></tr>`, `<tr><th>Gross salary</th><th class="number">${escapeHtml(currency.format(payslip.salaryGross ?? payslip.gross))}</th></tr>`)
    .replace('<h3>Deductions</h3>', '<h3>Employee deductions</h3>')
    .replace('<div class="total">', `${legacyNotice}${reimbursementSection}${employerSection}${statutorySection}${referenceSection}<div class="total">`);
}

function buildPayslipHtml(data, sourcePayslip) {
  const payslip = itemizePayslip(data, sourcePayslip);
  const liveCompany = data.companies.find((item) => item._id === payslip.companyId) || {};
  const liveEmployee = data.employees.find((item) => item._id === payslip.employeeId) || {};
  const settings = payslip.settingsSnapshot || normalizePayrollSettings(liveCompany);
  const employee = payslip.employeeSnapshot || liveEmployee;
  const company = payslip.companySnapshot || {
    legalName: settings.identity?.legalName || liveCompany.name || 'Company',
    registeredAddress: settings.identity?.registeredAddress || '',
    state: settings.identity?.state || '',
    pan: settings.identity?.pan || '',
    tan: settings.identity?.tan || '',
    gstin: settings.identity?.gstin || '',
    pfEstablishmentCode: settings.identity?.pfEstablishmentCode || '',
    esiEmployerCode: settings.identity?.esiEmployerCode || '',
  };
  const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: settings.currency || 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const moneyText = (value) => escapeHtml(currency.format(amount(value)));
  const valueOrDash = (value) => escapeHtml(value === undefined || value === null || value === '' ? '-' : value);
  const statusText = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';
  const lineRows = (items, emptyText) => items.length
    ? items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td class="amount">${moneyText(item.amount)}</td></tr>`).join('')
    : `<tr><td class="muted" colspan="2">${escapeHtml(emptyText)}</td></tr>`;
  const regularEarnings = (payslip.earnings || []).filter((item) => !item.reimbursement);
  const afterGrossEarnings = (payslip.earnings || []).filter((item) => item.reimbursement);
  const deductions = payslip.employeeDeductions || [];
  const employerContributions = payslip.employerContributions || [];
  const attendance = payslip.attendanceSummary || {};
  const ytd = yearToDate(data, payslip);
  const range = periodRange(payslip.period);
  const periodStart = range.start.toISOString().slice(0, 10);
  const periodEnd = range.end.toISOString().slice(0, 10);
  const periodLabel = range.start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const employeeName = employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Employee';
  const legalName = company.legalName || company.name || liveCompany.name || 'Company';
  const initials = legalName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'Q';
  const documentId = payslipDocumentId(payslip);
  const issuedDate = String(payslip.issuedAt || payslip.approvedAt || payslip.generatedAt || payslip.createdAt || '').slice(0, 10) || '-';
  const paidDate = String(payslip.paidAt || '').slice(0, 10) || '-';
  const account = maskedAccount(employee.bankAccountLast4 || payslip.salarySnapshot?.bankAccountLast4);
  const paymentMode = employee.paymentMode || payslip.paymentMode || payslip.salarySnapshot?.paymentMode || '';
  const salaryGross = amount(payslip.salaryGross ?? payslip.gross);
  const paidAfterGross = amount(payslip.paidAfterGross ?? payslip.reimbursementTotal ?? 0);
  const totalEarnings = amount(payslip.totalEarnings ?? salaryGross + paidAfterGross);
  const employerTotal = amount(payslip.employerContributionTotal || 0);
  const companyCost = amount(payslip.ctcForPeriod ?? totalEarnings + employerTotal);
  const companyRegistrations = [
    company.pan ? `PAN ${company.pan}` : '',
    company.tan ? `TAN ${company.tan}` : '',
    company.gstin ? `GSTIN ${company.gstin}` : '',
  ].filter(Boolean).join(' · ');
  // Payslips issued before per-employee locations existed carry no snapshot, so
  // resolve one live rather than printing a blank place of work.
  const workLocation = payslip.workLocationSnapshot
    || workLocationSnapshotFor(liveCompany, employee, settings.identity || {})
    || null;
  const establishmentIds = [
    workLocation?.pfEstablishmentCode || company.pfEstablishmentCode ? `PF: ${workLocation?.pfEstablishmentCode || company.pfEstablishmentCode}` : '',
    workLocation?.esiEmployerCode || company.esiEmployerCode ? `ESI: ${workLocation?.esiEmployerCode || company.esiEmployerCode}` : '',
  ].filter(Boolean).join(' · ');
  const workLocationLabel = workLocation
    ? [workLocation.name, workLocation.code ? `(${workLocation.code})` : ''].filter(Boolean).join(' ')
    : '';
  const legacyNotice = payslip.legacyDetailWarning
    ? `<div class="notice"><strong>Historical record:</strong> ${escapeHtml(payslip.legacyDetailWarning)}</div>`
    : '';
  const afterGrossSection = afterGrossEarnings.length ? `<section class="section avoid-break"><div class="section-title"><span>Paid after gross</span><small>Reimbursements and approved additions</small></div><table><tbody>${lineRows(afterGrossEarnings, 'No paid-after-gross items')}<tr class="subtotal"><th>Total paid after gross</th><th class="amount">${moneyText(paidAfterGross)}</th></tr></tbody></table></section>` : '';
  const employerSection = employerContributions.length ? `<section class="section avoid-break"><div class="section-title"><span>Employer contributions</span><small>Company-paid; not deducted from net pay</small></div><table><tbody>${lineRows(employerContributions, 'No employer contributions')}<tr class="subtotal"><th>Total employer contributions</th><th class="amount">${moneyText(employerTotal)}</th></tr><tr><th>Company cost for this period</th><th class="amount">${moneyText(companyCost)}</th></tr></tbody></table></section>` : '';
  const statutoryRows = (payslip.statutoryDetails || []).map((item) => {
    const status = item.applicable ? 'Applied' : item.reason || (item.enabled ? 'Not applicable' : 'Not enabled');
    return `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(status)}</td><td class="amount">${moneyText(item.employeeAmount || 0)}</td><td class="amount">${moneyText(item.employerAmount || 0)}</td></tr>`;
  }).join('');
  const statutorySection = statutoryRows
    ? `<section class="section statutory-summary avoid-break"><div class="section-title"><span>Statutory summary</span><small>Applicability and contributions</small></div><table><thead><tr><th>Statutory item</th><th>Status</th><th class="amount">Employee</th><th class="amount">Employer</th></tr></thead><tbody>${statutoryRows}</tbody></table></section>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payslip ${escapeHtml(periodLabel)} - ${escapeHtml(employeeName)}</title>
<style>
@page{size:A4;margin:5mm}*{box-sizing:border-box}body{margin:0;background:#e9edf2;color:#172033;font-family:Inter,"Segoe UI",Arial,sans-serif;font-size:11px;line-height:1.45}.sheet{width:100%;max-width:210mm;min-height:277mm;margin:18px auto;background:#fff;padding:14mm 13mm 11mm;box-shadow:0 8px 28px rgba(15,23,42,.12);position:relative}.top-rule{height:5px;background:linear-gradient(90deg,#c45f22,#e07b39 58%,#f0b47d);margin:-14mm -13mm 10mm}.header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.brand{display:flex;gap:12px;min-width:0}.logo{width:46px;height:46px;border-radius:10px;background:#2f2923;color:#fff;display:grid;place-items:center;font-size:18px;font-weight:800;letter-spacing:.5px;flex:0 0 auto}.company h1{font-size:19px;line-height:1.2;margin:0 0 4px;color:#172033}.company p,.document p{margin:2px 0;color:#596579}.tag{display:inline-block;padding:1px 5px;margin-right:4px;border-radius:4px;background:#f1f4f8;color:#6e7888;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}.document{text-align:right;min-width:190px}.document h2{margin:0 0 5px;font-size:21px;letter-spacing:2px;color:#c45f22}.document strong{color:#172033}.pill{display:inline-block;margin-top:5px;padding:3px 9px;border-radius:20px;background:#fdf0e6;color:#9a4619;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px}.divider{border:0;border-top:1px solid #dce2ea;margin:18px 0}.info-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #dce2ea;border-radius:8px;overflow:hidden}.info{padding:9px 10px;min-height:52px;border-right:1px solid #e5e9ef;border-bottom:1px solid #e5e9ef}.info:nth-child(4n){border-right:0}.info:nth-last-child(-n+4){border-bottom:0}.statutory-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0 14px}.statutory-card{padding:9px 10px;border:1px solid #dce2ea;border-radius:8px;background:#fbfcfd;min-height:50px}.label{font-size:8.5px;color:#6e7888;text-transform:uppercase;letter-spacing:.55px;font-weight:700}.value{margin-top:3px;color:#172033;font-weight:650;word-break:break-word}.attendance{display:grid;grid-template-columns:repeat(8,1fr);margin:14px 0;border:1px solid #dce2ea;border-radius:8px;background:#f8fafc;overflow:hidden}.attendance div{text-align:center;padding:8px 5px;border-right:1px solid #e5e9ef}.attendance div:last-child{border-right:0}.attendance strong{display:block;font-size:14px;color:#172033}.attendance span{font-size:8px;color:#6e7888;text-transform:uppercase;letter-spacing:.35px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}.section{border:1px solid #dce2ea;border-radius:8px;overflow:hidden;margin-top:14px}.columns .section{margin-top:0}.section-title{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:9px 11px;background:#f5f7fa;border-bottom:1px solid #dce2ea;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.45px}.section-title small{font-size:8px;color:#7a8493;font-weight:500;text-transform:none;letter-spacing:0}table{width:100%;border-collapse:collapse}td,th{padding:7px 11px;border-bottom:1px solid #edf0f4;text-align:left;font-weight:500}tr:last-child td,tr:last-child th{border-bottom:0}.amount{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.subtotal th{background:#fbfcfd;font-weight:800;border-top:1px solid #dce2ea}.muted{color:#7a8493}.calculation{display:grid;grid-template-columns:1fr auto;gap:8px 16px;margin-top:14px;padding:12px 14px;border-radius:8px;background:#172033;color:#fff}.calculation div:nth-child(even){text-align:right;font-variant-numeric:tabular-nums}.calculation .net-label,.calculation .net-value{font-size:17px;font-weight:800;padding-top:8px;border-top:1px solid rgba(255,255,255,.22)}.words{padding:8px 12px;border:1px solid #dce2ea;border-top:0;border-radius:0 0 8px 8px;color:#596579;font-size:9.5px}.words strong{color:#172033}.ytd{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#dce2ea}.ytd div{background:#fff;padding:9px 11px}.ytd strong{display:block;margin-top:3px;font-size:12px}.payment-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.payment-grid .value{font-size:10px}.notice{margin-top:12px;padding:9px 11px;border:1px solid #f2c68f;border-radius:7px;background:#fff8ec;color:#8a4c12;font-size:9px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:26px}.signature{padding-top:22px;border-top:1px solid #7e8794;text-align:center;color:#596579;font-size:9px}.footer{margin-top:18px;padding-top:10px;border-top:1px solid #dce2ea;text-align:center;color:#7a8493;font-size:8px}.hash{font-family:Consolas,monospace;word-break:break-all}.avoid-break{break-inside:avoid;page-break-inside:avoid}@media(max-width:720px){body{background:#fff}.sheet{margin:0;padding:18px;box-shadow:none;min-height:auto}.info-grid{grid-template-columns:repeat(2,1fr)}.statutory-grid{grid-template-columns:repeat(2,1fr)}.info:nth-child(2n){border-right:0}.info:nth-last-child(-n+4){border-bottom:1px solid #e5e9ef}.info:nth-last-child(-n+2){border-bottom:0}.columns{grid-template-columns:1fr}.attendance{grid-template-columns:repeat(4,1fr)}.attendance div:nth-child(4n){border-right:0}.payment-grid{grid-template-columns:1fr}}@media print{html,body{width:200mm}body{background:#fff;font-size:10px;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{width:148mm;max-width:none;height:210mm;min-height:210mm;margin:0;padding:7mm 8mm 5mm;box-shadow:none;zoom:1.35;display:flex;flex-direction:column;justify-content:space-between}.info-grid{grid-template-columns:repeat(4,1fr)}.info:nth-child(2n){border-right:1px solid #e5e9ef}.info:nth-child(4n){border-right:0}.info:nth-last-child(-n+4){border-bottom:0}.statutory-grid{grid-template-columns:repeat(4,1fr)}.columns{grid-template-columns:1fr 1fr;gap:8px}.attendance{grid-template-columns:repeat(8,1fr)}.attendance div:nth-child(4n){border-right:1px solid #e5e9ef}.attendance div:last-child{border-right:0}.payment-grid{grid-template-columns:repeat(3,1fr)}.top-rule{height:4px;margin:-7mm -8mm 6mm;background:#d96f2d}.header{gap:16px}.brand{gap:10px}.logo{width:40px;height:40px;border-radius:8px;font-size:15px}.company h1{font-size:16px;margin-bottom:3px}.company p,.document p{margin:1.5px 0}.document{min-width:175px}.document h2{font-size:18px;margin-bottom:3px}.pill{margin-top:3px;padding:2px 8px;font-size:7.5px}.divider{margin:10px 0}.info{padding:7px 8px;min-height:40px}.label{font-size:7px}.value{margin-top:3px}.statutory-grid{gap:8px;margin:7px 0 9px}.statutory-card{padding:7px 8px;min-height:38px}.attendance{margin:9px 0}.attendance div{padding:6px 3px}.attendance strong{font-size:12px}.attendance span{font-size:6.5px}.columns{gap:10px}.section{margin-top:10px}.section-title{padding:7px 9px;font-size:9px}.section-title small{font-size:7px}td,th{padding:5px 9px}.calculation{gap:6px 14px;margin-top:10px;padding:11px 12px}.calculation .net-label,.calculation .net-value{font-size:14px;padding-top:6px}.words{padding:6px 10px;font-size:8px}.ytd div{padding:8px 9px}.ytd strong{margin-top:2px;font-size:10px}.payment-grid{gap:9px}.payment-grid .value{font-size:8.5px}.notice{margin-top:7px;padding:7px 9px;font-size:7.5px}.statutory-summary,.signatures{display:none}.footer{margin-top:10px;padding-top:7px;font-size:6.5px}.footer p{margin:2px 0}.no-print{display:none}}
</style></head><body><main class="sheet"><div class="top-rule"></div>
<header class="header"><div class="brand"><div class="logo">${escapeHtml(initials)}</div><div class="company"><h1>${escapeHtml(legalName)}</h1><p><span class="tag">Regd. office</span> ${valueOrDash(company.registeredAddress || company.address)}</p><p>${escapeHtml([company.state, companyRegistrations].filter(Boolean).join(' · '))}</p>${establishmentIds ? `<p>${escapeHtml(establishmentIds)}</p>` : ''}${workLocation && workLocation.address ? `<p><span class="tag">Place of work</span> ${escapeHtml(workLocation.address)}</p>` : ''}</div></div><div class="document"><h2>PAYSLIP</h2><p><strong>${escapeHtml(periodLabel)}</strong></p><p>${escapeHtml(periodStart)} to ${escapeHtml(periodEnd)}</p><p>Payroll no: <strong>${valueOrDash(payslip.payrollNumber)}</strong></p><p>Document ID: <strong>${escapeHtml(documentId)}</strong></p><span class="pill">${escapeHtml(statusText(payslip.paymentStatus || payslip.status))}</span></div></header>
<hr class="divider"><section class="info-grid avoid-break"><div class="info"><div class="label">Employee name</div><div class="value">${escapeHtml(employeeName)}</div></div><div class="info"><div class="label">Employee ID</div><div class="value">${valueOrDash(employee.employeeId)}</div></div><div class="info"><div class="label">Department</div><div class="value">${valueOrDash(employee.department)}</div></div><div class="info"><div class="label">Designation</div><div class="value">${valueOrDash(employee.designation)}</div></div><div class="info"><div class="label">Date of joining</div><div class="value">${valueOrDash(String(employee.dateOfJoining || '').slice(0,10))}</div></div><div class="info"><div class="label">Bank name</div><div class="value">${valueOrDash(employee.bankName)}</div></div><div class="info"><div class="label">Bank account</div><div class="value">${valueOrDash(account)}</div></div><div class="info"><div class="label">IFSC / payment mode</div><div class="value">${valueOrDash([employee.bankIfsc, statusText(paymentMode)].filter(Boolean).join(' · '))}</div></div></section>
<section class="statutory-grid avoid-break"><div class="statutory-card"><div class="label">Permanent Account Number (PAN)</div><div class="value">${valueOrDash(employee.pan)}</div></div><div class="statutory-card"><div class="label">Universal Account Number (UAN)</div><div class="value">${valueOrDash(employee.uan)}</div></div><div class="statutory-card"><div class="label">Employee State Insurance (ESI)</div><div class="value">${valueOrDash(employee.esiNumber)}</div></div><div class="statutory-card"><div class="label">Work location</div><div class="value">${valueOrDash(workLocationLabel)}</div></div></section>
<section class="attendance avoid-break"><div><strong>${valueOrDash(attendance.scheduledDays)}</strong><span>Scheduled days</span></div><div><strong>${valueOrDash(attendance.payableDays)}</strong><span>Paid days</span></div><div><strong>${valueOrDash(attendance.presentDays)}</strong><span>Present</span></div><div><strong>${valueOrDash(attendance.wfhDays || 0)}</strong><span>WFH days</span></div><div><strong>${valueOrDash(attendance.paidLeaveDays)}</strong><span>Paid leave</span></div><div><strong>${valueOrDash(attendance.unpaidLeaveDays)}</strong><span>Unpaid leave</span></div><div><strong>${valueOrDash(attendance.weeklyOffDays || 0)}</strong><span>Weekly offs</span></div><div><strong>${valueOrDash(attendance.lossOfPayDays)}</strong><span>LOP days</span></div></section>
${legacyNotice}<section class="columns avoid-break"><div class="section"><div class="section-title"><span>Earnings</span><small>Salary components</small></div><table><tbody>${lineRows(regularEarnings, 'No earning details available')}<tr class="subtotal"><th>Salary gross</th><th class="amount">${moneyText(salaryGross)}</th></tr></tbody></table></div><div class="section"><div class="section-title"><span>Deductions</span><small>Employee deductions</small></div><table><tbody>${lineRows(deductions, 'No deductions')}<tr class="subtotal"><th>Total deductions</th><th class="amount">${moneyText(payslip.deductions)}</th></tr></tbody></table></div></section>
${afterGrossSection}<section class="calculation avoid-break"><div>Salary gross</div><div>${moneyText(salaryGross)}</div><div>Paid after gross</div><div>${moneyText(paidAfterGross)}</div><div>Total deductions</div><div>- ${moneyText(payslip.deductions)}</div><div class="net-label">NET PAY</div><div class="net-value">${moneyText(payslip.net)}</div></section><div class="words"><strong>Amount in words:</strong> ${escapeHtml(indianNumberWords(payslip.net))}</div>
<section class="section avoid-break"><div class="section-title"><span>Year-to-date summary</span><small>Financial year ${escapeHtml(ytd.taxYear)}</small></div><div class="ytd"><div><span class="label">Salary gross</span><strong>${moneyText(ytd.salaryGross ?? ytd.gross)}</strong></div><div><span class="label">After gross</span><strong>${moneyText(ytd.paidAfterGross || 0)}</strong></div><div><span class="label">Deductions</span><strong>${moneyText(ytd.deductions)}</strong></div><div><span class="label">Net paid</span><strong>${moneyText(ytd.net)}</strong></div></div></section>
${employerSection}${statutorySection}<section class="section avoid-break"><div class="section-title"><span>Payment and document details</span><small>Audit information</small></div><div class="payment-grid" style="padding:10px 11px"><div><div class="label">Payment status</div><div class="value">${escapeHtml(statusText(payslip.paymentStatus || 'unpaid'))}</div></div><div><div class="label">Paid date / reference</div><div class="value">${escapeHtml(`${paidDate} · ${payslip.paymentReference || '-'}`)}</div></div><div><div class="label">Issued date / version</div><div class="value">${escapeHtml(`${issuedDate} · v${payslip.issueVersion || 1}`)}</div></div></div></section>
<div class="signatures avoid-break"><div class="signature">Employee acknowledgement</div><div class="signature">Authorised signatory</div></div><footer class="footer"><p>${escapeHtml(settings.identity?.payslipFooter || 'This is a system-generated payslip and does not require a physical signature.')}</p><p>${escapeHtml(documentId)}${payslip.contentHash ? ` · Verification hash: <span class="hash">${escapeHtml(payslip.contentHash)}</span>` : ''}</p><p>Generated securely by QHR Payroll</p></footer></main></body></html>`;
}

module.exports = {
  PERIOD_PATTERN,
  amount,
  appendSalaryRevision,
  buildPayslipHtml,
  calculatePayroll,
  defaultPayrollSettings,
  ensurePayrollCollections,
  generatePayrollForCompany,
  itemizePayslip,
  issuePayslip,
  maskedAccount,
  normalizePayrollSettings,
  normalizeSalaryStructure,
  payrollIdentitySnapshots,
  resolveWorkLocation,
  workLocationSnapshotFor,
  payrollSummary,
  recalculateAdjustments,
  runAutomaticPayroll,
  salaryRevisionForPeriod,
  yearToDate,
};
