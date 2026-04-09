# QHR Attendance System - Complete Setup Guide

## 🎨 Unified Branding Applied

### Professional Blue Theme
All applications now use a consistent **professional blue color scheme**:
- **Primary Blue**: #2563eb (Deep Blue)
- **Accent Cyan**: #06b6d4 (Bright Cyan)
- **Success Green**: #10b981
- **Warning Amber**: #f59e0b

This branding is applied across:
- ✅ Mobile App (iOS & Android)
- ✅ Admin Panel
- ✅ Landing Page

### Company Customization
Companies can customize their branding in the admin panel:
- Upload company logo
- Choose primary and secondary colors
- Select from preset fonts
- Preview changes before applying

---

## 🚀 Running Services

### Current Status
| Service | URL | Port | Status |
|---------|-----|------|--------|
| **Backend API** | http://localhost:5001/api/v1 | 5001 | ✅ Running |
| **Admin Panel** | http://localhost:3001 | 3001 | ✅ Running |
| **Landing Page** | http://localhost:3002 | 3002 | ✅ Running |
| **Mobile App** | Android Emulator | 8081 | ✅ Running |

### Start All Services
```bash
# From Backend directory
npm run dev:all
```

This starts:
1. Backend API (port 5001)
2. Admin Panel (port 3001)
3. Landing Page (port 3002)

### Start Individual Services
```bash
# Backend only
npm run dev

# Admin Panel only
npm run admin:dev

# Landing Page only
npm run landing:dev

# Mobile App
cd ../
npx expo start
```

---

## 📱 Complete User Journey

### 1. Company Registration (Landing Page)
**URL**: http://localhost:3002/register

**Steps**:
1. Visit landing page
2. Click "Get Started" or "Start Free Trial"
3. Fill registration form:
   - Company Name
   - Company Code (unique, alphanumeric, max 10 chars)
   - Industry
   - Address
   - Admin First Name
   - Admin Last Name
   - Admin Email
   - Admin Phone
4. Agree to Terms & Conditions
5. Submit form

**Backend Process**:
- Creates company (inactive)
- Creates admin employee (ADMIN001, inactive)
- Generates verification token (24-hour expiry)
- Generates temporary passcode
- Sends verification email (TODO: email service)

**Response** (Development Mode):
```json
{
  "success": true,
  "message": "Company registered successfully",
  "data": {
    "companyId": "...",
    "companyCode": "ABC123",
    "verificationToken": "...",
    "tempPasscode": "XYZ789AB"
  }
}
```

### 2. Email Verification
**Endpoint**: `POST /api/v1/companies/verify-email`

**Payload**:
```json
{
  "token": "verification_token_from_email"
}
```

**Process**:
- Validates token
- Activates admin account
- Activates company
- Returns login credentials

### 3. Admin Login (Admin Panel)
**URL**: http://localhost:3001

**Credentials**:
- Company Code: ABC123
- Employee ID: ADMIN001
- Passcode: (from email)

**First Login**:
- System forces password change
- Admin sets new secure password
- Redirected to dashboard

### 4. Admin Dashboard
**Features**:
- View company stats
- Manage employees
- Configure office locations
- Set operating hours
- Customize company branding
- View attendance reports
- Manage leaves
- Process payroll

### 5. Add Employees
**Steps**:
1. Navigate to Employees section
2. Click "Add Employee"
3. Fill employee details:
   - Employee ID
   - First Name, Last Name
   - Email, Phone
   - Role (employee, hr, admin)
   - Department, Designation
   - Salary details
4. System generates temporary passcode
5. Send credentials to employee

### 6. Employee Mobile App Login
**Mobile App**: Download from Play Store / App Store

**Login**:
1. Select company from dropdown
2. Enter Employee ID / Email / Phone
3. Enter Passcode
4. First login → Change password

**Features**:
- Auto check-in/out with GPS
- View attendance history
- Apply for leaves
- Request WFH
- View payslips
- Submit grievances
- Track tasks

---

## 🔧 API Endpoints

### Public Endpoints
```
GET  /api/v1/auth/companies          - List all companies
POST /api/v1/auth/login              - Employee login
POST /api/v1/auth/admin-login        - Admin/HR login
POST /api/v1/companies/register      - Company registration
POST /api/v1/companies/verify-email  - Email verification
```

### Protected Endpoints (Require Auth)
```
# Attendance
POST /api/v1/attendance/check-in
POST /api/v1/attendance/check-out
GET  /api/v1/attendance/history

# Leaves
POST /api/v1/leaves/apply
GET  /api/v1/leaves/my-leaves
PUT  /api/v1/leaves/:id/approve

# Payroll
GET  /api/v1/payroll/my-payslips
POST /api/v1/payroll/generate

# Employees (Admin/HR only)
GET  /api/v1/employees
POST /api/v1/employees
PUT  /api/v1/employees/:id
```

---

## 🗄️ Database Schema

### Companies Collection
```javascript
{
  name: String,
  code: String (unique, uppercase),
  address: String,
  industry: String,
  isActive: Boolean,
  location: { latitude, longitude, radius },
  operatingHours: { startTime, endTime },
  settings: { autoCheckIn, autoCheckOut, gpsTracking, ... },
  leaveSettings: { casualLeave, sickLeave, paidLeave, ... },
  branding: { logo, primaryColor, secondaryColor }
}
```

