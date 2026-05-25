# QHR Full Feature Audit

Status: broad static audit plus first implementation/test pass completed. This is not a final production sign-off because disk space is still critically low and mobile, remaining web, and desktop verification need more headroom.

## Executive Summary

QHR has a large product skeleton, but several sections are not production-ready. The backend is the strongest production surface today: Node 24 validation passes with 42 suites / 396 tests, 92.60% statement coverage, 93.05% line coverage, and clean ESLint. The most complete functional web surface is `attendance-mobile/be-portal`. The polished Next admin in `attendance-mobile/Backend/admin-panel` is mostly mock/static. Mobile and desktop still need real-device/install/build verification once disk headroom is available.

## Screenshot Minimum Feature Matrix

This matrix maps the minimum feature set visible in the saved screenshots against the current codebase. `Working` means there is a real backend route plus at least one usable UI surface. `Partial` means the model/routes or screens exist but are incomplete, mismatched, or not fully enterprise-ready. `Placeholder` means mostly static/mock UI. `Missing` means no meaningful product implementation was found.

| Screenshot feature | Current status | Evidence / gap |
|---|---:|---|
| Employee profiles | Partial | Backend employee CRUD and `be-portal` employee page exist; profile lifecycle, documents, custom fields, audit trail, and onboarding are incomplete. |
| Departments and roles | Partial | Designation/department routes and pages exist; role/RBAC policy is still basic and needs enterprise permissions. |
| Branches / locations | Partial | Attendance areas/geofence pages exist; branch/company location master data is not a full Core HR branch module. |
| Custom fields | Partial | Company-scoped backend model/routes and web admin page now exist; needs create/edit UX and field enforcement on target entities. |
| Org chart | Partial | Backend org-chart route and web page now exist from reporting-manager data; needs true visual chart layout and drag/edit manager workflow. |
| Birthdays and anniversaries | Partial | Backend milestone route now exists using date of birth/joining date; needs dashboard/mobile surfacing and notifications. |
| Face attendance | Missing | No face capture, face match, liveness, enrollment, or verification flow found. |
| Work modes: WFH/Office/Remote | Partial | WFH requests and attendance method exist; no clean unified work-mode policy/calendar across web/mobile. |
| Geo-fencing | Partial | Attendance areas, location services, and geofence checks exist; check-in/out enforcement and multi-area policy integration are incomplete. |
| Auto checkout | Partial | Background tasks and attendance checkout exist; reliable server-side auto-checkout rules/jobs are not production-proven. |
| Late tracking | Partial | Attendance model tracks late fields; policy setup, reports, and corrective workflows are incomplete. |
| Multi-level leave approvals | Partial | Leave approval chain fields and approval routes exist; real multi-level workflow UX/policy setup is incomplete. |
| Holidays | Partial | Holiday backend and web/mobile pages exist; calendar-grade UX and policy scoping need hardening. |
| Unified calendar | Partial | Backend unified calendar route and web page now combine holidays, attendance, leave, and WFH. Needs drag/drop workflows and mobile calendar view. |
| Leave accrual/balance visual | Partial | Leave balance routes exist; visual policy/accrual management is not complete. |
| Automated payroll | Partial | Salary/payroll APIs exist and runtime blockers were fixed; calculations are simplified and duplicate APIs remain. |
| Payslip generation | Partial | Mobile now loads real `/salary/my`; backend payslip detail route added. PDF/email generation still missing. |
| Tax and deductions | Partial | Payroll deductions exist and employee tax declaration model/routes were added; statutory calculation rules and HR review UI remain. |
| Investments / IT declarations | Partial | Tax declaration model/API now supports declared items/proofs; needs mobile/web declaration UI and HR verification flow. |
| Recruitment and ATS | Partial | Job opening/candidate models, routes, stats, and web ATS page added; needs interviews, offers, career page, and candidate actions. |
| Advanced reports and analytics | Partial | Backend overview/headcount reports and web reports page added; no report builder, exports, or scheduled reports yet. |
| Priority support / SLA | Missing | Pricing copy can mention it, but no support/SLA workflow in product. |
| Custom workflows | Missing | No workflow builder/rule engine found. |
| Integrations | Partial | Integration model/routes and web status page added; actual provider connectors, secrets, webhooks, and sync jobs remain. |
| Onboarding | Partial | Company registration and employee creation exist; employee onboarding checklist/document workflow is incomplete. |
| Pricing page | Partial | Landing page has pricing/CTA concepts; needs final claims, proof, legal pages, and real demo/sales follow-up UI. |
| Demo request capture | Partial | Mongo-backed demo request route added; needs spam protection, admin sales UI, and notifications. |
| B2B web design quality | Partial | `be-portal` now includes the screenshot minimum modules in navigation/pages; many actions, filters, tables, and responsive refinements remain. |
| B2B mobile design quality | Partial | Mobile leaves, payslip, and activity now load backend data; design tokens and remaining admin/approval flows still need full QA. |

## Critical Blockers

- Full verification is constrained: disk is critically low. Node 24 is installed and verified through nvm, but some shells still default to older Node unless `nvm use 24` is loaded.
- Architecture must stay one-backend: all mobile, web, desktop, and landing/demo flows should target `attendance-mobile/Backend`. Folder restructuring is deferred, so docs and PM2 config should point at the current canonical paths instead of introducing duplicate runtime roots.
- Backend had several cross-tenant risks outside the employee controller; a first pass has now tightened leave, WFH, grievance, salary, and company-by-id paths, but a full security pass is still required.
- Admin/API contracts drift across web and mobile.
- Some backend runtime blockers were fixed: employee-management/payroll `AppError` imports, salary helper export, and leave route ordering. Remaining route/controller drift still needs tests.
- Registration now sends verification/passcode email through SMTP when configured; production fails closed if SMTP is missing.
- Mobile login and core attendance contract were corrected to send company code and use `/attendance/my`; leaves, payslip, activity, and several admin flows still need real API alignment.
- Mobile leaves, payslip, and activity were moved off obvious mock data and now call backend APIs with empty/error/loading states.
- New backend/web baselines were added for custom fields, recruitment/ATS, org chart/milestones, integrations, reports, payslip detail, and tax declarations.
- Unified calendar backend/web page was added for attendance, holidays, leave, and WFH.
- Desktop tracker needs production API URL, offline replay, token refresh, and consent/retention enforcement.
- Root `admin-panel` and root `landing-page` are demo shells, not production surfaces.

