# QHR Attendance System - Startup Guide

## Quick Start Commands

### 1. Start Backend API (Terminal 1)
```bash
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile/Backend
npm run dev
```
**Port:** 5001  
**URL:** http://localhost:5001

---

### 2. Start Admin Panel (Terminal 2)
```bash
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile/Backend/admin-panel
npm run dev
```
**Port:** 3001  
**URL:** http://localhost:3001

---

### 3. Start Landing Page (Terminal 3)
```bash
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile/Backend/landing-page
npm run dev
```
**Port:** 3000  
**URL:** http://localhost:3000

---

### 4. Start Mobile App (Terminal 4)
```bash
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile
npx expo start
```

Then:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app on physical device

---

## Troubleshooting

### Port Already in Use
If you get "EADDRINUSE" error:

**Kill process on port 5001 (Backend):**
```bash
lsof -ti:5001 | xargs kill -9
```

**Kill process on port 3001 (Admin Panel):**
```bash
lsof -ti:3001 | xargs kill -9
```

**Kill process on port 3000 (Landing Page):**
```bash
lsof -ti:3000 | xargs kill -9
```

**Kill all Expo processes:**
```bash
pkill -f expo
```

---

### Expo Go Not Opening in Emulator

**Option 1: Manual Launch**
1. Open Android emulator
2. Install Expo Go from Play Store
3. Run `npx expo start` in terminal
4. Press `a` to open in Android

**Option 2: Use Development Build**
```bash
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile
npx expo run:android
```

**Option 3: Scan QR Code**
1. Run `npx expo start`
2. Open Expo Go app on your phone
3. Scan the QR code shown in terminal

---

### Package Version Mismatch

Update packages to compatible versions:
```bash
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile
npx expo install expo@~54.0.33 expo-router@~6.0.23 @react-native-community/datetimepicker@8.4.4
```

---

## Database Setup

### Run Migrations
```bash
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile/Backend

# Connect to PostgreSQL
psql -U qhr_admin -d qhr_attendance

# Run migrations
\i src/migrations/001_payroll_tables.sql
\i src/migrations/002_exit_formalities_tables.sql
\i src/migrations/003_demo_requests_subscriptions.sql
```

---

## Environment Variables

### Backend (.env)
```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/attendance
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
NODE_ENV=development
```

### Admin Panel (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

### Landing Page (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

---

## Default Login Credentials

### Super Admin
- **Email:** admin@qhr.com
- **Password:** admin123

### Company Admin
- **Email:** company@example.com
- **Password:** password123

---

## Features Overview

### Mobile App
- ✅ GPS Attendance with geofencing
- ✅ Desktop Activity Tracking
- ✅ Leave Management
- ✅ Salary Slips (PF, ESIC, TDS)
- ✅ Exit Formalities & F&F
- ✅ iOS Glassmorphism Design

### Admin Panel
- ✅ Employee Management
- ✅ Attendance Reports
- ✅ Payroll Processing
- ✅ Demo Requests (Leads)
- ✅ Subscription Management
- ✅ Tasks & Projects

### Landing Page
- ✅ SME-focused messaging
- ✅ Request a Demo form
- ✅ Geo & Desktop monitoring features
- ✅ Pricing plans

---

## Need Help?

- **Documentation:** Check IMPLEMENTATION_SUMMARY.md
- **Design Analysis:** Check ADMIN_PANEL_DESIGN_ANALYSIS.md
- **Deployment:** Check Backend/DEPLOYMENT_GUIDE.md