### Employees Collection
```javascript
{
  company: ObjectId,
  employeeId: String,
  email: String,
  firstName: String,
  lastName: String,
  phone: String,
  role: Enum ['employee', 'hr', 'admin', 'super_admin'],
  passcode: String (hashed),
  isActive: Boolean,
  requirePasswordChange: Boolean,
  verificationToken: String,
  verificationExpires: Date,
  department: String,
  designation: String,
  salary: Number
}
```

### Attendance Collection
```javascript
{
  employee: ObjectId,
  company: ObjectId,
  date: Date,
  checkIn: { time, location, isLate },
  checkOut: { time, location },
  workHours: Number,
  status: Enum ['present', 'absent', 'late', 'half_day']
}
```

---

## 🎯 Testing Checklist

### Landing Page
- [ ] Hero section displays correctly
- [ ] Features section shows all 6 features
- [ ] Pricing cards display properly
- [ ] Testimonials render
- [ ] Registration form validates input
- [ ] Form submits to backend
- [ ] Success page shows credentials

### Registration Flow
- [ ] Company registration creates records
- [ ] Verification token generated
- [ ] Email verification activates accounts
- [ ] Admin can login after verification

### Admin Panel
- [ ] Login with company code works
- [ ] Super admin login (no company code) works
- [ ] Password change enforced on first login
- [ ] Dashboard shows correct stats
- [ ] Employee management works
- [ ] Location management works
- [ ] Company branding customization works

### Mobile App
- [ ] Company dropdown loads from API
- [ ] Login with employee ID works
- [ ] Login with email works
- [ ] Login with phone works
- [ ] GPS permissions requested
- [ ] Auto check-in triggers in geofence
- [ ] Manual check-in works
- [ ] Attendance history displays
- [ ] Leave application works

---

## 🔐 Security Considerations

### Implemented
✅ Password hashing (bcrypt)
✅ JWT authentication
✅ Role-based access control
✅ Company data isolation
✅ Secure password requirements
✅ Token expiration

### TODO (Production)
- [ ] HTTPS/SSL certificates
- [ ] Rate limiting on public endpoints
- [ ] CAPTCHA on registration form
- [ ] Email verification service (SendGrid/AWS SES)
- [ ] Two-factor authentication
- [ ] IP whitelisting for admin panel
- [ ] Audit logging
- [ ] Data encryption at rest
- [ ] Regular security audits

---

## 📧 Email Templates Needed

### 1. Company Registration Verification
**Subject**: Verify your QHR account

**Content**:
- Welcome message
- Verification link with token
- Temporary passcode
- Login instructions
- Support contact

### 2. Employee Invitation
**Subject**: You've been added to [Company Name] on QHR

**Content**:
- Welcome message
- Company code
- Employee ID
- Temporary passcode
- Mobile app download links
- Login instructions

### 3. Password Reset
**Subject**: Reset your QHR password

**Content**:
- Reset link with token
- Expiry time (1 hour)
- Security tips

---

## 🚀 Deployment Guide

### Backend (Node.js + MongoDB)
```bash
# Install dependencies
npm install

# Set environment variables
PORT=5001
MONGODB_URI=mongodb://...
JWT_SECRET=...
REDIS_HOST=...
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=...

# Build admin panel and landing page
npm run build

# Start production server
npm start
```

### Admin Panel (Next.js)
```bash
cd admin-panel
npm install
npm run build
npm start
```

### Landing Page (Next.js)
```bash
cd landing-page
npm install
npm run build
npm start
```

### Mobile App (Expo)
```bash
# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

---

## 📊 Monitoring & Analytics

### Metrics to Track
- User registrations per day
- Active companies
- Total employees
- Daily check-ins
- Average response time
- Error rates
- Mobile app crashes

### Tools
- Backend: PM2, Winston logs
- Frontend: Sentry, LogRocket
- Analytics: Google Analytics, Mixpanel
- Uptime: UptimeRobot, Pingdom

---

## 🎓 User Documentation

### For Admins
1. Getting Started Guide
2. Employee Management
3. Location Setup
4. Attendance Reports
5. Payroll Processing
6. Company Branding

### For Employees
1. Mobile App Installation
2. First Login & Password Change
3. Daily Check-in/out
4. Applying for Leaves
5. Viewing Payslips
6. Troubleshooting GPS Issues

---

## 🆘 Support & Troubleshooting

### Common Issues

**Mobile app can't connect to backend**
- Check API URL in `src/constants/api.ts`
- For Android emulator: Use `http://10.0.2.2:5001`
- For iOS simulator: Use `http://localhost:5001`
- For physical device: Use computer's IP address

**GPS not working**
- Grant location permissions
- Enable high accuracy mode
- Check if inside geofence radius
- Verify operating hours

**Admin panel shows 401 error**
- Check if backend is running
- Verify API URL in `.env.local`
- Clear browser cache
- Re-login

**Company dropdown empty in mobile app**
- Verify backend is running
- Check `/api/v1/auth/companies` endpoint
- Ensure at least one active company exists
- Check network connectivity

---

## 📝 Next Steps

### Immediate
1. Configure email service (SendGrid/AWS SES)
2. Add CAPTCHA to registration form
3. Seed database with test data
4. Test complete flow end-to-end

### Short Term
1. Add company logo upload
2. Implement custom branding preview
3. Add bulk employee import (CSV)
4. Create detailed reports
5. Add export functionality (PDF, Excel)

### Long Term
1. Mobile app offline mode
2. Desktop monitoring apps
3. Biometric authentication
4. Advanced analytics dashboard
5. Integration with payroll systems
6. Multi-language support
7. White-label solution

---

*Last Updated: March 10, 2026*
*Version: 1.0.0*
