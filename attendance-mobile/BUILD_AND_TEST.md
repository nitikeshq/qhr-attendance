# QHR Attendance Mobile - Build & Test Guide

## Quick Start - Test Right Now (No Build Needed)

### Option 1: Test in Expo Go (Fastest)
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile
npm start
```

Then:
- **Android:** Press `a` to open in Android emulator, OR scan QR code with Expo Go app
- **iOS:** Press `i` to open in iOS simulator, OR scan QR code with Expo Go app (iOS)
- **Web:** Press `w` to test in browser

**Note:** Geofencing requires physical device with Expo Go app for real testing.

---

## Building for Device Testing (Full Geofencing)

### Prerequisites

1. **Install EAS CLI:**
```bash
npm install -g eas-cli
```

2. **Login to Expo:**
```bash
eas login
```

3. **Configure project (first time only):**
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile
eas build:configure
```

### Build Commands

#### Android APK (for internal testing)
```bash
eas build --platform android --profile preview
```

**What happens:**
- Builds APK file (can sideload on any Android device)
- Includes all permissions and background location
- Download link provided when complete (~15-20 minutes)

**Install on device:**
- Download APK from provided link
- Enable "Install from unknown sources" on Android
- Install and test

#### iOS Build (for TestFlight)
```bash
eas build --platform ios --profile preview
```

**What happens:**
- Builds IPA file
- Requires Apple Developer account
- Can submit to TestFlight for internal testing

---

## Testing Checklist

### 1. Pre-Test Backend Setup

Ensure your backend has proper configuration:

```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile\Backend
npm start
```

Verify in backend:
- [ ] Company exists with employees
- [ ] Work location configured with coordinates
- [ ] Geofence radius set (100-200 meters recommended)
- [ ] Auto check-in enabled in company settings
- [ ] Operating hours configured

### 2. Mobile App Testing

#### Basic Features Test
- [ ] Login with valid credentials
- [ ] App shows home screen with today's status
- [ ] Can navigate between tabs
- [ ] Can refresh data
- [ ] Can logout

#### Manual Attendance Test (Before Auto)
- [ ] Check-in button works
- [ ] Check-out button works
- [ ] Location captured correctly
- [ ] Attendance recorded in backend

#### Auto Attendance Permission Flow
- [ ] App requests foreground location permission
- [ ] App requests background location permission ("Allow all the time")
- [ ] Permission status shown correctly in UI
- [ ] Error messages clear if permission denied

#### Geofencing Test (Requires Physical Device)

**Important:** Must test at actual work location or configure test geofence at your current location.

**Test Steps:**

1. **Setup test geofence:**
   - Go to your current location
   - Get coordinates (use Google Maps)
   - Configure work location in backend with these coordinates
   - Set radius to 150 meters

2. **Test Entry (Check-in):**
   - Start outside geofence area (200+ meters away)
   - Close the app completely (swipe away)
   - Walk/drive into geofence area
   - Wait 30-60 seconds
   - Open app and check if auto check-in occurred
   - Verify in backend attendance records

3. **Test Exit (Check-out):**
   - Start inside geofence area (at work location)
   - Close the app completely
   - Walk/drive outside geofence area (200+ meters)
   - Wait 30-60 seconds
   - Open app and check if auto check-out occurred
   - Verify in backend attendance records

4. **Test Boundary Jitter:**
   - Walk near geofence boundary
   - Cross boundary multiple times
   - Verify only ONE check-in recorded (no duplicates)

5. **Test Offline Mode:**
   - Turn on airplane mode
   - Enter geofence area
   - Wait 1 minute
   - Turn off airplane mode
   - Verify queued punch gets sent to server

6. **Test Operating Hours:**
   - Set operating hours to 9:30 AM - 6:30 PM
   - Test entry at 11 PM (should NOT auto check-in)
   - Test entry at 10 AM (should auto check-in)

---

## Troubleshooting

### Geofencing Not Working

**Check:**
1. ✅ Background location permission granted ("Allow all the time")
2. ✅ GPS enabled on device
3. ✅ Actually within geofence radius
4. ✅ App has geofence regions configured
5. ✅ Operating hours allow auto check-in
6. ✅ Company has auto check-in enabled

**Debug steps:**
```javascript
// Check in mobile app after login
console.log('Auto attendance status:', autoAttendance);
// Should show: { started: true, regions: 1 }
// If started: false, check the 'reason' field
```

### Build Failures

**Common issues:**

