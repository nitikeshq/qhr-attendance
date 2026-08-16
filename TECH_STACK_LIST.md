# QHR Attendance — Technology and Reusable Feature List

Verified against the workspace package manifests on 2026-07-20. Versions below describe this application; they are not generic recommendations.

## Applications

| Application | Location | Runtime / framework | Purpose |
|---|---|---|---|
| Backend API | `attendance-mobile/Backend` | Node.js 20+, Express 4.21 | Tenant API, attendance, payroll, reimbursements, billing |
| Admin panel | `admin-panel` | Next.js 16.2.10, React 18, TypeScript | Company HR/admin operations |
| Employee portal | `attendance-mobile` | Expo 54, React 19.1, React Native 0.81 | Mobile and web employee self-service |
| Landing page | `landing-page` | Next.js 16.2.10, React 18, TypeScript | Product marketing and lead capture |
| Desktop tracker | `desktop-app` | Electron 43.1 | Desktop activity and attendance agent |

## Backend API

Runtime dependencies:

```json
{
  "express": "^4.21.2",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "helmet": "^8.0.0",
  "morgan": "^1.10.0"
}
```

Built-in Node capabilities are used for the HTTP server, crypto hashing/tokens, filesystem receipt storage, and the `node:test` test runner. Data currently uses a JSON-file store; production should replace it with a transactional database, migrations, backups, and durable audit retention.

Backend commands:

```cmd
cd attendance-mobile\Backend
npm install
npm run seed
npm test
npm run lint
npm start
```

## Admin Panel

```json
{
  "next": "16.2.10",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "lucide-react": "^0.312.0",
  "typescript": "^5.3.3",
  "tailwindcss": "^3.4.1",
  "postcss": "^8.5.10",
  "autoprefixer": "^10.4.17"
}
```
The admin uses native `fetch`, React hooks, and local component state. Zustand, TanStack Query, Axios, Recharts, date-fns, clsx, and tailwind-merge are **not** admin-panel dependencies in this repository.

Admin commands:

```cmd
cd admin-panel
npm install
npm run lint
npm run build
npm run dev
```

## Employee Mobile / Web Portal

```json
{
  "expo": "~54.0.36",
  "react": "19.1.0",
  "react-native": "0.81.5",
  "react-native-web": "~0.21.0",
  "@expo/metro-runtime": "~6.1.2",
  "@expo/vector-icons": "15.0.2",
  "expo-location": "~19.0.8",
  "expo-task-manager": "14.0.9",
  "expo-background-fetch": "14.0.9",
  "@react-native-async-storage/async-storage": "2.2.0",
  "expo-document-picker": "~14.0.8",
  "expo-file-system": "~19.0.23",
  "expo-print": "~15.0.8",
  "expo-sharing": "~14.0.8",
  "expo-status-bar": "~3.0.9"
}
```

Mobile commands:

```cmd
cd attendance-mobile
npm install
npm run doctor
npm run export:web
npm run start
```

`npm run start` is interactive/long-running and should be run manually. Android emulators use `10.0.2.2` for the local API; web/iOS local development uses `127.0.0.1`. Production should set `EXPO_PUBLIC_API_URL`.

## Landing Page

```json
{
  "next": "16.2.10",
  "react": "^18.2.0",
  "framer-motion": "^11.0.3",
  "lucide-react": "^0.312.0",
  "@radix-ui/react-accordion": "^1.1.2",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.2.1",
  "tailwindcss": "^3.4.1"
}
```

## Desktop App

```json
{
  "electron": "^43.1.0",
  "electron-builder": "^26.15.3",
  "get-windows": "^9.3.0",
  "uiohook-napi": "^1.5.5",
  "auto-launch": "^5.0.6",
  "electron-store": "^8.1.0",
  "electron-updater": "^6.1.7",
  "ioredis": "^5.3.2",
  "node-fetch": "^2.7.0"
}
```
Desktop commands:

```cmd
cd desktop-app
npm install
npm run pack
npm run build:win
```

## Reusable Product Features Implemented

