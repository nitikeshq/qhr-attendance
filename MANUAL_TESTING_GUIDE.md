# Manual Testing Guide - QHR Attendance System

## 📋 Testing Documentation Overview

This guide provides comprehensive manual testing procedures for all portals and features.

**Testing Checklist:** `TESTING_CHECKLIST.csv` - Import into Excel/Google Sheets for tracking

---

## 🎯 Testing Scope

### Portals to Test
1. **Admin Panel** - Web console for HR/Admin
2. **Mobile App** - Employee self-service (iOS/Android)
3. **Backend API** - RESTful API endpoints
4. **Integration Flows** - End-to-end workflows
5. **Security & Performance** - Non-functional testing

### Test User Accounts

#### Default Test Company
```
Company Code: TESTCO
Company Name: Test Company Ltd
```

#### Admin User
```
Email: admin@testco.com
Password: (Check backend console on first run)
Role: Admin
Access: Full system access
```

#### HR User
```
Employee ID: HR001
Passcode: 1234
Role: HR
Access: HR functions, no platform admin
```

#### Manager User
```
Employee ID: MGR001
Passcode: 1234
Role: Manager
Access: Team approvals, limited HR functions
```

#### Regular Employee
```
Employee ID: EMP001
Passcode: 1234
Role: Employee
Access: Self-service only
```

---

## 📊 Using the Testing Checklist

### Open in Excel/Google Sheets

**Method 1: Excel**
```
1. Open Microsoft Excel
2. File → Open
3. Select TESTING_CHECKLIST.csv
4. Click "Yes" to import
```

**Method 2: Google Sheets**
```
1. Open Google Sheets
2. File → Import
3. Upload TESTING_CHECKLIST.csv
4. Import data
```

### Checklist Columns

| Column | Purpose |
|--------|---------|
| **Module** | System area (Admin Panel, Mobile App, Backend API) |
| **Page/Section** | Specific page or feature area |
| **Feature/Function** | What to test |
| **Test Steps** | Detailed steps to perform |
| **Expected Result** | What should happen |
| **Status** | Not Tested / Pass / Fail / Blocked |
| **Tested By** | Tester name |
| **Date** | Test execution date |
| **Notes** | Issues found, observations |
| **Priority** | High / Medium / Low |

### How to Use

1. **Sort by Priority** - Test High priority items first
2. **Filter by Module** - Test one portal at a time
3. **Update Status** - Mark as Pass/Fail after testing
4. **Add Notes** - Document any issues or observations
5. **Track Progress** - Use conditional formatting to see completion %

---

## 🖥️ Admin Panel Testing

### Prerequisites
```bash
cd c:\Q-Projects\qhr-attendance\admin-panel
npm install
npm run dev
```

Access: http://localhost:3000

### Testing Flow

#### 1. Authentication (15 min)
- [ ] Admin login with valid credentials
- [ ] Login with invalid credentials (test error)
- [ ] Session persistence (refresh page)
- [ ] Logout functionality

#### 2. Dashboard (10 min)
- [ ] View summary metrics
- [ ] View subscription information
- [ ] Click quick actions
- [ ] Data accuracy verification

#### 3. Employee Management (45 min)
- [ ] View employee list
- [ ] Search employees
- [ ] Filter by status/department
- [ ] Pagination (10/25/50/100 rows)
- [ ] Add new employee
- [ ] Edit employee details
- [ ] View employee profile (all tabs)
- [ ] Upload employee photo
- [ ] Assign salary structure
- [ ] View payslips in profile
- [ ] View attendance history
- [ ] View leave history
- [ ] Deactivate employee
- [ ] Delete employee (if permitted)
- [ ] Export employee list
- [ ] Import employees via CSV

#### 4. Attendance Management (30 min)
- [ ] View daily register
- [ ] Change date
- [ ] Filter by geofence area
- [ ] Filter by work location
- [ ] Filter by status
- [ ] Search employee
- [ ] View geofence details (area, distance)
- [ ] Switch to location groups view
- [ ] Export attendance data
- [ ] Manual attendance entry/correction

#### 5. Leave Management (20 min)
- [ ] View pending leave requests
- [ ] Approve leave
- [ ] Reject leave with reason
- [ ] View all leaves
- [ ] Filter by leave type
- [ ] Filter by status
- [ ] View employee leave balance
- [ ] Export leave data

