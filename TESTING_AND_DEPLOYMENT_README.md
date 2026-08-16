# Testing & Deployment - Complete Guide

## 📁 Files Created for You

### Testing Documentation
1. **TESTING_CHECKLIST.csv** - Excel-ready test checklist with 400+ test cases
2. **MANUAL_TESTING_GUIDE.md** - Complete step-by-step testing guide
3. **BUILD_DEPLOY_GUIDE.md** - Production deployment instructions

### Build Scripts
4. **attendance-mobile/build-apk.bat** - Windows script to build APK
5. **attendance-mobile/build-apk.sh** - Mac/Linux script to build APK

---

## 🚀 Quick Start - 3 Steps

### Step 1: Import Test Checklist (2 minutes)

```
1. Open Microsoft Excel or Google Sheets
2. Import TESTING_CHECKLIST.csv
3. Enable filtering
4. Sort by "Priority" column
5. Start testing High priority items first
```

**Checklist includes:**
- ✅ 400+ test cases
- ✅ Admin Panel (200+ tests)
- ✅ Mobile App (150+ tests)
- ✅ Backend API (50+ tests)
- ✅ Integration flows
- ✅ Security & performance

### Step 2: Build Mobile APK (20 minutes)

**Windows:**
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile
build-apk.bat
```

**Mac/Linux:**
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile
chmod +x build-apk.sh
./build-apk.sh
```

**The script will:**
1. Check/install EAS CLI
2. Login to Expo (if needed)
3. Choose Preview or Production build
4. Submit build to EAS servers
5. Email you download link when ready (15-20 min)

### Step 3: Deploy to Production (30 minutes)

Follow: **BUILD_DEPLOY_GUIDE.md**

Quick version:
```bash
# 1. Deploy backend
ssh your-server
cd /var/www/qhr-attendance
git pull
cd attendance-mobile/Backend
npm install --production
pm2 restart qhr-backend

# 2. Deploy admin panel (if using Vercel)
cd admin-panel
vercel --prod

# 3. Mobile app - already built in Step 2
# Download APK and distribute to users
```

---

## 📋 Testing Workflow

### Phase 1: Admin Panel Testing (2-3 hours)

**Open checklist, filter by:**
- Module: ADMIN PANEL
- Priority: High

**Test in order:**
1. Authentication (login/logout)
2. Employee management (CRUD operations)
3. Attendance (daily register, geofences)
4. Leave management (approvals)
5. Payroll (preview, generate, issue)
6. Configuration (company, attendance, payroll)

**Track progress:**
- Mark Status: Pass / Fail / Blocked
- Add notes for issues
- Take screenshots

### Phase 2: Mobile App Testing (2-3 hours)

**Requirements:**
- Backend running (localhost:5000)
- Test device or emulator
- APK built and installed

**Open checklist, filter by:**
- Module: MOBILE APP
- Priority: High

**Test in order:**
1. Authentication
2. Attendance (manual + auto)
3. Auto geofencing (MUST use physical device)
4. Requests (leave, WFH, expenses)
5. Payslips
6. Manager approvals (if applicable)

**Critical: Geofencing Test**
- Must use real device (not emulator)
- Configure test geofence at your current location
- Close app completely
- Move in/out of area
- Verify auto check-in/check-out

### Phase 3: Integration Testing (1-2 hours)

**Open checklist, filter by:**
- Module: INTEGRATION

**Test complete workflows:**
1. Geofencing: Admin setup → Employee auto check-in
2. Leave: Employee applies → Manager approves
3. Payroll: Generate → Issue → Employee views
4. Reimbursement: Employee submits → Manager approves

### Phase 4: Security & Performance (1 hour)

**Open checklist, filter by:**
- Module: SECURITY
- Module: PERFORMANCE

**Test:**
- SQL injection attempts
- XSS attempts
- Access control (roles/permissions)
- Page load times
- API response times

---

## 📊 Test Coverage Summary

| Module | Test Cases | Estimated Time |
|--------|-----------|----------------|
| Admin Panel | 200+ | 2-3 hours |
| Mobile App | 150+ | 2-3 hours |
| Backend API | 50+ | 1 hour |
| Integration | 20+ | 1-2 hours |
| Security | 15+ | 30 min |
| Performance | 10+ | 30 min |
| **Total** | **400+** | **8-10 hours** |

---

## 🎯 Test User Accounts

