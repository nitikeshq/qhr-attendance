const { nowIso } = require('./records');

function trimmed(value) {
  return String(value ?? '').trim();
}

function present(value) {
  return trimmed(value).length > 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isActive(item) {
  const status = trimmed(item?.status).toLowerCase();
  if (item?.active === false) return false;
  return status !== 'inactive' && status !== 'archived';
}

function requireFields(checks) {
  const missing = [];
  for (const check of checks) {
    if (!check.ok) missing.push(check.message);
  }
  return missing;
}

const ONBOARDING_STEPS = [
  {
    key: 'company_profile',
    title: 'Company profile',
    description: 'Legal name, contact details, address, and working hours used across the product.',
    required: true,
    evaluate(company) {
      const profile = company?.profile || {};
      const settings = company?.settings || {};
      const missing = requireFields([
        { ok: present(company?.name), message: 'Company name is required' },
        { ok: present(company?.email), message: 'Company email is required' },
        { ok: present(settings.timezone), message: 'Timezone is required' },
        { ok: present(settings.officeStart), message: 'Office start time is required' },
        { ok: present(settings.officeEnd), message: 'Office end time is required' },
        { ok: present(profile.registeredAddress), message: 'Registered address is required' },
        { ok: present(profile.city), message: 'City is required' },
        { ok: present(profile.state), message: 'State is required' },
        { ok: present(profile.pincode), message: 'Pincode is required' },
        { ok: present(profile.industry), message: 'Industry is required' },
      ]);
      return {
        complete: missing.length === 0,
        missing,
        summary: missing.length === 0
          ? `${trimmed(company?.name)} profile is complete with office hours ${trimmed(settings.officeStart)}-${trimmed(settings.officeEnd)} (${trimmed(settings.timezone)}).`
          : `${missing.length} company profile detail(s) still needed.`,
      };
    },
  },
  {
    key: 'payroll_identity',
    title: 'Payroll identity',
    description: 'Statutory employer identity printed on payslips and used for compliance filings.',
    required: true,
    evaluate(company) {
      const payroll = company?.payrollSettings || {};
      const identity = payroll.identity || {};
      const missing = requireFields([
        { ok: present(identity.legalName), message: 'Registered legal name is required' },
        { ok: present(identity.registeredAddress), message: 'Registered address is required' },
        { ok: present(identity.state), message: 'Registered state is required' },
        { ok: present(identity.pan), message: 'Company PAN is required' },
        { ok: present(payroll.currency), message: 'Payroll currency is required' },
        { ok: present(payroll.payFrequency), message: 'Pay frequency is required' },
        { ok: Number(payroll.paymentDay) >= 1, message: 'Salary payment day is required' },
      ]);
      const optional = ['tan', 'gstin', 'pfEstablishmentCode', 'esiEmployerCode'].filter((field) => present(identity[field]));
      return {
        complete: missing.length === 0,
        missing,
        summary: missing.length === 0
          ? `Payroll identity saved for ${trimmed(identity.legalName)} (PAN ${trimmed(identity.pan)}). ${optional.length} optional registration(s) captured; TAN, GSTIN, PF and ESI codes stay optional.`
          : `${missing.length} payroll identity field(s) still needed. TAN, GSTIN, PF and ESI codes are optional.`,
      };
    },
  },
  {
    key: 'work_locations',
    title: 'Work locations',
    description: 'Every office or site employees can be assigned to, including the payroll address.',
    required: true,
    evaluate(company) {
      const locations = asArray(company?.workLocations);
      const payrollAddresses = locations.filter((location) => location?.isPayrollAddress === true);
      const missing = [];
      if (locations.length === 0) missing.push('At least one work location is required');
      if (locations.length > 0 && payrollAddresses.length === 0) missing.push('One work location must be marked as the payroll address');
      if (payrollAddresses.length > 1) missing.push('Only one work location can be the payroll address');
      return {
        complete: missing.length === 0,
        missing,
        summary: missing.length === 0
          ? `${locations.length} work location(s) configured, payroll address is ${trimmed(payrollAddresses[0]?.name)}.`
          : `${locations.length} work location(s) saved so far.`,
      };
    },
  },
  {
    key: 'org_structure',
    title: 'Departments and designations',
    description: 'The reporting structure employees, approvals, and reports are grouped by.',
    required: true,
    evaluate(company) {
      const departments = asArray(company?.departments);
      const designations = asArray(company?.designations);
      const missing = [];
      if (departments.length === 0) missing.push('At least one department is required');
      if (designations.length === 0) missing.push('At least one designation is required');
      return {
        complete: missing.length === 0,
        missing,
        summary: `${departments.length} department(s) and ${designations.length} designation(s) configured.`,
      };
    },
  },
  {
    key: 'statutory',
    title: 'Statutory setup',
    description: 'PF, ESI, professional tax, and TDS contributions applied when payroll runs.',
    required: true,
    evaluate(company) {
      const statutory = company?.payrollSettings?.statutory || {};
      const acknowledged = company?.onboarding?.reviewed?.statutory === true;
      const enabled = ['pfEnabled', 'esiEnabled', 'professionalTaxEnabled', 'tdsEnabled'].filter((field) => statutory[field] === true);
      const complete = acknowledged || enabled.length > 0;
      return {
        complete,
        missing: complete ? [] : ['Statutory contributions have not been reviewed yet'],
        summary: complete
          ? `${enabled.length} statutory component(s) enabled. A company may legitimately have every statutory item disabled, so an explicit review acknowledgement counts as complete.`
          : 'Review PF, ESI, professional tax, and TDS. A company may legitimately have all statutory items disabled, which is why an explicit review acknowledgement is accepted instead of requiring any of them to be enabled.',
      };
    },
  },
  {
    key: 'attendance_policy',
    title: 'Attendance policy',
    description: 'How attendance is captured and how it affects payroll.',
    required: true,
    evaluate(company) {
      const settings = company?.settings || {};
      const policy = settings.attendancePolicy;
      const areas = asArray(company?.attendanceAreas).filter(isActive);
      const missing = [];
      if (!policy || typeof policy !== 'object') {
        missing.push('Attendance policy is required');
      } else {
        if (!present(policy.payrollImpact)) missing.push('Attendance payroll impact is required');
        if (!(Number(policy.fullDayMinutes) > 0)) missing.push('Full day working minutes are required');
        if (!(Number(policy.halfDayMinutes) > 0)) missing.push('Half day working minutes are required');
      }
      if (settings.gpsTracking === true && areas.length === 0) {
        missing.push('At least one active attendance area is required while GPS tracking is on');
      }
      return {
        complete: missing.length === 0,
        missing,
        summary: missing.length === 0
          ? `Policy impact "${trimmed(policy?.payrollImpact)}" with ${Number(policy?.fullDayMinutes)} full-day minutes; ${areas.length} active geofence(s).`
          : `${missing.length} attendance policy detail(s) still needed.`,
      };
    },
  },
  {
    key: 'leave_policy',
    title: 'Leave policy',
    description: 'Leave types employees can apply for and their yearly allowances.',
    required: true,
    evaluate(company) {
      const leaveTypes = asArray(company?.leaveTypes);
      const paidWithAllowance = leaveTypes.filter((type) => type?.paid !== false && Number(type?.annualAllowance) > 0);
      const missing = [];
      if (leaveTypes.length === 0) missing.push('At least one leave type is required');
      if (leaveTypes.length > 0 && paidWithAllowance.length === 0) missing.push('At least one paid leave type needs an annual allowance above zero');
      return {
        complete: missing.length === 0,
        missing,
        summary: `${leaveTypes.length} leave type(s) configured, ${paidWithAllowance.length} paid with an annual allowance.`,
      };
    },
  },
  {
    key: 'holidays',
    title: 'Holiday calendar',
    description: 'Public and company holidays for the current and upcoming year.',
    required: true,
    evaluate(company) {
      const currentYear = new Date().getUTCFullYear();
      const holidays = asArray(company?.holidays);
      const relevant = holidays.filter((holiday) => {
        const year = Number(String(holiday?.date || '').slice(0, 4));
        return year === currentYear || year === currentYear + 1;
      });
      const missing = relevant.length === 0
        ? [`At least one holiday dated in ${currentYear} or ${currentYear + 1} is required`]
        : [];
      return {
        complete: missing.length === 0,
        missing,
        summary: `${relevant.length} holiday(s) listed for ${currentYear}-${currentYear + 1} out of ${holidays.length} total.`,
      };
    },
  },
  {
    key: 'team',
    title: 'Invite your team',
    description: 'Add the employees who will use attendance, leave, and payroll.',
    required: false,
    evaluate(company, data) {
      const employees = asArray(data?.employees).filter((employee) => (
        employee.companyId === company?._id
        && employee.status !== 'inactive'
        && employee.role !== 'super_admin'
        && employee.role !== 'admin'
      ));
      const complete = employees.length > 0;
      return {
        complete,
        missing: complete ? [] : ['No employees added yet. You can go live now and add employees later.'],
        summary: complete
          ? `${employees.length} active employee(s) besides the company admin.`
          : 'Only the company admin exists so far, which is enough to go live.',
      };
    },
  },
  {
    key: 'review',
    title: 'Review and go live',
    description: 'Confirm the setup and activate the company.',
    required: true,
    evaluate(company) {
      const completedAt = company?.onboarding?.completedAt || null;
      return {
        complete: Boolean(completedAt),
        missing: completedAt ? [] : ['Onboarding has not been marked complete yet'],
        summary: completedAt ? `Onboarding completed on ${completedAt}.` : 'Finish the required steps, then go live.',
      };
    },
  },
];

function ensureOnboarding(company) {
  if (!company) return null;
  company.profile ||= {};
  const existing = company.onboarding && typeof company.onboarding === 'object' ? company.onboarding : {};
  company.onboarding = {
    ...existing,
    skippedSteps: Array.isArray(existing.skippedSteps) ? existing.skippedSteps : [],
    reviewed: existing.reviewed && typeof existing.reviewed === 'object' ? existing.reviewed : {},
    startedAt: existing.startedAt || nowIso(),
    completedAt: existing.completedAt || null,
    completedBy: existing.completedBy || null,
  };
  return company.onboarding;
}

function evaluateStep(step, company, data) {
  const result = step.evaluate(company, data) || {};
  return {
    complete: Boolean(result.complete),
    missing: Array.isArray(result.missing) ? result.missing : [],
    summary: String(result.summary || ''),
  };
}

function onboardingSnapshot(company, data) {
  const onboarding = company?.onboarding || {};
  const skippedSteps = Array.isArray(onboarding.skippedSteps) ? onboarding.skippedSteps : [];
  const completedAt = onboarding.completedAt || null;

  const steps = ONBOARDING_STEPS.map((step) => {
    const result = evaluateStep(step, company, data);
    return {
      key: step.key,
      title: step.title,
      description: step.description,
      required: step.required,
      complete: result.complete,
      skipped: skippedSteps.includes(step.key),
      missing: result.missing,
      summary: result.summary,
    };
  });

  const requiredSteps = steps.filter((step) => step.required);
  const totalRequired = requiredSteps.length;
  const completedRequired = requiredSteps.filter((step) => step.complete).length;
  const percent = totalRequired === 0 ? 100 : Math.round((completedRequired / totalRequired) * 100);
  const canComplete = requiredSteps.every((step) => step.key === 'review' || step.complete);
  const currentStep = requiredSteps.find((step) => !step.complete)?.key || 'review';

  return {
    status: completedAt ? 'completed' : 'in_progress',
    progress: { completedRequired, totalRequired, percent },
    canComplete,
    completedAt,
    currentStep,
    steps,
  };
}

module.exports = {
  ONBOARDING_STEPS,
  ensureOnboarding,
  onboardingSnapshot,
};
