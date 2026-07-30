# QHR work backlog

Everything raised in review, in the order it will be done. Updated as items land.

Legend: `[x]` complete and deployed · `[~]` in progress · `[ ]` not started · `[!]` blocked on a decision

---

## 0. Blocked — needs a decision or infrastructure

- [!] **HTTPS.** Payroll figures, bank digits, PAN/Aadhaar fragments and every password cross the network in clear text. Needs a domain, then `certbot`.
- [!] **Storage durability.** Single JSON file, one `.bak` copy, single process, no point-in-time recovery. Decide: Postgres, or JSON plus scheduled off-box backups with a tested restore.
- [!] **Rotate live demo passwords.** `deploy/rotate-demo-credentials.sh` is written and deployed but not run — it prints new passwords once and they must be captured.
- [!] **Versioned payroll settings.** Generating an old month applies today's statutory rules. Correct fix is effective-dated settings; the stale-period warning is the stopgap.
- [!] **Earned vs paid basis** for statutory registers and TDS. `yearToDate` sums approved and paid payslips (earned). Your accountant decides which basis each register uses.

---

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

- [x] Playwright browser tests: every console page renders, reload keeps the page, back/forward works, scroll resets, unknown page falls back, calendar renders every event kind, sign-in form ships no credentials. 8 tests, ~30s.
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

- [ ] Month / date-range view for all employees, wiring the unused `GET /attendance/overview`.
- [ ] Department and reporting-manager filters.
- [ ] Per-employee attendance history endpoint for HR (`/my` is self-only today).
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

## 7. Employee profile page

- [ ] Own URL, tabs: Overview, Salary and revisions, Payslips, Attendance, Leave, Assets, Access.
- [ ] Download all payslips for a year as one zip.
- [ ] Permission gating so a manager sees attendance and leave but not compensation.

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