All test users are in the seeded data:

### Company
```
Code: TESTCO
Name: Test Company Ltd
```

### Users for Testing

**Admin (Full Access):**
```
Email: admin@testco.com
Password: (check backend console)
Access: Everything
```

**HR User:**
```
Employee ID: HR001
Passcode: 1234
Access: HR functions
```

**Manager:**
```
Employee ID: MGR001
Passcode: 1234
Access: Team management, approvals
```

**Employee:**
```
Employee ID: EMP001
Passcode: 1234
Access: Self-service only
```

---

## 🏗️ Building Mobile APK

### Using the Build Script (Easiest)

**Windows:**
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile
build-apk.bat
```

**The script handles:**
- ✅ Installing EAS CLI if needed
- ✅ Logging in to Expo
- ✅ Choosing build profile
- ✅ Submitting build
- ✅ Providing build status

**Build profiles:**
1. **Preview** - APK for testing (sideload on any device)
2. **Production** - AAB for Play Store

**Timeline:**
- Script runs: 1-2 minutes
- Build time: 15-20 minutes
- Download link: Sent to your email

### Manual Build (Alternative)

```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile

# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build
eas build --platform android --profile preview

# Check status
eas build:list
```

### After Build Completes

1. **Download APK** from email link or EAS dashboard
2. **Test on device:**
   - Transfer APK to device
   - Enable "Install from unknown sources"
   - Install APK
   - Test all features
3. **Distribute to users** if tests pass

---

## 🚀 Deployment Steps

### Before Deploying

**Checklist:**
- [ ] All High priority tests passed
- [ ] Critical bugs fixed
- [ ] APK tested on physical device
- [ ] Production environment ready (server, domain, SSL)
- [ ] Environment variables configured
- [ ] Database backup plan in place

### Backend Deployment

```bash
# On production server
cd /var/www
git clone <your-repo>
cd qhr-attendance/attendance-mobile/Backend

# Install dependencies
npm install --production

# Configure environment
nano .env
# Add: NODE_ENV, PORT, JWT_SECRET, ALLOWED_ORIGINS, etc.

# Start with PM2
pm2 start npm --name "qhr-backend" -- start
pm2 save
pm2 startup

# Configure Nginx
# Setup SSL with certbot
```

**Detailed steps:** See BUILD_DEPLOY_GUIDE.md

### Admin Panel Deployment

**Option 1: Vercel (Recommended)**
```bash
cd admin-panel
vercel --prod
```

**Option 2: Self-hosted**
```bash
npm run build
# Deploy .next folder to server
pm2 start serve -- -s .next -l 3000
```

**Detailed steps:** See BUILD_DEPLOY_GUIDE.md

### Mobile App Distribution

1. **Build production APK** (already done)
2. **Test thoroughly**
3. **Distribute:**
   - Direct: Email/download link
   - Internal: Firebase App Distribution
   - Public: Google Play Store

**Detailed steps:** See BUILD_DEPLOY_GUIDE.md

---

## 📱 Mobile App API Configuration

### For Local Testing
```env
# attendance-mobile/.env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api/v1
```

### For Production
```env
# attendance-mobile/.env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

**Important:** Build new APK after changing API URL!

---

## ✅ Testing Sign-off Criteria

### Admin Panel: READY when
- [ ] All High priority tests: PASS
- [ ] All CRUD operations work
- [ ] Geofence configuration working
- [ ] Payroll generation working
- [ ] No critical bugs
- [ ] Performance acceptable (<3s page load)

### Mobile App: READY when
- [ ] All High priority tests: PASS
- [ ] Login/logout works
- [ ] Manual check-in/out works
- [ ] Auto geofencing works (tested on device)
- [ ] All self-service features work
- [ ] Manager approvals work (if applicable)
- [ ] No crashes
- [ ] Performance acceptable (<3s launch)

### Backend API: READY when
- [ ] All critical endpoints tested
- [ ] Authentication/authorization working
- [ ] Geofence API working
- [ ] Data validation working
- [ ] Error handling working
- [ ] Performance acceptable (<1s response)

### Integration: READY when
- [ ] Admin → Mobile geofencing flow works end-to-end
- [ ] Leave approval workflow complete
- [ ] Payroll generation → Mobile viewing works
- [ ] All notifications delivered
- [ ] No data loss or corruption

---

## 🐛 Issue Tracking

