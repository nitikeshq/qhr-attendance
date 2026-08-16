# Geofencing Setup - Admin to Mobile Flow

## 🎯 How It Works: Admin Setup → Employee Auto Check-in

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: ADMIN CONFIGURES IN ADMIN PANEL                        │
│                                                                 │
│ Admin Panel → Organization → Work Locations                     │
│   ├─ Add Work Location (Office/Branch/Site)                    │
│   ├─ Set GPS Coordinates (Latitude/Longitude)                  │
│   ├─ Set Geofence Radius (e.g., 150 meters)                   │
│   └─ Activate Location                                         │
│                                                                 │
│ Data saved to: Backend → companies.workLocations[]             │
│                         → attendanceAreas[]                     │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: ADMIN ENABLES AUTO CHECK-IN                            │
│                                                                 │
│ Admin Panel → Configuration → Attendance Settings               │
│   ├─ Enable "Auto check-in" toggle                            │
│   ├─ Set Operating Hours (e.g., 09:30 AM - 06:30 PM)          │
│   └─ Save Settings                                             │
│                                                                 │
│ Data saved to: Backend → company.settings.autoCheckIn = true   │
│                         → company.settings.officeStart         │
│                         → company.settings.officeEnd           │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: EMPLOYEE LOGS IN TO MOBILE APP                         │
│                                                                 │
│ Mobile App → Login Screen                                       │
│   ├─ Enter Company Code (e.g., TESTCO)                        │
│   ├─ Enter Employee ID (e.g., EMP001)                         │
│   └─ Enter Passcode (e.g., 1234)                              │
│                                                                 │
│ App calls: POST /api/v1/auth/login                             │
│ Receives: Token + Employee Data                                │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: MOBILE APP FETCHES GEOFENCE CONFIGURATION              │
│                                                                 │
│ App automatically calls: GET /api/v1/attendance/geofence-regions│
│                                                                 │
│ Backend returns:                                                │
│ {                                                              │
│   "regions": [                                                 │
│     {                                                          │
│       "identifier": "area-123",                               │
│       "name": "Head Office",                                  │
│       "latitude": 19.0760,                                    │
│       "longitude": 72.8777,                                   │
│       "radius": 150                                           │
│     }                                                          │
│   ],                                                           │
│   "operatingHours": {                                          │
│     "start": "09:30",                                         │
│     "end": "18:30"                                            │
│   },                                                           │
│   "autoCheckInEnabled": true                                   │
│ }                                                              │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: MOBILE APP REQUESTS PERMISSIONS                        │
│                                                                 │
│ App requests:                                                   │
│   ├─ Location permission (When in use)                         │
│   └─ Background location permission (Always/All the time)      │
│                                                                 │
│ User must grant: "Allow all the time" / "Always"               │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: MOBILE APP REGISTERS GEOFENCES WITH OS                 │
│                                                                 │
│ App calls: expo-location.startGeofencingAsync()                │
│                                                                 │
│ Registers each work location as:                               │
│   - Center: (latitude, longitude)                              │
│   - Radius: 150 meters                                         │
│   - Events: ENTER and EXIT                                     │
│                                                                 │
│ OS (Android/iOS) now monitors these locations                  │
│ ✅ AUTO CHECK-IN IS NOW ARMED                                  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: EMPLOYEE ARRIVES AT WORK (AUTOMATIC)                   │
│                                                                 │
│ Employee Location: Outside → Inside geofence                    │
│                                                                 │
│ OS detects boundary crossing → Wakes background task           │
│                                                                 │
│ Background Task (src/services/geofencing.js):                  │
│   ├─ Event type: ENTER                                        │
│   ├─ Check: Within operating hours? ✅                         │
│   ├─ Get current GPS location                                 │
│   ├─ Create punch record                                      │
│   └─ Send to server: POST /api/v1/attendance/auto            │
│                                                                 │
│ Server validates:                                               │
│   ├─ Location within work area? ✅                             │
│   ├─ Not duplicate? ✅                                         │
│   └─ Creates attendance record                                │
│                                                                 │
│ ✅ EMPLOYEE AUTOMATICALLY CHECKED IN                            │
│ ⏰ No manual action needed                                     │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 8: EMPLOYEE LEAVES WORK (AUTOMATIC)                       │
│                                                                 │
│ Employee Location: Inside → Outside geofence                    │
│                                                                 │
│ OS detects boundary crossing → Wakes background task           │
│                                                                 │
│ Background Task:                                                │
│   ├─ Event type: EXIT                                         │
│   ├─ Get current GPS location                                 │
│   ├─ Create punch record                                      │
│   └─ Send to server: POST /api/v1/attendance/auto            │
│                                                                 │
│ Server:                                                         │
│   ├─ Finds today's attendance record                          │
│   ├─ Sets check-out time                                      │
│   ├─ Calculates work duration                                 │
│   └─ Updates attendance status                                │
│                                                                 │
│ ✅ EMPLOYEE AUTOMATICALLY CHECKED OUT                           │
│ ⏰ No manual action needed                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👨‍💼 ADMIN CONFIGURATION STEPS

