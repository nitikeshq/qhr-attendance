# Data migration and work locations

## Which address appears on a payslip

A company can run several sites, so a payslip carries **two** addresses:

| Line | Source | Meaning |
|---|---|---|
| `Regd. office` | `payrollSettings.identity.registeredAddress` | The single statutory registered address. One per company. |
| `Place of work` | the employee's assigned work location | The site the employee actually reports to. |

Resolution order for the place of work (`resolveWorkLocation` in `src/utils/payroll.js`):

1. `employee.workLocationId` → that location.
2. No assignment → the location with `isPayrollAddress === true`.
3. No work locations at all → the block is omitted and only the registered office prints.

The resolved location is **frozen onto the payslip** as `workLocationSnapshot` when payroll
is generated, so reassigning someone later never rewrites a payslip that was already
issued. Payslips created before this feature existed have no snapshot, so the renderer
resolves one live rather than printing a blank.

PF and ESI establishment codes come from the work location when it carries them, and fall
back to the company-level codes in payroll identity. Branches frequently have their own
establishment registration, which is why the location wins.

### Assigning employees to a location

- One at a time: **Organisation → assignment drawer**, or `PATCH /api/v1/employees/:id`
  with `workLocationId`.
- In bulk: **Data migration → Assign employees to a work location**, or
  `POST /api/v1/org/work-locations/:id/assign` with `{ "employeeIds": ["emp_1", "emp_2"] }`.
  Requires `org.manage`. Employees already on that location are reported as `unchanged`
  rather than failing. A location with employees on it cannot be deleted.
- In bulk from a file: the `workLocationCode` column of the employee import.

## Employee CSV import

Endpoints are under `/api/v1/imports` and require the `employees.manage` permission
(admin and HR by default; managers are rejected).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/imports/employees/template` | CSV template with the exact headers and two example rows |
| `GET` | `/imports/employees/reference` | Valid work location / department / designation codes and enum values |
| `POST` | `/imports/employees/validate` | Dry run. Parses and validates, **writes nothing** |
| `POST` | `/imports/employees/commit` | Applies the import inside a single store transaction |

Both `validate` and `commit` take the file **contents as JSON**, not multipart:

```json
{ "csv": "employeeId,firstName,...\nEMP1001,Anita,...", "defaultPasscode": "1234" }
```

The browser reads the file with `FileReader` and posts the text. This keeps the server
free of multipart handling and lets the operator preview the parse before anything is
written. Limits: 2,000 rows and 4 MB per file.

### Columns

`employeeId, firstName, lastName, email, phone, role, department, designation,
employmentType, workLocationCode, managerEmail, dateOfJoining, status`

Only `firstName` and `email` are required. Unrecognised columns are reported in
`unknownColumns` and ignored — a mis-typed header is visible in the dry run instead of
silently producing empty fields.

### Behaviour

- **Upsert key:** `employeeId` if supplied, otherwise `email`. Re-running the same file
  updates instead of duplicating. If the two keys point at different existing employees
  the row is blocked rather than guessed.
- **Uniqueness** is checked against the database *and* within the file, so row 40 cannot
  silently overwrite row 12.
- **Masters** (`workLocationCode`, `department`, `designation`) match on code first, then
  name, case-insensitively. An unknown work location is an error; an unknown department or
  designation is a warning and is stored as free text.
- **Managers** are linked in a second pass after every row is created, so a manager listed
  further down the file still resolves. An unresolvable `managerEmail` is a warning and the
  manager is left unset.
- **Partial files are safe:** `workLocationId` is only overwritten when the row supplies a
  `workLocationCode`, so a file that omits the column will not wipe existing assignments.
- **New employees** get the `defaultPasscode` (default `1234`) with
  `requiresPasswordChange: true`.
- **Invalid rows are skipped, not fatal.** The response reports every row with its action
  (`create` / `update` / `skip`), errors and warnings, and the admin UI can export that
  report as CSV. If *every* row is invalid the request fails with 400 and nothing is
  written.

## Not yet covered

Salary structures are **not** part of the import. Statutory bases, component overrides and
revision history are involved enough that a bad import would corrupt payroll, so salary is
still set per employee or through the payroll workspace. A dedicated salary import with its
own dry run is the natural next step.

---

# Seat model

There is **no bundled free Company Admin seat**. Purchased seats are the whole
allowance: buy 10 and you get exactly 10 usable accounts.

```
allowance = plan.includedSeats + subscription.paidSeats
```

`includedSeats` is **0 on every paid plan**. A free tier is expressed as a plan with
`pricePerUser: 0` and `includedSeats >= 1` — the API refuses a zero-price plan with
zero included seats, because nobody could sign in.

The old `freeAdminSeats` field is gone. Migration `billingSchemaVersion 3` folds the
former free seat into `paidSeats` and sets `includedSeats: 0`, so no existing tenant
loses capacity. `freeAdminEmployeeId` became `billingContactEmployeeId`: it still lets
one person sign in while a subscription is paused so they can settle the invoice, but
it is access recovery, not a free seat.

Seat limits are enforced on employee creation, on reactivation, **and on bulk import**.
Import previously bypassed billing entirely.

## Plan catalogue

Super Admin owns pricing. `GET/POST/PATCH/DELETE /api/v1/admin/subscription-plans`
(`super_admin` only) manage `name`, `code`, `pricePerUser` (`null` for contact-sales),
`includedSeats`, `userLimit`, `annualDiscountPercent`, `status`, `description`,
`features[]`, `sortOrder`, and `highlighted`. Admin UI: **Platform → Plans & pricing**.

A plan a company is currently on cannot be deleted — set it to `inactive` instead, which
hides it from new purchases and leaves existing subscriptions intact.

# Company calendar

`GET /api/v1/calendar?from=&to=` returns one merged feed, readable by everyone in the
company (max 400 days per request):

| Kind | Source | Editable |
|---|---|---|
| `holiday` | `company.holidays` | yes |
| `event` | `company.calendarEvents` | yes |
| `birthday` | `employee.dateOfBirth`, recurring | derived |
| `anniversary` | `employee.dateOfJoining`, recurring | derived |

Writes require `settings.manage` (admin and HR): `POST/PATCH/DELETE /calendar/holidays/:id`
and `/calendar/events/:id`, plus `PATCH /calendar/settings` to toggle birthdays and
anniversaries company-wide.

Notes:
- Multi-day events are returned once per day they cover, so a month grid needs no extra work.
- A 29 February birthday falls back to 28 February in non-leap years rather than disappearing.
- Anniversaries start at year one; the joining year itself is not an anniversary.
- Any employee can hide their own birthday with `PATCH /calendar/my-visibility`
  (`{ "hideBirthday": true }`). Both the company setting and the personal opt-out are
  honoured, so nobody is published without consent.
- `dateOfBirth` is settable on the employee record and through a `dateOfBirth` column in
  the employee import.