1. **"No valid Android SDK found"**
   - EAS Build runs in cloud, you don't need local Android SDK
   - Just wait for cloud build to complete

2. **"Bundle identifier already exists"**
   - Change `bundleIdentifier` in `app.json`
   - For iOS: use unique identifier like `com.yourcompany.qhr.attendance`

3. **"Expo account required"**
   - Run `eas login` first
   - Create account at expo.dev if needed

### Location Permissions

**Android:**
- Settings → Apps → QHR Attendance → Permissions → Location → "Allow all the time"

**iOS:**
- Settings → Privacy & Security → Location Services → QHR Attendance → "Always"

---

## API Endpoints Used

### Geofencing
- `GET /api/v1/attendance/geofence-regions` - Fetch work locations with geofences
- `POST /api/v1/attendance/auto` - Auto check-in/check-out from geofence events

### Manual Attendance
- `POST /api/v1/attendance/check-in` - Manual check-in
- `POST /api/v1/attendance/check-out` - Manual check-out
- `GET /api/v1/attendance/today` - Today's attendance status

### Authentication
- `POST /api/v1/auth/login` - Employee login
- `POST /api/v1/auth/logout` - Logout

---

## Expected Behavior

### Successful Auto Check-in
```
[Background Task] Geofence event: enter
[Background Task] Location: {lat: 12.9716, lng: 77.5946, accuracy: 15}
[Background Task] Within operating hours: true
[Background Task] Reporting to server...
[Server Response] 200 OK - Check-in recorded
[Backend] Attendance created: checkIn at 09:15:00, method: automatic
```

### Check-in Outside Work Location
```
[Background Task] Geofence event: enter
[Background Task] Location: {lat: 0.0000, lng: 0.0000}
[Background Task] Reporting to server...
[Server Response] 409 Conflict - Location not within any work area
[App] Event not retried (deliberate rejection)
```

### Offline Queue
```
[Background Task] Geofence event: enter
[Background Task] Location: {lat: 12.9716, lng: 77.5946}
[Background Task] Reporting to server...
[Network Error] No connection
[Storage] Punch queued for later retry
[Later, when online]
[App Launch] Flushing 1 queued punch...
[Server Response] 200 OK - Check-in recorded with original timestamp
```

---

## Performance Expectations

### Battery Impact
- **Negligible** when using geofencing (OS-level, power-efficient)
- **No polling** - OS wakes app only on boundary cross
- More efficient than continuous location tracking

### Network Usage
- **Minimal** - only sends data on check-in/check-out events
- Typically 2-4 events per day per employee
- ~200 bytes per event

### Background Restrictions
- **Android 12+:** Background location restricted for new apps
  - User must explicitly grant "Allow all the time" in settings
  - App must explain why background location is needed
  
- **iOS 13+:** Users see periodic reminders about background location
  - Normal behavior, not a bug
  - Users can keep permission enabled

---

## Next Steps After Testing

1. ✅ Verify all features work on physical device
2. ✅ Test with real work locations and employees
3. ✅ Monitor backend logs for auto attendance events
4. ✅ Gather user feedback on accuracy and reliability
5. ✅ Fine-tune geofence radius based on real-world results
6. ✅ Consider adding notification when auto check-in occurs
7. ✅ Add offline indicator in UI
8. ✅ Set up monitoring for failed auto check-ins

---

## Build Profiles Explained

### `development`
- Development build with Expo Dev Client
- Hot reload and debugging enabled
- Use for active development

### `preview`
- Internal testing build
- No debugging, but can sideload
- **Recommended for testing geofencing**
- Android: APK file
- iOS: Can submit to TestFlight

### `production`
- Release build for app stores
- Android: App Bundle (AAB)
- iOS: Automatic version increment
- Optimized and minified

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for Android (internal testing)
eas build --platform android --profile preview

# Build for iOS (internal testing)
eas build --platform ios --profile preview

# Check build status
eas build:list

# View build logs
eas build:view [build-id]

# Submit to stores (after production build)
eas submit --platform android
eas submit --platform ios
```

---

## Support

- **Expo Documentation:** https://docs.expo.dev/
- **EAS Build:** https://docs.expo.dev/build/introduction/
- **Geofencing:** https://docs.expo.dev/versions/latest/sdk/location/#geofencing
- **Task Manager:** https://docs.expo.dev/versions/latest/sdk/task-manager/

---

**Ready to test!** Start with `npm start` for immediate testing in Expo Go, then build with EAS when you need full geofencing capabilities.
