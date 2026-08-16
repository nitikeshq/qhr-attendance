# QHR work backlog

Everything raised in review, in the order it will be done. Updated as items land.

Legend: `[x]` complete and validated · `[~]` in progress · `[ ]` not started · `[!]` blocked on a decision

Deployment state is tracked separately; `[x]` does not by itself mean the latest local changes are live.

**🎯 AUTO CHECK-IN STATUS:** See `AUTO_CHECKIN_STATUS.md` for complete feature status. **All automatic geofencing and attendance features are fully implemented and tested.** Ready for device build and testing.

---

## 0. Blocked — needs a decision or infrastructure

- [!] **HTTPS.** Payroll figures, bank digits, PAN/Aadhaar fragments and every password cross the network in clear text. Needs a domain, then `certbot`.
- [!] **Storage durability.** Single JSON file, one `.bak` copy, single process, no point-in-time recovery. Decide: Postgres, or JSON plus scheduled off-box backups with a tested restore.
- [!] **Rotate live demo passwords.** `deploy/rotate-demo-credentials.sh` is written and deployed but not run — it prints new passwords once and they must be captured.
- [!] **Versioned payroll settings.** Generating an old month applies today's statutory rules. Correct fix is effective-dated settings; the stale-period warning is the stopgap.
- [!] **Earned vs paid basis** for statutory registers and TDS. `yearToDate` sums approved and paid payslips (earned). Your accountant decides which basis each register uses.

---

## 0b. Reported in review — fixed in this batch

Raised directly from screenshots and use. Root causes are recorded because several
looked like different bugs but shared one cause.

- [x] **Every page had a second scrollbar.** The shared `<main>` used `overflow-x-hidden`; per CSS, one axis `hidden` with the other `visible` computes the other axis to `auto`, so the content area became its own vertical scroller. Now `overflow-x-clip`, leaving the window as the only vertical scroller.
- [x] **Payslip and salary dialogs were oversized and sat too high.** Payroll had a private overlay with no height bound and a top-anchored panel. Replaced with a shared `Modal` in `components/ui.tsx`: centred, `max-h-[calc(100dvh-3rem)]`, fixed header, scrolling only in the body, Escape and backdrop close, background scroll locked. The page-level modal was migrated to the same component, so all dialogs match.
- [x] **Admin settings appeared not to save, office hours especially.** Three separate causes: (1) office start/end and timezone existed in *two* cards writing through *two* endpoints (`/companies/settings` and `/onboarding/company_profile`), so whichever saved last silently overwrote the other; (2) the only Save button sat at the bottom of the unrelated "Work from home rules" card, three cards below the fields being edited; (3) a background refresh reset the form while it was being edited. Now: office hours and timezone are owned solely by Company details, each settings card carries its own Save with an explicit unsaved-changes state, and a refresh no longer discards edits. Verified end to end that values reach disk.
- [x] **HR saw default settings and could not save them.** The console only fetched `/companies` for `admin`, although the backend allows HR, so HR's form fell back to hardcoded defaults and saved those back. HR now loads the company record.
- [x] **Payslips always showed 31 / 31 paid days.** Not a calculation fault: under `calendar_days` every date of the month counts and paid weekly offs are included, so a full July really is 31 of 31. What was missing was visibility and control. The basis selector now sits beside the work week with a live month preview instead of being buried in Payroll settings, the payslip states which basis produced the figure, and the label reads "Paid days / salary basis". The default deliberately stays `calendar_days`: switching to `working_days` does not change a full month's pay, it makes each loss-of-pay day cost gross/23 instead of gross/31, so it belongs to policy rather than to a default.
- [x] **Pay dates ignored the working calendar.** `paymentDay` was a bare number, so a pay day falling on a weekly off or a public holiday stayed there and the register promised money on a day no transfer would happen. `paymentDateForPeriod` now brings it forward to the previous working day, never later, and the payroll preview shows the effective date with the reason when it moves.
- [x] **Payslip download produced a raw `.html` file.** Admin now uses the same print-ready flow as the mobile app: it opens the shared backend template and triggers the print dialog, so it saves as PDF. Labelled "Print / save PDF".
- [x] **Payslips printed the whole company profile.** GSTIN and employer PAN removed; TAN only when TDS was deducted; PF/ESI establishment codes only when that deduction applies; one address (place of work, else registered office) instead of two; duplicated state line dropped. Settings still collect all of it for calculations and filings.
- [x] **Mobile app had no real icons.** All glyphs were hand-composed from ~240 lines of positioned `View`s. Replaced with `@expo/vector-icons@15.0.2` (ships with Expo, no native rebuild) behind the app's own `Icon` name vocabulary in `src/icons.js`. Imported from the single family, so only `Ionicons.ttf` bundles: web bundle 957 kB → 530 kB.
- [x] **Mobile navigation hid half the app.** The five-slot tab bar pushed the rest into a bare overflow sheet showing only labels. Replaced with a real **Menu** screen: grouped sections (My day, Requests, Work, Pay, Manage), an icon and one line of explanation per destination, badge counts, and sign-out.
- [x] **Mobile Home was read-only.** Now leads with today's state, four quick actions, today's figures, an approvals prompt for managers, and identity details.
- [x] **Mobile Attendance and Work screens were unstyled lists.** Both now use the shared section/card/badge primitives, real icons, late-arrival notice, task counts (assigned/open/overdue/completed), overdue highlighting, and proper empty states.

