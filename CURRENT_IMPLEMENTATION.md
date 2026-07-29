# QHR Attendance - Current Implementation

Status date: 2026-07-20

This is the authoritative description of the recovered workspace. Older documents describe the inaccessible original `attendance-mobile` submodule and may contain historical MongoDB paths, ports, credentials, and feature claims.

## Runtime Architecture

All clients use one API authority:

```text
Landing page (3002) ----\
Admin portal (3003) -----\
Mobile / Expo (8082) ------> Backend API (5001) -> data/dev-db.json
Desktop tracker ----------/
```

| Surface | Current path | Purpose |
|---|---|---|
| Backend | `attendance-mobile/Backend` | Express API and JSON persistence |
| Admin | `admin-panel` | Role-aware Super Admin, Company Admin, HR, and Manager administration |
| Landing | `landing-page` | Public product, registration, demo, and contact forms |
| Mobile | `attendance-mobile` | Expo self-service app with role-aware team approvals |
| Desktop | `desktop-app` | Electron activity and app-usage tracker |

## Implemented Workflows

- Employee and admin authentication, refresh, profile, password change, and logout.
- Company listing, registration, verification, and local onboarding.
- Company Admin employee directory with complete multi-page loading, create/edit, employee-ID/contact/employment/manager/role/status/passcode management, soft deactivation/reactivation, and embedded monthly salary, manual TDS, recurring after-gross addition, statutory identifier, and bank setup; HR has scoped create/edit access without Company Admin-only deactivation or role elevation.
- Attendance check-in/check-out, today/history/team summary, location metadata, company attendance policy setup, full-day/half-day/late-grace thresholds, manual HR/Admin status correction, and policy-aware paid/unpaid/WFH/unnoticed-absence tracking.
- Leave types, balances, application, cancellation, and approval/rejection.
- WFH requests, approval workflows, HR/Admin WFH assignment, automatic WFH attendance marking, and grievance workflows.
- Employee reimbursement claims with expense/category/merchant/project/receipt details, manager and finance review stages, partial approval, payroll or separate-payment routing, payment references, employee history, and company registers.
- Desktop consent, heartbeat, activity snapshots, app usage, live state, and team summaries.
- Advanced tenant payroll with salary setup during employee creation/edit, monthly-gross salary entry, company and employee-specific formulas, visible configurable conveyance/additions/deductions, fixed/basic-percentage/gross-percentage/extra components, manual special allowance and TDS, live PF/ESI/PT/LWF/TDS/gratuity applicability and company-cost preview, policy-driven attendance/leave/WFH loss-of-pay, duplicate-safe manual and scheduled runs, claim-linked reimbursements, one-time adjustments, approval/publishing/payment references, payroll audit history, YTD totals, CSV exports, and itemized payslips that show salary gross separately from paid-after-gross reimbursements.
- Projects, tasks, comments, time logs, and sales-visit records.
- Geofence list/create/update/delete and holiday listing.
- Subscription plans, one-free-Company-Admin seat accounting, paid-seat limits, monthly/yearly renewal amounts, company-specific prices, and billing modes.
- Company Admin subscription self-service with standard-plan selection, paid-seat and monthly/yearly previews, prepaid plan-order invoices, automatic sandbox checkout, manual payment submission, renewal/grace visibility, and paginated invoice/payment history. Super Admin continues to control billing mode, custom terms, and enabled/default gateways.
- Platform and company invoice/payment ledgers with collected, outstanding, partially paid, pending-verification, upcoming-renewal, and renewal-book totals.
- Super Admin manual payment recording and confirmation/rejection/reversal with audit history; Company Admin manual payment submission with reference/proof metadata.
- Automatic billing lifecycle with pre-renewal reminders, 15-day grace reminders, paid-user pausing, and continued access for the free Company Admin.
- Manual online, manual offline, and custom-agreement billing never trigger billing-based account suspension; overdue balances remain available for follow-up.
- Billing email outbox and optional SendGrid delivery using `SENDGRID_API_KEY`, `EMAIL_FROM`, and `EMAIL_FROM_NAME`.
- Super Admin platform dashboard, global tenant metrics, company onboarding/detail/edit/suspension/archive/reactivation, subscription changes, sales lead management, cross-company employee account management, and tenant audit history.
- Super Admin uses a distinct QHR Platform console with platform-only navigation and a global audit log; Company Admin uses the tenant workforce console and cannot access platform audit data.
- Role-specific admin navigation and API authorization for Super Admin, Company Admin, HR, and Manager.
- Super Admin is separated from tenant workforce operations: Manager, HR, and Company Admin own routine attendance, leave/WFH/grievance, payroll, project, geofence, and desktop-activity management.
- Manager direct-report scoping across employees, attendance, leave, WFH, grievances, and desktop activity.
- Tenant suspension and archival enforcement for company discovery, new logins, refresh tokens, and existing non-Super-Admin sessions.
- Landing company registration, demo request, and contact lead persistence.
- Admin navigation, search, exports, settings, employee/geofence forms, leave actions, and real logout.
- Admin attendance register with paginated policy-aware table, WFH assignment, payroll register, runs, salary structures, company payroll/attendance settings, payslip review/adjustments/approval/payment/download, projects/tasks, and desktop activity views backed by the same company data.
- Landing registration now includes password setup, verification-code activation, and admin-login handoff.
- Mobile work assignments, refresh, backend logout, geofence enforcement, seeded leave, and published payslip detail with native PDF generation/share or web print-to-PDF.
- Mobile leave, WFH, grievance/support, reimbursement submission/history, and payslip self-service for every role, plus direct-team attendance and leave/WFH/reimbursement approvals for Manager, HR, and Company Admin.

