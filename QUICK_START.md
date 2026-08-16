# QHR Attendance - Quick Start Guide

## 🚀 Test Everything Right Now (5 Minutes)

### Step 1: Start Backend
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile\Backend
npm start
```
Backend runs at: http://localhost:5000

### Step 2: Start Mobile App
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile
npm start
```

### Step 3: Test
- Press `a` for Android emulator
- Press `i` for iOS simulator  
- Press `w` for web browser
- OR scan QR code with Expo Go app on your phone

### Step 4: Login
**Test Credentials:**
- Company Code: `TESTCO`
- Employee ID: `EMP001`
- Passcode: `1234`

---

## ✅ What Works Right Now

### Mobile App Features
- ✅ **Automatic check-in/check-out** (geofencing)
- ✅ Manual attendance
- ✅ Leave requests
- ✅ WFH requests
- ✅ Expense reimbursements
- ✅ Support tickets
- ✅ Payslip viewing
- ✅ Calendar with holidays
- ✅ Notifications
- ✅ Manager approvals

### Admin Panel
```bash
cd c:\Q-Projects\qhr-attendance\admin-panel
npm run dev
```
Access at: http://localhost:3000

**Admin Credentials:**
- Email: (check backend console on first run)
- Password: (shown on backend startup)

---

## 🎯 Key Files

### Documentation
- `AUTO_CHECKIN_STATUS.md` - Complete auto check-in feature status
- `CURRENT_STATUS_SUMMARY.md` - Overall project status
- `BUILD_AND_TEST.md` - Build for device instructions
- `WORK_BACKLOG.md` - Feature backlog and progress

### Mobile App Code
- `attendance-mobile/App.js` - Main application
- `attendance-mobile/src/services/geofencing.js` - Auto attendance
- `attendance-mobile/src/services/storage.js` - Persistent data
- `attendance-mobile/eas.json` - Build configuration

### Backend Code
- `Backend/src/routes/attendance.js` - Attendance API (includes `/auto`)
- `Backend/test/enterprise.smoke.test.js` - Tests including geofencing

---

## 📱 Build for Physical Device

### Install Build Tools
```bash
npm install -g eas-cli
eas login
```

### Build Android APK
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile
eas build --platform android --profile preview
```
Wait 15-20 minutes → Download APK → Install on Android device

### Build iOS (Requires Apple Developer Account)
```bash
eas build --platform ios --profile preview
```

---

## 🧪 Test Geofencing (Requires Physical Device)

### Prerequisites
1. Build and install app on device (see above)
2. Configure work location in backend:
   - Add work location with real GPS coordinates
   - Set geofence radius (150 meters recommended)
   - Enable auto check-in in company settings

### Test Steps
1. **Grant Permissions:**
   - Allow location "All the time" / "Always"
   
2. **Test Auto Check-in:**
   - Start outside work location (200+ meters away)
   - Close app completely
   - Walk/drive to work location
   - Wait 30-60 seconds
   - Open app → Check if auto check-in recorded

3. **Test Auto Check-out:**
   - Start inside work location
   - Close app completely
   - Walk/drive away (200+ meters)
   - Wait 30-60 seconds
   - Open app → Check if auto check-out recorded

4. **Verify in Backend:**
   - Check attendance records
   - Should show method: "automatic"

---

## 🔧 Configuration

### Backend Environment Variables
Create `.env` in `Backend/` folder:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081
```

### Mobile App Environment
Create `.env` in `attendance-mobile/` folder:
```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api/v1
```

**Android emulator:** Use `http://10.0.2.2:5000/api/v1`

---

## 🆘 Troubleshooting

### Backend Won't Start
```bash
cd attendance-mobile\Backend
npm install
npm run seed
npm start
```

### Mobile App Won't Start
```bash
cd attendance-mobile
npm install
npx expo start --clear
```

### Geofencing Not Working
Check:
- ✅ Location permission granted ("Always" / "All the time")
- ✅ GPS enabled on device
- ✅ Actually within geofence radius
- ✅ App has loaded work location coordinates
- ✅ Auto check-in enabled in company settings
- ✅ Current time within operating hours

### Build Failures
- EAS builds run in cloud, no local setup needed
- Check build logs: `eas build:view [build-id]`
- View all builds: `eas build:list`

---

## 📊 Project Structure

```
qhr-attendance/
├── attendance-mobile/          # Mobile app (Expo/React Native)
│   ├── Backend/               # API server (Express)
│   ├── src/
│   │   ├── services/
│   │   │   ├── geofencing.js # Auto attendance logic
│   │   │   └── storage.js    # Persistent storage
│   │   ├── screens/          # UI screens
│   │   ├── api.js           # API client
│   │   └── theme.js         # Styling
│   ├── App.js               # Main app entry
│   ├── app.json            # Expo configuration
│   └── eas.json            # Build configuration
├── admin-panel/              # Admin web console (Next.js)
├── landing-page/            # Marketing website
├── desktop-app/            # Desktop activity tracker
└── Documentation files
    ├── AUTO_CHECKIN_STATUS.md
    ├── CURRENT_STATUS_SUMMARY.md
    ├── BUILD_AND_TEST.md
    ├── WORK_BACKLOG.md
    └── TECH_STACK_LIST.md
```

---

## 🎯 Next Steps

1. ✅ **Test now** - Run backend + mobile app (5 minutes)
2. ✅ **Review code** - Check geofencing implementation
3. ✅ **Build for device** - Test full geofencing (30 minutes)
4. ✅ **Configure production** - HTTPS, database, SMTP
5. ✅ **Deploy** - Backend to server, apps to stores

---

## 📞 Quick Commands Reference

```bash
# Backend
cd attendance-mobile\Backend
npm install          # Install dependencies
npm run seed        # Seed test data
npm test           # Run tests
npm start          # Start server

# Mobile App
cd attendance-mobile
npm install          # Install dependencies
npm start           # Start dev server
npm run doctor     # Check Expo setup

# Admin Panel
cd admin-panel
npm install          # Install dependencies
npm run dev        # Start dev server
npm run build      # Production build

# EAS Build
npm install -g eas-cli      # Install CLI
eas login                   # Login to Expo
eas build --platform android --profile preview  # Build Android
eas build --platform ios --profile preview      # Build iOS
eas build:list                                 # View builds
```

---

## ✨ Key Features

### Automatic Attendance ⭐
- Geofencing with background location
- No manual action needed by employees
- Works when app is closed
- Offline queue for poor signal areas
- Server-side validation
- Operating hours enforcement

### Self-Service Portal
- Leave requests with balance tracking
- WFH requests
- Expense reimbursements
- Support tickets
- Payslip viewing
- Calendar with holidays

### Admin Console
- Employee management
- Attendance tracking
- Leave approvals
- Payroll processing
- Work location setup with geofencing
- Reports and exports

---

**Ready to test!** Start with `npm start` in backend and mobile app folders.

For detailed information, see:
- **Auto check-in details:** `AUTO_CHECKIN_STATUS.md`
- **Build instructions:** `BUILD_AND_TEST.md`
- **Complete status:** `CURRENT_STATUS_SUMMARY.md`
