'use strict';

/**
 * Payroll dry run and readiness.
 *
 * Generation used to be the first moment any figure existed: you could not see
 * what a month would produce until you had written its payslips. That is the
 * wrong shape for the one operation in the product that moves money.
 *
 * Everything here is read-only. `calculatePayroll` and `buildAttendanceSummary`
 * are pure over the data, so the same numbers generation would persist can be
 * computed and thrown away. The preview and the exceptions view are one
 * computation with different filters, deliberately: two code paths that could
 * disagree about someone's pay would be worse than having neither.
 */

const { PERIOD_PATTERN, normalizeHolidays, periodRange, workWeekFor } = require('./attendancePolicy');
const { paymentDateForPeriod } = require('./workWeek');
const {
  calculatePayroll,
  normalizePayrollSettings,
  normalizeSalaryStructure,
  salaryRevisionForPeriod,
} = require('./payroll');

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function trimmed(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function overlapsPeriod(startDate, endDate, start, end) {
  const from = trimmed(startDate).slice(0, 10);
  const to = trimmed(endDate || startDate).slice(0, 10);
  if (!from) return false;
  return from <= end && to >= start;
}

/**
 * Company-level problems. A blocker means the run cannot produce a correct
 * payslip for anybody; a warning means somebody should look before approving.
 */
function companyReadiness(data, company, period) {
  const blockers = [];
  const warnings = [];
  const settings = normalizePayrollSettings(company);
  const identity = settings.identity || {};

  const thisMonth = new Date().toISOString().slice(0, 7);
  if (period > thisMonth) {
    warnings.push({
      code: 'period.future',
      message: 'This period has not finished, so attendance and leave for it are incomplete.',
      fix: 'payroll',
    });
  } else if (period < thisMonth) {
    // Statutory settings are not versioned, so an old month is computed with
    // today's rules. Worth saying out loud rather than discovering on a payslip.
    warnings.push({
      code: 'period.stale',
      message: 'This period is in the past and will be computed with your current statutory settings, not the settings that applied then.',
      fix: 'settings',
    });
  }

  if (!trimmed(identity.legalName)) blockers.push({ code: 'identity.legalName', message: 'Payroll identity has no legal name, so payslips cannot be issued.', fix: 'settings' });
  if (!trimmed(identity.registeredAddress)) blockers.push({ code: 'identity.registeredAddress', message: 'No registered address, so payslips have no statutory address.', fix: 'settings' });
  if (!trimmed(identity.pan)) warnings.push({ code: 'identity.pan', message: 'Company PAN is missing from payroll identity.', fix: 'settings' });
  if (!trimmed(identity.tan) && settings.statutory?.tdsEnabled) warnings.push({ code: 'identity.tan', message: 'TDS is enabled but the company TAN is missing.', fix: 'settings' });

  const locations = (company.workLocations || []).filter((item) => item.status !== 'inactive');
  if (!locations.length) {
    blockers.push({ code: 'workLocation.missing', message: 'No active work location, so payslips have no place of work.', fix: 'org' });
  } else if (!locations.some((item) => item.isPayrollAddress === true)) {
    warnings.push({ code: 'workLocation.payrollAddress', message: 'No work location is marked as the payroll address.', fix: 'org' });
  }

  if (settings.statutory?.pfEnabled && !trimmed(identity.pfEstablishmentCode) && !locations.some((item) => trimmed(item.pfEstablishmentCode))) {
    warnings.push({ code: 'statutory.pf', message: 'Provident fund is enabled but no PF establishment code is recorded.', fix: 'settings' });
  }
  if (settings.statutory?.esiEnabled && !trimmed(identity.esiEmployerCode) && !locations.some((item) => trimmed(item.esiEmployerCode))) {
    warnings.push({ code: 'statutory.esi', message: 'ESI is enabled but no employer code is recorded.', fix: 'settings' });
  }

  return { blockers, warnings, settings };
}

/** Per-employee problems for the period, in the order they matter. */
function employeeReadiness(data, company, employee, settings, salary, start, end, period) {
  const blockers = [];
  const warnings = [];

  if (!salary.payrollEnabled) {
    blockers.push({ code: 'salary.missing', message: 'No salary structure, so this employee is skipped by the run.', fix: 'payroll' });
  }

  const pendingLeave = (data.leaves || []).filter((item) => (
    item.employeeId === employee._id
    && item.status === 'pending'
    && overlapsPeriod(item.startDate, item.endDate, start, end)
  ));
  if (pendingLeave.length) {
    // The one case where approving early guarantees a payslip that is wrong and
    // can no longer be corrected in place.
    blockers.push({
      code: 'leave.pending',
      message: `${pendingLeave.length} leave request(s) for this period are still awaiting a decision.`,
      fix: 'leaves',
    });
  }

  const pendingWfh = (data.wfhRequests || []).filter((item) => (
    item.employeeId === employee._id
    && item.status === 'pending'
    && overlapsPeriod(item.startDate || item.date, item.endDate || item.startDate || item.date, start, end)
  ));
  if (pendingWfh.length) {
    warnings.push({ code: 'wfh.pending', message: `${pendingWfh.length} work-from-home request(s) for this period are undecided.`, fix: 'wfh' });
  }

  const records = (data.attendances || []).filter((item) => (
    item.employeeId === employee._id && trimmed(item.dateKey || item.date).slice(0, 7) === period
  ));
  if (!records.length) {
    warnings.push({ code: 'attendance.none', message: 'No attendance records at all for this period.', fix: 'attendance' });
  }

  if (settings.statutory?.pfEnabled && salary.pfApplicable && !trimmed(salary.uan)) {
    warnings.push({ code: 'employee.uan', message: 'PF applies but no UAN is recorded.', fix: 'employees' });
  }
  if (settings.statutory?.esiEnabled && salary.esiApplicable && !trimmed(salary.esiNumber)) {
    warnings.push({ code: 'employee.esi', message: 'ESI applies but no ESI number is recorded.', fix: 'employees' });
  }
  if (settings.statutory?.tdsEnabled && !trimmed(salary.pan)) {
    warnings.push({ code: 'employee.pan', message: 'TDS is enabled but this employee has no PAN.', fix: 'employees' });
  }
  const paymentMode = salary.paymentMode || 'bank_transfer';
  if (paymentMode === 'bank_transfer' && !trimmed(salary.bankAccountLast4)) {
    warnings.push({ code: 'employee.bank', message: 'Paid by bank transfer but no account is recorded.', fix: 'employees' });
  }

  if (!employee.workLocationId) {
    warnings.push({ code: 'employee.workLocation', message: 'No work location assigned, so the payslip falls back to the registered address.', fix: 'org' });
  }

  const claims = (data.reimbursements || []).filter((item) => (
    item.employeeId === employee._id
    && item.paymentMethod === 'through_payroll'
    && item.payrollPeriod === period
    && ['approved', 'queued_for_payroll'].includes(item.status)
  ));
  if (claims.length) {
    warnings.push({
      code: 'reimbursement.queued',
      message: `${claims.length} reimbursement claim(s) will be added to this payslip.`,
      fix: 'reimbursements',
    });
  }

  return { blockers, warnings };
}

/** Why this employee is not a clean full month, in plain words. */
function exceptionReasons(row) {
  const reasons = [];
  const attendance = row.attendance || {};
  if (amount(attendance.lossOfPayDays) > 0) reasons.push(`${amount(attendance.lossOfPayDays)} loss-of-pay day(s)`);
  if (amount(attendance.unpaidLeaveDays) > 0) reasons.push(`${amount(attendance.unpaidLeaveDays)} unpaid leave day(s)`);
  if (amount(attendance.unnoticedAbsenceDays) > 0) reasons.push(`${amount(attendance.unnoticedAbsenceDays)} unexplained absence(s)`);
  if (amount(attendance.halfDayDays) > 0) reasons.push(`${amount(attendance.halfDayDays)} half day(s)`);
  if (row.adjustmentCount > 0) reasons.push(`${row.adjustmentCount} adjustment(s)`);
  if (row.joinedMidPeriod) reasons.push('joined during the period');
  if (row.leftMidPeriod) reasons.push('left during the period');
  if (row.salaryRevisionInPeriod) reasons.push('salary revision effective this period');
  return reasons;
}

/**
 * Computes what generation would produce, without writing anything.
 *
 * Returns a row per employee, each carrying the figures, its readiness problems
 * and whether it differs from a clean full month.
 */
function previewPayroll(data, { company, period }) {
  if (!PERIOD_PATTERN.test(String(period || ''))) throw new Error('Payroll period must use YYYY-MM format');
  const { start: startDate, end: endDate } = periodRange(period);
  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);

  const company_ = companyReadiness(data, company, period);
  const settings = company_.settings;

  const employees = (data.employees || []).filter((employee) => (
    employee.companyId === company._id && employee.status !== 'inactive' && employee.role !== 'super_admin'
  ));

  const rows = [];
  for (const employee of employees) {
    const selectedRevision = salaryRevisionForPeriod(data, employee, period);
    const salary = normalizeSalaryStructure(employee, settings, selectedRevision.salary);
    const readiness = employeeReadiness(data, company, employee, settings, salary, start, end, period);

    const existing = (data.payroll || []).find((item) => item.employeeId === employee._id && item.period === period) || null;
    const joining = trimmed(employee.dateOfJoining).slice(0, 10);
    const leaving = trimmed(employee.lastWorkingDate).slice(0, 10);

    const base = {
      employee: {
        _id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department || '',
        designation: employee.designation || '',
        workLocationId: employee.workLocationId || null,
      },
      payrollEnabled: salary.payrollEnabled === true,
      existingStatus: existing ? existing.status : null,
      adjustmentCount: existing ? (existing.adjustments || []).length : 0,
      joinedMidPeriod: Boolean(joining && joining > start && joining <= end),
      leftMidPeriod: Boolean(leaving && leaving >= start && leaving < end),
      salaryRevisionInPeriod: Boolean(
        selectedRevision.revision?.effectiveFrom
        && trimmed(selectedRevision.revision.effectiveFrom).slice(0, 10) > start,
      ),
      blockers: readiness.blockers,
      warnings: readiness.warnings,
    };

    if (!salary.payrollEnabled) {
      // Skipped by generation, so there is nothing to compute. Reported anyway,
      // because "skipped" used to be discovered only after the run.
      //
      // Warnings are dropped here on purpose. Without a salary structure the row
      // never produces a payslip, so "PF applies but no UAN" and the rest are
      // consequences of the one thing that matters, not separate problems. Listing
      // all of them buried the actual blocker in noise.
      rows.push({
        ...base,
        warnings: [],
        skipped: true,
        skipReason: 'Salary structure not configured',
        attendance: null,
        figures: null,
        reasons: ['no salary structure'],
      });
      continue;
    }

    const calculated = calculatePayroll(
      data,
      company,
      employee,
      period,
      settings,
      selectedRevision.salary,
      existing?.adjustments || [],
    );

    const row = {
      ...base,
      skipped: false,
      skipReason: null,
      attendance: calculated.attendanceSummary,
      figures: {
        salaryGross: amount(calculated.salaryGross ?? calculated.gross),
        paidAfterGross: amount(calculated.paidAfterGross),
        totalEarnings: amount(calculated.totalEarnings ?? calculated.gross),
        deductions: amount(calculated.deductions),
        net: amount(calculated.net),
        employerContributions: amount(calculated.employerContributions),
        ctc: amount(calculated.ctc),
      },
    };
    row.reasons = exceptionReasons(row);
    rows.push(row);
  }

  const totals = rows.reduce((sum, row) => {
    if (!row.figures) return sum;
    return {
      salaryGross: amount(sum.salaryGross + row.figures.salaryGross),
      deductions: amount(sum.deductions + row.figures.deductions),
      net: amount(sum.net + row.figures.net),
      ctc: amount(sum.ctc + row.figures.ctc),
    };
  }, { salaryGross: 0, deductions: 0, net: 0, ctc: 0 });

  const exceptions = rows.filter((row) => row.reasons.length > 0 || row.blockers.length > 0);

  // When the money actually moves, rather than the raw configured day number.
  const payment = paymentDateForPeriod(
    workWeekFor(company, settings),
    period,
    settings.paymentDay,
    new Set(normalizeHolidays(company?.holidays || []).map((item) => item.date)),
  );

  return {
    period,
    generatedAt: new Date().toISOString(),
    payment,
    company: { blockers: company_.blockers, warnings: company_.warnings },
    counts: {
      employees: rows.length,
      payable: rows.filter((row) => !row.skipped).length,
      skipped: rows.filter((row) => row.skipped).length,
      blocked: rows.filter((row) => row.blockers.length > 0).length,
      warned: rows.filter((row) => row.warnings.length > 0).length,
      exceptions: exceptions.length,
      clean: rows.length - exceptions.length,
    },
    totals,
    // A run is only ready when nothing at company or employee level blocks it.
    ready: company_.blockers.length === 0 && rows.every((row) => row.blockers.length === 0),
    rows,
  };
}

module.exports = {
  companyReadiness,
  employeeReadiness,
  exceptionReasons,
  previewPayroll,
};