## Validation Completed

- Backend syntax check: pass.
- Backend integration tests: 21/21 pass, including employee-create salary setup, manual monthly TDS, recurring after-gross additions, reimbursement manager/finance approval, partial approval, duplicate-safe payroll linking, separate payment, payroll payment synchronization, company formulas and overrides, statutory calculations, attendance loss-of-pay, itemized payslips, role permissions, subscriptions, billing, and tenant enforcement.
- Backend production dependency audit: 0 vulnerabilities.
- Admin production build: pass.
- Landing production build: pass.
- Admin and landing production dependency audits: 0 vulnerabilities.
- Expo Doctor: 18/18 checks pass.
- Expo web export: pass.
- Desktop native dependency rebuild and Windows unpacked package: pass.
- Desktop production dependency audit: 0 vulnerabilities.
- PM2 configuration parse: pass.
- Live HTTP workflow: backend, admin, landing, and mobile return HTTP 200.
- Live seeded API workflow: registration/verification, role-aware admin login, employee/geofence/project/task/payroll creation and approval, user check-in/out, leave/WFH/grievance application and approval, desktop activity, tenant isolation, Super Admin company/detail/employee/subscription/lead operations, suspension/archive enforcement, audit logging, logout invalidation, demo lead, and contact lead pass.

## Production Integration Boundaries

The local product workflow is runnable. A real production deployment still requires organization-specific infrastructure and credentials that cannot be inferred from source code:

- Replace JSON-file persistence with a managed transactional database and migration plan.
- Configure SendGrid credentials (or add the selected production mail provider) to deliver the implemented billing email outbox; without credentials reminders remain safely queued.
- Connect production Cashfree and PayU merchant credentials, mandate/checkout APIs, signed webhooks, refunds, and reconciliation to the implemented gateway-neutral billing ledger.
- Configure object storage and malware scanning before accepting uploaded documents.
- Add production domains, TLS, secret management, backups, monitoring, and retention policies.
- Run Android/iOS background location and geofence tests on physical devices.
- Supply desktop/mobile signing certificates and release-store accounts.
- Complete legal review and employee consent policy for desktop monitoring.
- Review each tenant's payroll policy with its payroll/legal advisor before production, and add bank-specific payment files, statutory return filing, Form 16, and accounting integrations when those external formats and credentials are supplied.

These are deployment inputs, not hidden code paths. The applications expose stable local contracts so each integration can be added without introducing another backend.
