# QHR Attendance Backend

Practical local Express scaffold for the QHR rebuild. It exposes `/health` and the documented REST surface under `/api/v1`, using file-backed JSON persistence by default.

## Run

```bash
npm install
npm run seed
npm run dev
```

The API defaults to `http://localhost:5001`.

## Seeded Logins

- Employee app/desktop: `TESTCO`, `EMP001`, passcode `1234`
- HR: `TESTCO`, `HR001`, passcode `1234`
- Company admin: `company@example.com`, password `password123`
- Super admin: `admin@qhr.com`, password `admin123`

The seed includes an automatic Cashfree test subscription and a manual-offline subscription with a part-paid invoice. Super Admin can inspect collected, outstanding, upcoming-renewal, and renewal-book totals in the Billing & Plans page.

## Scripts

- `npm run dev` starts the API with Node watch mode.
- `npm start` starts the API normally.
- `npm run seed` resets `data/dev-db.json`.
- `npm test` runs the API integration suite, including billing-mode, payment-verification, reminder, and automatic-only pause coverage.
