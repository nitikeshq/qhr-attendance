"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Download,
  Eye,
  FileCheck2,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

export type PayrollLine = {
  code: string;
  name: string;
  amount: number;
  source?: string;
  adjustmentId?: string;
  notes?: string;
  reimbursement?: boolean;
};
export type StatutoryDetail = {
  code: string;
  name: string;
  enabled: boolean;
  applicable: boolean;
  status: string;
  reason?: string;
  employeeAmount: number;
  employerAmount: number;
};
export type PayrollAdjustment = {
  _id: string;
  kind: "earning" | "deduction" | "reimbursement";
  code: string;
  name: string;
  amount: number;
  notes?: string;
  reimbursementClaimId?: string | null;
};
export type PayrollEmployee = {
  _id?: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department?: string;
  designation?: string;
  status?: string;
};
export type PayrollRecord = {
  _id: string;
  period: string;
  payrollNumber?: string;
  basic: number;
  hra?: number;
  allowances?: number;
  gross: number;
  salaryGross?: number;
  paidAfterGross?: number;
  reimbursementTotal?: number;
  totalEarnings?: number;
  deductions: number;
  net: number;
  employerContributionTotal?: number;
  ctcForPeriod?: number;
  status: string;
  paymentStatus?: string;
  paymentReference?: string | null;
  publishedAt?: string | null;
  paidAt?: string | null;
  generatedAt?: string | null;
  issuedAt?: string | null;
  issueVersion?: number;
  documentId?: string;
  contentHash?: string;
  settingsSnapshot?: PayrollSettings | null;
  salarySnapshot?: SalaryStructure | null;
  reopenedAt?: string | null;
  reopenReason?: string | null;
  employee: PayrollEmployee;
  earnings?: PayrollLine[];
  employeeDeductions?: PayrollLine[];
  employerContributions?: PayrollLine[];
  adjustments?: PayrollAdjustment[];
  attendanceSummary?: {
    scheduledDays: number;
    payableDays: number;
    presentDays: number;
    paidLeaveDays: number;
    lossOfPayDays: number;
  };
  statutoryDetails?: StatutoryDetail[];
  legacyDetailWarning?: string;
  statutoryReference?: {
    employeeDeductions: PayrollLine[];
    employerContributions: PayrollLine[];
    statutoryDetails: StatutoryDetail[];
    note: string;
  };
  yearToDate?: {
    taxYear: string;
    gross: number;
    deductions: number;
    net: number;
    tds: number;
  };
};
type PayrollCalculation =
  | "fixed"
  | "percentage_of_basic"
  | "percentage_of_gross"
  | "extra";
type PayrollTreatment = "included_in_gross" | "after_gross";
type SalaryRule = { calculation: PayrollCalculation; value: number; active?: boolean };
export type PayrollDefinition = {
  code: string;
  name: string;
  calculation: PayrollCalculation;
  treatment?: PayrollTreatment;
  defaultValue: number;
  taxable?: boolean;
  partOfPfWage?: boolean;
  partOfEsiWage?: boolean;
  prorate?: boolean;
  active: boolean;
  removable?: boolean;
};
export type PayrollSettings = {
  currency: string;
  payFrequency: string;
  workingDayMethod: "calendar_days" | "working_days" | "fixed_30";
  workingDays: number[];
  attendanceProration: boolean;
  approvalMode: "admin_approval" | "hr_then_admin";
  publishOnApproval: boolean;
  paymentDay: number;
  identity: {
    legalName: string;
    registeredAddress: string;
    state: string;
    pan: string;
    tan: string;
    gstin: string;
    pfEstablishmentCode: string;
    esiEmployerCode: string;
    payslipFooter: string;
  };
  autoGeneration: {
    enabled: boolean;
    dayOfMonth: number;
    period: "current" | "previous";
    submitForApproval: boolean;
  };
  salaryTemplate: {
    basic: SalaryRule;
    hra: SalaryRule;
    balanceComponentEnabled?: boolean;
    balanceComponentName: string;
  };
  statutory: {
    pfEnabled: boolean;
    employeePfRate: number;
    employerPfRate: number;
    epsRate: number;
    edliRate: number;
    pfWageBasis: "basic" | "gross" | "eligible_earnings";
    pfCeilingTrigger: number;
    pfWageCeiling: number;
    restrictPfToCeiling: boolean;
    esiEnabled: boolean;
    employeeEsiRate: number;
    employerEsiRate: number;
    esiWageBasis: "basic" | "gross" | "eligible_earnings";
    esiGrossCeiling: number;
    professionalTaxEnabled: boolean;
    professionalTaxMonthly: number;
    labourWelfareFundEnabled: boolean;
    employeeLabourWelfareFund: number;
    employerLabourWelfareFund: number;
    gratuityEnabled: boolean;
    gratuityRate: number;
    tdsEnabled: boolean;
    tdsMethod: string;
  };
  earnings: PayrollDefinition[];
  deductions: PayrollDefinition[];
  updatedAt?: string | null;
};
export type SalaryStructure = {
  payrollEnabled: boolean;
  effectiveFrom: string;
  salaryMode: "company_template" | "custom_formula";
  monthlyGrossTarget: number;
  coreRules: { basic: SalaryRule; hra: SalaryRule };
  coreRuleOverrides?: Partial<{ basic: SalaryRule; hra: SalaryRule }>;
  balanceComponentEnabled?: boolean;
  balanceComponentName: string;
  basic: number;
  hra: number;
  specialAllowance: number;
  monthlyGross: number;
  annualCtc: number;
  earnings: Array<PayrollDefinition & { value: number }>;
  deductions: Array<PayrollDefinition & { value: number }>;
  earningOverrides?: Array<PayrollDefinition & { value: number }>;
  deductionOverrides?: Array<PayrollDefinition & { value: number }>;
  statutoryOverrides?: Partial<{
    pfApplicable: boolean;
    esiApplicable: boolean;
    professionalTaxApplicable: boolean;
    labourWelfareFundApplicable: boolean;
    gratuityApplicable: boolean;
    professionalTaxMonthly: number;
    labourWelfareFundMonthly: number;
  }>;
  statutoryPolicy?: PayrollSettings["statutory"];
  statutoryPolicyOverrides?: Partial<PayrollSettings["statutory"]>;
  pfApplicable: boolean;
  esiApplicable: boolean;
  professionalTaxApplicable: boolean;
  labourWelfareFundApplicable: boolean;
  gratuityApplicable: boolean;
  professionalTaxMonthly: number;
  labourWelfareFundMonthly: number;
  monthlyTds: number;
  uan: string;
  esiNumber: string;
  pan: string;
  bankName: string;
  bankAccountLast4: string;
  bankIfsc: string;
  paymentMode: string;
  notes: string;
  updatedAt?: string | null;
  preview: {
    earnings: PayrollLine[];
    employeeDeductions: PayrollLine[];
    employerContributions: PayrollLine[];
    statutoryDetails: StatutoryDetail[];
    gross: number;
    salaryGross?: number;
    paidAfterGross?: number;
    reimbursementTotal?: number;
    totalEarnings?: number;
    totalDeductions: number;
    net: number;
    employerContributionTotal: number;
    companyCost: number;
  };
};
export type SalaryStructureRecord = {
  employee: PayrollEmployee;
  structure: SalaryStructure;
};
export type SalaryRevision = {
  _id: string;
  effectiveFrom: string;
  reason: string;
  createdAt: string;
  createdBy?: string | null;
  salarySnapshot: SalaryStructure;
};
export type PayrollRunTotals = {
  gross?: number;
  salaryGross?: number;
  paidAfterGross?: number;
  totalEarnings?: number;
  deductions?: number;
  net?: number;
  employerContributions?: number;
  ctc?: number;
};
export type PayrollRun = {
  _id: string;
  runNumber?: string;
  period: string;
  source?: string;
  status: string;
  employeeCount?: number;
  createdCount?: number;
  existingCount?: number;
  skippedCount?: number;
  skippedEmployees?: Array<{
    employeeId: string;
    name: string;
    reason: string;
  }>;
  /** Absent on historical runs saved before line-level totals existed. */
  totals?: PayrollRunTotals;
  grossTotal?: number;
  paidAfterGrossTotal?: number;
  deductionTotal?: number;
  netTotal?: number;
  employerContributionTotal?: number;
  companyCostTotal?: number;
  createdAt: string;
};

/** Normalizes current and legacy payroll run totals so the register never crashes. */
function runTotals(run: PayrollRun): Required<Pick<PayrollRunTotals, 'salaryGross' | 'paidAfterGross' | 'totalEarnings' | 'deductions' | 'net'>> {
  const totals = run.totals || {};
  const salaryGross = totals.salaryGross ?? totals.gross ?? run.grossTotal ?? 0;
  const paidAfterGross = totals.paidAfterGross ?? run.paidAfterGrossTotal ?? 0;
  return {
    salaryGross,
    paidAfterGross,
    totalEarnings: totals.totalEarnings ?? totals.gross ?? salaryGross + paidAfterGross,
    deductions: totals.deductions ?? run.deductionTotal ?? 0,
    net: totals.net ?? run.netTotal ?? 0,
  };
}
export type PayrollSummary = {
  period: string | null;
  employees: number;
  records: number;
  gross: number;
  salaryGross?: number;
  paidAfterGross?: number;
  totalEarnings?: number;
  deductions: number;
  net: number;
  employerContributions: number;
  ctc: number;
  draft: number;
  pendingApproval: number;
  approved: number;
  paid: number;
};
export type PayrollAuditLog = {
  _id: string;
  action: string;
  actorName: string;
  actorRole: string;
  employee?: PayrollEmployee | null;
  details?: Record<string, unknown>;
  createdAt: string;
};

type Props = {
  apiRoot: string;
  token: string;
  role: "hr" | "admin";
  payroll: PayrollRecord[];
  settings: PayrollSettings | null;
  salaryStructures: SalaryStructureRecord[];
  runs: PayrollRun[];
  summary: PayrollSummary | null;
  auditLogs: PayrollAuditLog[];
  initialSalaryEmployeeId?: string | null;
  onInitialSalaryConsumed?: () => void;
  onChanged: (message: string) => Promise<void>;
};

const fieldClass = "neu-input w-full px-3 py-2.5 font-normal";

type IdentityFieldKey = keyof PayrollSettings["identity"];
type FormulaFieldKey = "basic" | "hra" | "conveyance" | "custom_earning";
type StatutoryEnabledKey =
  | "pfEnabled"
  | "esiEnabled"
  | "professionalTaxEnabled"
  | "labourWelfareFundEnabled"
  | "gratuityEnabled"
  | "tdsEnabled";

const defaultPayslipFooter = "This is a system-generated payslip.";
const identityFieldOptions: Array<{
  key: IdentityFieldKey;
  label: string;
  multiline?: boolean;
  required?: boolean;
}> = [
  { key: "legalName", label: "Legal company name", required: true },
  { key: "registeredAddress", label: "Registered office address", multiline: true, required: true },
  { key: "state", label: "Registered state", required: true },
  { key: "pan", label: "Company PAN (if applicable)" },
  { key: "tan", label: "Company TAN (if TDS applies)" },
  { key: "gstin", label: "GSTIN (if registered)" },
  { key: "pfEstablishmentCode", label: "PF establishment code (if enabled)" },
  { key: "esiEmployerCode", label: "ESI employer code (if enabled)" },
  { key: "payslipFooter", label: "Payslip footer" },
];

const statutoryGroupOptions: Array<{
  code: string;
  label: string;
  enabledKey: StatutoryEnabledKey;
}> = [
  { code: "pf", label: "Provident fund", enabledKey: "pfEnabled" },
  { code: "esi", label: "Employee state insurance", enabledKey: "esiEnabled" },
  { code: "pt", label: "Professional tax", enabledKey: "professionalTaxEnabled" },
  { code: "lwf", label: "Labour welfare fund", enabledKey: "labourWelfareFundEnabled" },
  { code: "gratuity", label: "Gratuity provision", enabledKey: "gratuityEnabled" },
  { code: "tds", label: "Tax deducted at source", enabledKey: "tdsEnabled" },
];

const formulaFieldOptions: Array<{
  key: FormulaFieldKey;
  label: string;
  hint: string;
  defaultRule?: SalaryRule;
  presetCode?: string;
}> = [
  {
    key: "basic",
    label: "Basic salary",
    hint: "Usually percentage of monthly gross.",
    defaultRule: { calculation: "percentage_of_gross", value: 50, active: true },
  },
  {
    key: "hra",
    label: "House rent allowance",
    hint: "Usually percentage of basic salary.",
    defaultRule: { calculation: "percentage_of_basic", value: 40, active: true },
  },
  {
    key: "conveyance",
    label: "Conveyance allowance",
    hint: "Travel or commuting allowance.",
    presetCode: "conveyance",
  },
  {
    key: "custom_earning",
    label: "Custom earning",
    hint: "Create any earning with its own name and formula.",
  },
];

const calculationOptions: Array<{ value: PayrollCalculation; label: string }> = [
  { value: "fixed", label: "Fixed amount" },
  { value: "percentage_of_basic", label: "% of basic salary" },
  { value: "percentage_of_gross", label: "% of monthly gross" },
  { value: "extra", label: "Paid after gross" },
];

const earningPresets: PayrollDefinition[] = [
  { code: "conveyance", name: "Conveyance allowance", calculation: "fixed", defaultValue: 0, taxable: true, partOfPfWage: false, partOfEsiWage: true, prorate: true, active: true, removable: true },
  { code: "special_allowance", name: "Special allowance", calculation: "fixed", defaultValue: 0, taxable: true, partOfPfWage: false, partOfEsiWage: true, prorate: true, active: true, removable: true },
  { code: "medical_allowance", name: "Medical allowance", calculation: "fixed", defaultValue: 0, taxable: true, partOfPfWage: false, partOfEsiWage: true, prorate: true, active: true, removable: true },
  { code: "internet_allowance", name: "Internet allowance", calculation: "fixed", defaultValue: 0, taxable: true, partOfPfWage: false, partOfEsiWage: true, prorate: true, active: true, removable: true },
  { code: "mobile_reimbursement", name: "Mobile reimbursement", calculation: "fixed", treatment: "after_gross", defaultValue: 0, taxable: false, partOfPfWage: false, partOfEsiWage: false, prorate: false, active: true, removable: true },
  { code: "travel_reimbursement", name: "Travel reimbursement", calculation: "fixed", treatment: "after_gross", defaultValue: 0, taxable: false, partOfPfWage: false, partOfEsiWage: false, prorate: false, active: true, removable: true },
];
const deductionPresets: PayrollDefinition[] = [
  { code: "loan_recovery", name: "Loan recovery", calculation: "fixed", defaultValue: 0, prorate: true, active: true, removable: true },
  { code: "advance_recovery", name: "Salary advance recovery", calculation: "fixed", defaultValue: 0, prorate: true, active: true, removable: true },
  { code: "insurance_recovery", name: "Insurance recovery", calculation: "fixed", defaultValue: 0, prorate: false, active: true, removable: true },
  { code: "meal_recovery", name: "Meal recovery", calculation: "fixed", defaultValue: 0, prorate: false, active: true, removable: true },
];

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function labelStatus(value: string) {
  return String(value || "").replaceAll("_", " ");
}

function cleanPayrollSettingsForSave(settings: PayrollSettings): PayrollSettings {
  return {
    ...settings,
    salaryTemplate: {
      ...settings.salaryTemplate,
      balanceComponentEnabled: false,
    },
    earnings: settings.earnings
      .filter((item) => item.active !== false)
      .map((item) => ({ ...item, active: true, removable: item.removable !== false })),
    deductions: settings.deductions
      .filter((item) => item.active !== false)
      .map((item) => ({ ...item, active: true, removable: item.removable !== false })),
  };
}

function uniqueComponentCode(items: PayrollDefinition[], baseCode: string) {
  const used = new Set(items.map((item) => item.code));
  if (!used.has(baseCode)) return baseCode;
  let index = 2;
  while (used.has(`${baseCode}_${index}`)) index += 1;
  return `${baseCode}_${index}`;
}

function identityFieldHasValue(settings: PayrollSettings, key: IdentityFieldKey) {
  const value = String(settings.identity[key] || "").trim();
  if (!value) return false;
  if (key === "payslipFooter" && value === defaultPayslipFooter) return false;
  return true;
}

function salaryRuleActive(rule?: SalaryRule) {
  return rule?.active !== false;
}

function disabledSalaryRule(rule: SalaryRule): SalaryRule {
  return { ...rule, active: false, value: 0 };
}

function statusClass(status: string) {
  const value = status.toLowerCase();
  if (
    ["approved", "paid", "active", "published"].some((item) =>
      value.includes(item),
    )
  )
    return "bg-emerald-100 text-emerald-700";
  if (["draft", "pending"].some((item) => value.includes(item)))
    return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(value)}`}
    >
      {labelStatus(value)}
    </span>
  );
}

async function request<T>(
  apiRoot: string,
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message || `Request failed (${response.status})`);
  return payload.data as T;
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`neu-card rounded-lg p-4 sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