### 1. Set Up Work Locations with Geofences

**Location:** Admin Panel → Organization → Work Locations

#### Option A: Add New Work Location with Geofence

1. Click **"Add work location"**
2. Fill in details:
   - **Name:** Head Office, Mumbai Branch, etc.
   - **Address:** Full address (optional but recommended)
   - **Latitude:** GPS coordinate (e.g., 19.0760)
   - **Longitude:** GPS coordinate (e.g., 72.8777)
   - **Radius:** Geofence size in meters (default: 150m)
3. Check **"Active"** to enable
4. Click **Save**

#### Option B: Link to Existing Work Location

1. Go to **Organization → Geofences**
2. Click **"Add geofence"**
3. Select existing work location from dropdown
4. GPS coordinates auto-filled from work location
5. Adjust radius if needed
6. Click **Save**

#### Getting GPS Coordinates

**Easy Method:**
1. Open Google Maps
2. Right-click on your office/work location
3. Click first option (shows coordinates)
4. Copy latitude and longitude
5. Paste into admin panel

**Example Coordinates:**
- Mumbai: `19.0760, 72.8777`
- Delhi: `28.6139, 77.2090`
- Bangalore: `12.9716, 77.5946`

### 2. Enable Auto Check-in

**Location:** Admin Panel → Configuration → Attendance Settings

1. Toggle **"Enable auto check-in"** to ON
2. Set **Operating Hours:**
   - Start time: e.g., `09:30`
   - End time: e.g., `18:30`
3. Click **Save**

**Note:** Auto check-in only works within operating hours (with 2-hour buffer before/after)

### 3. Configure Additional Settings (Optional)

**Location:** Admin Panel → Configuration → Attendance Settings

- **GPS Tracking:** Enable to record GPS on manual check-ins
- **Photo Required:** Require photo on manual check-ins (optional)
- **Late Threshold:** Define what counts as "late arrival"

### 4. Assign Employees to Work Locations

**Location:** Admin Panel → Employees → [Employee Profile] → Overview

1. Open employee profile
2. Set **"Work location"** to their primary office
3. Save changes

**Note:** Employees can check in at ANY configured geofence, not just their assigned location.

---

## 📱 EMPLOYEE MOBILE APP FLOW

### What Happens When Employee Logs In

1. **Login Success:**
   - App saves session (token + employee data)
   - Persists to storage for background tasks

2. **Geofence Configuration Fetch:**
   ```javascript
   // Automatic, happens in background
   GET /api/v1/attendance/geofence-regions
   ```
   
3. **Permission Request:**
   - App shows permission dialogs
   - Employee must grant "Always" / "All the time"

4. **Geofencing Armed:**
   - App registers regions with OS
   - Background task ready
   - Status shown in app: "Auto attendance active (1 location)"

### What Employee Sees

**Home Screen:**
```
┌─────────────────────────────────┐
│ 🟢 Auto attendance active       │
│ Monitoring 1 work location      │
│                                 │
│ You don't need to check in      │
│ manually. Your attendance will  │
│ be recorded automatically.      │
└─────────────────────────────────┘
```

**If Permissions Denied:**
```
┌─────────────────────────────────┐
│ ⚠️ Background location needed   │
│                                 │
│ Go to Settings → Allow location │
│ "All the time" for automatic    │
│ attendance tracking.            │
│                                 │
│ [Open Settings]                 │
└─────────────────────────────────┘
```

**Manual Override Available:**
- If auto check-in fails (phone dead, forgot phone)
- Employee can still check in manually
- HR/admin can approve manual attendance requests