## 0d. Self-service requests, entitlements and employee visibility

Requested in review: pickers instead of free text, HR-policy leave entitlements with a
configurable cost when exceeded, and real figures for employees in the app.

**Backend foundation — done and tested (60 backend tests)**

- [x] **Company-owned option lists.** New `utils/requestOptions.js` with seeded reimbursement categories (travel, accommodation, meals, mobile and internet, office supplies, training, medical) and support categories (salary, attendance, facilities, manager, harassment, IT). Stable `code` per option, `active` flag so retiring one never rewrites history, and duplicate codes collapse instead of producing two options that write the same value.
- [x] `GET /companies/request-options` returns leave types plus both category lists in one call, readable by any role because the employee app renders the dropdowns. `PATCH /companies/request-options` is admin-only.
- [x] **Free text no longer accepted.** A reimbursement category is resolved against the company list; `allowOther` is configurable per list, and an "Other" claim keeps the employee's wording in `categoryLabel` rather than inventing a code. Turning "Other" off refuses unlisted categories.
- [x] **Leave types are validated on apply.** Previously any free-text code was accepted: an unknown code created a zero-allowance bucket, and anything containing "unpaid" skipped the balance check entirely. An unrecognised type is now refused and lists the valid ones.
- [x] `GET /leaves/types` returns normalized types with a resolved `unpaid` flag instead of the raw stored array.
- [x] **Employees can see their own figures.** New `utils/employeeSummary.js`, exposed as `GET /attendance/my-summary?period=` and `GET /attendance/my-year?year=`. Both reuse `buildAttendanceSummary`, so what an employee sees and what payroll pays cannot disagree. The old self-service summary hardcoded `absentDays: 0`, hiding the one figure that costs money. The year view always returns twelve months so a chart has a stable shape, marks future months rather than counting them as absence, and includes leave usage per type with allowance, remaining and over-allowance.
- [x] Registered tenants now store normalized leave types and seeded option lists, matching seeded tenants.

**Remaining for this feature**

- [ ] **Mobile pickers.** Replace the free-text leave type and expense category inputs with dropdowns fed by `/companies/request-options`, add an "Other" field, and show remaining balance beside the chosen leave type. Also add the missing support-request category input.
- [ ] **Entitlement policy and the cost of exceeding it.** Today an over-allowance request is hard-rejected at submission, so there is no way to take unpaid leave beyond the allowance. Needs: a per-type carry/accrual decision, and an admin-selected treatment when the allowance is exhausted — refuse, convert to unpaid at the normal per-day rate, deduct a fixed amount per day, or deduct a percentage of per-day salary. One option chosen per company, applied in `buildAttendanceSummary` and shown on the payslip.
- [ ] **Leave balances never reset.** `getBalance` matches on `employeeId` only and ignores its own `year` field, so there is no annual rollover; pending requests also do not reserve balance, letting several requests each pass the check and collectively exceed the allowance.
- [ ] **Mobile detail and charts.** Fill every screen with the figures its page implies, using the new endpoints: monthly and yearly present/absent/leave/LOP counts, a twelve-month bar chart, leave-usage bars per type against allowance, and late-arrival trend. Charts can be built from Views, so no charting dependency is needed.
- [ ] **Admin UI for the lists.** Leave types are currently only editable inside the onboarding wizard, and the new category lists have no screen yet. Both belong in Configuration alongside the work week.

## 0c. Reported in review — still open