## Backend Coverage

| Area | Status | Main gaps |
|---|---|---|
| Auth | Exists | Missing validators for admin login/refresh/change password/device token; refresh token is DB-match only. |
| Companies | Exists | Same-company check missing on company-by-id; registration email delivery missing; public company list leaks codes. |
| Employees | Improved | Better tenant scoping added; still needs full super-admin policy review. |
| Employee management | Risky | Runtime import error; overlaps `/employees`; treats string designation like ObjectId. |
| Attendance | Exists | Geofence status logged but not enforced; managers can see broad company data. |
| Attendance areas | Exists | Not integrated into check-in/out; some manual validation edge cases. |
| Location | Exists | Weak batch limits; manager location access too broad. |
| Leave | Exists | Cross-tenant risk on ID-based privileged reads/approvals; duplicates leave type logic. |
| WFH | Exists | Fetch-by-id before scoping; super-admin assumptions can break. |
| Grievances | Exists | ID-based mutation scoping needs tightening. |
| Payroll/salary | Risky | Duplicate APIs; runtime import issues; simplified math; tenant checks missing in places. |
| Projects/tasks | Exists | Authorization too broad; weak validation; mobile route gaps. |
| Desktop activity | Exists | Privacy/consent/rate-limit gaps; detail route tenant risk. |
| Health | Exists | Partial validation; no company policy toggle enforcement. |
| Absents | Exists | Review/auto-process tenant and validation gaps. |
| Demo requests | Fixed baseline | Mongo-backed route added; still needs spam/rate/captcha and sales follow-up UI. |
| Dead legacy | Present | SQL `payroll.js`, `exitFormalities.js`, migrations should be removed or quarantined. |

Current backend validation baseline: 42 Jest suites / 396 tests pass on Node 24, with active production-surface coverage at 92.60% statements / 93.05% lines. Backend `npm run lint` passes cleanly with zero warnings. Dead, unmounted legacy SQL route files are excluded from coverage and should be removed or quarantined during the final folder-structure cleanup.

## Mobile Coverage

| Area | Status | Main gaps |
|---|---|---|
| Login/auth | Wired but likely broken | App should send company code; passcode validation must be consistent; logout/device token not fully wired. |
| Permissions | Native only | Consent state not stored server-side; decline handling is weak. |
| Home attendance | Partial/local | Today state should load server-first; no strong manual fallback/status banner. |
| Attendance history | Mismatched | Calls `/attendance/history`; backend exposes `/attendance/my`. |
| Leaves | Improved | Mobile now loads leave types, balance, requests and submits leave; cancellation and richer balance totals still need work. |
| WFH | Mostly wired | Needs better errors/offline draft handling. |
| Approvals | Partly wired | Detail uses missing service methods. |
| Tasks/sales visits | Partly wired | Missing `/projects` and `/edit-task`; upload/photo flow incomplete. |
| Grievances | Wired | Attachments/offline drafts missing. |
| Payslip | Improved | Mobile now loads `/salary/my`; PDF/email and tax declaration UI remain. |
| Health/activity | Partial | Activity now loads desktop activity backend and shows empty/error states; health remains partly local. |
| Admin settings | Mixed | Missing leave type form; geofence endpoints drift. |
| Background/offline sync | Risky | Payloads do not match current backend; reconciliation is weak. |

## Web/Desktop Coverage

| Surface | Status | Main gaps |
|---|---|---|
| Root admin-panel | Static shell | No API, routes, or working actions. |
| Root landing-page | Static shell | Fake claims, dead CTAs, weak B2B credibility. |
| Backend Next admin | Polished mock | Many mock pages, missing pages in sidebar, API base/path drift. |
| Backend landing | Improved | Still needs email verification delivery, prod admin URL, proof/screenshots, terms/privacy. |
| be-portal | Closest real admin | Added missing module pages; edit/create actions, endpoint polish, and mobile table states remain. |
| desktop-app | Real tracker code | Wrong default URL, offline replay missing, token refresh missing, privacy enforcement missing. |

Production blocker summary: web needs a single chosen admin surface and final builds; mobile needs dependency/type/build checks plus real-device geofence/background QA; desktop needs production API URL, auth refresh, offline replay, consent, retention, and disclosure checks.

## Recommended Work Order

1. Free disk and switch local/runtime Node to 24.
2. Run full install/build/test for backend, mobile, landing, and `be-portal`.
3. Finish sales follow-up UI and notifications for demo requests.
4. Add full edit UX for recruitment, custom fields, integrations, tax declarations, org chart, and reports.
5. Close remaining cross-tenant holes in attendance areas, desktop activity details, absents, tasks/projects, and legacy routes.
6. Add face attendance only after product/security decisions on biometrics, liveness, consent, and retention.
7. Add exports, report builder, production notification flows, and finish mobile QA for the new calendar/tax declaration screens.
8. Remove or quarantine dead SQL/legacy routes.
9. Add E2E smoke tests for company registration, admin login, employee creation, geofence setup, mobile check-in/out, leave approval, payroll/payslip, recruitment, custom fields, reports, and demo request.
