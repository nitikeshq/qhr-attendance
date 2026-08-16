# QHR Attendance Policy and Payroll Tracking

Status date: 2026-07-19

## What Is Implemented

- Company Admin can configure attendance payroll impact as leave-only, attendance plus leave, or no payroll deduction.
- Full-day, half-day, late-grace, paid leave, unpaid leave, unnoticed absence, holiday, and WFH payable-day rules are stored in the company settings.
- HR/Admin can manually correct an employee day as present, half day, absent, or work from home with work duration and notes.
- Approved WFH requests and HR/Admin WFH assignments automatically create or update attendance rows as `work_from_home`.
- Payroll uses the shared attendance policy summary, so loss-of-pay days are calculated from the same attendance/WFH/leave data shown in the admin portal.
- Existing companies stay conservative by default: payroll continues as leave-only until the company enables attendance-plus-leave deductions.

## Main API Surface

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/attendance/team` | Team attendance rows with today's status and monthly policy summary |
| GET | `/api/v1/attendance/overview` | Policy-aware team attendance summaries |
| GET | `/api/v1/attendance/policy` | Read attendance, leave, holiday, and WFH payroll rules |
| PATCH | `/api/v1/attendance/policy` | Save company attendance policy, leave types, and holidays |
| PATCH | `/api/v1/attendance/status` | Correct employee attendance status/duration |
| POST | `/api/v1/wfh/assign` | Assign approved WFH and mark attendance |
| PATCH | `/api/v1/wfh/:id/review` | Approve/reject WFH; approval marks attendance |
| POST | `/api/v1/payroll/generate` | Generate payroll using the shared attendance summary |

## Verification

- Backend API test `attendance policy, WFH assignment, and unpaid leave feed payroll loss-of-pay` covers:
  - attendance policy save,
  - full-day and half-day manual statuses,
  - admin WFH assignment,
  - employee unpaid leave with admin approval,
  - team attendance summary,
  - payroll generation with 2.5 payable days and 1.5 loss-of-pay days.
- Full backend suite: 17/17 passing.
- Admin TypeScript check: passing.