- [ ] **Mobile Requests screen.** Four stacked forms with no field labels, dates typed as `YYYY-MM-DD`, free-text leave type and expense category, and raw status text instead of the `Badge` component. Needs labelled fields, a date picker, pickers for type/category, and per-form success and error surfaces.
- [ ] **Mobile Team screen.** Raw status text instead of `Badge`, five metrics that wrap awkwardly, approve/reject buttons that change card height, and no per-approval loading state.
- [ ] **Mobile session persistence.** Token and employee live only in React state, with no `SecureStore`, so a reload signs the user out.
- [ ] **Mobile loading and error feedback.** One boolean and one string drive a single banner used for success, warning and error alike; no skeletons, so screens show stale content while refreshing.
- [ ] **Mobile payslip HTML duplication.** `App.js` still carries its own brown/orange payslip template alongside the canonical backend one. Point the app at the endpoint HTML and delete the copy.
- [ ] **Roster half-days are not a payroll concept.** A weekday set to "half" is counted in the work-week preview, but `buildAttendanceSummary` only branches on `off`, so a rostered half day is not scheduled or paid as 0.5. Decide the intended semantics, then implement with tests.
- [ ] **Existing payslips keep their snapshot.** Records generated before the salary-day basis changed still show the old figures until a draft is recalculated. Approved and paid records are immutable by design; confirm this is the intended experience.

## 1. Security and trust — done

- [x] Registration verification hardened: code hashed with pbkdf2, 30-minute expiry, 5-attempt lock, consumed on use, never returned in the response (test env only).
- [x] Fixed: a company with no stored code was verified by *any* code.
- [x] `POST /companies/resend-verification` with a 60-second cooldown, and a response that does not reveal whether a tenant exists.
- [x] Migration hashes and expires any plaintext code left in the data file.
- [x] Outbound email service with queue, retry and dedupe (`services/mailer.js`), flushed on boot and hourly.
- [x] `GET /admin/outbound-emails` so the platform owner can relay codes until SMTP is configured.
- [x] Demo seeding gated out of production; an empty production data file yields one bootstrap admin whose password comes from env or is printed once.
- [x] Registration wizard resend button, and it degrades correctly when the code is not returned.
- [x] Removed pre-filled demo credentials from the login form (earlier session), now guarded by a test.

## 2. Quality gates — done

- [x] Playwright browser tests: every console page renders, reload keeps the page, back/forward works, scroll resets, unknown page falls back, calendar renders every event kind, employee profile tabs load, payroll preview stays concise, and the sign-in form ships no credentials. 11 tests.
- [x] Runs both servers itself against a throwaway data file; uses a production build so hydration races don't cause flakes.
- [x] `verify-admin-bundle.sh` asserts new UI strings are present and removed ones stay absent.

## 3. Work calendar — backend done, UI pending

- [x] **The trap:** weekly offs were only honoured under `workingDayMethod: 'working_days'`. Under `calendar_days` every date counted as working, so a Sunday with no check-in became an unnoticed absence — about 8 days of pay per person per month once absence deductions are enabled. Fixed: weekly offs recognised under all methods, classified `weekly_off`, paid via `weeklyOffPayableDays`.
- [x] Work week model: per weekday `full` / `half` / `off`, plus `nth` patterns (2nd and 4th Saturday) and `alternate` parity.
- [x] `workingDayMethod` now controls the payable-day denominator only, so no existing tenant's pay changes.
- [x] `GET /attendance/policy` returns the work week and a plain-English summary.
- [x] `PATCH /attendance/work-week` (admin only), keeps the legacy `workingDays` list in step.
- [x] `GET /attendance/work-week/preview?period=` day-by-day month with working / half / weekly-off / holiday counts and the payable-day basis.
- [x] Deleted a dead duplicate `attendanceSummary` in `payroll.js` that carried its own copy of the rule.
- [x] Work-week editor UI with the month preview: per-weekday full / half / off / "some weeks off" with a 1st–5th occurrence picker, and a month calendar showing working, half, weekly-off and holiday days plus the payable-day basis. Browser test covers it.
- [ ] Move work week and office hours onto work locations, company value as default.
- [ ] Derive the half-day threshold from office hours instead of a fixed 240 minutes.

## 4. Attendance page

- [x] Per-employee monthly attendance history endpoint with manager/HR/admin scoping.
- [x] Employee names in the daily register and location groups open the employee profile directly on the Attendance tab and preserve the month in the URL.
- [ ] Month / date-range view for all employees, wiring the unused `GET /attendance/overview`.
- [ ] Department and reporting-manager filters.
- [ ] Export a period, not just the loaded day.
- [ ] Manual correction / regularisation with a reason and an audit entry.

## 5. Payroll preview and readiness