#### 6. WFH Management (15 min)
- [ ] View pending WFH requests
- [ ] Approve WFH
- [ ] Reject WFH with reason
- [ ] View all WFH records
- [ ] Filter and export

#### 7. Payroll (60 min)
- [ ] Generate payroll preview for period
- [ ] View readiness check (blockers/warnings)
- [ ] View exceptions view
- [ ] Generate draft payslips
- [ ] View payroll register
- [ ] Filter payslips by status
- [ ] View payslip details
- [ ] Edit draft payslip (add adjustment)
- [ ] Approve payslip
- [ ] Issue payslip to employee
- [ ] Mark as paid with reference
- [ ] Download payslip PDF
- [ ] Export payroll register
- [ ] View salary structures
- [ ] Create salary structure
- [ ] Edit salary structure
- [ ] Delete salary structure

#### 8. Reimbursements (20 min)
- [ ] View reimbursement requests
- [ ] Filter by status
- [ ] View request details
- [ ] View receipt attachment
- [ ] Approve reimbursement
- [ ] Reject reimbursement
- [ ] Partial approval (adjust amount)
- [ ] Export reimbursements

#### 9. Grievances (15 min)
- [ ] View grievances list
- [ ] Filter by category/status
- [ ] View grievance details
- [ ] Update status
- [ ] Add comment
- [ ] Resolve grievance with notes

#### 10. Projects & Tasks (20 min)
- [ ] View projects list
- [ ] Create project
- [ ] Edit project
- [ ] Assign members
- [ ] Delete project
- [ ] View tasks list
- [ ] Create task
- [ ] Edit task
- [ ] Change task status
- [ ] Delete task

#### 11. Assets (20 min)
- [ ] View assets list
- [ ] Add asset
- [ ] Assign asset to employee
- [ ] Return asset
- [ ] Change asset status
- [ ] Delete asset
- [ ] Filter by category/status
- [ ] Export assets

#### 12. Calendar (10 min)
- [ ] View calendar
- [ ] Navigate months
- [ ] View holiday details
- [ ] View event details

#### 13. Organization Management (40 min)

**Departments:**
- [ ] View departments
- [ ] Add department
- [ ] Edit department
- [ ] Delete department

**Designations:**
- [ ] View designations
- [ ] Add designation
- [ ] Edit designation
- [ ] Delete designation

**Work Locations:**
- [ ] View work locations
- [ ] Add work location
- [ ] Edit work location
- [ ] Add GPS coordinates
- [ ] Set as payroll address
- [ ] Delete work location

**Geofences:**
- [ ] View geofences
- [ ] Add geofence manually
- [ ] Add geofence linked to work location
- [ ] Edit geofence (change radius/coordinates)
- [ ] Deactivate geofence
- [ ] Delete geofence
- [ ] Verify geofence appears on map
- [ ] Test coordinate validation

#### 14. Configuration (60 min)

**Company Settings:**
- [ ] View company profile
- [ ] Edit company details
- [ ] Upload company logo
- [ ] Edit registered office address
- [ ] Add statutory details (PAN/TAN/GSTIN)
- [ ] Add PF/ESI establishment codes

**Attendance Settings:**
- [ ] Enable auto check-in
- [ ] Disable auto check-in
- [ ] Set operating hours
- [ ] Enable GPS tracking
- [ ] Require photo on check-in
- [ ] Set late threshold

**Work Week Settings:**
- [ ] Configure work week (Full/Half/Off per day)
- [ ] Set occurrence patterns (1st, 2nd Saturday off)
- [ ] View work week preview
- [ ] Set salary day basis (Calendar/Working days)
- [ ] Verify calculation preview

**Holidays:**
- [ ] View holidays list
- [ ] Add holiday
- [ ] Edit holiday
- [ ] Delete holiday
- [ ] Import holidays from CSV

**Leave Types:**
- [ ] View leave types
- [ ] Add leave type
- [ ] Edit leave type (allowance, paid/unpaid)
- [ ] Delete leave type

**Payroll Settings:**
- [ ] Enable PF with percentages
- [ ] Enable ESI with percentages
- [ ] Configure TDS rules
- [ ] Set payment day
- [ ] Enable LOP deductions

#### 15. Subscriptions (10 min)
- [ ] View current plan
- [ ] View usage statistics
- [ ] View billing history
- [ ] Download invoice
- [ ] Upgrade plan (if available)