function PaginatedTable({
  headers,
  rows,
  empty = "No records found",
}: {
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const first = (page - 1) * pageSize;
  return (
    <div>
      <div className="-mx-4 overflow-x-auto border-y border-line sm:-mx-5">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap px-3 py-2 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.slice(first, first + pageSize).map((row, rowIndex) => (
                <tr
                  key={first + rowIndex}
                  className="border-t border-line hover:bg-surface-subtle"
                >
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2.5 align-middle first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-3 py-12 text-center text-sm text-ink-soft"
                >
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
          <label className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wide text-ink-muted">Rows</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="neu-input rounded-lg px-2 py-1.5"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
            <span>
              {first + 1}-{Math.min(first + pageSize, rows.length)} of{" "}
              {rows.length}
            </span>
          </label>
          <div className="flex items-center gap-1">
            <button
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
              className="ghost-button p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-24 text-center font-semibold tabular-nums text-ink">
              Page {page} of {pageCount}
            </span>
            <button
              aria-label="Next page"
              disabled={page === pageCount}
              onClick={() => setPage((value) => value + 1)}
              className="ghost-button p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Overlay({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-3 sm:p-6"
    >
      <div
        className={`mx-auto my-2 rounded-lg border border-slate-200 bg-white p-4 shadow-lg sm:p-6 ${wide ? "max-w-5xl" : "max-w-2xl"}`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            aria-label="Close"
            onClick={close}
            className="neu-button rounded-lg p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function PayrollWorkspace({
  apiRoot,
  token,
  role,
  payroll,
  settings,
  salaryStructures,
  runs,
  summary,
  auditLogs,
  initialSalaryEmployeeId,
  onInitialSalaryConsumed,
  onChanged,
}: Props) {
  const [tab, setTab] = useState<
    "register" | "runs" | "structures" | "settings" | "audit"
  >("register");
  const [period, setPeriod] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(
    null,
  );
  const [selectedSalary, setSelectedSalary] =
    useState<SalaryStructureRecord | null>(null);
  const [salaryRevisions, setSalaryRevisions] = useState<SalaryRevision[]>([]);
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({});
  const [draftSettings, setDraftSettings] = useState<PayrollSettings | null>(
    settings,
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const selectedSummary = useMemo(() => {
    const records = payroll.filter((item) => item.period === period);
    if (summary?.period === period) return summary;
    return {
      period,
      employees: new Set(records.map((item) => item.employee.employeeId)).size,
      records: records.length,
      gross: records.reduce((sum, item) => sum + (item.salaryGross ?? item.gross), 0),
      salaryGross: records.reduce((sum, item) => sum + (item.salaryGross ?? item.gross), 0),
      paidAfterGross: records.reduce((sum, item) => sum + (item.paidAfterGross ?? item.reimbursementTotal ?? 0), 0),
      totalEarnings: records.reduce((sum, item) => sum + (item.totalEarnings ?? item.gross), 0),
      deductions: records.reduce((sum, item) => sum + item.deductions, 0),
      net: records.reduce((sum, item) => sum + item.net, 0),
      employerContributions: records.reduce(
        (sum, item) => sum + (item.employerContributionTotal || 0),
        0,
      ),
      ctc: records.reduce(
        (sum, item) => sum + (item.ctcForPeriod || item.totalEarnings || item.gross),
        0,
      ),
      draft: records.filter((item) => item.status === "draft").length,
      pendingApproval: records.filter(
        (item) => item.status === "pending_approval",
      ).length,
      approved: records.filter((item) => item.status === "approved").length,
      paid: records.filter((item) => item.status === "paid").length,
    };
  }, [payroll, period, summary]);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);
  useEffect(() => {
    if (selectedPayslip)
      setSelectedPayslip(
        payroll.find((item) => item._id === selectedPayslip._id) || null,
      );
  }, [payroll, selectedPayslip?._id]);
  useEffect(() => {
    if (!initialSalaryEmployeeId) return;
    const record = salaryStructures.find(
      (item) => item.employee._id === initialSalaryEmployeeId,
    );
    if (!record) return;
    setTab("structures");
    setSelectedSalary(record);
    onInitialSalaryConsumed?.();
  }, [initialSalaryEmployeeId, onInitialSalaryConsumed, salaryStructures]);
  useEffect(() => {
    if (!selectedSalary?.employee._id) {
      setSalaryRevisions([]);
      return;
    }
    let active = true;
    request<{ revisions: SalaryRevision[] }>(
      apiRoot,
      token,
      `/payroll/salary-structures/${selectedSalary.employee._id}/revisions`,
    )
      .then((result) => { if (active) setSalaryRevisions(result.revisions || []); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load salary history"); });
    return () => { active = false; };
  }, [apiRoot, token, selectedSalary?.employee._id]);

  async function perform(
    key: string,
    path: string,
    options: RequestInit,
    fallback: string,
  ) {
    setBusy(key);
    setError("");
    try {
      const result = await request<{ message?: string }>(
        apiRoot,
        token,
        path,
        options,
      );
      await onChanged(result.message || fallback);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      setBusy("");
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(
      "generate",
      "/payroll/generate",
      {
        method: "POST",
        body: JSON.stringify({
          period,
          replaceDrafts: form.get("replaceDrafts") === "on",
          submitForApproval: form.get("submitForApproval") === "on",
        }),
      },
      "Payroll generated",
    );
  }

  async function download(payslip: PayrollRecord) {
    setBusy(`download-${payslip._id}`);
    setError("");
    try {
      const response = await fetch(
        `${apiRoot}/payroll/${payslip._id}/download`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => ({}))).message ||
            "Could not download payslip",
        );
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await response.blob());
      link.download = `payslip-${payslip.employee.employeeId}-${payslip.period}.html`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not download payslip",
      );
    } finally {
      setBusy("");
    }
  }

  async function downloadPaymentAdvice() {
    setBusy("payment-advice");
    setError("");
    try {
      const response = await fetch(`${apiRoot}/payroll/payment-advice?period=${encodeURIComponent(period)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Could not download payment advice");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await response.blob());
      link.download = `payment-advice-${period}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not download payment advice");
    } finally {
      setBusy("");
    }
  }

  async function reconcilePayments() {
    const eligible = payroll.filter((item) => item.period === period && item.status === "approved" && item.paymentStatus !== "paid");
    const payments = eligible.flatMap((item) => {
      const paymentReference = String(paymentReferences[item._id] || "").trim();
      const paidAt = String(paymentDates[item._id] || "").trim();
      return paymentReference ? [{ payrollId: item._id, paymentReference, paidAt }] : [];
    });
    if (!payments.length) {
      setError("Enter at least one bank transaction reference to reconcile.");
      return;
    }
    if (payments.some((item) => !item.paidAt)) {
      setError("Select the company-confirmed paid date for every entered payment.");
      return;
    }
    await perform(
      "reconcile-payments",
      "/payroll/payments/reconcile",
      { method: "POST", body: JSON.stringify({ period, payments }) },
      "Salary payments reconciled",
    );
    setPaymentReferences({});
    setPaymentDates({});
  }

  const tabs = [
    { key: "register" as const, label: "Payroll register" },
    { key: "runs" as const, label: "Payroll runs" },
    { key: "structures" as const, label: "Salary structures" },
    { key: "settings" as const, label: "Company settings" },
    { key: "audit" as const, label: "Audit trail" },
  ];
  const periodPayroll = payroll.filter((item) => item.period === period);
  const draftCount = periodPayroll.filter(
    (item) => item.status === "draft",
  ).length;
  const approvableCount = periodPayroll.filter((item) =>
    ["draft", "pending_approval"].includes(item.status),
  ).length;
  const unpublishedCount = periodPayroll.filter(
    (item) => ["approved", "paid"].includes(item.status) && !item.publishedAt,
  ).length;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === item.key ? "gradient-button" : "neu-button text-slate-600"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "register" && (
        <>
          <Card>
            <div className="mb-4">
              <h2 className="text-lg font-bold">Run payroll</h2>
              <p className="mt-1 text-sm text-slate-500">
                Calculates every active employee with payroll enabled using current company settings, that employee&apos;s salary structure, attendance, leave, WFH, statutory rules, and saved one-time adjustments.
              </p>
            </div>
            <form
              onSubmit={generate}
              className="flex flex-wrap items-end gap-3"
            >
              <label className="min-w-44 flex-1 text-sm font-semibold">
                Payroll month
                <input
                  type="month"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  className={`${fieldClass} mt-1`}
                  required
                />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  name="replaceDrafts"
                  type="checkbox"
                  className="h-4 w-4 accent-primary-600"
                />
                Refresh existing drafts
                <HelpTip text="Recalculate draft and pending records from the latest company and employee settings while preserving one-time adjustments." />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  name="submitForApproval"
                  type="checkbox"
                  className="h-4 w-4 accent-primary-600"
                />
                Submit after generation
              </label>
              <button
                disabled={busy === "generate"}
                className="gradient-button flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 font-semibold"
              >
                {busy === "generate" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Generate payroll
              </button>
            </form>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
            <Metric
              label="Employees"
              value={String(selectedSummary.employees)}
              icon={<Wallet className="h-5 w-5" />}
            />
            <Metric
              label="Salary gross"
              value={money(selectedSummary.salaryGross ?? selectedSummary.gross)}
            />
            <Metric
              label="Paid after gross"
              value={money(selectedSummary.paidAfterGross ?? 0)}
            />
            <Metric
              label="Total earnings"
              value={money(selectedSummary.totalEarnings ?? selectedSummary.gross)}
            />
            <Metric
              label="Deductions"
              value={money(selectedSummary.deductions)}
            />
            <Metric label="Net payroll" value={money(selectedSummary.net)} />
            <Metric label="Company cost" value={money(selectedSummary.ctc)} />
          </div>
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Payroll register</h2>
                <p className="text-sm text-slate-500">
                  {period} · {selectedSummary.draft} draft ·{" "}
                  {selectedSummary.pendingApproval} pending approval ·{" "}
                  {selectedSummary.paid} paid
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {role === "admin" && (
                  <button
                    onClick={() => void downloadPaymentAdvice()}
                    disabled={busy === "payment-advice"}
                    className="neu-button flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                    Payment advice
                  </button>
                )}
                <button
                  onClick={() => exportRegister(periodPayroll)}
                  disabled={!periodPayroll.length}
                  className="neu-button flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                {draftCount > 0 && (
                  <button
                    disabled={busy === "bulk-submit"}
                    onClick={() =>
                      void perform(
                        "bulk-submit",
                        "/payroll/bulk/submit",
                        { method: "POST", body: JSON.stringify({ period }) },
                        "Draft payroll submitted",
                      )
                    }
                    className="neu-button rounded-lg px-3 py-2 text-sm font-semibold"
                  >
                    Submit all ({draftCount})
                  </button>
                )}
                {role === "admin" && approvableCount > 0 && (
                  <button
                    disabled={busy === "bulk-approve"}
                    onClick={() =>
                      void perform(
                        "bulk-approve",
                        "/payroll/bulk/approve",
                        { method: "POST", body: JSON.stringify({ period }) },
                        "Payroll approved",
                      )
                    }
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Approve all ({approvableCount})
                  </button>
                )}
                {role === "admin" && unpublishedCount > 0 && (
                  <button
                    disabled={busy === "bulk-publish"}
                    onClick={() =>
                      void perform(
                        "bulk-publish",
                        "/payroll/bulk/publish",
                        { method: "POST", body: JSON.stringify({ period }) },
                        "Payslips published",
                      )
                    }
                    className="gradient-button rounded-lg px-3 py-2 text-sm font-semibold"
                  >
                    Publish all ({unpublishedCount})
                  </button>
                )}
              </div>
            </div>
            <PaginatedTable
              headers={[
                "Employee",
                "Period",
                "Salary gross",
                "Paid after gross",
                "Total earnings",
                "Deductions",
                "Net pay",
                "Status",
                "Actions",
              ]}
              rows={periodPayroll.map((item) => [
                <div key="employee">
                  <p className="font-semibold">
                    {item.employee.firstName} {item.employee.lastName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.employee.employeeId} · {item.employee.department}
                  </p>
                </div>,
                item.period,
                money(item.salaryGross ?? item.gross),
                money(item.paidAfterGross ?? item.reimbursementTotal ?? 0),
                money(item.totalEarnings ?? item.gross),
                money(item.deductions),
                <strong key="net">{money(item.net)}</strong>,
                <Status key="status" value={item.status} />,
                <div key="actions" className="flex flex-wrap gap-2">
                  <button
                    title="View payslip"
                    onClick={() => setSelectedPayslip(item)}
                    className="neu-button rounded-lg p-2"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {["draft", "pending_approval"].includes(item.status) && (
                    <button
                      onClick={() => setSelectedPayslip(item)}
                      className="neu-button flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold"
                    >
                      <Plus className="h-4 w-4" />
                      Adjust
                    </button>
                  )}
                  {item.status === "draft" && (
                    <button
                      onClick={() =>
                        void perform(
                          `submit-${item._id}`,
                          `/payroll/${item._id}/submit`,
                          { method: "POST" },
                          "Payroll submitted",
                        )
                      }
                      className="neu-button rounded-lg px-2.5 py-2 text-xs font-semibold"
                    >
                      Submit
                    </button>
                  )}
                  {role === "admin" &&
                    ["draft", "pending_approval"].includes(item.status) && (
                      <button
                        onClick={() =>
                          void perform(
                            `approve-${item._id}`,
                            `/payroll/${item._id}/approve`,
                            { method: "PATCH" },
                            "Payroll approved",
                          )
                        }
                        className="rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-semibold text-white"
                      >
                        Approve
                      </button>
                    )}
                  {["approved", "paid"].includes(item.status) && (
                    <button
                      title="Download payslip"
                      onClick={() => void download(item)}
                      className="neu-button rounded-lg p-2"
                    >
                      {busy === `download-${item._id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>,
              ])}
              empty="Generate payroll for this period to begin."
            />
            {role === "admin" && periodPayroll.some((item) => item.status === "approved" && item.paymentStatus !== "paid") && (
              <details className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer font-bold">Bank payment reconciliation</summary>
                <p className="mt-2 text-xs text-slate-500">Enter each bank UTR/reference after the transfer clears. Only rows with a reference are submitted; successful rows are locked as paid.</p>
                <div className="mt-3 space-y-2">
                  {periodPayroll.filter((item) => item.status === "approved" && item.paymentStatus !== "paid").map((item) => (
                    <label key={item._id} className="grid items-center gap-2 rounded-lg border border-slate-200 bg-white/50 p-3 text-sm sm:grid-cols-[minmax(180px,1fr)_minmax(190px,1fr)_150px]">
                      <span><strong>{item.employee.firstName} {item.employee.lastName}</strong><small className="block text-slate-500">{item.employee.employeeId} · {money(item.net)}</small></span>
                      <input
                        value={paymentReferences[item._id] || ""}
                        onChange={(event) => setPaymentReferences((current) => ({ ...current, [item._id]: event.target.value }))}
                        placeholder="Bank UTR / transaction reference"
                        className={fieldClass}
                      />
                      <label className="text-xs font-semibold text-slate-600">Paid date
                        <input
                          type="date"
                          value={paymentDates[item._id] || ""}
                          onChange={(event) => setPaymentDates((current) => ({ ...current, [item._id]: event.target.value }))}
                          className={`${fieldClass} mt-1`}
                        />
                      </label>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy === "reconcile-payments"}
                  onClick={() => void reconcilePayments()}
                  className="mt-3 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === "reconcile-payments" ? "Reconciling..." : "Reconcile entered payments"}
                </button>
              </details>
            )}
          </Card>
        </>
      )}

      {tab === "runs" && (
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-bold">Payroll runs</h2>
            <p className="text-sm text-slate-500">
              Duplicate-safe generation history and totals
            </p>
          </div>
          <PaginatedTable
            headers={[
              "Run",
              "Period",
              "Source",
              "Employees",
              "Skipped",
              "Salary gross",
              "After gross",
              "Total earnings",
              "Net",
              "Status",
              "Created",
            ]}
            rows={runs.map((run) => {
              const totals = runTotals(run);
              return [
                <strong key="run">{run.runNumber || run._id}</strong>,
                run.period,
                labelStatus(run.source || "manual"),
                `${run.employeeCount ?? 0} (${run.createdCount ?? 0} new)`,
                <span
                  key="skipped"
                  title={run.skippedEmployees
                    ?.map((item) => `${item.employeeId}: ${item.reason}`)
                    .join("\n")}
                >
                  {run.skippedCount || 0}
                </span>,
                money(totals.salaryGross),
                money(totals.paidAfterGross),
                money(totals.totalEarnings),
                money(totals.net),
                <Status key="status" value={run.status} />,
                new Date(run.createdAt).toLocaleString("en-IN"),
              ];
            })}
            empty="No payroll runs have been generated."
          />
        </Card>
      )}

      {tab === "structures" && (
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-bold">Employee salary structures</h2>
            <p className="text-sm text-slate-500">
              Effective salary, statutory applicability, tax input, and payment
              details
            </p>
          </div>
          <PaginatedTable
            headers={[
              "Employee",
              "Effective from",
              "Monthly gross",
              "Annual CTC",
              "PF / ESI",
              "Setup",
              "Action",
            ]}
            rows={salaryStructures.map((item) => [
              <div key="employee">
                <p className="font-semibold">
                  {item.employee.firstName} {item.employee.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {item.employee.employeeId} · {item.employee.designation}
                </p>
              </div>,
              String(item.structure.effectiveFrom).slice(0, 10),
              money(item.structure.monthlyGross),
              money(item.structure.annualCtc),
              `${item.structure.pfApplicable ? "PF" : "-"} / ${item.structure.esiApplicable ? "ESI" : "-"}`,
              <Status
                key="setup"
                value={item.structure.updatedAt ? "configured" : "default"}
              />,
              <button
                key="edit"
                onClick={() => setSelectedSalary(item)}
                className="neu-button rounded-lg px-3 py-2 text-xs font-semibold"
              >
                Configure
              </button>,
            ])}
            empty="No active employees are available for payroll."
          />
        </Card>
      )}

      {tab === "settings" && draftSettings && (
        <PayrollSettingsForm
          settings={draftSettings}
          setSettings={setDraftSettings}
          readOnly={role !== "admin"}
          busy={busy === "settings"}
          save={async () => {
            const identity = draftSettings.identity;
            if (![identity.legalName, identity.registeredAddress, identity.state].every((value) => String(value || "").trim())) {
              setError("Legal company name, registered office address, and registered state are required for professional payslips.");
              return;
            }
            setBusy("settings");
            setError("");
            try {
              const result = await request<{ message: string }>(
                apiRoot,
                token,
                "/payroll/settings",
                {
                  method: "PATCH",
                  body: JSON.stringify(cleanPayrollSettingsForSave(draftSettings)),
                },
              );
              await onChanged(result.message);
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Could not save payroll settings",
              );
            } finally {
              setBusy("");
            }
          }}
        />
      )}

      {tab === "audit" && (
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-bold">Payroll audit trail</h2>
            <p className="text-sm text-slate-500">
              Policy, salary, run, adjustment, approval, publishing, and payment
              events
            </p>
          </div>
          <PaginatedTable
            headers={["Time", "Action", "Actor", "Employee", "Role"]}
            rows={auditLogs.map((item) => [
              new Date(item.createdAt).toLocaleString("en-IN"),
              labelStatus(item.action.replace("payroll.", "")),
              item.actorName,
              item.employee
                ? `${item.employee.firstName} ${item.employee.lastName} (${item.employee.employeeId})`
                : "-",
              labelStatus(item.actorRole),
            ])}
            empty="No payroll changes have been recorded."
          />
        </Card>
      )}

      {selectedPayslip && (
        <PayslipModal
          payslip={selectedPayslip}
          currentSettings={settings}
          role={role}
          busy={busy}
          close={() => setSelectedPayslip(null)}
          perform={perform}
          download={download}
        />
      )}
      {selectedSalary && draftSettings && (
        <SalaryModal
          record={selectedSalary}
          revisions={salaryRevisions}
          settings={draftSettings}
          busy={busy === "salary"}
          close={() => setSelectedSalary(null)}
          save={async (values) => {
            setBusy("salary");
            setError("");
            try {
              const result = await request<{ message: string }>(
                apiRoot,
                token,
                `/payroll/salary-structures/${selectedSalary.employee._id}`,
                { method: "PUT", body: JSON.stringify(values) },
              );
              setSelectedSalary(null);
              await onChanged(result.message);
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Could not save salary structure",
              );
            } finally {
              setBusy("");
            }
          }}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="neu-card rounded-lg px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          {label}
        </p>
        {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
      </div>
      <p className="mt-1.5 truncate text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}

function exportRegister(records: PayrollRecord[]) {
  if (!records.length) return;
  const rows = records.map((item) => [
    item.employee.employeeId,
    `${item.employee.firstName} ${item.employee.lastName}`,
    item.period,
    item.salaryGross ?? item.gross,
    item.paidAfterGross ?? item.reimbursementTotal ?? 0,
    item.totalEarnings ?? item.gross,
    item.deductions,
    item.net,
    item.employerContributionTotal || 0,
    item.status,
  ]);
  const csv = [
    [
      "Employee ID",
      "Employee",
      "Period",
      "Salary gross",
      "Paid after gross",
      "Total earnings",
      "Deductions",
      "Net",
      "Employer contributions",
      "Status",
    ],
    ...rows,
  ]
    .map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `payroll-register-${records[0].period}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function PayslipModal({
  payslip,
  currentSettings,
  role,
  busy,
  close,
  perform,
  download,
}: {
  payslip: PayrollRecord;
  currentSettings: PayrollSettings | null;
  role: "hr" | "admin";
  busy: string;
  close: () => void;
  perform: (
    key: string,
    path: string,
    options: RequestInit,
    fallback: string,
  ) => Promise<void>;
  download: (payslip: PayrollRecord) => Promise<void>;
}) {
  const earnings: PayrollLine[] = payslip.earnings?.length
    ? payslip.earnings
    : [
        { code: "basic", name: "Basic salary", amount: payslip.basic },
        { code: "hra", name: "House rent allowance", amount: payslip.hra || 0 },
        {
          code: "legacy_allowances",
          name: "Legacy allowances",
          amount: payslip.allowances || 0,
        },
      ].filter((item) => item.amount);
  const deductions = payslip.employeeDeductions?.length
    ? payslip.employeeDeductions
    : [
        {
          code: "legacy_deductions",
          name: "Legacy deductions (detail unavailable)",
          amount: payslip.deductions,
        },
      ];
  const reimbursementLines = earnings.filter((item) => item.reimbursement);
  const salaryEarnings = earnings.filter((item) => !item.reimbursement);
  const statutoryDetails = payslip.statutoryDetails || [];
  const editable = ["draft", "pending_approval"].includes(payslip.status);
  const settingsChanged = Boolean(
    payslip.settingsSnapshot?.updatedAt &&
      currentSettings?.updatedAt &&
      payslip.settingsSnapshot.updatedAt !== currentSettings.updatedAt,
  );
  const calculationDate = payslip.generatedAt
    ? new Date(payslip.generatedAt).toLocaleString("en-IN")
    : "the original payroll run";
  async function adjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform(
      "adjustment",
      `/payroll/${payslip._id}/adjustments`,
      { method: "POST", body: JSON.stringify(Object.fromEntries(form)) },
      "Adjustment added",
    );
  }
  async function markPaid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(
      "mark-paid",
      `/payroll/${payslip._id}/mark-paid`,
      {
        method: "POST",
        body: JSON.stringify(
          Object.fromEntries(new FormData(event.currentTarget)),
        ),
      },
      "Payroll marked paid",
    );
  }
  async function recalculate(reason = "") {
    await perform(
      "recalculate",
      `/payroll/${payslip._id}/recalculate`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
      "Payroll recalculated",
    );
  }
  return (
    <Overlay
      title={`${payslip.employee.firstName} ${payslip.employee.lastName} - ${payslip.period}`}
      close={close}
      wide
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info
          label="Payslip number"
          value={payslip.payrollNumber || payslip._id}
        />
        <Info label="Document ID" value={payslip.documentId || "Created on approval"} />
        <Info label="Status" value={labelStatus(payslip.status)} />
        <Info
          label="Payable days"
          value={`${payslip.attendanceSummary?.payableDays ?? "-"} / ${payslip.attendanceSummary?.scheduledDays ?? "-"}`}
        />
        <Info label="Salary gross" value={money(payslip.salaryGross ?? payslip.gross)} />
        <Info label="Paid after gross" value={money(payslip.paidAfterGross ?? payslip.reimbursementTotal ?? 0)} />
        <Info label="Total earnings" value={money(payslip.totalEarnings ?? payslip.gross)} />
        <Info label="Total deductions" value={money(payslip.deductions)} />
        <Info label="Net pay" value={money(payslip.net)} />
      </div>
      {payslip.settingsSnapshot && (
        <div
          className={`mb-5 rounded-lg border px-4 py-3 text-sm ${settingsChanged ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50/60 text-emerald-800"}`}
        >
          <p className="font-semibold">
            {settingsChanged
              ? "Company payroll settings changed after this calculation."
              : "Connected to company payroll settings."}
          </p>
          <p className="mt-1 text-xs leading-5">
            Calculated on {calculationDate} using a snapshot of company settings, this employee&apos;s salary structure, attendance, leave, and applicable statutory rules.
            {settingsChanged && editable
              ? " Recalculate this record to apply the latest settings."
              : " The saved snapshot protects approved payroll from later configuration changes."}
          </p>
        </div>
      )}
      {payslip.legacyDetailWarning && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Historical payroll record</p>
          <p className="mt-1 leading-5">{payslip.legacyDetailWarning}</p>
          <p className="mt-2 text-xs">Reopen and recalculate it to replace reconstructed lines with a fresh calculation from current company and employee settings.</p>
        </div>
      )}
      <div className={`grid gap-5 ${reimbursementLines.length ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <LineTable
          title="Salary earnings"
          lines={salaryEarnings}
          totalLabel="Gross salary"
          total={payslip.salaryGross ?? salaryEarnings.reduce((sum, item) => sum + item.amount, 0)}
        />
        {reimbursementLines.length > 0 && <LineTable title="Reimbursements paid after gross" lines={reimbursementLines} totalLabel="Reimbursement total" total={payslip.reimbursementTotal ?? reimbursementLines.reduce((sum, item) => sum + item.amount, 0)} />}
        <LineTable
          title="Employee deductions"
          lines={deductions}
          totalLabel="Total deductions"
          total={payslip.deductions}
        />
      </div>
      {Boolean(payslip.employerContributions?.length) && (
        <div className="mt-5">
          <LineTable
            title="Employer contributions"
            lines={payslip.employerContributions || []}
            totalLabel="Employer total"
            total={payslip.employerContributionTotal || 0}
          />
        </div>
      )}
      {statutoryDetails.length > 0 && (
        <StatutorySummary details={statutoryDetails} />
      )}
      {payslip.statutoryReference && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <h3 className="font-bold">Current statutory setup reference</h3>
          <p className="mt-1 text-sm text-slate-600">
            {payslip.statutoryReference.note}
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <LineTable
              title="Current employee deductions"
              lines={payslip.statutoryReference.employeeDeductions}
              totalLabel="Reference total"
              total={payslip.statutoryReference.employeeDeductions.reduce(
                (sum, item) => sum + item.amount,
                0,
              )}
            />
            <LineTable
              title="Current employer provisions"
              lines={payslip.statutoryReference.employerContributions}
              totalLabel="Reference total"
              total={payslip.statutoryReference.employerContributions.reduce(
                (sum, item) => sum + item.amount,
                0,
              )}
            />
          </div>
        </div>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info
          label="Present days"
          value={String(payslip.attendanceSummary?.presentDays ?? "-")}
        />
        <Info
          label="Paid leave"
          value={String(payslip.attendanceSummary?.paidLeaveDays ?? "-")}
        />
        <Info
          label="Loss of pay"
          value={String(payslip.attendanceSummary?.lossOfPayDays ?? "-")}
        />
        <Info
          label={`YTD net ${payslip.yearToDate?.taxYear || ""}`}
          value={money(payslip.yearToDate?.net || 0)}
        />
      </div>
      {editable && (
        <form
          onSubmit={adjustment}
          className="mt-5 grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="sm:col-span-2 lg:col-span-5">
            <h3 className="font-bold">One-time payroll adjustment</h3>
            <p className="mt-1 text-xs text-slate-500">
              Add an earning, reimbursement, or deduction only for this employee and this payroll month. It does not change the company formula or employee salary structure.
            </p>
          </div>
          <label className="text-sm font-semibold">
            Adjustment type
            <select name="kind" className={`${fieldClass} mt-1`}>
              <option value="earning">One-time earning</option>
              <option value="deduction">One-time deduction</option>
              <option value="reimbursement">Paid after gross / reimbursement</option>
            </select>
          </label>
          <label className="text-sm font-semibold lg:col-span-2">
            Name
            <input name="name" required className={`${fieldClass} mt-1`} />
          </label>
          <label className="text-sm font-semibold">
            Amount
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              className={`${fieldClass} mt-1`}
            />
          </label>
          <button
            disabled={busy === "adjustment"}
            className="gradient-button self-end rounded-lg px-3 py-2.5 text-sm font-semibold"
          >
            Apply adjustment
          </button>
          <label className="text-sm font-semibold sm:col-span-2 lg:col-span-5">
            Notes
            <input name="notes" className={`${fieldClass} mt-1`} />
          </label>
        </form>
      )}
      {Boolean(payslip.adjustments?.length) && (
        <div className="mt-4 space-y-2 rounded-lg border border-slate-200 p-4">
          <h3 className="font-bold">One-time adjustments applied</h3>
          {payslip.adjustments?.map((item) => (
            <div
              key={item._id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <span>
                <strong>{item.name}</strong> - {item.kind === "deduction"
                  ? "Deduction"
                  : item.kind === "reimbursement"
                    ? "Paid after gross"
                    : "Earning"} - {money(item.amount)}
                {item.notes && <small className="ml-2 text-slate-500">{item.notes}</small>}
              </span>
              {editable && (
                <button
                  title="Remove adjustment"
                  onClick={() =>
                    void perform(
                      `remove-${item._id}`,
                      `/payroll/${payslip._id}/adjustments/${item._id}`,
                      { method: "DELETE" },
                      "Adjustment removed",
                    )
                  }
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => void download(payslip)}
          className="neu-button flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
        >
          <Download className="h-4 w-4" />
          Download payslip
        </button>
        {editable && (
          <button
            type="button"
            disabled={busy === "recalculate"}
            onClick={() => void recalculate()}
            className="neu-button flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
          >
            {busy === "recalculate" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Recalculate from current settings
          </button>
        )}
        {payslip.status === "draft" && (
          <button
            onClick={() =>
              void perform(
                "submit",
                `/payroll/${payslip._id}/submit`,
                { method: "POST" },
                "Payroll submitted",
              )
            }
            className="neu-button rounded-lg px-3 py-2 text-sm font-semibold"
          >
            Submit
          </button>
        )}
        {role === "admin" &&
          ["draft", "pending_approval"].includes(payslip.status) && (
            <button
              onClick={() =>
                void perform(
                  "approve",
                  `/payroll/${payslip._id}/approve`,
                  { method: "PATCH" },
                  "Payroll approved",
                )
              }
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Approve and publish
            </button>
          )}
        {role === "admin" &&
          payslip.status === "approved" &&
          !payslip.publishedAt && (
            <button
              onClick={() =>
                void perform(
                  "publish",
                  `/payroll/${payslip._id}/publish`,
                  { method: "POST" },
                  "Payslip published",
                )
              }
              className="gradient-button rounded-lg px-3 py-2 text-sm font-semibold"
            >
              Publish
            </button>
          )}
      </div>
      {role === "admin" && payslip.status === "approved" && (
        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900">
          <p className="font-bold">Issued payslip is locked</p>
          <p className="mt-1 text-xs leading-5">Approved payroll is an immutable employee document. Enter corrections as arrears, recoveries, or other adjustments in the next payroll period so the audit trail remains intact.</p>
        </div>
      )}
      {role === "admin" && payslip.status === "approved" && (
        <form
          onSubmit={markPaid}
          className="mt-5 grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 sm:grid-cols-4"
        >
          <label className="text-sm font-semibold">
            Payment mode
            <select name="paymentMode" className={`${fieldClass} mt-1`}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Transaction reference
            <input name="paymentReference" required className={`${fieldClass} mt-1`} />
          </label>
          <label className="text-sm font-semibold">
            Paid date
            <input name="paidAt" type="date" required className={`${fieldClass} mt-1`} />
          </label>
          <button
            disabled={busy === "mark-paid"}
            className="self-end rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white"
          >
            Mark paid
          </button>
        </form>
      )}
    </Overlay>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/40 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold capitalize">{value}</p>
    </div>
  );
}
function LineTable({
  title,
  lines,
  totalLabel,
  total,
}: {
  title: string;
  lines: PayrollLine[];
  totalLabel: string;
  total: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-3 space-y-2">
        {lines.map((line, index) => (
          <div
            key={`${line.code}-${index}`}
            className="flex justify-between gap-4 text-sm"
          >
            <span className="text-slate-600">
              {line.name}
              {line.reimbursement && (
                <small className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                  Paid after gross
                </small>
              )}
            </span>
            <span className="font-semibold">{money(line.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 font-bold">
          <span>{totalLabel}</span>
          <span>{money(total)}</span>
        </div>
      </div>
    </div>
  );
}

function StatutorySummary({ details }: { details: StatutoryDetail[] }) {
  return (
    <div className="mt-5 rounded-lg border border-slate-200 p-4">
      <h3 className="font-bold">Statutory applicability</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {details.map((item) => (
          <div key={item.code} className="rounded-lg bg-white/40 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold">{item.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.applicable ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
              >
                {!item.enabled
                  ? "Not enabled"
                  : item.applicable
                    ? "Applied"
                    : "Not applicable"}
              </span>
            </div>
            {item.reason && (
              <p className="mt-1 text-xs text-slate-500">{item.reason}</p>
            )}
            {(item.employeeAmount > 0 || item.employerAmount > 0) && (
              <p className="mt-2 text-xs text-slate-600">
                Employee: {money(item.employeeAmount)} | Employer:{" "}
                {money(item.employerAmount)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type EditableSalaryComponent = PayrollDefinition & { value: number };
type EmployeeStatutoryValues = {
  pfApplicable: boolean;
  esiApplicable: boolean;
  professionalTaxApplicable: boolean;
  labourWelfareFundApplicable: boolean;
  gratuityApplicable: boolean;
  professionalTaxMonthly: number;
  labourWelfareFundMonthly: number;
  monthlyTds: number;
};
type StatutoryPolicyKey =
  | "employeePfRate"
  | "employerPfRate"
  | "epsRate"
  | "edliRate"
  | "pfWageBasis"
  | "pfCeilingTrigger"
  | "pfWageCeiling"
  | "restrictPfToCeiling"
  | "employeeEsiRate"
  | "employerEsiRate"
  | "esiWageBasis"
  | "esiGrossCeiling"
  | "gratuityRate";
type EmployeeStatutoryPolicy = Pick<
  PayrollSettings["statutory"],
  StatutoryPolicyKey
>;
const statutoryPolicyKeys: StatutoryPolicyKey[] = [
  "employeePfRate",
  "employerPfRate",
  "epsRate",
  "edliRate",
  "pfWageBasis",
  "pfCeilingTrigger",
  "pfWageCeiling",
  "restrictPfToCeiling",
  "employeeEsiRate",
  "employerEsiRate",
  "esiWageBasis",
  "esiGrossCeiling",
  "gratuityRate",
];
type SalaryEditorPreview = SalaryStructure["preview"] & {
  basic: number;
  hra: number;
  specialAllowance: number;
  warning: string;
};

function rounded(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
function isAfterGrossComponent(item: Pick<PayrollDefinition, "calculation" | "treatment">) {
  return item.treatment === "after_gross" || item.calculation === "extra";
}
function componentAmount(
  calculation: PayrollCalculation,
  value: number,
  basic: number,
  gross: number,
) {
  if (calculation === "percentage_of_basic")
    return rounded((basic * value) / 100);
  if (calculation === "percentage_of_gross")
    return rounded((gross * value) / 100);
  return rounded(value);
}

function companyComponentValue(definition: PayrollDefinition): EditableSalaryComponent {
  return { ...definition, value: definition.defaultValue };
}

function componentUsesCompanyDefault(
  item: EditableSalaryComponent,
  definition: PayrollDefinition,
) {
  const companyItem = companyComponentValue(definition);
  const fields: Array<keyof EditableSalaryComponent> = [
    "code",
    "name",
    "calculation",
    "treatment",
    "value",
    "taxable",
    "partOfPfWage",
    "partOfEsiWage",
    "prorate",
    "active",
  ];
  return fields.every((field) => item[field] === companyItem[field]);
}

function buildEmployeeComponentOverrides(
  items: EditableSalaryComponent[],
  companyItems: PayrollDefinition[],
) {
  return items.flatMap((item) => {
    const companyItem = companyItems.find((entry) => entry.code === item.code);
    if (!companyItem) return item.active === false ? [] : [item];
    return componentUsesCompanyDefault(item, companyItem) ? [] : [item];
  });
}

function salaryRuleUsesCompanyDefault(rule: SalaryRule, companyRule: SalaryRule) {
  return (
    rule.calculation === companyRule.calculation &&
    rule.value === companyRule.value &&
    salaryRuleActive(rule) === salaryRuleActive(companyRule)
  );
}

function buildCoreRuleOverrides(
  rules: { basic: SalaryRule; hra: SalaryRule },
  settings: PayrollSettings,
) {
  return Object.fromEntries(
    (["basic", "hra"] as const)
      .filter(
        (key) =>
          !salaryRuleUsesCompanyDefault(rules[key], settings.salaryTemplate[key]),
      )
      .map((key) => [key, rules[key]]),
  ) as Partial<{ basic: SalaryRule; hra: SalaryRule }>;
}

function companyStatutoryValues(settings: PayrollSettings) {
  return {
    pfApplicable: settings.statutory.pfEnabled,
    esiApplicable: settings.statutory.esiEnabled,
    professionalTaxApplicable: settings.statutory.professionalTaxEnabled,
    labourWelfareFundApplicable: settings.statutory.labourWelfareFundEnabled,
    gratuityApplicable: settings.statutory.gratuityEnabled,
    professionalTaxMonthly: settings.statutory.professionalTaxMonthly,
    labourWelfareFundMonthly: settings.statutory.employeeLabourWelfareFund,
  };
}

function buildStatutoryOverrides(
  values: EmployeeStatutoryValues,
  settings: PayrollSettings,
) {
  const defaults = companyStatutoryValues(settings);
  return Object.fromEntries(
    Object.entries(defaults).filter(
      ([key, value]) => values[key as keyof typeof defaults] !== value,
    ),
  );
}

function companyStatutoryPolicy(
  settings: PayrollSettings,
): EmployeeStatutoryPolicy {
  return Object.fromEntries(
    statutoryPolicyKeys.map((key) => [key, settings.statutory[key]]),
  ) as EmployeeStatutoryPolicy;
}

function effectiveEmployeeStatutoryPolicy(
  settings: PayrollSettings,
  saved?: PayrollSettings["statutory"],
) {
  const defaults = companyStatutoryPolicy(settings);
  return Object.fromEntries(
    statutoryPolicyKeys.map((key) => [
      key,
      saved?.[key] ?? defaults[key],
    ]),
  ) as EmployeeStatutoryPolicy;
}

function buildStatutoryPolicyOverrides(
  policy: EmployeeStatutoryPolicy,
  settings: PayrollSettings,
) {
  return Object.fromEntries(
    statutoryPolicyKeys
      .filter((key) => policy[key] !== settings.statutory[key])
      .map((key) => [key, policy[key]]),
  ) as Partial<EmployeeStatutoryPolicy>;
}
function editorLine(
  code: string,
  name: string,
  amount: number,
  extra: Partial<PayrollLine> = {},
): PayrollLine {
  return { code, name, amount: rounded(amount), ...extra };
}

function buildSalaryEditorPreview(
  settings: PayrollSettings,
  grossTarget: number,
  rules: { basic: SalaryRule; hra: SalaryRule },
  earnings: EditableSalaryComponent[],
  deductions: EditableSalaryComponent[],
  flags: {
    pfApplicable: boolean;
    esiApplicable: boolean;
    professionalTaxApplicable: boolean;
    labourWelfareFundApplicable: boolean;
    gratuityApplicable: boolean;
    professionalTaxMonthly: number;
    labourWelfareFundMonthly: number;
    monthlyTds: number;
  },
): SalaryEditorPreview {
  const target = Math.max(0, rounded(grossTarget));
  const basic = salaryRuleActive(rules.basic)
    ? componentAmount(rules.basic.calculation, rules.basic.value, 0, target)
    : 0;
  const hra = salaryRuleActive(rules.hra)
    ? componentAmount(rules.hra.calculation, rules.hra.value, basic, target)
    : 0;
  const activeEarnings = earnings.filter((item) => item.active);
  const customEarnings = activeEarnings.map((item) =>
    editorLine(
      item.code,
      item.name,
      componentAmount(item.calculation, item.value, basic, target),
      { reimbursement: isAfterGrossComponent(item) },
    ),
  );
  const salaryEarningsTotal = activeEarnings.reduce(
    (sum, item) =>
      sum +
      (isAfterGrossComponent(item)
        ? 0
        : componentAmount(item.calculation, item.value, basic, target)),
    0,
  );
  const committedBeforeBalance = rounded(
    basic + hra + salaryEarningsTotal,
  );
  const specialAllowance = settings.salaryTemplate.balanceComponentEnabled
    ? Math.max(0, rounded(target - committedBeforeBalance))
    : 0;
  const committed = rounded(committedBeforeBalance + specialAllowance);
  const earningsLines = [
    editorLine("basic", "Basic salary", basic),
    editorLine("hra", "House rent allowance", hra),
    editorLine(
      "special_allowance",
      settings.salaryTemplate.balanceComponentName || "Special allowance",
      specialAllowance,
    ),
    ...customEarnings,
  ].filter((item) => item.amount !== 0);
  const salaryGross = committed;
  const paidAfterGross = rounded(
    earningsLines
      .filter((item) => item.reimbursement)
      .reduce((sum, item) => sum + item.amount, 0),
  );
  const totalEarnings = rounded(salaryGross + paidAfterGross);
  const customDeductions = deductions
    .filter((item) => item.active)
    .map((item) =>
      editorLine(
        item.code,
        item.name,
        componentAmount(item.calculation, item.value, basic, salaryGross),
      ),
    )
    .filter((item) => item.amount !== 0);
  const selectedPfWage = rounded(
    basic +
      activeEarnings.reduce(
        (sum, item) =>
          sum +
          (item.partOfPfWage && !isAfterGrossComponent(item)
            ? componentAmount(item.calculation, item.value, basic, target)
            : 0),
        0,
      ),
  );
  const selectedEsiWage = rounded(
    basic +
      hra +
      specialAllowance +
      activeEarnings.reduce(
        (sum, item) =>
          sum +
          (item.partOfEsiWage !== false && !isAfterGrossComponent(item)
            ? componentAmount(item.calculation, item.value, basic, target)
            : 0),
        0,
      ),
  );
  const statutory = settings.statutory;
  const pfWage =
    statutory.pfWageBasis === "basic"
      ? basic
      : statutory.pfWageBasis === "gross"
        ? committed
        : selectedPfWage;
  const esiWage =
    statutory.esiWageBasis === "basic"
      ? basic
      : statutory.esiWageBasis === "gross"
        ? committed
        : selectedEsiWage;
  const shouldCapPf =
    statutory.restrictPfToCeiling &&
    committed > (statutory.pfCeilingTrigger || statutory.pfWageCeiling);
  const pfBase = statutory.pfEnabled && flags.pfApplicable
    ? shouldCapPf
      ? Math.min(pfWage, statutory.pfWageCeiling)
      : pfWage
    : 0;
  const employeePf = rounded((pfBase * statutory.employeePfRate) / 100);
  const employerPfTotal = rounded((pfBase * statutory.employerPfRate) / 100);
  const eps = pfBase
    ? Math.min(
        employerPfTotal,
        rounded(
          (pfBase * statutory.epsRate) / 100,
        ),
      )
    : 0;
  const esiEligible =
    statutory.esiEnabled &&
    flags.esiApplicable &&
    committed <= statutory.esiGrossCeiling;
  const employeeEsi = esiEligible
    ? rounded((esiWage * statutory.employeeEsiRate) / 100)
    : 0;
  const employerEsi = esiEligible
    ? rounded((esiWage * statutory.employerEsiRate) / 100)
    : 0;
  const gratuity =
    statutory.gratuityEnabled && flags.gratuityApplicable
      ? rounded((basic * statutory.gratuityRate) / 100)
      : 0;
  const employeeDeductions = [
    ...customDeductions,
    editorLine("provident_fund", "Employee provident fund", employeePf),
    editorLine(
      "employee_state_insurance",
      "Employee state insurance",
      employeeEsi,
    ),
    editorLine(
      "professional_tax",
      "Professional tax",
      statutory.professionalTaxEnabled && flags.professionalTaxApplicable
        ? flags.professionalTaxMonthly ?? statutory.professionalTaxMonthly
        : 0,
    ),
    editorLine(
      "labour_welfare_fund",
      "Labour welfare fund",
      statutory.labourWelfareFundEnabled && flags.labourWelfareFundApplicable
        ? flags.labourWelfareFundMonthly ?? statutory.employeeLabourWelfareFund
        : 0,
    ),
    editorLine(
      "tds",
      "Tax deducted at source",
      statutory.tdsEnabled ? flags.monthlyTds : 0,
    ),
  ].filter((item) => item.amount !== 0);
  const employerContributions = [
    editorLine("employer_epf", "Employer EPF", rounded(employerPfTotal - eps)),
    editorLine("employer_eps", "Employer pension contribution", eps),
    editorLine(
      "edli",
      "Deposit-linked insurance",
      pfBase
        ? rounded(
            (pfBase * statutory.edliRate) / 100,
          )
        : 0,
    ),
    editorLine("employer_esi", "Employer state insurance", employerEsi),
    editorLine(
      "employer_lwf",
      "Employer welfare fund",
      statutory.labourWelfareFundEnabled && flags.labourWelfareFundApplicable
        ? statutory.employerLabourWelfareFund
        : 0,
    ),
    editorLine("gratuity", "Gratuity provision", gratuity),
  ].filter((item) => item.amount !== 0);
  const professionalTax =
    statutory.professionalTaxEnabled && flags.professionalTaxApplicable
      ? flags.professionalTaxMonthly || statutory.professionalTaxMonthly
      : 0;
  const employeeLwf =
    statutory.labourWelfareFundEnabled && flags.labourWelfareFundApplicable
      ? flags.labourWelfareFundMonthly || statutory.employeeLabourWelfareFund
      : 0;
  const employerLwf =
    statutory.labourWelfareFundEnabled && flags.labourWelfareFundApplicable
      ? statutory.employerLabourWelfareFund
      : 0;
  const statutoryDetails: StatutoryDetail[] = [
    {
      code: "provident_fund",
      name: "EPF / EPS / EDLI",
      enabled: statutory.pfEnabled,
      applicable: pfBase > 0,
      status: pfBase > 0 ? "applied" : "not_applicable",
      employeeAmount: employeePf,
      employerAmount: rounded(
        employerPfTotal +
          (pfBase
            ? (Math.min(pfWage, statutory.pfWageCeiling) * statutory.edliRate) /
              100
            : 0),
      ),
    },
    {
      code: "employee_state_insurance",
      name: "Employee state insurance",
      enabled: statutory.esiEnabled,
      applicable: esiEligible,
      status: esiEligible ? "applied" : "not_applicable",
      reason:
        statutory.esiEnabled &&
        flags.esiApplicable &&
        committed > statutory.esiGrossCeiling
          ? "Gross salary is above the ESI wage ceiling"
          : "",
      employeeAmount: employeeEsi,
      employerAmount: employerEsi,
    },
    {
      code: "professional_tax",
      name: "Professional tax",
      enabled: statutory.professionalTaxEnabled,
      applicable: professionalTax > 0,
      status: professionalTax > 0 ? "applied" : "not_applicable",
      employeeAmount: professionalTax,
      employerAmount: 0,
    },
    {
      code: "labour_welfare_fund",
      name: "Labour welfare fund",
      enabled: statutory.labourWelfareFundEnabled,
      applicable: employeeLwf > 0 || employerLwf > 0,
      status: employeeLwf > 0 || employerLwf > 0 ? "applied" : "not_applicable",
      employeeAmount: employeeLwf,
      employerAmount: employerLwf,
    },
    {
      code: "tds",
      name: "Tax deducted at source",
      enabled: statutory.tdsEnabled,
      applicable: flags.monthlyTds > 0,
      status: flags.monthlyTds > 0 ? "applied" : "not_applicable",
      employeeAmount: statutory.tdsEnabled ? flags.monthlyTds : 0,
      employerAmount: 0,
    },
    {
      code: "gratuity",
      name: "Gratuity provision",
      enabled: statutory.gratuityEnabled,
      applicable: gratuity > 0,
      status: gratuity > 0 ? "applied" : "not_applicable",
      employeeAmount: 0,
      employerAmount: gratuity,
    },
  ];
  const totalDeductions = rounded(
    employeeDeductions.reduce((sum, item) => sum + item.amount, 0),
  );
  const employerContributionTotal = rounded(
    employerContributions.reduce((sum, item) => sum + item.amount, 0),
  );
  return {
    basic,
    hra,
    specialAllowance,
    earnings: earningsLines,
    employeeDeductions,
    employerContributions,
    statutoryDetails,
    gross: salaryGross,
    salaryGross,
    paidAfterGross,
    reimbursementTotal: paidAfterGross,
    totalEarnings,
    totalDeductions,
    net: rounded(Math.max(0, totalEarnings - totalDeductions)),
    employerContributionTotal,
    companyCost: rounded(totalEarnings + employerContributionTotal),
    warning:
      committedBeforeBalance > target
        ? `Configured earnings exceed monthly gross by ${money(committed - target)}.`
        : "",
  };
}

function SalaryModal({
  record,
  revisions,
  settings,
  busy,
  close,
  save,
}: {
  record: SalaryStructureRecord;
  revisions: SalaryRevision[];
  settings: PayrollSettings;
  busy: boolean;
  close: () => void;
  save: (values: Record<string, unknown>) => Promise<void>;
}) {
  const structure = record.structure;
  const [salaryMode, setSalaryMode] = useState<
    "company_template" | "custom_formula"
  >(structure.salaryMode || "company_template");
  const [monthlyGross, setMonthlyGross] = useState(
    structure.monthlyGrossTarget || structure.monthlyGross || 0,
  );
  const [annualCtc, setAnnualCtc] = useState(
    structure.annualCtc ||
      (structure.monthlyGrossTarget || structure.monthlyGross || 0) * 12,
  );
  const [payrollEnabled, setPayrollEnabled] = useState(
    structure.payrollEnabled,
  );
  const [rules, setRules] = useState(
    structure.coreRules || settings.salaryTemplate,
  );
  const [earnings, setEarnings] = useState<EditableSalaryComponent[]>(
    structure.earnings.map((item) => ({
      ...item,
      value: item.value ?? item.defaultValue,
    })),
  );
  const [deductions, setDeductions] = useState<EditableSalaryComponent[]>(
    structure.deductions.map((item) => ({
      ...item,
      value: item.value ?? item.defaultValue,
    })),
  );
  const [flags, setFlags] = useState<EmployeeStatutoryValues>({
    pfApplicable: structure.pfApplicable,
    esiApplicable: structure.esiApplicable,
    professionalTaxApplicable: structure.professionalTaxApplicable,
    labourWelfareFundApplicable: structure.labourWelfareFundApplicable,
    gratuityApplicable: structure.gratuityApplicable,
    professionalTaxMonthly: structure.professionalTaxMonthly,
    labourWelfareFundMonthly: structure.labourWelfareFundMonthly,
    monthlyTds: structure.monthlyTds,
  });
  const [statutoryPolicy, setStatutoryPolicy] =
    useState<EmployeeStatutoryPolicy>(
      effectiveEmployeeStatutoryPolicy(settings, structure.statutoryPolicy),
    );
  const activeRules = rules;
  const coreRuleOverrides =
    salaryMode === "company_template"
      ? buildCoreRuleOverrides(rules, settings)
      : {};
  const activeEarnings = earnings;
  const activeDeductions = deductions;
  const earningOverrides = buildEmployeeComponentOverrides(
    activeEarnings,
    settings.earnings,
  );
  const deductionOverrides = buildEmployeeComponentOverrides(
    activeDeductions,
    settings.deductions,
  );
  const statutoryOverrides = buildStatutoryOverrides(flags, settings);
  const statutoryDefaults = companyStatutoryValues(settings);
  const statutoryPolicyOverrides = buildStatutoryPolicyOverrides(
    statutoryPolicy,
    settings,
  );
  const previewSettings = {
    ...settings,
    statutory: { ...settings.statutory, ...statutoryPolicy },
    salaryTemplate: { ...settings.salaryTemplate, balanceComponentEnabled: false },
  };
  const preview = useMemo(
    () =>
      buildSalaryEditorPreview(
        previewSettings,
        monthlyGross,
        activeRules,
        activeEarnings,
        activeDeductions,
        flags,
      ),
    [
      previewSettings,
      monthlyGross,
      activeRules,
      activeEarnings,
      activeDeductions,
      flags,
    ],
  );
  const afterGrossPreviewTotal = rounded(preview.paidAfterGross ?? 0);
  const grossSalaryPreview = rounded(preview.salaryGross ?? preview.gross);
  useEffect(() => {
    setAnnualCtc(rounded((monthlyGross + afterGrossPreviewTotal) * 12));
  }, [monthlyGross, afterGrossPreviewTotal]);
  function updateGross(value: number) {
    const next = Math.max(0, value || 0);
    setMonthlyGross(next);
    setAnnualCtc(rounded(next * 12));
  }
  function updateRule(kind: "basic" | "hra", values: Partial<SalaryRule>) {
    setRules((current) => ({
      ...current,
      [kind]: { ...current[kind], ...values },
    }));
  }
  function changeSalaryMode(value: "company_template" | "custom_formula") {
    setSalaryMode(value);
    if (value === "company_template") {
      setRules({
        basic: structure.coreRuleOverrides?.basic || settings.salaryTemplate.basic,
        hra: structure.coreRuleOverrides?.hra || settings.salaryTemplate.hra,
      });
    }
  }
  function resetCoreRule(kind: "basic" | "hra") {
    updateRule(kind, settings.salaryTemplate[kind]);
  }
  function updateComponent(
    kind: "earnings" | "deductions",
    index: number,
    values: Partial<EditableSalaryComponent>,
  ) {
    const update = (items: EditableSalaryComponent[]) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...values } : item,
      );
    if (kind === "earnings") setEarnings(update);
    else setDeductions(update);
  }
  function addEmployeeComponent(kind: "earnings" | "deductions") {
    const items = kind === "earnings" ? earnings : deductions;
    const code = uniqueComponentCode(
      items,
      kind === "earnings" ? "employee_addition" : "employee_deduction",
    );
    const component: EditableSalaryComponent = {
      code,
      name: kind === "earnings" ? "Employee addition" : "Employee deduction",
      calculation: "fixed",
      defaultValue: 0,
      value: 0,
      taxable: kind === "earnings",
      partOfPfWage: false,
      partOfEsiWage: kind === "earnings",
      prorate: true,
      active: true,
      removable: true,
    };
    if (kind === "earnings") setEarnings((current) => [...current, component]);
    else setDeductions((current) => [...current, component]);
  }
  function removeEmployeeComponent(kind: "earnings" | "deductions", index: number) {
    updateComponent(kind, index, { active: false });
  }
  function resetEmployeeComponent(
    kind: "earnings" | "deductions",
    index: number,
    definition: PayrollDefinition,
  ) {
    updateComponent(kind, index, companyComponentValue(definition));
  }
  function updateStatutoryPolicy(
    key: StatutoryPolicyKey,
    value: EmployeeStatutoryPolicy[StatutoryPolicyKey],
  ) {
    setStatutoryPolicy((current) => ({ ...current, [key]: value }));
  }
  function resetStatutoryPolicy(key: StatutoryPolicyKey) {
    updateStatutoryPolicy(key, settings.statutory[key]);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save({
      payrollEnabled,
      effectiveFrom: form.get("effectiveFrom"),
      revisionReason: form.get("revisionReason"),
      salaryMode,
      monthlyGrossTarget: monthlyGross,
      coreRules: salaryMode === "custom_formula" ? activeRules : undefined,
      coreRuleOverrides,
      specialAllowance: 0,
      earningOverrides,
      deductionOverrides,
      statutoryOverrides,
      statutoryPolicyOverrides,
      annualCtc,
      ...flags,
      uan: form.get("uan"),
      esiNumber: form.get("esiNumber"),
      pan: form.get("pan"),
      bankName: form.get("bankName"),
      bankAccountLast4: form.get("bankAccountLast4"),
      bankIfsc: form.get("bankIfsc"),
      paymentMode: form.get("paymentMode"),
      notes: form.get("notes"),
    });
  }

  return (
    <Overlay
      title={`Salary - ${record.employee.firstName} ${record.employee.lastName}`}
      close={close}
      wide
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">
            Effective from
            <input
              name="effectiveFrom"
              type="date"
              defaultValue={String(structure.effectiveFrom).slice(0, 10)}
              required
              className={`${fieldClass} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Revision reason
            <input
              name="revisionReason"
              defaultValue="Salary structure updated"
              required
              className={`${fieldClass} mt-1`}
              placeholder="Promotion, annual revision, correction"
            />
          </label>
          <label className="text-sm font-semibold">
            Monthly gross salary
            <input
              type="number"
              min="0"
              step="0.01"
              value={monthlyGross}
              onChange={(event) => updateGross(Number(event.target.value))}
              required
              className={`${fieldClass} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Salary calculation
            <select
              value={salaryMode}
              onChange={(event) =>
                changeSalaryMode(
                  event.target.value as "company_template" | "custom_formula",
                )
              }
              className={`${fieldClass} mt-1`}
            >
              <option value="company_template">Company formula + field overrides</option>
              <option value="custom_formula">Fully custom Basic and HRA</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Annual CTC
            <input
              type="number"
              min="0"
              step="0.01"
              value={annualCtc}
              onChange={(event) =>
                setAnnualCtc(Math.max(0, Number(event.target.value) || 0))
              }
              className={`${fieldClass} mt-1`}
            />
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">Basic and HRA formula</h3>
              <p className="mt-1 text-xs text-slate-500">
                Edit either field for this employee. Unchanged fields continue following Company settings.
              </p>
            </div>
            {salaryMode === "company_template" && Object.keys(coreRuleOverrides).length > 0 && (
              <button
                type="button"
                onClick={() => setRules({ basic: settings.salaryTemplate.basic, hra: settings.salaryTemplate.hra })}
                className="neu-button inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset Basic and HRA
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <CoreSalaryRuleCard
              label="Basic salary"
              rule={rules.basic}
              companyRule={settings.salaryTemplate.basic}
              customMode={salaryMode === "custom_formula"}
              basic
              change={(values) => updateRule("basic", values)}
              reset={() => resetCoreRule("basic")}
            />
            <CoreSalaryRuleCard
              label="House rent allowance"
              rule={rules.hra}
              companyRule={settings.salaryTemplate.hra}
              customMode={salaryMode === "custom_formula"}
              change={(values) => updateRule("hra", values)}
              reset={() => resetCoreRule("hra")}
            />
          </div>
          {salaryMode === "custom_formula" && (
            <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Fully custom mode disconnects both Basic and HRA from future Company formula changes.
            </p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SalaryComponentEditor
            title="Employee earnings and additions"
            kind="earnings"
            items={earnings}
            companyItems={settings.earnings}
            change={(index, values) =>
              updateComponent("earnings", index, values)
            }
            add={() => addEmployeeComponent("earnings")}
            remove={(index) => removeEmployeeComponent("earnings", index)}
            reset={(index, definition) =>
              resetEmployeeComponent("earnings", index, definition)
            }
          />
          <SalaryComponentEditor
            title="Employee recurring deductions"
            kind="deductions"
            items={deductions}
            companyItems={settings.deductions}
            change={(index, values) =>
              updateComponent("deductions", index, values)
            }
            add={() => addEmployeeComponent("deductions")}
            remove={(index) => removeEmployeeComponent("deductions", index)}
            reset={(index, definition) =>
              resetEmployeeComponent("deductions", index, definition)
            }
          />
        </div>

        {preview.warning && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {preview.warning}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Info label="Gross salary" value={money(grossSalaryPreview)} />
          <Info label="Paid after gross" value={money(afterGrossPreviewTotal)} />
          <Info label="Total earnings" value={money(preview.totalEarnings ?? preview.gross)} />
          <Info
            label="Employee deductions"
            value={money(preview.totalDeductions)}
          />
          <Info label="Estimated net pay" value={money(preview.net)} />
          <Info label="Company cost" value={money(preview.companyCost)} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <LineTable
            title="Earnings and additions"
            lines={preview.earnings}
            totalLabel="Total earnings"
            total={preview.totalEarnings ?? preview.gross}
          />
          <LineTable
            title="Employee deductions"
            lines={preview.employeeDeductions}
            totalLabel="Total deductions"
            total={preview.totalDeductions}
          />
          <LineTable
            title="Employer contributions"
            lines={preview.employerContributions}
            totalLabel="Employer total"
            total={preview.employerContributionTotal}
          />
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">Payroll applicability</h3>
              <p className="mt-1 text-xs text-slate-500">
                Enabled company rules are inherited. Change a switch only for an employee exception.
              </p>
            </div>
            {Object.keys(statutoryOverrides).length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setFlags((current) => ({ ...current, ...statutoryDefaults }))
                }
                className="neu-button flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset company defaults
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-white/40 p-3 text-sm">
              <ControlledCheck
                label="Include in payroll"
                checked={payrollEnabled}
                change={setPayrollEnabled}
              />
            </div>
            {[
              ["pfApplicable", "PF applicable", settings.statutory.pfEnabled],
              ["esiApplicable", "ESI applicable", settings.statutory.esiEnabled],
              ["professionalTaxApplicable", "Professional tax applicable", settings.statutory.professionalTaxEnabled],
              ["labourWelfareFundApplicable", "LWF applicable", settings.statutory.labourWelfareFundEnabled],
              ["gratuityApplicable", "Gratuity applicable", settings.statutory.gratuityEnabled],
            ].filter(([, , enabled]) => enabled).map(([key, label]) => {
              const flagKey = key as keyof Pick<EmployeeStatutoryValues,
                "pfApplicable" | "esiApplicable" | "professionalTaxApplicable" | "labourWelfareFundApplicable" | "gratuityApplicable">;
              const overridden = Object.prototype.hasOwnProperty.call(statutoryOverrides, flagKey);
              return (
                <div key={flagKey} className="rounded-lg bg-white/40 p-3 text-sm">
                  <ControlledCheck
                    label={String(label)}
                    checked={Boolean(flags[flagKey])}
                    change={(value) =>
                      setFlags((current) => ({ ...current, [flagKey]: value }))
                    }
                  />
                  <p className={`mt-2 text-[11px] font-semibold ${overridden ? "text-blue-700" : "text-emerald-700"}`}>
                    {overridden ? "Employee override" : "Company default"}
                  </p>
                </div>
              );
            })}
          </div>
          {!settings.statutory.pfEnabled &&
            !settings.statutory.esiEnabled &&
            !settings.statutory.professionalTaxEnabled &&
            !settings.statutory.labourWelfareFundEnabled &&
            !settings.statutory.gratuityEnabled && (
              <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                No statutory payroll rules are enabled in Company settings.
              </p>
            )}
          {(settings.statutory.pfEnabled ||
            settings.statutory.esiEnabled ||
            settings.statutory.gratuityEnabled) && (
            <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 xl:grid-cols-2">
              {settings.statutory.pfEnabled && (
                <EmployeePfPolicyCard
                  policy={statutoryPolicy}
                  defaults={settings.statutory}
                  overrides={statutoryPolicyOverrides}
                  change={updateStatutoryPolicy}
                  reset={resetStatutoryPolicy}
                />
              )}
              {settings.statutory.esiEnabled && (
                <EmployeeEsiPolicyCard
                  policy={statutoryPolicy}
                  defaults={settings.statutory}
                  overrides={statutoryPolicyOverrides}
                  change={updateStatutoryPolicy}
                  reset={resetStatutoryPolicy}
                />
              )}
              {settings.statutory.gratuityEnabled && (
                <div className="rounded-lg bg-white/40 p-4">
                  <h4 className="font-bold">Gratuity calculation</h4>
                  <div className="mt-3 max-w-sm">
                    <EmployeePolicyNumber
                      label="Gratuity % of basic"
                      policyKey="gratuityRate"
                      value={statutoryPolicy.gratuityRate}
                      defaultValue={settings.statutory.gratuityRate}
                      change={updateStatutoryPolicy}
                      reset={resetStatutoryPolicy}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {(settings.statutory.tdsEnabled ||
            settings.statutory.professionalTaxEnabled ||
            settings.statutory.labourWelfareFundEnabled) && (
            <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {settings.statutory.tdsEnabled && (
                <SettingNumber
                  label="Monthly TDS input"
                  value={flags.monthlyTds}
                  change={(value) =>
                    setFlags((current) => ({ ...current, monthlyTds: value }))
                  }
                />
              )}
              {settings.statutory.professionalTaxEnabled && (
                <SettingNumber
                  label="Professional tax amount"
                  value={flags.professionalTaxMonthly}
                  change={(value) =>
                    setFlags((current) => ({ ...current, professionalTaxMonthly: value }))
                  }
                  help={`Company default: ${money(settings.statutory.professionalTaxMonthly)}`}
                />
              )}
              {settings.statutory.labourWelfareFundEnabled && (
                <SettingNumber
                  label="Employee LWF amount"
                  value={flags.labourWelfareFundMonthly}
                  change={(value) =>
                    setFlags((current) => ({ ...current, labourWelfareFundMonthly: value }))
                  }
                  help={`Company default: ${money(settings.statutory.employeeLabourWelfareFund)}`}
                />
              )}
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">
            PAN
            <input
              name="pan"
              defaultValue={structure.pan}
              className={`${fieldClass} mt-1 uppercase`}
            />
          </label>
          <label className="text-sm font-semibold">
            UAN
            <input
              name="uan"
              defaultValue={structure.uan}
              className={`${fieldClass} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            ESI number
            <input
              name="esiNumber"
              defaultValue={structure.esiNumber}
              className={`${fieldClass} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Payment mode
            <select
              name="paymentMode"
              defaultValue={structure.paymentMode}
              className={`${fieldClass} mt-1`}
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Bank name
            <input
              name="bankName"
              defaultValue={structure.bankName}
              className={`${fieldClass} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Account last 4
            <input
              name="bankAccountLast4"
              inputMode="numeric"
              maxLength={4}
              defaultValue={structure.bankAccountLast4}
              className={`${fieldClass} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            IFSC
            <input
              name="bankIfsc"
              defaultValue={structure.bankIfsc}
              className={`${fieldClass} mt-1 uppercase`}
            />
          </label>
          <label className="text-sm font-semibold">
            Notes
            <input
              name="notes"
              defaultValue={structure.notes}
              className={`${fieldClass} mt-1`}
            />
          </label>
        </div>
        <details className="rounded-lg border border-slate-200 bg-white/35 p-4">
          <summary className="cursor-pointer font-bold">Salary revision history ({revisions.length})</summary>
          <div className="mt-3 space-y-2">
            {revisions.length ? revisions.map((revision) => (
              <div key={revision._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/50 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold">Effective {String(revision.effectiveFrom).slice(0, 10)} · {revision.reason}</p>
                  <p className="text-xs text-slate-500">Saved {new Date(revision.createdAt).toLocaleString("en-IN")}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(revision.salarySnapshot.monthlyGross)}</p>
                  <p className="text-xs text-slate-500">Annual CTC {money(revision.salarySnapshot.annualCtc)}</p>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">No prior salary revisions have been saved.</p>}
          </div>
        </details>
        <button
          disabled={busy || monthlyGross <= 0 || Boolean(preview.warning)}
          className="gradient-button flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save salary structure
        </button>
      </form>
    </Overlay>
  );
}

function CoreSalaryRuleCard({
  label,
  rule,
  companyRule,
  customMode,
  basic = false,
  change,
  reset,
}: {
  label: string;
  rule: SalaryRule;
  companyRule: SalaryRule;
  customMode: boolean;
  basic?: boolean;
  change: (values: Partial<SalaryRule>) => void;
  reset: () => void;
}) {
  const inherited = !customMode && salaryRuleUsesCompanyDefault(rule, companyRule);
  return (
    <div className="rounded-lg bg-white/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-bold">{label}</h4>
          <p className={`mt-1 text-[11px] font-semibold ${inherited ? "text-emerald-700" : "text-blue-700"}`}>
            {inherited ? "Company default" : customMode ? "Fully custom formula" : "Employee override"}
          </p>
        </div>
        {!customMode && !inherited && (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <RefreshCw className="h-3.5 w-3.5" />
            Use company default
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FormulaControl
          label={basic ? "Basic" : "HRA"}
          rule={rule}
          basic={basic}
          change={change}
        />
      </div>
    </div>
  );
}

type EmployeePolicyControlProps = {
  policy: EmployeeStatutoryPolicy;
  defaults: PayrollSettings["statutory"];
  overrides: Partial<EmployeeStatutoryPolicy>;
  change: (
    key: StatutoryPolicyKey,
    value: EmployeeStatutoryPolicy[StatutoryPolicyKey],
  ) => void;
  reset: (key: StatutoryPolicyKey) => void;
};

function EmployeePfPolicyCard(props: EmployeePolicyControlProps) {
  const keys: StatutoryPolicyKey[] = [
    "pfWageBasis",
    "employeePfRate",
    "employerPfRate",
    "epsRate",
    "edliRate",
    "restrictPfToCeiling",
    "pfCeilingTrigger",
    "pfWageCeiling",
  ];
  const manualCount = keys.filter((key) =>
    Object.prototype.hasOwnProperty.call(props.overrides, key),
  ).length;
  return (
    <div className="rounded-lg bg-white/40 p-4">
      <PolicyCardHeader
        title="PF calculation for this employee"
        manualCount={manualCount}
        reset={() => keys.forEach(props.reset)}
      />
      <p className="mt-2 text-xs leading-5 text-slate-500">
        The cap is applied only when monthly gross is above the trigger. Example: above {money(props.policy.pfCeilingTrigger)}, calculate PF on at most {money(props.policy.pfWageCeiling)}.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <EmployeePolicySelect
          label="PF calculation base"
          policyKey="pfWageBasis"
          value={props.policy.pfWageBasis}
          defaultValue={props.defaults.pfWageBasis}
          options={[
            ["basic", "Basic salary"],
            ["gross", "Gross earnings"],
            ["eligible_earnings", "Basic + selected PF earnings"],
          ]}
          change={props.change}
          reset={props.reset}
        />
        <EmployeePolicyNumber label="Employee PF %" policyKey="employeePfRate" value={props.policy.employeePfRate} defaultValue={props.defaults.employeePfRate} change={props.change} reset={props.reset} />
        <EmployeePolicyNumber label="Employer PF %" policyKey="employerPfRate" value={props.policy.employerPfRate} defaultValue={props.defaults.employerPfRate} change={props.change} reset={props.reset} />
        <EmployeePolicyNumber label="EPS %" policyKey="epsRate" value={props.policy.epsRate} defaultValue={props.defaults.epsRate} change={props.change} reset={props.reset} />
        <EmployeePolicyNumber label="EDLI %" policyKey="edliRate" value={props.policy.edliRate} defaultValue={props.defaults.edliRate} change={props.change} reset={props.reset} />
        <EmployeePolicyToggle label="Apply capped PF base" policyKey="restrictPfToCeiling" value={props.policy.restrictPfToCeiling} defaultValue={props.defaults.restrictPfToCeiling} change={props.change} reset={props.reset} />
        {props.policy.restrictPfToCeiling && (
          <>
            <EmployeePolicyNumber label="Cap when monthly gross is above" policyKey="pfCeilingTrigger" value={props.policy.pfCeilingTrigger} defaultValue={props.defaults.pfCeilingTrigger} change={props.change} reset={props.reset} />
            <EmployeePolicyNumber label="Capped PF calculation base" policyKey="pfWageCeiling" value={props.policy.pfWageCeiling} defaultValue={props.defaults.pfWageCeiling} change={props.change} reset={props.reset} />
          </>
        )}
      </div>
    </div>
  );
}

function EmployeeEsiPolicyCard(props: EmployeePolicyControlProps) {
  const keys: StatutoryPolicyKey[] = [
    "esiWageBasis",
    "employeeEsiRate",
    "employerEsiRate",
    "esiGrossCeiling",
  ];
  const manualCount = keys.filter((key) =>
    Object.prototype.hasOwnProperty.call(props.overrides, key),
  ).length;
  return (
    <div className="rounded-lg bg-white/40 p-4">
      <PolicyCardHeader
        title="ESI calculation for this employee"
        manualCount={manualCount}
        reset={() => keys.forEach(props.reset)}
      />
      <p className="mt-2 text-xs leading-5 text-slate-500">
        ESI applies when monthly gross is at or below the eligibility ceiling, then uses the selected calculation base.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <EmployeePolicySelect
          label="ESI calculation base"
          policyKey="esiWageBasis"
          value={props.policy.esiWageBasis}
          defaultValue={props.defaults.esiWageBasis}
          options={[
            ["gross", "Gross earnings"],
            ["basic", "Basic salary"],
            ["eligible_earnings", "Selected ESI earnings"],
          ]}
          change={props.change}
          reset={props.reset}
        />
        <EmployeePolicyNumber label="Employee ESI %" policyKey="employeeEsiRate" value={props.policy.employeeEsiRate} defaultValue={props.defaults.employeeEsiRate} change={props.change} reset={props.reset} />
        <EmployeePolicyNumber label="Employer ESI %" policyKey="employerEsiRate" value={props.policy.employerEsiRate} defaultValue={props.defaults.employerEsiRate} change={props.change} reset={props.reset} />
        <EmployeePolicyNumber label="ESI eligibility ceiling" policyKey="esiGrossCeiling" value={props.policy.esiGrossCeiling} defaultValue={props.defaults.esiGrossCeiling} change={props.change} reset={props.reset} />
      </div>
    </div>
  );
}

function PolicyCardHeader({
  title,
  manualCount,
  reset,
}: {
  title: string;
  manualCount: number;
  reset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h4 className="font-bold">{title}</h4>
        <p className={`mt-1 text-[11px] font-semibold ${manualCount ? "text-blue-700" : "text-emerald-700"}`}>
          {manualCount ? `${manualCount} manual field${manualCount === 1 ? "" : "s"}` : "All fields use company defaults"}
        </p>
      </div>
      {manualCount > 0 && (
        <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
          <RefreshCw className="h-3.5 w-3.5" />
          Reset section
        </button>
      )}
    </div>
  );
}

function PolicyFieldSource({
  manual,
  defaultText,
  reset,
}: {
  manual: boolean;
  defaultText: string;
  reset: () => void;
}) {
  return manual ? (
    <button type="button" onClick={reset} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
      <RefreshCw className="h-3 w-3" /> Manual - use company default
    </button>
  ) : (
    <p className="mt-1 text-[11px] font-semibold text-emerald-700">Company default: {defaultText}</p>
  );
}

function EmployeePolicyNumber({
  label,
  policyKey,
  value,
  defaultValue,
  change,
  reset,
}: {
  label: string;
  policyKey: StatutoryPolicyKey;
  value: number;
  defaultValue: number;
  change: EmployeePolicyControlProps["change"];
  reset: EmployeePolicyControlProps["reset"];
}) {
  const manual = value !== defaultValue;
  return (
    <label className="text-xs font-semibold">
      {label}
      <input type="number" min="0" step="0.01" value={value} onChange={(event) => change(policyKey, Math.max(0, Number(event.target.value) || 0))} className={`${fieldClass} mt-1 text-sm`} />
      <PolicyFieldSource manual={manual} defaultText={String(defaultValue)} reset={() => reset(policyKey)} />
    </label>
  );
}

function EmployeePolicySelect({
  label,
  policyKey,
  value,
  defaultValue,
  options,
  change,
  reset,
}: {
  label: string;
  policyKey: "pfWageBasis" | "esiWageBasis";
  value: PayrollSettings["statutory"]["pfWageBasis"];
  defaultValue: PayrollSettings["statutory"]["pfWageBasis"];
  options: Array<[PayrollSettings["statutory"]["pfWageBasis"], string]>;
  change: EmployeePolicyControlProps["change"];
  reset: EmployeePolicyControlProps["reset"];
}) {
  const manual = value !== defaultValue;
  const defaultLabel = options.find(([key]) => key === defaultValue)?.[1] || defaultValue;
  return (
    <label className="text-xs font-semibold">
      {label}
      <select value={value} onChange={(event) => change(policyKey, event.target.value as typeof value)} className={`${fieldClass} mt-1 text-sm`}>
        {options.map(([key, optionLabel]) => <option key={key} value={key}>{optionLabel}</option>)}
      </select>
      <PolicyFieldSource manual={manual} defaultText={defaultLabel} reset={() => reset(policyKey)} />
    </label>
  );
}

function EmployeePolicyToggle({
  label,
  policyKey,
  value,
  defaultValue,
  change,
  reset,
}: {
  label: string;
  policyKey: "restrictPfToCeiling";
  value: boolean;
  defaultValue: boolean;
  change: EmployeePolicyControlProps["change"];
  reset: EmployeePolicyControlProps["reset"];
}) {
  const manual = value !== defaultValue;
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm">
      <ControlledCheck label={label} checked={value} change={(checked) => change(policyKey, checked)} />
      <PolicyFieldSource manual={manual} defaultText={defaultValue ? "Enabled" : "Disabled"} reset={() => reset(policyKey)} />
    </div>
  );
}

function calculationSummary(calculation: PayrollCalculation, value: number) {
  if (calculation === "percentage_of_basic") return `${value}% of basic salary`;
  if (calculation === "percentage_of_gross") return `${value}% of monthly gross`;
  if (calculation === "extra") return `${money(value)} paid after gross`;
  return money(value);
}
function FormulaControl({
  label,
  rule,
  basic = false,
  change,
}: {
  label: string;
  rule: SalaryRule;
  basic?: boolean;
  change: (values: Partial<SalaryRule>) => void;
}) {
  return (
    <>
      <label className="text-sm font-semibold">
        {label} calculation
        <select
          value={rule.calculation}
          onChange={(event) =>
            change({ calculation: event.target.value as PayrollCalculation })
          }
          className={`${fieldClass} mt-1`}
        >
          {calculationOptions
            .filter((item) => item.value !== "extra")
            .filter((item) => !basic || item.value !== "percentage_of_basic")
            .map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
        </select>
      </label>
      <SettingNumber
        label={
          rule.calculation === "fixed"
            ? `${label} amount`
            : `${label} percentage`
        }
        value={rule.value}
        change={(value) => change({ value })}
      />
    </>
  );
}
function SalaryComponentEditor({
  title,
  kind,
  items,
  companyItems,
  change,
  add,
  remove,
  reset,
}: {
  title: string;
  kind: "earnings" | "deductions";
  items: EditableSalaryComponent[];
  companyItems: PayrollDefinition[];
  change: (index: number, values: Partial<EditableSalaryComponent>) => void;
  add: () => void;
  remove: (index: number) => void;
  reset: (index: number, definition: PayrollDefinition) => void;
}) {
  const visibleItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.active !== false);
  const excludedCompanyItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      item.active === false && companyItems.some((entry) => entry.active && entry.code === item.code),
    );
  const companyDefaultCount = visibleItems.filter(({ item }) => {
    const definition = companyItems.find((entry) => entry.code === item.code);
    return definition && componentUsesCompanyDefault(item, definition);
  }).length;
  const employeeChangeCount = visibleItems.length - companyDefaultCount + excludedCompanyItems.length;
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {companyDefaultCount} company default{companyDefaultCount === 1 ? "" : "s"}
            {employeeChangeCount > 0
              ? `, ${employeeChangeCount} employee change${employeeChangeCount === 1 ? "" : "s"}`
              : ". Changes here apply only to this employee."}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="neu-button flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
        >
          <Plus className="h-4 w-4" />
          Add {kind === "earnings" ? "addition" : "deduction"}
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {visibleItems.length ? (
          visibleItems.map(({ item, index }) => {
            const companyItem = companyItems.find((entry) => entry.code === item.code);
            const inherited = Boolean(companyItem && componentUsesCompanyDefault(item, companyItem));
            return (
              <div
                key={item.code}
                className="grid gap-3 rounded-lg bg-white/40 p-3 sm:grid-cols-2"
              >
                <div className="flex items-center justify-between gap-3 sm:col-span-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${inherited ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                    {inherited ? "Company default" : companyItem ? "Employee override" : "Employee only"}
                  </span>
                  {companyItem && !inherited && (
                    <button
                      type="button"
                      onClick={() => reset(index, companyItem)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reset to company default
                    </button>
                  )}
                </div>
              <label className="text-xs font-semibold">
                Name
                <input
                  value={item.name}
                  onChange={(event) => change(index, { name: event.target.value })}
                  className={`${fieldClass} mt-1 text-sm`}
                />
              </label>
              {kind === "earnings" && (
                <label className="text-xs font-semibold">
                  Salary treatment
                  <select
                    value={isAfterGrossComponent(item) ? "after_gross" : "included_in_gross"}
                    onChange={(event) => {
                      const paidAfterGross = event.target.value === "after_gross";
                      change(index, {
                        treatment: paidAfterGross ? "after_gross" : "included_in_gross",
                      });
                    }}
                    className={`${fieldClass} mt-1 text-sm`}
                  >
                    <option value="included_in_gross">Included in gross</option>
                    <option value="after_gross">Paid after gross</option>
                  </select>
                </label>
              )}
              <label className="text-xs font-semibold">
                Calculation
                <select
                  aria-label={`${item.name} calculation`}
                  value={item.calculation === "extra" ? "fixed" : item.calculation}
                  onChange={(event) =>
                    change(index, {
                      calculation: event.target.value as PayrollCalculation,
                    })
                  }
                  className={`${fieldClass} mt-1 text-sm disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {calculationOptions
                    .filter((option) => option.value !== "extra")
                    .map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
              </label>
              <label className="text-xs font-semibold">
                {item.calculation === "fixed" || item.calculation === "extra" ? "Amount" : "Percentage"}
                <input
                  aria-label={`${item.name} value`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.value}
                  onChange={(event) =>
                    change(index, {
                      value: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                  className={`${fieldClass} mt-1 text-sm`}
                />
              </label>
              {kind === "earnings" && (
                <div className="flex flex-wrap gap-4 text-xs sm:col-span-2">
                  <ControlledCheck
                    label="Taxable earning"
                    checked={item.taxable !== false}
                    change={(value) => change(index, { taxable: value })}
                  />
                  <ControlledCheck
                    label="Prorate for attendance"
                    checked={item.prorate !== false}
                    change={(value) => change(index, { prorate: value })}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(index)}
                className="neu-button justify-self-start rounded-lg px-3 py-2 text-xs font-semibold text-red-600 sm:col-span-2"
              >
                Remove for this employee
              </button>
              </div>
            );
          })
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            No components are active. Add a company default under Company settings or create an employee-only item here.
          </p>
        )}
        {excludedCompanyItems.length > 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Excluded for this employee</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {excludedCompanyItems.map(({ item, index }) => {
                const companyItem = companyItems.find((entry) => entry.code === item.code);
                if (!companyItem) return null;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => reset(index, companyItem)}
                    className="neu-button inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Restore {companyItem.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SalaryTemplateSettingsCard({
  settings,
  setSettings,
  readOnly,
  busy,
}: {
  settings: PayrollSettings;
  setSettings: (settings: PayrollSettings) => void;
  readOnly: boolean;
  busy: boolean;
}) {
  const [selectedFormulaField, setSelectedFormulaField] = useState("");
  const [previewGross, setPreviewGross] = useState(20000);
  const updateRule = (kind: "basic" | "hra", values: Partial<SalaryRule>) =>
    setSettings({
      ...settings,
      salaryTemplate: {
        ...settings.salaryTemplate,
        [kind]: { ...settings.salaryTemplate[kind], ...values },
      },
    });
  const updateEarning = (code: string, values: Partial<PayrollDefinition>) =>
    setSettings({
      ...settings,
      earnings: settings.earnings.map((item) =>
        item.code === code ? { ...item, ...values, active: true } : item,
      ),
    });
  const removeEarning = (code: string) =>
    setSettings({
      ...settings,
      earnings: settings.earnings.filter((item) => item.code !== code),
    });
  function addFormulaField(key: FormulaFieldKey) {
    const option = formulaFieldOptions.find((item) => item.key === key);
    if (!option) return;
    if (key === "conveyance") {
      const preset = earningPresets.find((item) => item.code === "conveyance");
      if (!preset) return;
      const existing = settings.earnings.find((item) => item.code === preset.code);
      setSettings({
        ...settings,
        earnings: existing
          ? settings.earnings.map((item) =>
              item.code === preset.code ? { ...item, ...preset, active: true } : item,
            )
          : [...settings.earnings, preset],
      });
      return;
    }
    if (key === "custom_earning") {
      const code = uniqueComponentCode(settings.earnings, "custom_earning");
      setSettings({
        ...settings,
        earnings: [
          ...settings.earnings,
          {
            code,
            name: "Custom earning",
            calculation: "fixed",
            defaultValue: 0,
            taxable: true,
            partOfPfWage: false,
            partOfEsiWage: true,
            prorate: true,
            active: true,
            removable: true,
          },
        ],
      });
      return;
    }
    setSettings({
      ...settings,
      salaryTemplate: {
        ...settings.salaryTemplate,
        [key]: {
          ...option.defaultRule,
          ...settings.salaryTemplate[key],
          active: true,
          value: settings.salaryTemplate[key]?.value || option.defaultRule?.value || 0,
        },
      },
    });
  }
  function removeFormulaField(key: FormulaFieldKey) {
    if (key !== "basic" && key !== "hra") return;
    setSettings({
      ...settings,
      salaryTemplate: {
        ...settings.salaryTemplate,
        [key]: disabledSalaryRule(settings.salaryTemplate[key]),
      },
    });
  }
  const selectedFormulaFields = formulaFieldOptions.filter((item) =>
    (item.key === "basic" || item.key === "hra") && salaryRuleActive(settings.salaryTemplate[item.key]),
  );
  const selectedFormulaEarnings = settings.earnings.filter((item) => item.active !== false);
  const availableFormulaFields = formulaFieldOptions.filter(
    (item) =>
      item.key === "custom_earning" ||
      !selectedFormulaFields.some((selected) => selected.key === item.key) &&
      !(item.key === "conveyance" && selectedFormulaEarnings.some((earning) => earning.code === "conveyance")),
  );
  const exampleRules = {
    basic: settings.salaryTemplate.basic,
    hra: settings.salaryTemplate.hra,
  };
  const exampleSettings = {
    ...settings,
    salaryTemplate: { ...settings.salaryTemplate, balanceComponentEnabled: false },
  };
  const exampleEarnings = selectedFormulaEarnings
    .map((item) => ({ ...item, value: item.defaultValue }));
  const exampleDeductions = settings.deductions
    .filter((item) => item.active)
    .map((item) => ({ ...item, value: item.defaultValue }));
  const example = buildSalaryEditorPreview(
    exampleSettings,
    previewGross,
    exampleRules,
    exampleEarnings,
    exampleDeductions,
    {
      pfApplicable: settings.statutory.pfEnabled,
      esiApplicable: settings.statutory.esiEnabled,
      professionalTaxApplicable: true,
      labourWelfareFundApplicable: true,
      gratuityApplicable: settings.statutory.gratuityEnabled,
      professionalTaxMonthly: 0,
      labourWelfareFundMonthly: 0,
      monthlyTds: 0,
    },
  );
  const previewRows = example.earnings.map((line) => {
    const rule =
      line.code === "basic"
        ? settings.salaryTemplate.basic
        : line.code === "hra"
          ? settings.salaryTemplate.hra
          : selectedFormulaEarnings.find((item) => item.code === line.code);
    return {
      ...line,
      formula: rule
        ? calculationSummary(rule.calculation, "defaultValue" in rule ? rule.defaultValue : rule.value)
        : "Calculated amount",
    };
  });
  const salaryFormulaTotal = rounded(
    example.earnings.reduce((sum, line) => {
      const definition = selectedFormulaEarnings.find((item) => item.code === line.code);
      return sum + (definition && isAfterGrossComponent(definition) ? 0 : line.amount);
    }, 0),
  );
  const afterGrossTotal = rounded(example.paidAfterGross || 0);
  const unallocatedGross = rounded(previewGross - salaryFormulaTotal);
  return (
    <fieldset disabled={readOnly || busy} className="disabled:opacity-70">
      <Card>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Default salary formula</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Add only the earnings this company pays. Each employee can still have a custom formula from Salary structures.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
            <label className="min-w-56 flex-1 text-xs font-semibold sm:flex-none">
              Add formula component
              <select
                value={selectedFormulaField}
                onChange={(event) => setSelectedFormulaField(event.target.value)}
                className={`${fieldClass} mt-1 text-sm`}
              >
                <option value="">Choose component</option>
                {availableFormulaFields.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!selectedFormulaField}
              onClick={() => {
                addFormulaField(selectedFormulaField as FormulaFieldKey);
                setSelectedFormulaField("");
              }}
              className="neu-button flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
        <details className="mb-4 rounded-lg bg-white/40 px-4 py-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-slate-700">
            <HelpCircle className="h-4 w-4 text-blue-600" />
            What do the calculation options mean?
          </summary>
          <div className="mt-3 grid gap-x-6 gap-y-2 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-600 sm:grid-cols-2">
            <p><strong>Fixed amount:</strong> the same amount each month.</p>
            <p><strong>% of basic:</strong> calculated from Basic salary.</p>
            <p><strong>% of monthly gross:</strong> calculated from the employee&apos;s entered gross salary.</p>
            <p><strong>Included in gross:</strong> forms part of the employee&apos;s monthly gross salary.</p>
            <p><strong>Paid after gross:</strong> an allowance or reimbursement added on top of gross salary.</p>
            <p><strong>Prorate:</strong> reduce the component when payable attendance days are lower.</p>
            <p><strong>PF/ESI base:</strong> advanced inclusion controls appear only after that statutory rule is enabled.</p>
          </div>
        </details>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          {selectedFormulaFields.map((item) => (
            <FormulaComponentCard
              key={item.key}
              option={item}
              settings={settings}
              updateRule={updateRule}
              remove={() => removeFormulaField(item.key)}
            />
          ))}
          {selectedFormulaEarnings.map((item) => (
            <FormulaEarningCard
              key={item.code}
              item={item}
              update={(values) => updateEarning(item.code, values)}
              remove={() => removeEarning(item.code)}
              pfEnabled={settings.statutory.pfEnabled}
              esiEnabled={settings.statutory.esiEnabled}
            />
          ))}
          {!selectedFormulaFields.length && !selectedFormulaEarnings.length && (
            <p className="p-6 text-center text-sm text-slate-500">
              No formula components selected. Add Basic, HRA, Conveyance, or a custom earning when this company needs them.
            </p>
          )}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-bold">Formula preview</h3>
                <p className="mt-1 text-xs text-slate-500">Change the test gross to verify every selected calculation.</p>
              </div>
              <label className="w-full text-xs font-semibold sm:w-56">
                Test monthly gross
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={previewGross}
                  onChange={(event) => setPreviewGross(Math.max(0, Number(event.target.value) || 0))}
                  className={`${fieldClass} mt-1 text-sm`}
                />
              </label>
            </div>
            {previewRows.length > 0 ? (
              <FormulaPreviewTable
                rows={previewRows}
                grossTotal={salaryFormulaTotal}
                afterGrossTotal={afterGrossTotal}
                total={example.totalEarnings ?? example.gross}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                Add a formula component to see its calculation here.
              </p>
            )}
            {previewRows.length > 0 && unallocatedGross > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {money(unallocatedGross)} of the test gross is not assigned. Add or adjust a component when the formula should equal the employee&apos;s monthly gross.
              </p>
            )}
            {previewRows.length > 0 && unallocatedGross === 0 && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                The selected salary components match the test monthly gross.
              </p>
            )}
            {example.warning && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {example.warning}
              </p>
            )}
        </div>
      </Card>
    </fieldset>
  );
}

function FormulaComponentCard({
  option,
  settings,
  updateRule,
  remove,
}: {
  option: (typeof formulaFieldOptions)[number];
  settings: PayrollSettings;
  updateRule: (kind: "basic" | "hra", values: Partial<SalaryRule>) => void;
  remove: () => void;
}) {
  const coreKey = option.key === "basic" || option.key === "hra" ? option.key : null;
  if (!coreKey) return null;
  return (
    <div className="grid gap-4 border-b border-slate-200 bg-white/20 p-4 last:border-b-0 lg:grid-cols-[minmax(210px,1fr)_minmax(360px,1.5fr)_auto] lg:items-center">
      <div className="min-w-0">
        <h3 className="font-bold">{option.label}</h3>
        <p className="mt-1 text-xs text-slate-500">{option.hint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormulaControl
          label={coreKey === "basic" ? "Basic" : "HRA"}
          rule={settings.salaryTemplate[coreKey]}
          basic={coreKey === "basic"}
          change={(values) => updateRule(coreKey, { ...values, active: true })}
        />
      </div>
      <button
        type="button"
        onClick={remove}
        className="neu-button justify-self-start rounded-lg p-2 text-red-600 lg:justify-self-end"
        aria-label={`Remove ${option.label}`}
        title={`Remove ${option.label}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function FormulaEarningCard({
  item,
  update,
  remove,
  pfEnabled,
  esiEnabled,
}: {
  item: PayrollDefinition;
  update: (values: Partial<PayrollDefinition>) => void;
  remove: () => void;
  pfEnabled: boolean;
  esiEnabled: boolean;
}) {
  return (
    <div className="grid gap-4 border-b border-slate-200 bg-white/20 p-4 last:border-b-0 lg:grid-cols-[minmax(190px,1fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_minmax(130px,0.6fr)_auto] lg:items-end">
      <label className="text-sm font-semibold">
        Component name
        <input
          value={item.name}
          onChange={(event) => update({ name: event.target.value })}
          className={`${fieldClass} mt-1`}
        />
      </label>
      <label className="text-sm font-semibold">
        Salary treatment
        <select
          value={isAfterGrossComponent(item) ? "after_gross" : "included_in_gross"}
          onChange={(event) => {
            const paidAfterGross = event.target.value === "after_gross";
            update({
              treatment: paidAfterGross ? "after_gross" : "included_in_gross",
            });
          }}
          className={`${fieldClass} mt-1`}
        >
          <option value="included_in_gross">Included in gross</option>
          <option value="after_gross">Paid after gross</option>
        </select>
      </label>
      <label className="text-sm font-semibold">
        Calculation
        <select
          value={item.calculation === "extra" ? "fixed" : item.calculation}
          onChange={(event) => update({ calculation: event.target.value as PayrollCalculation })}
          className={`${fieldClass} mt-1`}
        >
          {calculationOptions.filter((option) => option.value !== "extra").map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <SettingNumber
        label={item.calculation === "fixed" || item.calculation === "extra" ? "Amount" : "Percentage"}
        value={item.defaultValue}
        change={(value) => update({ defaultValue: value })}
        help={isAfterGrossComponent(item) ? "This allowance or reimbursement is paid on top of monthly gross salary." : undefined}
      />
      <button
        type="button"
        onClick={remove}
        className="neu-button justify-self-start rounded-lg p-2 text-red-600 lg:justify-self-end"
        aria-label={`Remove ${item.name}`}
        title={`Remove ${item.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <details className="lg:col-span-full">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-slate-600">
          Advanced options
          <HelpTip text="Open only when this component needs special attendance or statutory treatment." />
        </summary>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 rounded-lg bg-white/45 px-3 py-3 text-xs">
          <ControlledCheck
            label="Taxable earning"
            checked={item.taxable !== false}
            change={(value) => update({ taxable: value })}
            help="Classify this component for tax reporting. Reimbursements are usually non-taxable; allowances may be taxable. Monthly TDS remains a manual employee input."
          />
          <ControlledCheck
            label="Prorate for attendance"
            checked={item.prorate !== false}
            change={(value) => update({ prorate: value })}
            help="Reduce this amount when payable days are lower than the full payroll period."
          />
          {pfEnabled && !isAfterGrossComponent(item) && (
            <ControlledCheck
              label="Include in PF calculation base"
              checked={Boolean(item.partOfPfWage)}
              change={(value) => update({ partOfPfWage: value })}
              help="PF already uses Basic salary. Select this only when this earning must also be included in PF wages."
            />
          )}
          {esiEnabled && !isAfterGrossComponent(item) && (
            <ControlledCheck
              label="Include in ESI calculation base"
              checked={item.partOfEsiWage !== false}
              change={(value) => update({ partOfEsiWage: value })}
              help="ESI normally uses eligible gross earnings. Clear this only when this earning is excluded under the company's applicable ESI rules."
            />
          )}
        </div>
      </details>
    </div>
  );
}

function FormulaPreviewTable({
  rows,
  grossTotal,
  afterGrossTotal,
  total,
}: {
  rows: Array<PayrollLine & { formula: string }>;
  grossTotal: number;
  afterGrossTotal: number;
  total: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white/35">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="px-4 py-3 font-semibold">Component</th>
            <th className="px-4 py-3 font-semibold">Calculation</th>
            <th className="px-4 py-3 text-right font-semibold">Example amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line) => (
            <tr key={line.code} className="border-b border-slate-200/70 last:border-0">
              <td className="px-4 py-3 font-medium">{line.name}</td>
              <td className="px-4 py-3 text-slate-500">{line.formula}</td>
              <td className="px-4 py-3 text-right font-semibold">{money(line.amount)}</td>
            </tr>
          ))}
          <tr className="bg-white/35">
            <td className="px-4 py-3 font-semibold" colSpan={2}>Gross salary components</td>
            <td className="px-4 py-3 text-right font-semibold">{money(grossTotal)}</td>
          </tr>
          {afterGrossTotal > 0 && (
            <tr className="bg-white/35">
              <td className="px-4 py-3 font-semibold" colSpan={2}>Paid after gross</td>
              <td className="px-4 py-3 text-right font-semibold">{money(afterGrossTotal)}</td>
            </tr>
          )}
          <tr className="bg-white/60">
            <td className="px-4 py-3 font-bold" colSpan={2}>Estimated total earnings</td>
            <td className="px-4 py-3 text-right font-bold">{money(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PayrollSettingsForm({
  settings,
  setSettings,
  readOnly,
  busy,
  save,
}: {
  settings: PayrollSettings;
  setSettings: (settings: PayrollSettings) => void;
  readOnly: boolean;
  busy: boolean;
  save: () => Promise<void>;
}) {
  const identity = (key: keyof PayrollSettings["identity"], value: string) =>
    setSettings({
      ...settings,
      identity: { ...settings.identity, [key]: value },
    });
  const statutory = (
    key: keyof PayrollSettings["statutory"],
    value: boolean | number | string,
  ) =>
    setSettings({
      ...settings,
      statutory: { ...settings.statutory, [key]: value },
    });
  const automatic = (
    key: keyof PayrollSettings["autoGeneration"],
    value: boolean | number | string,
  ) =>
    setSettings({
      ...settings,
      autoGeneration: {
        ...settings.autoGeneration,
        [key]: value,
      } as PayrollSettings["autoGeneration"],
    });
  function addStatutoryGroup(enabledKey: StatutoryEnabledKey) {
    statutory(enabledKey, true);
  }
  function removeStatutoryGroup(enabledKey: StatutoryEnabledKey) {
    statutory(enabledKey, false);
  }
  function addDefinition(kind: "earnings" | "deductions", presetCode: string) {
    const presets = kind === "earnings" ? earningPresets : deductionPresets;
    const preset = presets.find((item) => item.code === presetCode);
    const base = preset || {
      code: kind === "earnings" ? "custom_earning" : "custom_deduction",
      name: kind === "earnings" ? "Custom earning" : "Custom deduction",
      calculation: "fixed" as const,
      defaultValue: 0,
      taxable: kind === "earnings",
      partOfPfWage: false,
      partOfEsiWage: kind === "earnings",
      prorate: true,
      active: true,
      removable: true,
    };
    const existing = settings[kind].find((item) => item.code === base.code);
    if (existing) {
      setSettings({
        ...settings,
        [kind]: settings[kind].map((item) =>
          item.code === base.code ? { ...item, ...base, active: true } : item,
        ),
      });
      return;
    }
    const next = preset ? base : { ...base, code: uniqueComponentCode(settings[kind], base.code) };
    setSettings({ ...settings, [kind]: [...settings[kind], next] });
  }
  function updateDefinition(
    kind: "earnings" | "deductions",
    code: string,
    values: Partial<PayrollDefinition>,
  ) {
    setSettings({
      ...settings,
      [kind]: settings[kind].map((item) =>
        item.code === code ? { ...item, ...values } : item,
      ),
    });
  }
  function removeDefinition(kind: "earnings" | "deductions", code: string) {
    setSettings({
      ...settings,
      [kind]: settings[kind].filter((item) => item.code !== code),
    });
  }
  const activeStatutoryGroups = statutoryGroupOptions.filter((item) => Boolean(settings.statutory[item.enabledKey]));
  return (
    <fieldset
      disabled={readOnly || busy}
      className="space-y-5 disabled:opacity-70"
    >
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-bold">Company payslip details</h2>
        </div>
        <p className="mb-4 max-w-3xl text-sm text-slate-500">
          These company details are available by default for payslips and statutory records. Leave a field blank when it is not applicable.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {identityFieldOptions.map((option) => {
            const key = option.key;
            return (
              <label key={key} className={`text-sm font-semibold ${option.multiline || key === "payslipFooter" ? "md:col-span-2 xl:col-span-4" : ""}`}>
                {option.label}{option.required ? " *" : ""}
                {option.multiline ? (
                  <textarea
                    rows={2}
                    required={option.required}
                    value={settings.identity[key] || ""}
                    onChange={(event) => identity(key, event.target.value)}
                    className={`${fieldClass} mt-1`}
                  />
                ) : (
                  <input
                    required={option.required}
                    value={settings.identity[key] || ""}
                    onChange={(event) => identity(key, event.target.value)}
                    className={`${fieldClass} mt-1`}
                  />
                )}
              </label>
            );
          })}
        </div>
      </Card>
      <SalaryTemplateSettingsCard
        settings={settings}
        setSettings={setSettings}
        readOnly={readOnly}
        busy={busy}
      />
      <Card>
        <h2 className="mb-4 text-lg font-bold">
          Payroll policy and automation
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold">
            Working day method
            <select
              value={settings.workingDayMethod}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  workingDayMethod: event.target
                    .value as PayrollSettings["workingDayMethod"],
                })
              }
              className={`${fieldClass} mt-1`}
            >
              <option value="calendar_days">Calendar days</option>
              <option value="working_days">Configured working days</option>
              <option value="fixed_30">Fixed 30 days</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Approval workflow
            <select
              value={settings.approvalMode}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  approvalMode: event.target
                    .value as PayrollSettings["approvalMode"],
                })
              }
              className={`${fieldClass} mt-1`}
            >
              <option value="admin_approval">Company Admin approval</option>
              <option value="hr_then_admin">HR then Company Admin</option>
            </select>
          </label>
          <SettingNumber
            label="Payment day"
            value={settings.paymentDay}
            change={(value) => setSettings({ ...settings, paymentDay: value })}
            min={1}
            max={28}
          />
          <SettingNumber
            label="Auto-generation day"
            value={settings.autoGeneration.dayOfMonth}
            change={(value) => automatic("dayOfMonth", value)}
            min={1}
            max={28}
          />
          <label className="text-sm font-semibold">
            Auto period
            <select
              value={settings.autoGeneration.period}
              onChange={(event) => automatic("period", event.target.value)}
              className={`${fieldClass} mt-1`}
            >
              <option value="current">Current month</option>
              <option value="previous">Previous month</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          <ControlledCheck
            label="Prorate from attendance"
            checked={settings.attendanceProration}
            change={(value) =>
              setSettings({ ...settings, attendanceProration: value })
            }
          />
          <ControlledCheck
            label="Publish after approval"
            checked={settings.publishOnApproval}
            change={(value) =>
              setSettings({ ...settings, publishOnApproval: value })
            }
          />
          <ControlledCheck
            label="Automatic generation"
            checked={settings.autoGeneration.enabled}
            change={(value) => automatic("enabled", value)}
          />
          <ControlledCheck
            label="Auto-submit for approval"
            checked={settings.autoGeneration.submitForApproval}
            change={(value) => automatic("submitForApproval", value)}
          />
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">Statutory configuration</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add only the statutory rules this company uses. Disabled rules stay hidden and do not appear in salary setup or payslip calculations.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 text-sm font-semibold">
            Add statutory rule
            <select
              onChange={(event) => {
                const option = statutoryGroupOptions.find((item) => item.enabledKey === event.target.value);
                if (option) addStatutoryGroup(option.enabledKey);
                event.target.value = "";
              }}
              className={`${fieldClass} mt-1`}
              defaultValue=""
            >
              <option value="">Select statutory rule</option>
              {statutoryGroupOptions
                .filter((item) => !settings.statutory[item.enabledKey])
                .map((item) => (
                  <option key={item.code} value={item.enabledKey}>{item.label}</option>
                ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {activeStatutoryGroups.map((group) => (
            <StatutoryRuleCard
              key={group.code}
              group={group}
              settings={settings}
              change={statutory}
              remove={() => removeStatutoryGroup(group.enabledKey)}
            />
          ))}
          {!activeStatutoryGroups.length && (
            <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 xl:col-span-2">
              No statutory rules selected. Add PF, ESI, professional tax, LWF, gratuity, or TDS only when applicable.
            </p>
          )}
        </div>
      </Card>
      <ComponentDefinitions
        title="Custom deductions"
        kind="deductions"
        items={settings.deductions.filter((item) => item.active !== false)}
        presets={deductionPresets}
        add={(presetCode) => addDefinition("deductions", presetCode)}
        update={(code, values) =>
          updateDefinition("deductions", code, values)
        }
        remove={(code) => removeDefinition("deductions", code)}
      />
      {readOnly ? (
        <p className="text-sm text-slate-500">
          Company Admin access is required to change payroll policy.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void save()}
          className="gradient-button flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileCheck2 className="h-4 w-4" />
          )}
          Save payroll settings
        </button>
      )}
    </fieldset>
  );
}

function SettingInput({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        value={value || ""}
        onChange={(event) => change(event.target.value)}
        className={`${fieldClass} mt-1`}
      />
    </label>
  );
}
function SettingNumber({
  label,
  value,
  change,
  min = 0,
  max,
  help,
}: {
  label: string;
  value: number;
  change: (value: number) => void;
  min?: number;
  max?: number;
  help?: string;
}) {
  return (
    <label className="text-sm font-semibold">
      <span className="inline-flex items-center gap-1.5">
        {label}
        {help && <HelpTip text={help} />}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step="0.01"
        value={value ?? 0}
        onChange={(event) => change(Number(event.target.value))}
        className={`${fieldClass} mt-1`}
      />
    </label>
  );
}
function ControlledCheck({
  label,
  checked,
  change,
  help,
}: {
  label: string;
  checked: boolean;
  change: (value: boolean) => void;
  help?: string;
}) {
  return (
    <label className="flex items-center gap-2 font-semibold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => change(event.target.checked)}
        className="h-4 w-4 accent-primary-600"
      />
      <span className="inline-flex items-center gap-1.5">
        {label}
        {help && <HelpTip text={help} />}
      </span>
    </label>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span
      className="inline-flex cursor-help text-slate-400 hover:text-blue-600"
      title={text}
      aria-label={text}
      tabIndex={0}
    >
      <HelpCircle className="h-3.5 w-3.5" />
    </span>
  );
}

function StatutoryRuleCard({
  group,
  settings,
  change,
  remove,
}: {
  group: (typeof statutoryGroupOptions)[number];
  settings: PayrollSettings;
  change: (
    key: keyof PayrollSettings["statutory"],
    value: boolean | number | string,
  ) => void;
  remove: () => void;
}) {
  const statutory = settings.statutory;
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{group.label}</h3>
          <p className="text-xs text-slate-500">Enabled for this company</p>
        </div>
        <button
          type="button"
          onClick={remove}
          className="neu-button rounded-lg px-3 py-2 text-xs font-semibold text-red-600"
        >
          Remove
        </button>
      </div>
      {group.code === "pf" && (
        <div>
          <p className="mb-4 rounded-lg bg-white/45 px-3 py-2 text-xs leading-5 text-slate-600">
            Choose the PF base separately from the cap rule. Selected PF earnings use Basic plus components marked as PF wage in their Advanced options.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              PF calculation base
              <select value={statutory.pfWageBasis} onChange={(event) => change("pfWageBasis", event.target.value)} className={`${fieldClass} mt-1`}>
                <option value="basic">Basic salary</option>
                <option value="gross">Gross earnings</option>
                <option value="eligible_earnings">Basic + selected PF earnings</option>
              </select>
            </label>
            <SettingNumber label="Employee PF %" value={statutory.employeePfRate} change={(value) => change("employeePfRate", value)} help="Percentage deducted from the employee's PF calculation base." />
            <SettingNumber label="Employer PF %" value={statutory.employerPfRate} change={(value) => change("employerPfRate", value)} help="Employer contribution percentage calculated on the same PF base." />
            <SettingNumber label="EPS %" value={statutory.epsRate} change={(value) => change("epsRate", value)} help="The pension share allocated from the employer PF contribution." />
            <SettingNumber label="EDLI %" value={statutory.edliRate} change={(value) => change("edliRate", value)} help="Employer-paid deposit-linked insurance contribution." />
            <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
              <ControlledCheck label="Apply capped PF base above a gross threshold" checked={statutory.restrictPfToCeiling} change={(value) => change("restrictPfToCeiling", value)} help="When enabled, the cap applies only after monthly gross exceeds the configured trigger." />
            </div>
            {statutory.restrictPfToCeiling && (
              <>
                <SettingNumber label="Cap when monthly gross is above" value={statutory.pfCeilingTrigger} change={(value) => change("pfCeilingTrigger", value)} help="Example: enter 20000 to start capping only when monthly gross is above Rs.20,000." />
                <SettingNumber label="Capped PF calculation base" value={statutory.pfWageCeiling} change={(value) => change("pfWageCeiling", value)} help="Example: enter 15000 to calculate PF on at most Rs.15,000 after the trigger is crossed." />
              </>
            )}
          </div>
        </div>
      )}
      {group.code === "esi" && (
        <div>
          <p className="mb-4 rounded-lg bg-white/45 px-3 py-2 text-xs leading-5 text-slate-600">
            ESI has its own base and eligibility ceiling. Paid-after-gross reimbursements are excluded from gross and selected-earnings bases.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              ESI calculation base
              <select value={statutory.esiWageBasis} onChange={(event) => change("esiWageBasis", event.target.value)} className={`${fieldClass} mt-1`}>
                <option value="gross">Gross earnings</option>
                <option value="basic">Basic salary</option>
                <option value="eligible_earnings">Selected ESI earnings</option>
              </select>
            </label>
            <SettingNumber label="Employee ESI %" value={statutory.employeeEsiRate} change={(value) => change("employeeEsiRate", value)} help="Percentage deducted from the employee's eligible ESI wages." />
            <SettingNumber label="Employer ESI %" value={statutory.employerEsiRate} change={(value) => change("employerEsiRate", value)} help="Employer contribution percentage calculated on eligible ESI wages." />
            <SettingNumber label="Apply ESI when monthly gross is at or below" value={statutory.esiGrossCeiling} change={(value) => change("esiGrossCeiling", value)} help="Employees above this monthly gross amount are not eligible for ESI." />
          </div>
        </div>
      )}
      {group.code === "pt" && (
        <SettingNumber label="Professional tax monthly" value={statutory.professionalTaxMonthly} change={(value) => change("professionalTaxMonthly", value)} />
      )}
      {group.code === "lwf" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingNumber label="Employee LWF" value={statutory.employeeLabourWelfareFund} change={(value) => change("employeeLabourWelfareFund", value)} />
          <SettingNumber label="Employer LWF" value={statutory.employerLabourWelfareFund} change={(value) => change("employerLabourWelfareFund", value)} />
        </div>
      )}
      {group.code === "gratuity" && (
        <SettingNumber label="Gratuity provision % of basic" value={statutory.gratuityRate} change={(value) => change("gratuityRate", value)} />
      )}
      {group.code === "tds" && (
        <p className="rounded-lg bg-white/40 p-3 text-sm text-slate-600">
          Manual TDS is enabled. QHR does not estimate income tax automatically: the company enters the monthly deduction while adding or editing the employee, and can change it later in Salary structures.
        </p>
      )}
    </div>
  );
}

function ComponentDefinitions({
  title,
  kind,
  items,
  presets,
  add,
  update,
  remove,
}: {
  title: string;
  kind: "earnings" | "deductions";
  items: PayrollDefinition[];
  presets: PayrollDefinition[];
  add: (presetCode: string) => void;
  update: (code: string, values: Partial<PayrollDefinition>) => void;
  remove: (code: string) => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState("");
  const availablePresets = presets.filter((preset) => !items.some((item) => item.code === preset.code));
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-slate-500">
            Add only the reusable company components this payroll actually uses.
          </p>
        </div>
        <div className="flex min-w-64 flex-1 flex-wrap items-end gap-2 sm:flex-none">
          <label className="min-w-52 flex-1 text-xs font-semibold sm:flex-none">
            Select field
            <select
              value={selectedPreset}
              onChange={(event) => setSelectedPreset(event.target.value)}
              className={`${fieldClass} mt-1 text-sm`}
            >
              <option value="">Choose from list</option>
              {availablePresets.map((preset) => (
                <option key={preset.code} value={preset.code}>{preset.name}</option>
              ))}
              <option value="custom">Custom {kind === "earnings" ? "earning" : "deduction"}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              if (!selectedPreset) return;
              add(selectedPreset);
              setSelectedPreset("");
            }}
            className="neu-button flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            Add field
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.code}
              className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-2 xl:grid-cols-6"
            >
              <label className="text-xs font-semibold">
                Name
                <input
                  value={item.name}
                  onChange={(event) =>
                    update(item.code, { name: event.target.value })
                  }
                  className={`${fieldClass} mt-1 text-sm`}
                />
              </label>
              <label className="text-xs font-semibold">
                Code
                <input
                  value={item.code}
                  onChange={(event) =>
                    update(item.code, {
                      code: event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "_"),
                    })
                  }
                  className={`${fieldClass} mt-1 text-sm`}
                />
              </label>
              <label className="text-xs font-semibold">
                Calculation
                <select
                  value={item.calculation}
                  onChange={(event) =>
                    update(item.code, {
                      calculation: event.target
                        .value as PayrollDefinition["calculation"],
                    })
                  }
                  className={`${fieldClass} mt-1 text-sm`}
                >
                  {calculationOptions
                    .filter((option) => kind === "earnings" || option.value !== "extra")
                    .map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
              </label>
              <SettingNumber
                label="Default value"
                value={item.defaultValue}
                change={(value) => update(item.code, { defaultValue: value })}
              />
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <ControlledCheck
                  label="Prorate"
                  checked={item.prorate !== false}
                  change={(value) => update(item.code, { prorate: value })}
                />
                {kind === "earnings" && (
                  <>
                    <ControlledCheck
                      label="Taxable"
                      checked={item.taxable !== false}
                      change={(value) => update(item.code, { taxable: value })}
                    />
                    <ControlledCheck
                      label="PF wage"
                      checked={Boolean(item.partOfPfWage)}
                      change={(value) => update(item.code, { partOfPfWage: value })}
                    />
                    <ControlledCheck
                      label="ESI wage"
                      checked={item.partOfEsiWage !== false}
                      change={(value) =>
                        update(item.code, { partOfEsiWage: value })
                      }
                    />
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(item.code)}
                className="neu-button self-center justify-self-start rounded-lg p-2 text-red-600 xl:justify-self-end"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
            No fields selected yet.
          </p>
        )}
      </div>
    </Card>
  );
}
