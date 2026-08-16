# Admin Quick Guide - Geofencing Setup

## 🚀 5-Minute Setup for Auto Check-in

### Step 1: Add Work Location (2 minutes)
```
Admin Panel → Organization → Work Locations → Add work location

Required fields:
├─ Name: "Head Office" or "Mumbai Branch"
├─ Latitude: 19.0760 (from Google Maps)
├─ Longitude: 72.8777 (from Google Maps)
├─ Radius: 150 (meters)
└─ Status: ✅ Active

Click Save
```

**Getting Coordinates:**
1. Open Google Maps
2. Right-click your office location
3. Click first option (shows coordinates)
4. Copy → Paste into admin panel

### Step 2: Enable Auto Check-in (1 minute)
```
Admin Panel → Configuration → Attendance Settings

Toggle ON:
├─ Auto check-in: ON ✅
├─ Operating hours:
│   ├─ Start: 09:30
│   └─ End: 18:30
└─ Click Save

Done! ✅
```

### Step 3: Tell Employees (2 minutes)
```
Send message to employees:

"Auto attendance is now enabled!

1. Login to the mobile app
2. When it asks for location permission, choose "Always" or "All the time"
3. That's it! You'll be automatically checked in when you arrive at work.

You don't need to open the app or press any button."
```

---

## ✅ What Admin Controls

### Required Setup (One-Time)
- ✅ **Work location GPS coordinates** (latitude/longitude)
- ✅ **Geofence radius** (how big the tracking area is)
- ✅ **Enable/disable toggle** (master switch for auto check-in)
- ✅ **Operating hours** (when auto check-in is allowed)

### Optional Settings
- 📍 GPS tracking on manual check-ins
- 📷 Photo requirement for manual check-ins
- ⏰ Late arrival threshold
- 🏢 Assign employees to specific locations