#### 16. Onboarding Wizard (30 min)
- [ ] View onboarding progress
- [ ] Complete Company Profile step
- [ ] Complete Payroll Identity step
- [ ] Add Work Locations step
- [ ] Setup Departments step
- [ ] Configure Statutory step
- [ ] Configure Attendance Policy step
- [ ] Setup Leave Policy step
- [ ] Add Holidays step
- [ ] Add Team Members step
- [ ] Review and Go Live

#### 17. Reports (15 min)
- [ ] Generate attendance report
- [ ] Generate leave report
- [ ] Generate payroll report
- [ ] Export reports (CSV/PDF)

---

## 📱 Mobile App Testing

### Prerequisites

**Option 1: Test with Expo Go (Quick)**
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile
npm install
npm start
```
Scan QR code with Expo Go app

**Option 2: Build APK (Full Testing)**
```bash
eas build --platform android --profile preview
```
Wait for build, download and install APK

### Testing Flow

#### 1. Authentication (10 min)
- [ ] Employee login with valid credentials
- [ ] Login with invalid credentials
- [ ] Remember session (close and reopen app)
- [ ] Logout functionality

#### 2. Home Screen (10 min)
- [ ] View dashboard
- [ ] View today's attendance status
- [ ] Tap quick action cards
- [ ] View metrics (hours, days)
- [ ] Refresh data

#### 3. Attendance (45 min)

**Manual Attendance:**
- [ ] Manual check-in with location
- [ ] Manual check-out
- [ ] View check-in/out details

**Auto Attendance Setup:**
- [ ] View auto attendance status
- [ ] Grant "When in use" location permission
- [ ] Grant "Always"/"All the time" permission
- [ ] Verify "Auto attendance active" status
- [ ] View monitored locations count

**Auto Check-in Testing (Physical Device Required):**
- [ ] Start outside work location
- [ ] Close app completely
- [ ] Move into geofenced area
- [ ] Wait 30-60 seconds
- [ ] Open app and verify automatic check-in
- [ ] Check method shows "automatic"
- [ ] Verify geofence area recorded

**Auto Check-out Testing:**
- [ ] Start inside work location (after check-in)
- [ ] Close app completely
- [ ] Move outside geofenced area
- [ ] Wait 30-60 seconds
- [ ] Open app and verify automatic check-out
- [ ] Verify work duration calculated

**Offline Testing:**
- [ ] Enable airplane mode
- [ ] Enter work location
- [ ] Wait 1 minute
- [ ] Disable airplane mode
- [ ] Verify queued punch sent to server

**Permission Denial:**
- [ ] Deny location permission
- [ ] View error message and instructions
- [ ] Open settings and grant permission
- [ ] Verify auto attendance activates

#### 4. Requests (40 min)

**Leave Requests:**
- [ ] View leave request form
- [ ] Select leave type from dropdown
- [ ] Select start and end dates
- [ ] Enter reason
- [ ] Submit leave request
- [ ] View leave balance
- [ ] View leave history with status

**WFH Requests:**
- [ ] Fill WFH form
- [ ] Select date
- [ ] Enter reason and location
- [ ] Submit WFH request
- [ ] View WFH history

**Grievances:**
- [ ] Fill grievance form
- [ ] Select category
- [ ] Enter subject and description
- [ ] Submit grievance
- [ ] View ticket number
- [ ] View grievance history

**Reimbursements:**
- [ ] Fill expense form
- [ ] Select category
- [ ] Enter amount, date, details
- [ ] Attach receipt (camera)
- [ ] Attach receipt (gallery)
- [ ] Submit reimbursement
- [ ] View reimbursement history

#### 5. Calendar (10 min)
- [ ] View calendar
- [ ] Navigate months (previous/next)
- [ ] Jump to today
- [ ] View holiday details
- [ ] View leave markers on calendar

#### 6. Inbox/Notifications (10 min)
- [ ] View notifications list
- [ ] Check unread badge count
- [ ] Tap notification (mark as read)
- [ ] Verify badge count decreases
- [ ] Mark all as read
- [ ] View notification details

#### 7. Work (15 min)
- [ ] View projects section
- [ ] View assigned projects
- [ ] View tasks section
- [ ] View assigned tasks with status
- [ ] Filter tasks by status
- [ ] Update task status
- [ ] Save task changes

#### 8. Payslips (20 min)
- [ ] View payslips list
- [ ] Tap on payslip
- [ ] View earnings breakdown
- [ ] View deductions breakdown
- [ ] View net salary
- [ ] Download/Print payslip as PDF
- [ ] Share payslip
- [ ] Verify all components displayed

#### 9. Team Features (Manager Only) (30 min)

**View as Manager (Login: MGR001/1234):**
- [ ] View Team tab
- [ ] View team attendance today
- [ ] View pending leave requests
- [ ] Approve leave request
- [ ] Reject leave request with reason
- [ ] Verify notification sent to employee
- [ ] View pending WFH requests
- [ ] Approve WFH request
- [ ] Reject WFH request
- [ ] View team grievances
- [ ] View reimbursement approvals
- [ ] Approve reimbursement with amount
- [ ] Reject reimbursement

#### 10. Menu (5 min)
- [ ] View menu screen
- [ ] View grouped sections
- [ ] Navigate to any section from menu
- [ ] View profile info at top
- [ ] Sign out from menu

---

## 🔌 Backend API Testing

### Prerequisites
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile\Backend
npm install
npm start
```

