# QHR Local Demo Credentials

These accounts are created by `attendance-mobile/Backend/npm run seed`.

## Admin Portal

| Role | Email | Password | Company |
|---|---|---|---|
| Super Admin | `admin@qhr.com` | `admin123` | QHR Demo |
| Company Admin | `company@example.com` | `password123` | Test Company |
| HR | `hr@testco.com` | `password123` | Test Company |
| Manager | `manager@testco.com` | `password123` | Test Company |

Admin URL: `http://localhost:3003`

## Mobile And Desktop

| Company code | Employee ID | Passcode | Name |
|---|---|---|---|
| `TESTCO` | `EMP001` | `1234` | John Doe |
| `TESTCO` | `MGR001` | `1234` | Meera Singh (Manager) |
| `TESTCO` | `HR001` | `1234` | Hari Rao (HR) |
| `TESTCO` | `ADMIN001` | `1234` | Company Admin |
| `QHR` | `EMP001` | `emp123` | Rahul Sharma |
| `QHR` | `COMPANY001` | `password123` | Company Admin |
| `QHR` | `SUPER001` | `1234` | QHR Super Admin |

Mobile web URL: `http://localhost:8082`

The seed also includes one pending leave and one approved June 2026 payslip for `TESTCO / EMP001`. Manager, HR, and Company Admin mobile accounts receive the additional Team workspace for scoped attendance and leave/WFH approvals. Super Admin remains a platform-management role and does not receive tenant approval queues.

## Public Landing

No login is required. Company registration, demo request, and contact forms submit to the backend when `NEXT_PUBLIC_API_URL` is configured during the landing build.

Do not use these demo passwords in a deployed environment. Replace seeded accounts and use managed secrets before production rollout.