### What Admin DOES NOT Need to Do
- ❌ Enable/disable per employee (it's automatic for all)
- ❌ Set schedules for auto check-in (works for everyone)
- ❌ Approve auto check-ins (they happen automatically)
- ❌ Monitor real-time (system handles it)

---

## 🎯 How Employees Use It

### Initial Login (One-Time)
1. Employee opens mobile app
2. Logs in with Company Code + Employee ID + Passcode
3. App asks for location permission
4. Employee grants "Always" / "All the time" permission
5. ✅ Auto check-in is armed

### Daily Usage (100% Automatic)
```
Morning:
Employee arrives at work → Auto checked in ✅
(No action needed, works with app closed)

Evening:
Employee leaves work → Auto checked out ✅
(No action needed, works with app closed)
```

**Employee sees in app:**
```
Home Screen:
┌────────────────────────────────┐
│ 🟢 Auto attendance active      │
│ Today: Checked in at 9:15 AM   │
│                                │
│ You don't need to press        │
│ anything. Attendance is        │
│ recorded automatically.        │
└────────────────────────────────┘
```

---

## 📊 Admin Monitoring

### View Attendance
```
Admin Panel → Attendance → Daily Register

You'll see:
├─ Employee name
├─ Check-in time (automatic)
├─ Check-out time (automatic)
├─ Geofence area: "Head Office"
├─ Distance: "45m from center"
└─ Method: "automatic"
```

### Filter & Export
- Filter by geofence area
- Filter by work location
- Filter by method (automatic vs manual)
- Export to Excel/CSV

---

## 🔧 Common Admin Tasks

### Check if Geofencing is Working
```
1. Go to: Organization → Geofences
2. Should see your location(s) listed
3. Status should be "Active"
4. Coordinates should match your office on Google Maps
```

### Temporarily Disable Auto Check-in
```
Configuration → Attendance Settings
Toggle "Auto check-in" to OFF
(Manual check-in still works)
```

### Add More Locations
```
Organization → Work Locations → Add work location
(Repeat Step 1 for each office/branch)
```

### Approve Manual Attendance (Backup)
```
If auto check-in fails (phone dead, forgot phone):

1. Employee can request manual attendance
2. Admin sees request in Approvals
3. Admin verifies and approves
4. Attendance recorded with reason
```

---

## ⚙️ Recommended Settings

### Geofence Radius
```
Small office (1-2 floors):     100 meters
Medium office (multi-floor):   150 meters ← RECOMMENDED
Large campus:                  200-300 meters
Industrial area:               300-500 meters
```

### Operating Hours
```
Standard office: 09:30 AM - 06:30 PM

Note: System adds 2-hour buffer automatically
- Early arrivals (07:30 AM) ✅ Still tracked
- Late workers (08:30 PM) ✅ Still tracked
- Weekend passes (Sunday) ❌ Not tracked
```

---

## 🚨 Troubleshooting

### "Employees not getting auto checked in"

**Check these (in order):**

1. **Geofence coordinates correct?**
   - Go to Organization → Geofences
   - Copy latitude/longitude
   - Paste into Google Maps
   - Should point to your office ✅

2. **Auto check-in enabled?**
   - Go to Configuration → Attendance
   - Toggle should be ON ✅

3. **Employee granted permission?**
   - Ask employee: Settings → QHR Attendance → Location
   - Should be "Always" / "All the time" ✅

4. **Employee actually at office?**
   - Within radius? ✅
   - During operating hours? ✅

### "Geofence too large, triggers from nearby road"

**Solution:**
```
1. Go to: Organization → Geofences
2. Click on the geofence
3. Reduce radius: 150m → 100m
4. Save
5. Test again
```

### "Geofence too small, employees miss check-in"

**Solution:**
```
1. Go to: Organization → Geofences
2. Click on the geofence
3. Increase radius: 150m → 200m
4. Save
5. Test again
```

---

## 📱 Employee Permission Guide (Share This)

### Android
```
Settings → Apps → QHR Attendance → Permissions → Location
Select: "Allow all the time"
```

### iOS
```
Settings → Privacy & Security → Location Services → QHR Attendance
Select: "Always"
```

**Why "Always"?**
- So attendance works even when app is closed
- Phone wakes app when you arrive/leave work
- No manual action needed

---

## ✅ Setup Verification Checklist

Before going live:

### Admin Panel
- [ ] Work location added with GPS coordinates
- [ ] Geofence radius set (default: 150m)
- [ ] Location status: Active
- [ ] Auto check-in toggle: ON
- [ ] Operating hours configured
- [ ] Settings saved successfully

### Test with One Employee
- [ ] Employee can login to mobile app
- [ ] App shows "Auto attendance active"
- [ ] Employee granted location permission "Always"
- [ ] Test check-in at office (arrive physically)
- [ ] Check attendance recorded in admin panel
- [ ] Verify method shows "automatic"
- [ ] Verify geofence area shows in attendance

### Ready for All Employees
- [ ] Test successful ✅
- [ ] Inform all employees
- [ ] Share permission instructions
- [ ] Monitor first few days
- [ ] Adjust radius if needed

---

## 📞 Admin Support Quick Reference

### Key URLs
```
Admin Panel: http://localhost:3000 (development)
Backend API: http://localhost:5000 (development)
Mobile App: Expo Go app or built APK/IPA
```

### Key API Endpoint (For Testing)
```bash
# Check what mobile app receives
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/v1/attendance/geofence-regions

# Should return your configured locations
```

### Documentation Files
```
GEOFENCING_ADMIN_SETUP.md    ← Complete admin guide
AUTO_CHECKIN_STATUS.md        ← Technical implementation details
BUILD_AND_TEST.md             ← Build mobile app for testing
QUICK_START.md                ← 5-minute testing guide
```

---

## 🎯 Key Takeaways

1. **Admin sets up work locations with GPS** → System handles rest
2. **Enable auto check-in toggle** → Works for all employees
3. **Employees grant "Always" permission** → Auto tracking works
4. **Zero daily admin effort** → Fully automatic
5. **Manual override available** → Safety net for tech issues
6. **Full audit trail** → GPS coordinates + distance recorded

**Setup once. Works forever. 100% automatic.**

---

## 🔗 Quick Links

**Admin Panel Sections:**
- Work Locations: Organization → Work Locations
- Geofences: Organization → Geofences
- Attendance Settings: Configuration → Attendance
- Daily Register: Attendance → Daily Register
- Reports: Attendance → Reports

**Mobile App Sections:**
- Home: Shows auto attendance status
- Attendance: Manual check-in backup
- Menu: All features

---

**Questions?** Refer to `GEOFENCING_ADMIN_SETUP.md` for complete details.