---

## 🔧 BACKEND API ENDPOINTS

### 1. Geofence Configuration (Mobile App Calls)

```http
GET /api/v1/attendance/geofence-regions
Authorization: Bearer {employee-token}
```

**Response:**
```json
{
  "data": {
    "regions": [
      {
        "identifier": "area-abc123",
        "name": "Head Office",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "radius": 150
      }
    ],
    "operatingHours": {
      "start": "09:30",
      "end": "18:30"
    },
    "autoCheckInEnabled": true,
    "gpsTrackingEnabled": true
  }
}
```

### 2. Automatic Attendance (Background Task Calls)

```http
POST /api/v1/attendance/auto
Authorization: Bearer {employee-token}
Content-Type: application/json

{
  "event": "enter",
  "regionId": "area-abc123",
  "occurredAt": "2026-08-13T09:15:00.000Z",
  "location": {
    "latitude": 19.0760,
    "longitude": 72.8777,
    "accuracy": 15
  }
}
```

**Response:**
```json
{
  "attendance": {
    "_id": "att-xyz789",
    "employeeId": "emp-123",
    "date": "2026-08-13",
    "checkIn": {
      "time": "2026-08-13T09:15:00.000Z",
      "method": "automatic",
      "areaName": "Head Office",
      "distanceMeters": 45
    },
    "status": "present"
  },
  "message": "Checked in automatically"
}
```

---

## ✅ ADMIN CHECKLIST

Before testing geofencing:

### Company Setup
- [ ] At least one work location created
- [ ] GPS coordinates set (latitude/longitude)
- [ ] Geofence radius configured (150m recommended)
- [ ] Location marked as "Active"

### Attendance Settings
- [ ] Auto check-in toggle: **ON**
- [ ] Operating hours configured (e.g., 09:30 - 18:30)
- [ ] Settings saved successfully

### Employee Setup
- [ ] Employees have valid credentials
- [ ] Employees assigned to company
- [ ] Employees have active status
- [ ] (Optional) Employees assigned to work location

### Testing Preparation
- [ ] Backend server running
- [ ] Test employee account ready
- [ ] Work location coordinates verified (check on Google Maps)
- [ ] Geofence radius appropriate for building size

---

## 🎯 GEOFENCE RADIUS RECOMMENDATIONS

### Small Office / Single Floor
- **Radius:** 50-100 meters
- **Use case:** Small office building, single floor
- **Pros:** More precise, less false triggers
- **Cons:** May miss check-in if parking is far

### Medium Office / Multi-Floor Building
- **Radius:** 100-150 meters (RECOMMENDED)
- **Use case:** Multi-floor office, parking lot nearby
- **Pros:** Good balance of accuracy and coverage
- **Cons:** None, works well for most scenarios

### Large Campus / Industrial Area
- **Radius:** 150-300 meters
- **Use case:** Large campus, industrial area, multiple buildings
- **Pros:** Covers entire campus
- **Cons:** Less precise, may trigger from nearby roads

### Very Large Area
- **Radius:** 300-500 meters
- **Use case:** Very large industrial complexes
- **Pros:** Covers massive areas
- **Cons:** Lower accuracy

**Default Setting:** 150 meters (good for most offices)

---

## 🔍 ADMIN MONITORING & VERIFICATION

### View Automatic Attendance

**Location:** Admin Panel → Attendance → Daily Register

**Geofence Column Shows:**
- ✅ Area name (e.g., "Head Office")
- 📍 Distance from center (e.g., "45m from center")
- 📱 Method: "automatic"

**Filter Options:**
- Filter by geofence area
- Filter by work location
- Filter by attendance method

### Attendance Details

**Click on employee to see:**
- Check-in time with GPS coordinates
- Check-out time with GPS coordinates
- Geofence area triggered
- Distance from geofence center
- Method: automatic vs manual
- Duration of work

### Audit Trail

**All automatic attendance includes:**
- Exact GPS coordinates (validated server-side)
- Geofence area that triggered
- Distance from area center
- Timestamp (when OS detected crossing)
- Method label: "automatic"

---

## ⚙️ ADVANCED ADMIN CONFIGURATION

### Multiple Work Locations

**Scenario:** Company has multiple offices

1. Add each office as separate work location
2. Configure geofence for each
3. Employees can check in at ANY location
4. System records which location they used

