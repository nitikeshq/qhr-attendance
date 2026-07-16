# QHR Attendance - Local Startup

The recovered workspace uses one backend API and four clients. Run commands from PowerShell with Node.js 20.19 or newer.

## 1. Backend API

```powershell
cd C:\Q-Projects\qhr-attendance\attendance-mobile\Backend
npm install
npm run seed
npm run dev
```

URL: `http://localhost:5001`
Health: `http://localhost:5001/health`

## 2. Admin Portal

```powershell
cd C:\Q-Projects\qhr-attendance\admin-panel
npm install
npm run dev
```

URL: `http://localhost:3003`

## 3. Landing Page

```powershell
cd C:\Q-Projects\qhr-attendance\landing-page
npm install
npm run dev
```

URL: `http://localhost:3002`

## 4. Mobile App

```powershell
cd C:\Q-Projects\qhr-attendance\attendance-mobile
npm install
npm start
```

Press `a` for Android, `i` on macOS for iOS, or `w` for web. The web client can be started directly on port 8082 with:

```powershell
npm run web -- --port 8082
```

For a physical phone, set `EXPO_PUBLIC_API_URL` to the computer's LAN address, for example `http://192.168.1.20:5001`.

## 5. Desktop Tracker

```powershell
cd C:\Q-Projects\qhr-attendance\desktop-app
npm install
npm start
```

Build a Windows package with `npm run build:win`, or an unpacked verification build with `npm run pack`.

## Configuration

Admin and landing default to `http://127.0.0.1:5001`. Override at build time with:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

Desktop uses `QHR_API_URL`; mobile uses `EXPO_PUBLIC_API_URL`.

Billing reminders are queued automatically. Configure SendGrid to deliver them:

```env
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=billing@example.com
EMAIL_FROM_NAME=QHR Billing
BILLING_CYCLE_INTERVAL_MS=3600000
```

Cashfree and PayU remain in test configuration until production merchant credentials and signed webhook URLs are supplied. Gateway secrets must be provided through environment/secret management and must never be stored in the JSON datastore or browser bundle.

Local persistence is `attendance-mobile/Backend/data/dev-db.json`. Run `npm run seed` in the backend to reset demo data.

See [CURRENT_IMPLEMENTATION.md](CURRENT_IMPLEMENTATION.md) for the authoritative architecture, implemented modules, validation results, and production integration boundaries.