- [x] `GET /payroll/preview?period=` — dry run using the same `calculatePayroll` and `buildAttendanceSummary` as generation, writing nothing. Verified by count-unchanged assertions.
- [x] Readiness check. Company blockers: missing legal name, missing registered address, no active work location. Company warnings: missing PAN, missing TAN with TDS on, no payroll address, PF/ESI enabled without codes, stale or unfinished period. Employee blockers: no salary structure, pending leave in the period. Employee warnings: pending WFH, no attendance records, missing UAN/ESI/PAN, missing bank details, no work location, queued reimbursements.
- [x] Preview table per employee: scheduled days, payable days, LOP, gross, deductions, net, and a plain-language reason column. Company blockers link straight to the page that fixes them.
- [x] Block approval while a leave overlapping the period is still pending, with an explicit `force` escape.
- [x] Every blocker and warning carries a `fix` target so it is actionable.
- [ ] Flag a draft as stale when attendance or leave changed after it was generated.
- [~] Future periods: now a preview warning rather than a hard block. Three existing tests deliberately use forward-dated periods for stable fixtures, and a draft payslip is reversible, so a hard block was the wrong trade.

## 6. Exceptions review

- [x] `view=exceptions` returns only employees whose figures differ from a clean full month — same computation, filtered, so the two views can never disagree. Default view in the UI.
- [ ] One-click LOP waiver, inserted as a labelled adjustment so the payslip shows deduction and waiver.

## 7. Employee profile page and scalable navigation

- [x] Stable deep URL: `?page=employee-detail&id=<id>&tab=<tab>&period=<month>`. Direct refresh and Back/Forward fetch the employee by ID instead of depending on the loaded list page.
- [x] Organized tabs: Overview, Salary, Payslips, Attendance, Leave, Assets, and Access. Compensation tabs are hidden from managers.
- [x] Editing is inline on the profile using the shared complete employee form; the separate Edit popup entry point is removed.
- [x] Employee names route contextually from Employees, Attendance, Leave, WFH, Payroll preview/register/structures/audit, Reimbursements, Assets, Projects/Tasks, Grievances, Desktop Activity, and tenant employee lists.
- [x] Employee directory uses server-side search, status filtering, deterministic ordering, and 10/25/50/100-row pagination. The backend also supports department, manager, and work-location filters.
- [x] Profile payslips and leave history use employee-scoped, paginated backend queries instead of loading and filtering the global register.
- [ ] Show salary revision history directly in the profile Salary tab.
- [ ] Download all payslips for a year as one zip.
- [ ] Add controlled server pagination to the full payroll register and long-lived profile history tabs rather than returning up to 100 rows at once.

## 8. Payments as records

- [ ] `salaryPayments` with reference, real paid date, amount, mode, note and allocations across payslips.
- [ ] Partial payments with derived amount paid, balance and state (`unpaid` / `partially_paid` / `paid`).
- [ ] **Blocker today:** the payment reference must be unique per payslip, so one bank transfer cannot clear three months.
- [ ] Reject paid dates in the future (only the format is checked today).
- [ ] Migrate existing `paymentReference` / `paidAt` / `paymentStatus`.
- [ ] Allow reopening a payslip while approved, unissued and unpaid, with a reason.

## 9. Arrears

- [ ] Ledger across all periods: employee, period, net, paid, balance, days overdue against `paymentDay`, buckets 0–30 / 31–60 / 61–90 / 90+, company total.
- [ ] Batch allocation, oldest month first, overridable.
- [ ] Employee-visible payment status per month.
- [ ] Optional promised payment date and note.

## 10. Pricing connected end to end

- [ ] Public pricing page reads the live plan catalogue instead of static content.
- [ ] Bulk re-price with a preview of affected tenants and deltas, applied from next renewal.
- [ ] Remove the silent `?? 19` fallback price; surface unpriced companies.
- [ ] Audit money changes with old and new values, not just field names.
- [ ] Flag on the company when its price differs from its plan.

## 11. Expose what already works

- [ ] `autoGeneration` toggle in Payroll settings. Automatic runs already work — hourly scheduler, chosen day, submits for approval — but are disabled by default and API-only.
- [ ] Explicit "do absences reduce pay?" choice instead of deriving it from an `attendanceProration` checkbox.
- [ ] Payroll notifications: payslip published, payment received, period overdue at 30/60/90 days. There are none today.

## 12. Self-service and operations

- [ ] Employee password reset and profile edits with an approval step.
- [ ] Manager delegation prompt so approvals don't stall silently.
- [ ] Monitoring, alerting, staging environment, log rotation.
- [ ] Leaver final settlement carrying outstanding arrears.

---

## Earlier sessions, already shipped

Registration wizard and enterprise redesign · landing page rewrite · admin design system and dark nav rail · payslip dual address (registered office and place of work) · CSV import with dry run · seat model without a bundled free seat · plan CRUD · calendar with holidays, events, birthdays and anniversaries · notification inbox · geofence-to-site backfill and geofence editing · employee lifecycle with one-time passwords · URL-backed navigation and scroll reset · dashboard subscription figure corrected from a hardcoded per-head price · demo-data loader removed entirely.