### Found a Bug?

**Use the checklist:**
1. Mark Status: **Fail**
2. Add in Notes column:
   ```
   BUG: Short description
   Steps: 1. 2. 3.
   Expected: ...
   Actual: ...
   ```
3. Take screenshot
4. Create separate bug report if critical

### Bug Priority Guidelines

**High/Critical:**
- Blocks core functionality
- Data loss
- Security vulnerability
- Crashes app

**Medium:**
- Feature doesn't work as expected
- UI issues
- Performance problems

**Low:**
- Cosmetic issues
- Nice-to-have features
- Minor inconveniences

---

## 📈 Testing Progress Tracking

### Daily Testing Report

Create a simple daily summary:

```
Date: __________
Tester: __________

Tests Executed: ___
Passed: ___
Failed: ___
Blocked: ___

Completion %: ___

High Priority Bugs:
1. 
2. 

Blockers:
1. 

Tomorrow's Plan:
1. 
2. 
```

### Weekly Summary

```
Week Ending: __________

Total Tests: ___
Completed: ___
Completion %: ___

Modules Tested:
- [ ] Admin Panel
- [ ] Mobile App
- [ ] Backend API
- [ ] Integration
- [ ] Security
- [ ] Performance

Critical Issues Open: ___
Blockers: ___

Status: On Track / At Risk / Blocked
```

---

## 📞 Support & Resources

### Documentation Files

| File | Purpose |
|------|---------|
| **TESTING_CHECKLIST.csv** | 400+ test cases in Excel format |
| **MANUAL_TESTING_GUIDE.md** | Detailed testing procedures |
| **BUILD_DEPLOY_GUIDE.md** | Deployment instructions |
| **AUTO_CHECKIN_STATUS.md** | Geofencing implementation details |
| **GEOFENCING_ADMIN_SETUP.md** | Admin configuration guide |
| **YOUR_QUESTIONS_ANSWERED.md** | FAQ and troubleshooting |

### Quick Links

```
Local Backend: http://localhost:5000
Local Admin: http://localhost:3000
Mobile Dev Server: http://localhost:8081

Production Backend: https://api.yourdomain.com
Production Admin: https://admin.yourdomain.com
```

### Common Issues

**Issue: Cannot build APK**
- Solution: Run `npm install -g eas-cli` then `eas login`

**Issue: Geofencing not working**
- Solution: Use physical device, check GPS enabled, verify coordinates

**Issue: Admin panel not connecting to backend**
- Solution: Check NEXT_PUBLIC_API_URL environment variable

**Issue: Mobile app showing network error**
- Solution: Check backend is running, check API_ROOT in src/api.js

---

## 🎯 Next Steps

### 1. Today: Start Testing (2 hours)
```
1. Open TESTING_CHECKLIST.csv in Excel
2. Sort by Priority (High first)
3. Filter Module: ADMIN PANEL
4. Start testing and marking Pass/Fail
5. Take notes of any issues
```

### 2. This Week: Complete Core Testing (8 hours)
```
Day 1-2: Admin Panel testing
Day 3-4: Mobile App testing
Day 5: Integration and security testing
```

### 3. Next Week: Build and Deploy (1 day)
```
Morning: Build production APK
Afternoon: Deploy backend and admin
Evening: Distribute APK and verify
```

### 4. Ongoing: Monitor and Fix (Continuous)
```
- Monitor production logs
- Fix reported bugs
- Release updates
- Collect user feedback
```

---

## ✅ Final Checklist Before Going Live

### Technical
- [ ] All High priority tests passed
- [ ] APK built and tested on device
- [ ] Backend deployed to production
- [ ] Admin panel deployed to production
- [ ] SSL certificates installed
- [ ] Environment variables configured
- [ ] Database backups scheduled
- [ ] Monitoring setup (PM2, logs)

### Business
- [ ] Admin trained on system
- [ ] HR trained on system
- [ ] Employees onboarded (credentials provided)
- [ ] Support process defined
- [ ] Documentation shared with users
- [ ] Go-live date communicated

### Security
- [ ] Default passwords changed
- [ ] JWT secrets are strong
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] File upload restrictions set
- [ ] Sensitive data encrypted

---

**Ready to test and deploy!** Start with TESTING_CHECKLIST.csv and follow MANUAL_TESTING_GUIDE.md

**Questions?** Refer to the documentation files listed above.