API Base URL: http://localhost:5000/api/v1

### Testing Tools
- **Postman** (recommended) - Import collection
- **cURL** - Command line
- **REST Client VS Code Extension**

### Authentication Flow

**1. Login**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "companyCode": "TESTCO",
  "employeeId": "EMP001",
  "passcode": "1234"
}

Expected: 200 OK with accessToken
```

**2. Use Token in Requests**
```http
GET /api/v1/attendance/today
Authorization: Bearer {accessToken}

Expected: 200 OK with attendance data
```

### API Test Checklist (See CSV)

Test all endpoints listed in "BACKEND API" section of checklist:
- Authentication endpoints
- Attendance endpoints (including geofence-regions)
- Leave management endpoints
- Payroll endpoints
- All CRUD operations
- Error responses (401, 403, 404, 500)

---

## 🔗 Integration Testing

### Critical Flows to Test

#### Flow 1: Complete Geofencing Setup
```
1. Admin: Add work location with GPS (19.0760, 72.8777)
2. Admin: Enable auto check-in toggle
3. Employee: Login to mobile app
4. Employee: Grant "Always" location permission
5. Verify: Mobile shows "Auto attendance active"
6. Employee: Go to physical location
7. Verify: Auto check-in happens
8. Admin: Check daily register
9. Verify: Shows automatic check-in with geofence area
```

#### Flow 2: Leave Approval Workflow
```
1. Employee: Apply for leave
2. Manager: See in Team tab
3. Manager: Approve leave
4. Employee: Receive notification
5. Verify: Leave balance updated
6. Verify: Calendar shows leave
7. Admin: Verify in leave register
```

#### Flow 3: Payroll Generation
```
1. Admin: Generate payroll preview
2. Admin: Check readiness (fix any blockers)
3. Admin: Generate draft payslips
4. Admin: Review and approve all payslips
5. Admin: Issue payslips to employees
6. Employee: View payslip in mobile app
7. Employee: Download PDF
8. Admin: Mark payslips as paid
9. Verify: Status updates throughout
```

#### Flow 4: Reimbursement Process
```
1. Employee: Submit expense with receipt
2. Manager: View in approvals
3. Manager: Approve with amount
4. Manager: Set payment method (payroll/separate)
5. Verify: Notification sent to employee
6. Verify: Status updated
7. If payroll: Linked to next payslip
8. Admin: View in reimbursements register
```

---

## 🔒 Security Testing

### Authentication Tests
- [ ] SQL injection in login fields
- [ ] XSS attempts in text inputs
- [ ] Token expiry handling
- [ ] Invalid token rejection
- [ ] Session timeout
- [ ] Logout clears session

### Authorization Tests
- [ ] Employee cannot access admin endpoints
- [ ] Manager can only see own team
- [ ] Employee cannot view others' payslips
- [ ] Cross-company data isolation
- [ ] Role-based access enforced

### Data Security
- [ ] Passwords hashed (not plaintext)
- [ ] Sensitive data encrypted
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] File upload restrictions (type, size)

---

## ⚡ Performance Testing

### Load Time Tests
- [ ] Admin page load < 3 seconds
- [ ] Mobile app launch < 3 seconds
- [ ] API response < 1 second
- [ ] Large data pagination works smoothly
- [ ] Export large datasets

### Stress Tests
- [ ] 100+ employees in list
- [ ] 1000+ attendance records
- [ ] Concurrent users
- [ ] Bulk operations

---

## ♿ Accessibility Testing

- [ ] Keyboard navigation
- [ ] Screen reader compatibility
- [ ] Color contrast ratios
- [ ] Touch target sizes (mobile)
- [ ] Form field labels
- [ ] Error message clarity

---

## 📈 Test Progress Tracking

### Using the CSV Checklist

**1. Open in Excel/Google Sheets**
- Import TESTING_CHECKLIST.csv
- Enable filtering

**2. Add Conditional Formatting**
```
Status column:
- Green: Pass
- Red: Fail
- Yellow: Blocked
- Gray: Not Tested
```

**3. Calculate Completion**
```
Total Tests: COUNT(Status column)
Passed: COUNTIF(Status, "Pass")
Failed: COUNTIF(Status, "Fail")
Completion %: (Passed + Failed) / Total * 100
```

**4. Priority-Based Testing**
```
Sort by Priority column
Test High → Medium → Low
```

### Daily Testing Report Template

```
Date: __________
Tester: __________