- Multi-tenant companies, role-based access, employee lifecycle, managers, departments, and designations.
- **GPS/geofence attendance with automatic check-in/check-out**, background location tracking, offline punch queueing, manual check-in/out fallback, leave, WFH, holidays, attendance policy, and payroll payable-day calculation.
- **Automatic geofencing attendance**: Background task-based geofence monitoring, OS-level location triggers, automatic punch reporting when entering/exiting work areas, offline queue with retry, server-side location validation, operating hours enforcement, and configurable per-company enable/disable.
- Company salary templates plus employee overrides, effective-dated salary revisions, manual TDS, PF/ESI/PT/LWF/gratuity configuration, and recurring additions/deductions.
- Independent earning formula and salary treatment: fixed / percentage formulas can be either included in gross or paid after gross; after-gross items are excluded from PF/ESI wage bases.
- Payroll generation, draft review, one-time adjustments, approval, immutable issued payslips, publishing, payment advice, UTR reconciliation, YTD totals, and printable payslips.
- Employee reimbursement claims, manager/finance approval, partial approval, payroll or separate payment, protected PDF/JPEG/PNG receipts, and duplicate-payment protection.
- Subscription billing, invoices, payment records, company billing modes, and platform-level tenant administration.
- Projects/tasks, grievances, desktop activity summaries, audit trails, CSV exports, and responsive employee/admin portals.
- Guided company onboarding: ten setup steps (company profile, payroll identity, work locations, departments/designations, statutory, attendance policy, leave policy, holidays, team, review) whose completion is derived from the stored records themselves rather than from boolean flags, so progress cannot drift from reality. Steps are freely navigable and resumable, payroll identity and statutory setup are Company Admin only, optional steps can be skipped, going live is rejected with an aggregated list of blockers until every required step passes, and onboarding can be reopened with an audit entry.

## Design System

Admin and employee portals use a Microsoft Fluent-inspired enterprise flat design:

```css
--neu-bg: #F5F7FA;       /* compatibility name: app canvas */
--neu-bg-alt: #FFFFFF;   /* surfaces and form controls */
--primary: #0F6CBD;      /* primary actions and active states */
--text: #172033;
--text-secondary: #596579;
--border: #D8DEE6;
--success: #107C41;
```

Legacy `neu-*` class names remain as compatibility aliases, but their implementation is flat: opaque white surfaces, 1px neutral borders, 6–8px radii, no embossed/inset shadows, and only restrained elevation for dialogs. Typography uses the native enterprise system stack—Segoe UI Variable/Segoe UI on Windows and web, SF system fonts on Apple platforms, and Roboto/sans-serif on Android—with responsive heading sizes, readable line heights, tabular financial numerals, accessible text scaling, and 16px mobile form controls. Buttons use solid colors with clear hover, pressed, disabled, and focus-visible states. Motion is short and functional, and reduced-motion preferences are respected. Mobile uses the same palette and hierarchy with touch-friendly controls and overflow-safe responsive grouping. Printable payroll documents retain their independent document-specific design.

## Current Security and Reliability Baseline

- Browser CORS uses an explicit origin allow-list; production fails closed when `ALLOWED_ORIGINS` is missing.
- API and authentication endpoints have configurable IP throttling, with stricter login/refresh limits.
- Access and refresh tokens are stored as SHA-256 hashes, rotated on refresh, and configurable through explicit TTL settings. Privileged login no longer accepts an employee passcode as a password fallback.
- Password changes enforce a stronger policy, reject password reuse, and revoke the user’s other sessions.
- Holiday retrieval requires authentication and is scoped to the logged-in company.
- Every request receives an `X-Request-Id`; error envelopes and backend logs use the same correlation ID.
- JSON persistence now uses a flushed temporary file, atomic rename, previous-file backup, serialized mutations, and in-memory rollback on failed writes. PM2 is intentionally limited to one backend process while JSON storage remains.

These controls improve the current deployment but do not replace a transactional database, centralized rate limiting, immutable audit storage, object storage, or tested disaster recovery.

## What Must Change Before High-Scale Production

1. Replace JSON storage and local receipt files with a database and private object storage.
2. Add database migrations, encryption/key management, backups, retention, malware scanning, and observability.
3. Integrate tenant-specific statutory filing/tax rules and legal review; configuration is not legal or tax advice.
4. Integrate bank-specific encrypted payment files or payment APIs; the current CSV is an advice/register, not a bank upload file.
5. Add deployment CI/CD, secret management, rate limiting at the edge, disaster recovery, and production monitoring.

## Copying This Stack to Another App

Use the package manifests as the source of truth. Copy only the packages needed by that application rather than installing every library into every frontend. Prefer `npm install` from a committed lockfile for exact reproduction, and keep Node at the engines requirement (`>=20.19` for Next.js/Electron apps; `>=20` for the backend).