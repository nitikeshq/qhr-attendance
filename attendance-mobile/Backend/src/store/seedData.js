const { hashSecret } = require('../utils/passwords');
const { generateOneTimePassword } = require('../utils/employeeProfile');
const { addDays, dateKey, nowIso, startOfDayIso } = require('../utils/records');
const { normalizeAttendancePolicy } = require('../utils/attendancePolicy');
const {
  issuePayslip,
  normalizePayrollSettings,
  normalizeSalaryStructure,
  payrollIdentitySnapshots,
} = require('../utils/payroll');

function baseLeaveTypes() {
  return [
    { code: 'casual', name: 'Casual Leave', annualAllowance: 12, color: '#6366F1', paid: true, payrollTreatment: 'paid' },
    { code: 'sick', name: 'Sick Leave', annualAllowance: 10, color: '#10B981', paid: true, payrollTreatment: 'paid' },
    { code: 'earned', name: 'Earned Leave', annualAllowance: 18, color: '#F59E0B', paid: true, payrollTreatment: 'paid' },
    { code: 'unpaid', name: 'Unpaid Leave', annualAllowance: 0, color: '#6B7280', paid: false, payrollTreatment: 'unpaid' },
  ];
}

function makeCompany(overrides) {
  const now = nowIso();
  return {
    _id: overrides._id,
    name: overrides.name,
    code: overrides.code,
    email: overrides.email,
    phone: overrides.phone || '+91 98765 43210',
    domain: overrides.domain || null,
    isVerified: overrides.isVerified ?? true,
    verificationStatus: overrides.isVerified === false ? 'pending' : 'verified',
    status: overrides.status || (overrides.isVerified === false ? 'pending' : 'active'),
    verificationCode: overrides.verificationCode || '000000',
    subscription: {
      plan: 'Professional',
      pricePerUser: 19,
      annualDiscountPercent: 10,
      billingCycle: 'monthly',
      billingMode: 'manual_offline',
      paymentGateway: null,
      status: 'active',
      startedAt: now,
      currentPeriodStart: addDays(new Date(), -20).toISOString(),
      currentPeriodEnd: addDays(new Date(), 10).toISOString(),
      nextRenewalAt: addDays(new Date(), 10).toISOString(),
      graceEndsAt: null,
      pausedAt: null,
      includedSeats: 0,
      paidSeats: 0,
      ...(overrides.subscription || {}),
    },
    branding: {
      primaryColor: '#6366F1',
      secondaryColor: '#8B5CF6',
      logo: null,
      ...(overrides.branding || {}),
    },
    profile: {
      registeredAddress: '401, QHR Business Centre, Andheri East, Mumbai 400069',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400069',
      industry: 'Information Technology',
      ...(overrides.profile || {}),
    },
    // Seeded demo tenants start part-way through onboarding on purpose: the profile,
    // leave, holiday, and attendance defaults exist, while departments, designations,
    // and work locations are left for the onboarding wizard to collect.
    onboarding: {
      startedAt: now,
      completedAt: null,
      completedBy: null,
      skippedSteps: [],
      reviewed: { statutory: Boolean(overrides.payrollSettings) },
      ...(overrides.onboarding || {}),
    },
    settings: {
      timezone: 'Asia/Kolkata',
      officeStart: '09:30',
      officeEnd: '18:30',
      gpsTracking: true,
      autoCheckIn: true,
      leaveApproval: true,
      desktopMonitoring: true,
      requirePhotoAttendance: false,
      ...(overrides.settings || {}),
      attendancePolicy: normalizeAttendancePolicy({ payrollSettings: overrides.payrollSettings || {} }, overrides.settings?.attendancePolicy || {}),
    },
    ...(overrides.payrollSettings ? { payrollSettings: overrides.payrollSettings } : {}),
    attendanceAreas: overrides.attendanceAreas || [
      {
        _id: `${overrides._id}_area_main`,
        name: 'Main Office',
        address: 'QHR Demo Office',
        latitude: 19.076,
        longitude: 72.8777,
        radiusMeters: 150,
      },
    ],
    leaveTypes: overrides.leaveTypes || baseLeaveTypes(),
    holidays: overrides.holidays || [
      { date: '2026-01-26', name: 'Republic Day' },
      { date: '2026-08-15', name: 'Independence Day' },
      { date: '2026-10-02', name: 'Gandhi Jayanti' },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function makeEmployee(overrides) {
  const now = nowIso();
  const firstName = overrides.firstName || 'QHR';
  const lastName = overrides.lastName || 'User';
  return {
    _id: overrides._id,
    companyId: overrides.companyId,
    employeeId: overrides.employeeId,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: overrides.email,
    phone: overrides.phone || '+91 90000 00000',
    role: overrides.role || 'employee',
    department: overrides.department || 'Operations',
    designation: overrides.designation || 'Employee',
    managerId: overrides.managerId || null,
    status: 'active',
    dateOfJoining: overrides.dateOfJoining || '2025-04-01',
    passcodeHash: hashSecret(overrides.passcode || '1234'),
    passwordHash: hashSecret(overrides.password || overrides.passcode || '1234'),
    requiresPasswordChange: Boolean(overrides.requiresPasswordChange),
    lastLoginAt: null,
    ...(overrides.salary ? { salary: overrides.salary } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function makeLeaveBalance(employeeId) {
  return {
    employeeId,
    year: 2026,
    balances: {
      casual: { total: 12, used: 0, remaining: 12 },
      sick: { total: 10, used: 0, remaining: 10 },
      earned: { total: 18, used: 0, remaining: 18 },
      unpaid: { total: 0, used: 0, remaining: 0 },
    },
  };
}

function createSeedData() {
  const today = dateKey();
  const yesterday = dateKey(addDays(new Date(), -1));
  const now = nowIso();

  const companies = [
    makeCompany({
      _id: 'company_qhr',
      name: 'QHR Demo',
      code: 'QHR',
      email: 'admin@qhr.com',
      domain: 'qhr.com',
      phone: '+91 99999 11111',
      subscription: {
        billingMode: 'manual_offline',
        billingContactEmployeeId: 'emp_qhr_company_admin',
        paidSeats: 2,
        customRenewalAmount: 95,
        customTerms: 'Platform-managed offline account; billing does not control access.',
      },
    }),
    makeCompany({
      _id: 'company_testco',
      name: 'Test Company',
      code: 'TESTCO',
      email: 'company@example.com',
      domain: 'testco.example',
      phone: '+91 99999 22222',
      subscription: {
        billingMode: 'automatic',
        paymentGateway: 'cashfree',
        billingContactEmployeeId: 'emp_company_admin',
        paidSeats: 10,
        pricePerUser: 19,
      },
      payrollSettings: {
        currency: 'INR',
        payFrequency: 'monthly',
        workingDayMethod: 'calendar_days',
        workingDays: [1, 2, 3, 4, 5],
        attendanceProration: false,
        approvalMode: 'hr_then_admin',
        publishOnApproval: true,
        paymentDay: 7,
        identity: {
          legalName: 'Test Company Private Limited',
          registeredAddress: '401, QHR Business Centre, Andheri East, Mumbai 400069, Maharashtra, India',
          state: 'Maharashtra',
          pan: 'AAACT0000A',
          tan: 'MUMA00000A',
          gstin: '27AAACT0000A1Z5',
          pfEstablishmentCode: 'MH/BAN/0000000',
          esiEmployerCode: '31000000000000000',
          payslipFooter: 'This is a system-generated payslip and does not require a signature.',
        },
        autoGeneration: { enabled: false, dayOfMonth: 25, period: 'current', submitForApproval: true },
        salaryTemplate: {
          basic: { calculation: 'percentage_of_gross', value: 60, active: true },
          hra: { calculation: 'percentage_of_gross', value: 20, active: true },
          balanceComponentEnabled: false,
          balanceComponentName: 'Special allowance',
        },
        statutory: {
          pfEnabled: true,
          employeePfRate: 12,
          employerPfRate: 12,
          epsRate: 8.33,
          edliRate: 0.5,
          pfWageBasis: 'basic',
          pfCeilingTrigger: 20000,
          pfWageCeiling: 15000,
          restrictPfToCeiling: true,
          esiEnabled: true,
          employeeEsiRate: 0.75,
          employerEsiRate: 3.25,
          esiWageBasis: 'gross',
          esiGrossCeiling: 21000,
          professionalTaxEnabled: true,
          professionalTaxMonthly: 200,
          labourWelfareFundEnabled: false,
          employeeLabourWelfareFund: 0,
          employerLabourWelfareFund: 0,
          tdsEnabled: true,
          tdsMethod: 'employee_monthly_override',
        },
        earnings: [
          { code: 'conveyance', name: 'Conveyance allowance', calculation: 'percentage_of_gross', defaultValue: 20, taxable: true, partOfPfWage: false, partOfEsiWage: true, prorate: true, active: true },
        ],
        deductions: [
          { code: 'meal_recovery', name: 'Meal recovery', calculation: 'fixed', defaultValue: 200, prorate: false, active: true },
        ],
      },
    }),
  ];

  const employees = [
    makeEmployee({
      _id: 'emp_super_admin',
      companyId: 'company_qhr',
      employeeId: 'SUPER001',
      firstName: 'QHR',
      lastName: 'Admin',
      email: 'admin@qhr.com',
      role: 'super_admin',
      department: 'Platform',
      designation: 'Super Admin',
      password: 'admin123',
    }),
    makeEmployee({
      _id: 'emp_qhr_company_admin',
      companyId: 'company_qhr',
      employeeId: 'COMPANY001',
      firstName: 'Company',
      lastName: 'Admin',
      email: 'company-admin@qhr.com',
      role: 'admin',
      department: 'Operations',
      designation: 'Company Admin',
      passcode: 'password123',
      password: 'password123',
    }),
    makeEmployee({
      _id: 'emp_qhr_001',
      companyId: 'company_qhr',
      employeeId: 'EMP001',
      firstName: 'Rahul',
      lastName: 'Sharma',
      email: 'emp001@example.com',
      role: 'employee',
      department: 'Engineering',
      designation: 'Frontend Developer',
      managerId: 'emp_qhr_company_admin',
      passcode: 'emp123',
      password: 'emp123',
    }),
    makeEmployee({
      _id: 'emp_company_admin',
      companyId: 'company_testco',
      employeeId: 'ADMIN001',
      firstName: 'Company',
      lastName: 'Admin',
      email: 'company@example.com',
      role: 'admin',
      department: 'Management',
      designation: 'Company Admin',
      password: 'password123',
    }),
    makeEmployee({
      _id: 'emp_admin_testco',
      companyId: 'company_testco',
      employeeId: 'ADMIN002',
      firstName: 'Asha',
      lastName: 'Admin',
      email: 'admin@testco.com',
      role: 'admin',
      department: 'Management',
      designation: 'Admin',
      password: 'admin123',
    }),
    makeEmployee({
      _id: 'emp_hr_001',
      companyId: 'company_testco',
      employeeId: 'HR001',
      firstName: 'Hari',
      lastName: 'Rao',
      email: 'hr@testco.com',
      role: 'hr',
      department: 'Human Resources',
      designation: 'HR Manager',
      password: 'password123',
    }),
    makeEmployee({
      _id: 'emp_mgr_001',
      companyId: 'company_testco',
      employeeId: 'MGR001',
      firstName: 'Meera',
      lastName: 'Singh',
      email: 'manager@testco.com',
      role: 'manager',
      department: 'Engineering',
      designation: 'Engineering Manager',
      password: 'password123',
    }),
    makeEmployee({
      _id: 'emp_001',
      companyId: 'company_testco',
      employeeId: 'EMP001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'employee@testco.com',
      role: 'employee',
      department: 'Engineering',
      designation: 'Software Engineer',
      managerId: 'emp_mgr_001',
      password: 'password123',
      salary: {
        payrollEnabled: true,
        effectiveFrom: '2025-04-01',
        salaryMode: 'company_template',
        monthlyGrossTarget: 30000,
        coreRuleOverrides: {},
        earningOverrides: [],
        deductionOverrides: [],
        statutoryOverrides: {},
        statutoryPolicyOverrides: {},
        monthlyTds: 500,
        uan: '100000000001',
        pan: 'ABCDE1234F',
        esiNumber: '310000000001',
        bankName: 'Demo Bank',
        bankAccountLast4: '1234',
        bankIfsc: 'DEMO0001234',
        paymentMode: 'bank_transfer',
        annualCtc: 360000,
      },
    }),
  ];

  const demoCompany = companies.find((company) => company._id === 'company_testco');
  const demoEmployee = employees.find((employee) => employee._id === 'emp_001');
  const demoSettings = normalizePayrollSettings(demoCompany);
  const demoSalary = normalizeSalaryStructure(demoEmployee, demoSettings);
  const demoSnapshots = payrollIdentitySnapshots(demoCompany, demoEmployee, demoSalary, demoSettings);
  const demoSalaryRevision = {
    _id: 'salary_revision_seed_emp001_2025_04',
    companyId: demoCompany._id,
    employeeId: demoEmployee._id,
    effectiveFrom: '2025-04-01',
    previousSalary: null,
    salarySnapshot: demoSalary,
    reason: 'Initial salary setup',
    status: 'approved',
    approvedBy: 'emp_company_admin',
    approvedAt: '2025-04-01T04:00:00.000Z',
    createdAt: '2025-04-01T04:00:00.000Z',
    updatedAt: '2025-04-01T04:00:00.000Z',
  };
  const demoPayslip = {
    _id: 'payroll_seed_emp001_2026_06',
    companyId: demoCompany._id,
    employeeId: demoEmployee._id,
    runId: 'payroll_run_seed_testco_2026_06',
    period: '2026-06',
    payrollNumber: 'TESTCO-202606-EMP001',
    ...demoSnapshots,
    salarySnapshot: demoSalary,
    settingsSnapshot: demoSettings,
    salaryRevisionId: demoSalaryRevision._id,
    salaryRevisionEffectiveFrom: demoSalaryRevision.effectiveFrom,
    basic: 18000,
    hra: 6000,
    allowances: 6000,
    gross: 30000,
    salaryGross: 30000,
    paidAfterGross: 2200,
    reimbursementTotal: 2200,
    totalEarnings: 32200,
    deductions: 2700,
    totalDeductions: 2700,
    net: 29500,
    earnings: [
      { code: 'basic', name: 'Basic salary', amount: 18000, source: 'salary', taxable: true, treatment: 'included_in_gross', partOfPfWage: true, partOfEsiWage: true },
      { code: 'hra', name: 'House rent allowance', amount: 6000, source: 'salary', taxable: true, treatment: 'included_in_gross', partOfPfWage: false, partOfEsiWage: true },
      { code: 'conveyance', name: 'Conveyance allowance', amount: 6000, source: 'salary', taxable: true, treatment: 'included_in_gross', partOfPfWage: false, partOfEsiWage: true },
      { code: 'internet_reimbursement', name: 'Approved internet expense reimbursement', amount: 2200, source: 'reimbursement', taxable: false, treatment: 'after_gross', reimbursement: true, partOfPfWage: false, partOfEsiWage: false },
    ],
    employeeDeductions: [
      { code: 'meal_recovery', name: 'Meal recovery', amount: 200, source: 'salary' },
      { code: 'provident_fund', name: 'Employee provident fund', amount: 1800, source: 'statutory' },
      { code: 'professional_tax', name: 'Professional tax', amount: 200, source: 'statutory' },
      { code: 'tds', name: 'Tax deducted at source', amount: 500, source: 'statutory' },
    ],
    employerContributions: [
      { code: 'employer_epf', name: 'Employer EPF', amount: 550.5, source: 'statutory' },
      { code: 'employer_eps', name: 'Employer pension contribution', amount: 1249.5, source: 'statutory' },
      { code: 'edli', name: 'Deposit-linked insurance', amount: 75, source: 'statutory' },
    ],
    statutoryDetails: [
      { code: 'provident_fund', name: 'EPF / EPS / EDLI', enabled: true, applicable: true, employeeAmount: 1800, employerAmount: 1875, reason: '' },
      { code: 'employee_state_insurance', name: 'Employee state insurance', enabled: true, applicable: false, employeeAmount: 0, employerAmount: 0, reason: 'Gross salary is above the ESI wage ceiling' },
      { code: 'professional_tax', name: 'Professional tax', enabled: true, applicable: true, employeeAmount: 200, employerAmount: 0, reason: '' },
      { code: 'labour_welfare_fund', name: 'Labour welfare fund', enabled: false, applicable: false, employeeAmount: 0, employerAmount: 0, reason: 'Disabled by company policy' },
      { code: 'tds', name: 'Tax deducted at source', enabled: true, applicable: true, employeeAmount: 500, employerAmount: 0, reason: '' },
    ],
    employerContributionTotal: 1875,
    ctcForPeriod: 34075,
    attendanceSummary: {
      calendarDays: 30,
      scheduledDays: 30,
      eligibleDays: 30,
      presentDays: 22,
      wfhDays: 2,
      weeklyOffDays: 6,
      paidLeaveDays: 2,
      unpaidLeaveDays: 0,
      lossOfPayDays: 0,
      payableDays: 30,
      prorationApplied: false,
    },
    adjustments: [
      { _id: 'adjustment_seed_internet_reimbursement', type: 'earning', name: 'Approved internet expense reimbursement', amount: 2200, treatment: 'after_gross', reimbursement: true },
    ],
    calculation: {
      salaryGross: 30000,
      paidAfterGross: 2200,
      totalEarnings: 32200,
      employeeDeductions: 2700,
      netPay: 29500,
      employerContributions: 1875,
      companyCost: 34075,
    },
    status: 'paid',
    paymentStatus: 'paid',
    paymentMode: 'bank_transfer',
    paymentReference: 'UTR-DEMO-20260707-001',
    paidAt: '2026-07-07T06:30:00.000Z',
    approvedBy: 'emp_company_admin',
    approvedAt: '2026-07-05T06:30:00.000Z',
    publishedAt: '2026-07-05T06:30:00.000Z',
    generatedAt: '2026-07-01T06:30:00.000Z',
    createdAt: '2026-07-01T06:30:00.000Z',
    updatedAt: '2026-07-07T06:30:00.000Z',
  };
  issuePayslip(demoPayslip, 'emp_company_admin');

  return {
    meta: {
      seededAt: now,
      schemaVersion: 2,
    },
    companies,
    employees,
    leaveBalances: employees.map((employee) => makeLeaveBalance(employee._id)),
    attendances: [
      {
        _id: 'att_yesterday_emp001',
        companyId: 'company_testco',
        employeeId: 'emp_001',
        date: startOfDayIso(yesterday),
        dateKey: yesterday,
        checkIn: {
          time: `${yesterday}T04:05:00.000Z`,
          method: 'geofence',
          location: { latitude: 19.076, longitude: 72.8777, accuracy: 20 },
        },
        checkOut: {
          time: `${yesterday}T13:02:00.000Z`,
          method: 'manual',
          location: { latitude: 19.076, longitude: 72.8777, accuracy: 25 },
        },
        workDuration: 537,
        status: 'present',
        isLate: false,
        lateByMinutes: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
    leaves: [
      {
        _id: 'leave_seed_emp001',
        companyId: 'company_testco',
        employeeId: 'emp_001',
        leaveType: 'casual',
        startDate: '2026-07-20',
        endDate: '2026-07-20',
        days: 1,
        reason: 'Seeded personal leave for approval testing',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      },
    ],
    wfhRequests: [],
    grievances: [],
    reimbursements: [],
    reimbursementAuditLogs: [],
    salaryRevisions: [demoSalaryRevision],
    desktopActivities: [
      {
        _id: 'desktop_today_emp001',
        companyId: 'company_testco',
        employeeId: 'emp_001',
        dateKey: today,
        sessionStart: null,
        sessionEnd: null,
        snapshots: [],
        topApps: [],
        topCategories: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    desktopConsents: [],
    desktopStates: [],
    demoRequests: [],
    contactMessages: [],
    payroll: [demoPayslip],
    payrollRuns: [
      {
        _id: 'payroll_run_seed_testco_2026_06',
        runNumber: 'RUN-2026-06-0001',
        companyId: demoCompany._id,
        period: '2026-06',
        source: 'manual',
        status: 'paid',
        employeeCount: 1,
        createdCount: 1,
        existingCount: 0,
        skippedCount: 0,
        skippedEmployees: [],
        totals: {
          gross: 30000,
          salaryGross: 30000,
          paidAfterGross: 2200,
          totalEarnings: 32200,
          deductions: 2700,
          net: 29500,
          employerContributions: 1875,
          ctc: 34075,
        },
        createdBy: 'emp_company_admin',
        createdAt: '2026-07-01T06:30:00.000Z',
        updatedAt: '2026-07-07T06:30:00.000Z',
      },
    ],
    payrollAuditLogs: [],
    paymentBatches: [],
    projects: [],
    tasks: [],
    subscriptionPlans: [
      { _id: 'plan_free', name: 'Free', code: 'free', pricePerUser: 0, annualDiscountPercent: 0, includedSeats: 1, status: 'active', userLimit: 1, sortOrder: 0, description: 'For evaluating QHR with a single account.', features: ['Geofenced attendance', 'Leave and WFH requests', 'Employee mobile app'] },
    { _id: 'plan_starter', name: 'Starter', code: 'starter', pricePerUser: 19, annualDiscountPercent: 0, includedSeats: 0, status: 'active', userLimit: null, sortOrder: 1, description: 'Attendance and leave for a growing team.', features: ['Everything in Free', 'Multiple work locations', 'Multi-level approvals', 'Payroll inputs'] },
      { _id: 'plan_professional', name: 'Professional', code: 'professional', pricePerUser: 29, annualDiscountPercent: 10, includedSeats: 0, status: 'active', userLimit: null, sortOrder: 2, highlighted: true, description: 'Full payroll, assets, and work management.', features: ['Everything in Starter', 'Payslips and statutory reports', 'Desktop work hours', 'Asset register', 'Priority support'] },
      { _id: 'plan_enterprise', name: 'Enterprise', code: 'enterprise', pricePerUser: null, annualDiscountPercent: 0, includedSeats: 0, status: 'active', userLimit: null, sortOrder: 3, description: 'Negotiated terms and rollout support.', features: ['Everything in Professional', 'Custom integrations', 'Dedicated rollout support', 'SLA planning'] },
    ],
    billingInvoices: [
      {
        _id: 'invoice_qhr_manual_2026_07',
        invoiceNumber: 'QHR-2026-0001',
        companyId: 'company_qhr',
        kind: 'renewal',
        billingCycle: 'monthly',
        seatCount: 2,
        pricePerSeat: 19,
        issueDate: addDays(new Date(), -12).toISOString(),
        dueDate: addDays(new Date(), -2).toISOString(),
        periodStart: addDays(new Date(), -20).toISOString(),
        periodEnd: addDays(new Date(), 10).toISOString(),
        subtotal: 95,
        tax: 0,
        total: 95,
        amountPaid: 40,
        status: 'partially_paid',
        createdAt: addDays(new Date(), -12).toISOString(),
        updatedAt: now,
      },
      {
        _id: 'invoice_testco_2026_07',
        invoiceNumber: 'QHR-2026-0002',
        companyId: 'company_testco',
        kind: 'renewal',
        billingCycle: 'monthly',
        seatCount: 4,
        pricePerSeat: 19,
        issueDate: addDays(new Date(), -20).toISOString(),
        dueDate: addDays(new Date(), -20).toISOString(),
        periodStart: addDays(new Date(), -20).toISOString(),
        periodEnd: addDays(new Date(), 10).toISOString(),
        subtotal: 76,
        tax: 0,
        total: 76,
        amountPaid: 76,
        status: 'paid',
        createdAt: addDays(new Date(), -20).toISOString(),
        updatedAt: now,
      },
    ],
    billingPayments: [
      {
        _id: 'payment_qhr_part_1', companyId: 'company_qhr', invoiceId: 'invoice_qhr_manual_2026_07', amount: 40,
        method: 'bank_transfer', reference: 'UTR-QHR-0001', proofUrl: null, notes: 'Seeded part payment', status: 'cleared',
        submittedBy: 'emp_qhr_company_admin', submittedByName: 'Company Admin', verifiedBy: 'emp_super_admin', verifiedAt: now,
        createdAt: addDays(new Date(), -5).toISOString(), updatedAt: now,
      },
      {
        _id: 'payment_testco_renewal', companyId: 'company_testco', invoiceId: 'invoice_testco_2026_07', amount: 76,
        method: 'cashfree', reference: 'CF-SEED-0001', proofUrl: null, notes: 'Seeded automatic renewal', status: 'cleared',
        submittedBy: 'emp_company_admin', submittedByName: 'Company Admin', verifiedBy: 'gateway_cashfree', verifiedAt: now,
        createdAt: addDays(new Date(), -20).toISOString(), updatedAt: now,
      },
    ],
    billingNotifications: [],
    paymentGateways: [
      { code: 'cashfree', name: 'Cashfree', enabled: true, isDefault: true, mode: 'test' },
      { code: 'payu', name: 'PayU', enabled: true, isDefault: false, mode: 'test' },
    ],
    sessions: [],
    counters: {
      company: 2,
      employee: 6,
      leave: 1,
      wfh: 0,
      grievance: 0,
      attendance: 1,
      desktop: 1,
    },
  };
}

/**
 * A production first boot, with one platform administrator and nothing else.
 *
 * The demo tenants exist so tests and local development have something to work
 * against, but they ship with published passwords. A real deployment must not
 * create them, so an empty data file in production yields only an account whose
 * password comes from the environment and must be changed on first sign-in.
 */
function createBootstrapData() {
  const now = nowIso();
  const password = String(process.env.QHR_BOOTSTRAP_PASSWORD || '').trim() || generateOneTimePassword();
  const generated = !process.env.QHR_BOOTSTRAP_PASSWORD;

  const company = makeCompany({
    _id: 'company_platform',
    name: 'QHR Platform',
    code: 'QHR',
    email: String(process.env.QHR_BOOTSTRAP_EMAIL || 'admin@localhost').trim().toLowerCase(),
    domain: null,
    phone: null,
    attendanceAreas: [],
    holidays: [],
  });
  company.isVerified = true;
  company.verificationStatus = 'verified';
  company.status = 'active';

  const admin = makeEmployee({
    _id: 'emp_platform_admin',
    companyId: company._id,
    employeeId: 'SUPER001',
    firstName: 'Platform',
    lastName: 'Administrator',
    email: company.email,
    role: 'super_admin',
    department: 'Platform',
    designation: 'Super Admin',
    password,
  });
  admin.requiresPasswordChange = true;

  if (generated) {
    // Printed once, on purpose: only the hash is stored, so this is the single
    // opportunity to capture it.
    console.warn([
      '',
      '  QHR first boot: a platform administrator was created.',
      `    email:    ${admin.email}`,
      `    password: ${password}`,
      '  This is shown once. Change it immediately after signing in.',
      '  Set QHR_BOOTSTRAP_EMAIL and QHR_BOOTSTRAP_PASSWORD to choose your own.',
      '',
    ].join('\n'));
  }

  return {
    meta: { seededAt: now, seedKind: 'bootstrap' },
    companies: [company],
    employees: [admin],
    attendances: [],
    leaves: [],
    wfhRequests: [],
    grievances: [],
    reimbursements: [],
    payroll: [],
    payrollRuns: [],
    payrollAuditLogs: [],
    salaryRevisions: [],
    projects: [],
    tasks: [],
    assets: [],
    assetAssignments: [],
    desktopActivity: [],
    desktopStates: [],
    leaveBalances: [],
    notifications: [],
    demoRequests: [],
    contactMessages: [],
    auditLogs: [],
    sessions: [],
    outboundEmails: [],
    invoices: [],
    payments: [],
    billingNotifications: [],
  };
}

/**
 * Chooses what an empty data file becomes. Demo tenants everywhere except a
 * production deployment, which gets the bootstrap account unless demo data is
 * explicitly requested.
 */
function createInitialData() {
  const wantsDemo = String(process.env.QHR_SEED_DEMO || '').toLowerCase() === 'true';
  if (process.env.NODE_ENV === 'production' && !wantsDemo) return createBootstrapData();
  return createSeedData();
}

module.exports = {
  createBootstrapData,
  createInitialData,
  createSeedData,
};
