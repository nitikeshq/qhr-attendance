# QHR Advanced Payroll

Status date: 2026-07-20

## Ownership

- Company Admin owns company payroll identity, rules, statutory switches/rates, automatic generation, final approval, publishing, and payment confirmation.
- HR can configure employee salary structures, generate/recalculate payroll, add draft adjustments, and submit records for approval.
- Employees only see approved and published or paid payslips belonging to their own account.
- Super Admin remains outside routine tenant payroll processing, matching the platform/tenant separation in `scope.md`.

## Implemented Flow

1. Company Admin configures legal/payslip details, working-day policy, approval policy, attendance deduction policy, statutory settings, optional automatic generation, and the default salary formula. Basic and HRA can be fixed or percentage-based. Conveyance and other reusable additions/deductions are visible configurable options. Every custom earning independently selects a fixed/percentage calculation and whether it is included in salary gross or paid after gross; after-gross items are excluded from PF/ESI wage bases. Special allowance is manual instead of silently auto-balancing salary.
2. HR or Company Admin enters monthly gross, optional recurring paid-after-gross addition, manual monthly TDS, payment mode, identifiers, and masked bank details while creating or editing an employee. The company formula is applied automatically. Salary structures remains available for advanced component, statutory, and employee-specific overrides.
3. A manual or scheduled run creates one duplicate-safe salary snapshot per employee and period.
4. The engine calculates policy-driven attendance, WFH, half-day, paid leave, unpaid leave, unnoticed absence, holiday, and loss-of-pay values before calculating earnings, custom deductions, employee statutory deductions, employer contributions, net pay, and company cost. Optional gratuity is calculated as a configurable percentage of basic and remains an employer provision rather than an employee deduction.
5. Employees submit reimbursement claims with expense details and protected PDF/JPEG/PNG receipts (or legacy HTTPS references). Managers can complete first-level approval; HR or Company Admin records the approved amount and routes it through a selected payroll month or as a separate payment. Payroll-routed claims are linked exactly once as paid-after-gross lines and become paid with that payroll. Separate payments require their own reference and never change salary net pay.
6. HR can add manual one-time earnings, deductions, reimbursements, bonuses, arrears, or recoveries while the record is draft/submitted.
7. HR submits and Company Admin approves individually or for the whole period. Approval publishes automatically when company policy enables it; otherwise Company Admin publishes individually or in bulk.
8. Company Admin approval creates an immutable issued payslip with a persisted document ID, version, issuance time, and content hash. Company Admin can export payment advice, reconcile bank UTR references in bulk, or record payment individually. Corrections to issued/paid payroll are entered as following-period arrears or recoveries so historical employee documents remain unchanged.
9. Employees view salary earnings, reimbursements paid after gross, employee deductions (including manually entered TDS), employer contributions, statutory applicability, attendance value, and YTD totals. The same separation is preserved in Admin review and downloaded payslips.
10. Historical payslips that predate component snapshots preserve their approved gross, deduction, and net totals. Matching earnings/deductions may be reconstructed from the employee's current salary setup, while unmatched deductions stay explicitly labeled as legacy totals; current statutory policy is shown only as a reference and is never substituted into the historical net pay.

## API Surface

| Method | Endpoint | Purpose |
|---|---|---|
| GET/PATCH | `/api/v1/attendance/policy` | Read or update attendance/WFH/leave payroll rules |
| POST/GET | `/api/v1/reimbursements`, `/api/v1/reimbursements/my` | Submit and list employee expense claims |
| GET/PATCH | `/api/v1/reimbursements`, `/api/v1/reimbursements/:id/review` | Company claim register and manager/finance review |
| POST | `/api/v1/reimbursements/:id/mark-paid` | Record a separately paid reimbursement |
| PATCH | `/api/v1/attendance/status` | HR/Admin attendance status correction for payroll tracking |
| POST | `/api/v1/wfh/assign` | HR/Admin approved WFH assignment with attendance marking |
| GET/PATCH | `/api/v1/payroll/settings` | Read or update company payroll policy |
| GET/PUT | `/api/v1/payroll/salary-structures/:employeeId` | Read or update employee salary structure |
| GET | `/api/v1/payroll/salary-structures/:employeeId/revisions` | Effective-dated salary revision history |
| GET | `/api/v1/payroll/payment-advice` | Download approved unpaid salary payment register |
| POST | `/api/v1/payroll/payments/reconcile` | Reconcile approved salaries with bank UTR references |
| POST/GET | `/api/v1/reimbursements/:id/attachments`, `/api/v1/reimbursements/:id/attachments/:attachmentId` | Upload/download protected receipts |
| GET | `/api/v1/payroll` | Payroll register, summary, runs, settings, and structures |
| POST | `/api/v1/payroll/generate` | Generate or recalculate a period |
| POST | `/api/v1/payroll/:id/adjustments` | Add earning/deduction/reimbursement |
| POST | `/api/v1/payroll/:id/submit` | Submit draft for approval |
| PATCH | `/api/v1/payroll/:id/approve` | Company Admin final approval |
| POST | `/api/v1/payroll/bulk/submit` | Submit all period drafts |
| POST | `/api/v1/payroll/bulk/approve` | Approve all eligible period records |
| POST | `/api/v1/payroll/bulk/publish` | Publish all approved period payslips |
| POST | `/api/v1/payroll/:id/publish` | Publish an approved payslip |
| POST | `/api/v1/payroll/:id/mark-paid` | Record salary payment |
| GET | `/api/v1/payroll/:id/download` | Download printable payslip HTML |
| GET | `/api/v1/payroll/my-payslips` | Employee published payslips |

## Statutory Defaults

The engine ships editable reference defaults, disabled until the company marks the scheme applicable. EPFO documents the usual employee/employer contribution at 12%, EPS diversion at 8.33%, and the Rs.15,000 wage ceiling. ESIC publishes 0.75% employee and 3.25% employer contribution rates with a Rs.21,000 general wage ceiling. Salary TDS is intentionally an employee monthly payroll input because the Income Tax Department requires projected income, deductions, evidence, and the applicable tax regime to be considered.

Official references:

- [EPFO FAQ](https://www.epfindia.gov.in/site_en/FAQ.php)
- [Ministry of Labour and Employment Annual Report 2024-25](https://labour.gov.in/sites/default/files/arenglish2024-25_compressed.pdf)
- [Income Tax Department TDS compliance](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/tds-compliance)

Professional tax, labour welfare fund, and gratuity policy remain company-configured because applicability and treatment vary. Gratuity is modeled as a company-paid provision and does not reduce net pay. Production payroll still requires tenant-specific legal review and external statutory filing/banking integrations.