**Example:**
- Head Office Mumbai: Geofence 150m
- Branch Office Delhi: Geofence 150m
- Branch Office Bangalore: Geofence 150m

Employee traveling to Delhi branch? Automatic check-in works there too!

### Operating Hours Buffer

**Built-in Feature:**
- Admin sets: 09:30 AM - 06:30 PM
- System allows: 07:30 AM - 08:30 PM (2-hour buffer on each side)
- Why? Early arrivals and late workers still get tracked

### Disable Auto Check-in Temporarily

**Location:** Admin Panel → Configuration → Attendance Settings

1. Toggle **"Enable auto check-in"** to OFF
2. All employees immediately stop auto tracking
3. Manual check-in still works
4. Toggle back ON to re-enable

**Use cases:**
- System maintenance
- Testing manual workflows
- Temporary policy changes

### Per-Location Settings (Future Enhancement)

Currently planned:
- Different operating hours per location
- Different radius per location
- Activate/deactivate specific locations

---

## 🚨 TROUBLESHOOTING FOR ADMINS

### Employees Not Getting Auto Checked In

**Admin Actions:**

1. **Verify Geofence Setup:**
   - Go to Organization → Geofences
   - Check GPS coordinates are correct
   - Verify radius is reasonable (150m)
   - Confirm status is "Active"

2. **Check Attendance Settings:**
   - Go to Configuration → Attendance
   - Verify "Auto check-in" toggle is ON
   - Check operating hours include current time

3. **Test Coordinates:**
   - Open Google Maps
   - Enter the latitude/longitude you configured
   - Verify it points to your actual office

4. **Check Backend Status:**
   ```bash
   # View API endpoint
   GET /api/v1/attendance/geofence-regions
   
   # Should return regions array with your locations
   ```

### Employee Reports "Not Working"

**Admin Checklist:**

1. Ask employee to check:
   - Location permission: "Always" / "All the time"
   - GPS enabled on phone
   - Actually at work location (within radius)
   - Current time within operating hours

2. Check employee's attendance:
   - Go to Attendance → Daily Register
   - Find employee
   - Check if any attendance recorded today
   - Look for manual check-in option

3. Grant Manual Attendance:
   - If auto failed due to tech issue
   - HR/admin can manually add attendance
   - Include reason in notes

### Geofence Too Large/Small

**Adjust Radius:**

1. Go to Organization → Geofences
2. Click on geofence to edit
3. Change "Radius (metres)" value
4. Test from different distances
5. Typical adjustment: Start at 150m, increase if needed

---

## 📊 ADMIN REPORTS & ANALYTICS

### Geofencing Usage Statistics

**Location:** Admin Panel → Attendance → Reports

**Available Metrics:**
- % of attendance via auto check-in
- % of attendance via manual check-in
- Average distance from geofence center
- Geofence accuracy statistics
- Failed auto check-in count

### Per-Location Analytics

**View for each work location:**
- Total employees checked in
- Average arrival time
- Average departure time
- Late arrivals count
- Work duration statistics

---

## ✅ SUMMARY: ADMIN RESPONSIBILITIES

### Initial Setup (One-Time)
1. ✅ Add work locations with GPS coordinates
2. ✅ Set geofence radius (default: 150m)
3. ✅ Enable auto check-in toggle
4. ✅ Configure operating hours
5. ✅ Activate locations

### Ongoing Management
- ✅ Monitor daily attendance reports
- ✅ Review geofence accuracy
- ✅ Adjust radius if needed
- ✅ Handle manual attendance requests (backup)
- ✅ Update locations when offices change

### Employee Support
- ✅ Guide employees on granting permissions
- ✅ Troubleshoot location issues
- ✅ Approve manual attendance when needed
- ✅ Answer questions about auto check-in

---

## 🎯 KEY POINTS

1. **Admin sets up ONCE** - Employees benefit forever
2. **GPS coordinates are critical** - Must be accurate
3. **150m radius works for most offices** - Adjust if needed
4. **Auto check-in toggle** - Master on/off switch
5. **Operating hours enforced** - Prevents Sunday triggers
6. **Manual override always available** - Safety net for employees
7. **Server validates everything** - Prevents fake check-ins
8. **Audit trail preserved** - GPS, distance, method recorded

**The system is designed for minimum admin effort, maximum automation, and full auditability.**