Tests Executed Today: ___
Passed: ___
Failed: ___
Blocked: ___

Critical Issues Found:
1. 
2. 
3. 

Blockers:
1. 
2. 

Next Steps:
1. 
2. 
```

---

## 🐛 Bug Report Template

When you find issues:

```
Bug ID: BUG-001
Module: Admin Panel / Mobile App / Backend API
Page/Screen: _____________
Priority: High / Medium / Low
Severity: Critical / Major / Minor

Steps to Reproduce:
1. 
2. 
3. 

Expected Result:
_____________

Actual Result:
_____________

Screenshots/Videos:
(Attach)

Environment:
- Browser/Device: _______
- OS Version: _______
- App Version: _______

Tested By: _______
Date: _______
```

---

## ✅ Test Completion Criteria

### Admin Panel: DONE when
- [ ] All high priority tests pass
- [ ] All CRUD operations work
- [ ] All workflows complete successfully
- [ ] No critical bugs remain
- [ ] Performance acceptable

### Mobile App: DONE when
- [ ] All authentication flows work
- [ ] Auto geofencing works on physical device
- [ ] All self-service features functional
- [ ] Manager approvals work
- [ ] No crashes or freezes
- [ ] Performance acceptable

### Backend API: DONE when
- [ ] All endpoints respond correctly
- [ ] Error handling works
- [ ] Authentication/authorization enforced
- [ ] Data validation works
- [ ] Performance acceptable

### Integration: DONE when
- [ ] All critical flows complete end-to-end
- [ ] Data flows correctly between systems
- [ ] Notifications work
- [ ] No data loss or corruption

---

## 📞 Testing Support

### If You Find Issues

1. **Document in checklist** (Status: Fail, add notes)
2. **Create bug report** (use template above)
3. **Take screenshots/videos**
4. **Note reproduction steps**
5. **Check priority** (High/Medium/Low)

### Common Issues & Solutions

**Issue: Cannot login to admin panel**
- Check backend is running
- Check correct credentials
- Clear browser cache
- Check console for errors

**Issue: Mobile app not connecting**
- Check backend API URL
- Check device can reach backend
- Check API_ROOT in mobile app config

**Issue: Auto check-in not working**
- Verify GPS coordinates correct
- Verify auto check-in toggle ON
- Verify operating hours set
- Verify location permission "Always"
- Verify geofence radius appropriate
- Test on physical device (not simulator)

**Issue: Payroll calculations wrong**
- Check work week configuration
- Check salary day basis setting
- Check attendance records accurate
- Check leave records accurate
- Generate preview to see breakdown

---

## 🎯 Quick Start Testing

### Fastest Path to Test Everything (4 hours)

**Hour 1: Setup & Admin (60 min)**
1. Start backend and admin panel
2. Login as admin
3. Configure company (GPS, auto check-in, hours)
4. Add test employees
5. Test key admin features

**Hour 2: Mobile Employee Testing (60 min)**
1. Build/run mobile app
2. Login as employee
3. Test manual attendance
4. Setup auto attendance (grant permissions)
5. Test leave/WFH/expenses
6. View payslips

**Hour 3: Manager & Geofencing (60 min)**
1. Login as manager
2. Test approvals
3. Physical device geofencing test
4. Move in/out of location
5. Verify auto check-in/out

**Hour 4: Payroll & Integration (60 min)**
1. Generate payroll preview
2. Create payslips
3. Issue to employees
4. Verify in mobile
5. Test complete workflows

---

**Ready to test!** Open TESTING_CHECKLIST.csv in Excel and start testing systematically.
