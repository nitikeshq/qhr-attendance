# QHR Production Readiness

> **Current implementation:** See [CURRENT_IMPLEMENTATION.md](CURRENT_IMPLEMENTATION.md). The original private submodule was unavailable, so the runnable local backend, admin, landing, mobile, and desktop surfaces were recovered and revalidated on 2026-07-13. Historical paths and test counts below describe the former repository state.

## Current canonical surfaces

- Backend API: `attendance-mobile/Backend`
- Functional web portal: `attendance-mobile/be-portal`
- Next admin prototype: `attendance-mobile/Backend/admin-panel`
- Public landing: `attendance-mobile/Backend/landing-page`
- Mobile app: `attendance-mobile`
- Desktop tracker: `desktop-app`

The root `admin-panel` and `landing-page` are legacy/prototype shells. Do not invest in them unless they are intentionally made canonical.

Production architecture is one backend: every mobile, web, desktop, and landing/demo flow must use `attendance-mobile/Backend` as the single API authority. Do not introduce a second backend, local-only route layer, or shell-specific API contract while folder restructuring remains deferred.

## Fixed in this pass

- Added `.gitmodules` for the `attendance-mobile` gitlink.
- Updated project Node requirement to Node 24.
- Removed tracked production/local backend env files from git tracking.
- Hardened mobile auth behavior so production no longer falls back to mock login.
- Dev-gated mobile runtime API override and developer settings.
- Started backend tenant scoping for employee update/deactivate/leave-balance actions.
- Raised passcode minimum from 4 to 8 characters.
- Added production PM2 config that uses built apps and environment variables.
- Added SMTP-backed company verification/passcode email utility.
- Added backend/web baselines for recruitment/ATS, custom fields, integrations, reports, org chart, milestones, unified calendar, payslip detail, and tax declarations.
- Replaced mobile mock leaves, payslip, and activity screens with backend-backed loading/error/empty states.
- Added backend Jest/ESLint configuration and focused unit/smoke coverage for new enterprise modules, attendance, leave, salary, employees, middleware, and utilities.
- Fixed backend route/runtime blockers found during testing, including duplicate company-code schema index noise, payroll/employee-management error imports, salary working-day helper export, leave static route ordering, and designation department filtering.

## Must fix before production launch

- Rotate any secrets that were ever committed in `Backend/.env` or `Backend/.env.production`.
- Finish tenant scoping across every controller, not only employees.
- Pick one web admin surface: either upgrade `be-portal` or fully API-wire `Backend/admin-panel`.
- Remove or rewrite PostgreSQL-only routes/docs/migrations because the app currently uses MongoDB.
- Keep backend coverage above the requested 90% threshold for the active production surface; current backend baseline is 42 passing suites / 396 passing tests with 92.60% statement coverage and clean lint.
- Verify mobile background location/geofence registration on real Android and iOS devices.
- Complete mobile dependency/type/build verification after disk headroom is available.
- Complete web production builds for the chosen admin surface and landing page after API contracts are frozen.
- Complete desktop tracker production QA for API URL configuration, token refresh, offline replay, consent, retention, and monitoring disclosure.
- Add explicit employee consent, retention, and audit views for GPS and desktop monitoring.
- Replace fake landing-page claims with verified proof or product-specific screenshots.

## Verification needed

Run after installing Node 24 and freeing disk space:

```bash
nvm install 24
nvm use 24
cd /Users/nitikeshd/Projects/qhr-attendance/attendance-mobile/Backend
npm ci
npm test
npm run lint

cd ../
npm ci
npm run typecheck
npm run doctor

cd Backend/admin-panel
npm ci
npm run build

cd ../../be-portal
npm ci
npm run build
```

Current validation note:

- Node 24 is available through nvm: `v24.15.0`.
- Backend `npm test -- --runInBand` passes: 42 suites, 396 tests.
- Backend `npm run test:coverage -- --runInBand` passes at 92.60% statements / 93.05% lines for the active production surface. Dead, unmounted legacy SQL route files are excluded from coverage and should be removed or quarantined during the final folder-structure cleanup.
- Backend `npm run lint` passes cleanly with zero warnings for the active lint target.
- `be-portal` builds under Node 24.
- Mobile, remaining web, and desktop verification are still limited by low disk headroom. Do not treat those surfaces as production-signed until install/build/smoke checks complete on a machine with enough free space.
