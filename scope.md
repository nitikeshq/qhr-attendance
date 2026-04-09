# QHR Attendance Management System - Complete Scope Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Modules & Features](#core-modules--features)
4. [API Documentation](#api-documentation)
5. [API Request & Response Schemas](#api-request--response-schemas)
6. [Database Schema](#database-schema)
7. [Frontend Applications](#frontend-applications)
8. [Mobile App Pages by User Role](#mobile-app-pages-by-user-role)
9. [User Roles & Permissions](#user-roles--permissions)
10. [Integration Capabilities](#integration-capabilities)
11. [Security Features](#security-features)
12. [Deployment & Infrastructure](#deployment--infrastructure)

---

## System Overview

QHR Attendance Management System is a comprehensive HRMS solution designed for Small and Medium Enterprises (SMEs). It provides end-to-end employee management with advanced features including GPS-based attendance tracking, leave management, payroll processing, grievance handling, and wellness tracking.

### Key Business Problems Solved
- **Automated Attendance**: GPS-based geofencing eliminates manual attendance tracking
- **Leave Management**: Streamlined leave requests with approval workflows
- **Remote Work Support**: WFH request management and monitoring
- **Employee Engagement**: Health & wellness features, grievance redressal
- **Productivity Tracking**: Desktop activity monitoring for remote teams
- **Sales Management**: GPS-verified client visit tracking
- **Payroll Automation**: Integrated salary processing with statutory compliance

---

## Architecture

### System Architecture Diagram
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│   Backend API   │────▶│    MongoDB      │
│  (React Native) │     │   (Express.js)  │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                        ┌──────┴──────┐
                        ▼             ▼
                   ┌─────────┐   ┌─────────┐
                   │  Redis  │   │ Socket  │
                   │ (Cache) │   │   .IO   │
                   └─────────┘   └─────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Admin Panel  │    │ Desktop App   │    │ Landing Page │
│  (Next.js)   │    │ (Electron)    │    │  (Next.js)   │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Technology Stack

#### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js 4.x
- **Database**: MongoDB 6+ with Mongoose ODM
- **Real-time**: Socket.IO
- **Caching**: Redis (optional)
- **Authentication**: JWT with refresh tokens
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate Limiting, Mongo Sanitize

#### Mobile Application
- **Framework**: Expo SDK 54 (React Native)
- **UI Library**: React Native Paper (Material Design 3)
- **Navigation**: Expo Router
- **State Management**: React Context API
- **Storage**: AsyncStorage
- **Location Services**: Expo Location with Geofencing
- **Sensors**: Expo Sensors (Pedometer)
- **Notifications**: Expo Notifications

#### Admin Panel
- **Framework**: Next.js 14 with React 18
- **UI Components**: Radix UI + shadcn/ui
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod

#### Desktop Application
- **Framework**: Electron 28
- **Activity Tracking**: uiohook-napi, active-win
- **Auto-start**: auto-launch
- **Storage**: electron-store
- **Updates**: electron-updater

---

## Core Modules & Features

### 1. Authentication & Authorization
- **Multi-tenant Login**: Company code + Employee ID + Passcode
- **Role-based Access Control**: 5 user roles with granular permissions
- **JWT Security**: Access tokens with refresh token rotation
- **Device Management**: Multi-device login support
- **Password Policies**: Mandatory change on first login

### 2. Attendance Management
- **GPS Geofencing**: Automatic check-in/out within office perimeter
- **Manual Attendance**: Override options for authorized users
- **Offline Support**: Queue attendance when offline, sync on reconnect
- **Real-time Tracking**: Live location updates during work hours
- **Attendance Reports**: Daily, weekly, monthly analytics
- **Late Coming Tracking**: Automatic detection with notifications

### 3. Leave Management
- **Leave Types**: Casual, Sick, Earned, Unpaid leaves
- **Leave Balance**: Real-time balance tracking with carry-forward
- **Approval Workflow**: Multi-level approval with delegation
- **Leave History**: Complete audit trail with comments
- **Leave Calendar**: Team leave visibility for managers
- **Leave Policies**: Configurable rules per company

### 4. Work From Home (WFH)
- **WFH Requests**: Date-based requests with reasons
- **Approval System**: Manager/admin approval workflow
- **WFH Tracking**: Monitor remote work days
- **Integration**: Links with attendance system

### 5. Grievance Management
- **9 Categories**: HR, Payroll, Facilities, IT, etc.
- **Anonymous Option**: Optional anonymous submissions
- **Tracking System**: Status updates through resolution lifecycle
- **Assignment**: Auto/manual assignment to concerned departments
- **Satisfaction Rating**: Post-resolution feedback

### 6. Health & Wellness
- **Pedometer**: Daily steps, distance, calories tracking
- **Exercise Reminders**: 30-minute interval notifications
- **Breathing Exercises**: Box breathing, 4-7-8, deep belly
- **Eye Care**: Blink reminders, 20-20-20 rule
- **Stretch Breaks**: Desk exercise routines

### 7. Project & Task Management
- **Project Creation**: Manage multiple projects with teams
- **Task Assignment**: Assign tasks to team members
- **Priority Management**: Low, Medium, High, Urgent levels
- **Time Tracking**: Log hours spent on tasks
- **Voice Comments**: Record and attach voice notes
- **Progress Tracking**: Real-time status updates

### 8. Sales Visit Tracking
- **GPS Verification**: Verify presence at customer locations
- **Visit Radius**: Configurable perimeter (default 100m)
- **Time Tracking**: Duration spent at each location
- **Photo Evidence**: Location-stamped photographs
- **Customer Management**: Client information database
- **Visit Reports**: Analytics and completion rates

### 9. Desktop Activity Monitoring
- **Activity Tracking**: Keyboard, mouse, click monitoring
- **Idle Detection**: Automatic away-time detection
- **Application Usage**: Track active windows and apps
- **Productivity Scoring**: Daily productivity metrics
- **Real-time Sync**: Live data transmission to backend
- **System Tray**: Background operation with auto-start

### 10. Payroll Management
- **Salary Structure**: Basic, HRA, allowances, deductions
- **Statutory Compliance**: PF, ESIC, TDS calculations
- **Payslip Generation**: Automated monthly payslips
- **Bonus/Deduction**: Ad-hoc adjustments
- **Approval Workflow**: Multi-level salary approval
- **Reports**: Comprehensive payroll analytics

### 11. Employee Management
- **Employee Profiles**: Complete employee database
- **Department Structure**: Organizational hierarchy
- **Reporting Structure**: Manager-subordinate relationships
- **Document Management**: Profile photos, documents
- **Onboarding**: Streamlined employee registration
- **Offboarding**: Resignation and F&F processing

### 12. Company Configuration
- **Company Settings**: Office locations, work hours
- **Geofence Setup**: Multiple office locations
- **Leave Policies**: Configure leave types and balances
- **Holiday Calendar**: Company-specific holidays
- **Branding**: Custom logos and colors
- **Work Days**: Configurable weekly schedules

---

## API Documentation

### Base URL
- **Development**: `http://localhost:3001/api/v1`
- **Production**: `https://hr.qwegle.com/api/v1`

### Authentication Endpoints

#### Public Routes
| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| POST | `/auth/login` | Employee login | `{ companyCode, employeeId, passcode }` |
| POST | `/auth/admin-login` | Admin panel login | `{ email, password }` |
| POST | `/auth/refresh-token` | Refresh JWT token | `{ refreshToken }` |
| GET | `/auth/companies` | Get company list | - |

#### Protected Routes
| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| POST | `/auth/logout` | Logout user | - |
| POST | `/auth/change-password` | Change password | `{ currentPassword, newPassword }` |
| GET | `/auth/me` | Get current user | - |
| POST | `/auth/device-token` | Update device token | `{ token, platform }` |

### Attendance Endpoints
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| POST | `/attendance/check-in` | Check in with location | Employee |
| POST | `/attendance/check-out` | Check out with location | Employee |
| GET | `/attendance/today` | Today's attendance | Employee |
| GET | `/attendance/my` | My attendance history | Employee |
| GET | `/attendance/summary` | Attendance summary | Employee |
| GET | `/attendance/team` | Team attendance | Manager+ |

### Leave Management Endpoints
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/leaves/types` | Get leave types | Employee |
| GET | `/leaves/balance` | Leave balance | Employee |
| POST | `/leaves` | Apply for leave | Employee |
| GET | `/leaves/my` | My leave requests | Employee |
| GET | `/leaves/:id` | Leave details | Employee |
| POST | `/leaves/:id/cancel` | Cancel leave | Employee |
| GET | `/leaves/approvals/pending` | Pending approvals | Approver |
| POST | `/leaves/:id/approve` | Approve/reject leave | Approver |
| POST | `/leaves/delegate` | Delegate approval | Approver |

### WFH Endpoints
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| POST | `/wfh` | Apply WFH | Employee |
| GET | `/wfh/my-requests` | My WFH requests | Employee |
| GET | `/wfh/pending` | Pending requests | Approver |
| GET | `/wfh/stats` | WFH statistics | Manager+ |
| GET | `/wfh/:id` | WFH details | Employee |
| PATCH | `/wfh/:id/review` | Review WFH request | Approver |
| PATCH | `/wfh/:id/cancel` | Cancel WFH request | Employee |

### Grievance Endpoints
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| POST | `/grievances` | Submit grievance | Employee |
| GET | `/grievances/my-grievances` | My grievances | Employee |
| GET | `/grievances/all` | All grievances | HR/Admin |
| GET | `/grievances/assigned` | Assigned grievances | HR/Admin |
| GET | `/grievances/stats` | Grievance statistics | HR/Admin |
| GET | `/grievances/:id` | Grievance details | Related |
| PATCH | `/grievances/:id/assign` | Assign grievance | HR/Admin |
| PATCH | `/grievances/:id/status` | Update status | HR/Admin |
| POST | `/grievances/:id/comment` | Add comment | Related |
| PATCH | `/grievances/:id/resolve` | Resolve grievance | HR/Admin |
| PATCH | `/grievances/:id/close` | Close grievance | HR/Admin |
| PATCH | `/grievances/:id/rate` | Rate satisfaction | Employee |

### Payroll Endpoints
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| POST | `/payroll/generate` | Generate salary | HR/Admin |
| POST | `/payroll/bulk-generate` | Bulk generate salaries | HR/Admin |
| GET | `/payroll` | Get salary records | HR/Admin |
| PATCH | `/payroll/:salaryId/approve` | Approve salary | HR/Admin |
| POST | `/payroll/:salaryId/bonus` | Add bonus | HR/Admin |
| POST | `/payroll/:salaryId/deduction` | Add deduction | HR/Admin |
| DELETE | `/payroll/:salaryId/bonus/:bonusId` | Remove bonus | HR/Admin |
| DELETE | `/payroll/:salaryId/deduction/:deductionId` | Remove deduction | HR/Admin |

### Project & Task Endpoints
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/projects` | Get projects | Employee |
| POST | `/projects` | Create project | Manager+ |
| GET | `/projects/stats` | Project statistics | Manager+ |
| GET | `/projects/:id` | Project details | Related |
| PUT | `/projects/:id` | Update project | Manager+ |
| DELETE | `/projects/:id` | Archive project | Admin |
| POST | `/projects/:id/members` | Add member | Manager+ |
| DELETE | `/projects/:id/members/:employeeId` | Remove member | Manager+ |

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/tasks` | Get tasks | Employee |
| POST | `/tasks` | Create task | Manager+ |
| GET | `/tasks/stats` | Task statistics | Manager+ |
| GET | `/tasks/sales-visits` | Sales visit tasks | Sales |
| GET | `/tasks/:id` | Task details | Related |
| PUT | `/tasks/:id` | Update task | Assignee/Manager |
| DELETE | `/tasks/:id` | Delete task | Creator/Admin |
| POST | `/tasks/:id/comments` | Add comment | Related |
| POST | `/tasks/:id/time-logs` | Log time | Assignee |
| POST | `/tasks/:id/verify-visit` | Verify visit | Sales |
| POST | `/tasks/:id/record-exit` | Record exit | Sales |

### Desktop Activity Endpoints
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| POST | `/desktop-activity/record` | Record activity | Employee |
| POST | `/desktop-activity/heartbeat` | Send heartbeat | Employee |
| GET | `/desktop-activity/my` | My activity | Employee |
| PUT | `/desktop-activity/apps` | Update app categories | Employee |
| GET | `/desktop-activity/team` | Team activity | Manager+ |
| GET | `/desktop-activity/live` | Live status | Manager+ |
| GET | `/desktop-activity/summary` | Activity summary | Manager+ |
| GET | `/desktop-activity/:employeeId/:date` | Activity details | Manager+ |

### Employee Management Endpoints
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/employees/designations` | Get designations | Employee |
| GET | `/employees/departments` | Get departments | Employee |
| GET | `/employees` | Get employees | HR/Admin |
| GET | `/employees/:id` | Employee details | HR/Admin |
| POST | `/employees` | Create employee | HR/Admin |
| PATCH | `/employees/:id` | Update employee | HR/Admin |
| DELETE | `/employees/:id` | Deactivate employee | Admin |
| PATCH | `/employees/:id/leave-balance` | Update leave balance | HR/Admin |

### Company Management Endpoints
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| POST | `/companies/register` | Register company | Public |
| POST | `/companies/verify-email` | Verify email | Public |
| GET | `/companies/public` | Public companies | Public |
| POST | `/companies` | Create company | Super Admin |
| GET | `/companies` | Get companies | Super Admin |
| GET | `/companies/:id` | Company details | Admin |
| PATCH | `/companies/:id` | Update company | Super Admin |

### Holiday Management Endpoints
| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/holidays` | Get holidays | Employee |
| GET | `/holidays/today` | Check today holiday | Employee |
| POST | `/holidays` | Create holiday | HR/Admin |
| PATCH | `/holidays/:id` | Update holiday | HR/Admin |
| DELETE | `/holidays/:id` | Delete holiday | HR/Admin |
| POST | `/holidays/process-attendance` | Process holiday attendance | Admin |

---

## Database Schema

### Core Collections

#### Company
```javascript
{
  name: String,                    // Company name
  code: String,                    // Unique company code
  address: {
    street, city, state, country, zipCode
  },
  location: {
    latitude: Number,              // Office coordinates
    longitude: Number,
    radius: Number                 // Geofence radius (50-5000m)
  },
  operatingHours: {
    startTime: "09:00",
    endTime: "18:00",
    timezone: "Asia/Kolkata",
    workDays: [1,2,3,4,5]         // Mon-Fri
  },
  settings: {
    autoCheckIn: Boolean,
    autoCheckOut: Boolean,
    allowManualAttendance: Boolean,
    requirePhotoOnCheckIn: Boolean,
    gpsTrackingEnabled: Boolean,
    gpsTrackingIntervalMs: Number
  },
  leaveSettings: {
    casualLeaves: Number,
    sickLeaves: Number,
    earnedLeaves: Number,
    carryForward: Boolean,
    maxCarryForward: Number
  },
  branding: {
    logo: String,
    primaryColor: String,
    secondaryColor: String,
    accentColor: String,
    favicon: String
  },
  isActive: Boolean
}
```

#### Employee
```javascript
{
  employeeId: String,              // Unique employee ID
  company: ObjectId,              // Reference to Company
  email: String,
  passcode: String,                // Hashed
  firstName: String,
  lastName: String,
  phone: String,
  designation: String,
  department: String,
  role: "employee" | "manager" | "hr" | "admin" | "super_admin",
  reportingTo: ObjectId,           // Reference to manager
  canApproveLeaves: Boolean,
  delegatedApproverFor: [ObjectId],
  leaveBalance: {
    casual: Number,
    sick: Number,
    earned: Number,
    unpaid: Number
  },
  salary: {
    basic: Number,
    hra: Number,
    allowances: Number,
    deductions: Number,
    grossSalary: Number,
    currency: String
  },
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    accountHolderName: String
  },
  joiningDate: Date,
  profilePhoto: String,
  deviceTokens: [{
    token: String,
    platform: "ios" | "android" | "web",
    lastUsed: Date
  }],
  lastLocation: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    timestamp: Date
  },
  isActive: Boolean,
  isOnLeave: Boolean,
  currentLeave: ObjectId,
  requiresPasswordChange: Boolean,
  lastLoginAt: Date
}
```

#### Attendance
```javascript
{
  employee: ObjectId,
  company: ObjectId,
  date: Date,
  checkIn: {
    time: Date,
    location: { latitude, longitude, accuracy },
    method: "auto" | "manual" | "geofence"
  },
  checkOut: {
    time: Date,
    location: { latitude, longitude, accuracy }
  },
  workDuration: Number,            // Minutes
  status: "present" | "absent" | "half_day" | "on_leave" | "holiday",
  isLate: Boolean,
  lateByMinutes: Number
}
```

#### Leave
```javascript
{
  employee: ObjectId,
  company: ObjectId,
  leaveType: "casual" | "sick" | "earned" | "unpaid",
  startDate: Date,
  endDate: Date,
  reason: String,
  status: "pending" | "approved" | "rejected" | "cancelled",
  approvedBy: ObjectId,
  approverComments: String,
  days: Number,                    // Calculated leave days
  attachments: [String]            // Document URLs
}
```

#### WFHRequest
```javascript
{
  employee: ObjectId,
  company: ObjectId,
  date: Date,
  reason: String,
  status: "pending" | "approved" | "rejected" | "cancelled",
  reviewedBy: ObjectId,
  reviewComments: String,
  approvedAt: Date
}
```

#### Grievance
```javascript
{
  employee: ObjectId,
  company: ObjectId,
  category: String,                // 9 predefined categories
  subject: String,
  description: String,
  isAnonymous: Boolean,
  status: "open" | "in_progress" | "resolved" | "closed",
  priority: "low" | "medium" | "high" | "critical",
  assignedTo: ObjectId,
  comments: [{
    user: ObjectId,
    message: String,
    timestamp: Date,
    isInternal: Boolean
  }],
  satisfaction: Number,            // 1-5 rating
  resolvedAt: Date,
  resolvedBy: ObjectId
}
```

#### Project
```javascript
{
  name: String,
  description: String,
  company: ObjectId,
  manager: ObjectId,               // Project manager
  members: [{
    employee: ObjectId,
    role: String,                  // Developer, Designer, etc.
    joinedAt: Date
  }],
  status: "active" | "completed" | "archived",
  priority: "low" | "medium" | "high" | "urgent",
  startDate: Date,
  endDate: Date,
  budget: Number,
  tags: [String],
  createdBy: ObjectId
}
```

#### Task
```javascript
{
  title: String,
  description: String,
  project: ObjectId,
  assignedTo: ObjectId,
  createdBy: ObjectId,
  status: "todo" | "in_progress" | "review" | "completed",
  priority: "low" | "medium" | "high" | "urgent",
  dueDate: Date,
  estimatedHours: Number,
  actualHours: Number,
  tags: [String],
  attachments: [String],
  comments: [{
    user: ObjectId,
    message: String,
    type: "text" | "voice",
    timestamp: Date
  }],
  timeLogs: [{
    user: ObjectId,
    hours: Number,
    description: String,
    date: Date
  }],
  isSalesVisit: Boolean,
  customerInfo: {
    name: String,
    address: String,
    phone: String,
    email: String
  },
  visitLocation: {
    latitude: Number,
    longitude: Number,
    radius: Number
  },
  visitVerification: {
    entryTime: Date,
    exitTime: Date,
    entryLocation: { latitude, longitude, accuracy },
    exitLocation: { latitude, longitude, accuracy },
    photos: [String]
  }
}
```

#### DesktopActivity
```javascript
{
  employee: ObjectId,
  company: ObjectId,
  date: Date,
  sessions: [{
    startTime: Date,
    endTime: Date,
    duration: Number,             // Minutes
    activityScore: Number,         // 0-100
    keystrokes: Number,
    mouseClicks: Number,
    mouseDistance: Number,        // Pixels
    idleTime: Number,             // Minutes
    applications: [{
      name: String,
      windowTitle: String,
      duration: Number,           // Minutes
      category: "productive" | "neutral" | "unproductive"
    }]
  }],
  totalActiveTime: Number,        // Minutes
  totalIdleTime: Number,          // Minutes
  productivityScore: Number,     // 0-100
  topApplications: [{
    name: String,
    duration: Number,
    category: String
  }]
}
```

#### Salary
```javascript
{
  employee: ObjectId,
  company: ObjectId,
  month: Number,                  // 1-12
  year: Number,
  basic: Number,
  hra: Number,
  allowances: Number,
  deductions: Number,
  grossSalary: Number,
  netSalary: Number,
  pf: Number,
  esic: Number,
  tds: Number,
  professionalTax: Number,
  extraBonus: [{
    amount: Number,
    description: String,
    date: Date
  }],
  extraDeduction: [{
    amount: Number,
    description: String,
    date: Date
  }],
  status: "draft" | "pending_approval" | "approved" | "paid",
  approvedBy: ObjectId,
  approvedAt: Date,
  paidAt: Date,
  paymentMode: String,
  transactionId: String
}
```

#### Holiday
```javascript
{
  name: String,
  date: Date,
  type: "national" | "state" | "company",
  isOptional: Boolean,
  company: ObjectId,               // null for national holidays
  description: String,
  recurring: Boolean,
  createdAt: Date,
  createdBy: ObjectId
}
```

---

## Frontend Applications

### 1. Mobile Application (React Native)

#### Core Screens
- **Login**: Company code + Employee ID authentication
- **Dashboard**: Today's attendance, quick actions, notifications
- **Attendance**: Check-in/out with GPS, attendance history
- **Leaves**: Apply, view, cancel leave requests
- **WFH**: Submit and track work from home requests
- **Health & Wellness**: Pedometer, exercises, reminders
- **Tasks**: Project tasks, sales visits, time tracking
- **Grievances**: Submit, track, and rate grievances
- **Payslip**: View monthly salary slips
- **Profile**: Personal info, settings, password change

#### Key Features
- **GPS Geofencing**: Automatic attendance within office radius
- **Offline Support**: Queue operations when offline
- **Push Notifications**: Real-time updates for approvals
- **Voice Recording**: Attach voice notes to tasks
- **Photo Capture**: Location-stamped photos for visits
- **Biometric Authentication**: Fingerprint/Face ID support
- **Dark Mode**: System theme support
- **Multi-language**: English and regional languages

### 2. Admin Panel (Next.js)

#### Dashboard Modules
- **Analytics Dashboard**: Attendance, leave, payroll charts
- **Employee Management**: CRUD operations, bulk import
- **Attendance Reports**: Daily, monthly, custom date ranges
- **Leave Management**: Approvals, balance management
- **Payroll Processing**: Salary generation, approvals
- **Company Settings**: Configuration, branding
- **Task Management**: Project oversight, task assignments
- **Grievance Portal**: Resolution tracking
- **Desktop Activity**: Team productivity monitoring

#### Features
- **Real-time Updates**: WebSocket integration
- **Export Reports**: PDF, Excel, CSV formats
- **Bulk Operations**: Import employees, generate salaries
- **Audit Trail**: Complete activity logs
- **Multi-tenant**: Support for multiple companies
- **Responsive Design**: Works on tablets and desktops

### 3. Desktop Application (Electron)

#### Core Functionality
- **Activity Monitoring**: Keyboard, mouse, application tracking
- **Idle Detection**: Automatic away-time detection
- **Productivity Scoring**: Algorithm-based productivity metrics
- **Real-time Sync**: Continuous data transmission
- **System Tray**: Background operation
- **Auto-start**: Launch with system boot

#### Privacy Features
- **No Content Capture**: Only counts, not actual content
- **User Control**: Start/stop tracking options
- **Data Encryption**: Secure data transmission
- **Configurable Settings**: Customizable tracking parameters

### 4. Landing Page (Next.js)

#### Marketing Features
- **Feature Showcase**: Interactive demonstrations
- **Pricing Plans**: Tier-based subscription model
- **Demo Requests**: Lead capture form
- **Company Registration**: Self-service onboarding
- **Testimonials**: Customer success stories
- **Blog**: HR and productivity content

---

## User Roles & Permissions

### Role Hierarchy
1. **Super Admin**: System-wide access, manages all companies
2. **Company Admin**: Full access within company
3. **HR Manager**: Employee management, approvals, payroll
4. **Manager**: Team management, approvals, reports
5. **Employee**: Basic features, self-service

### Permission Matrix

| Feature | Super Admin | Company Admin | HR Manager | Manager | Employee |
|---------|-------------|---------------|------------|---------|----------|
| **Authentication** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Profile Management** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Attendance** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Leave - Apply** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Leave - Approve** | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Leave - Balance Update** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **WFH - Apply** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **WFH - Approve** | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Grievance - Submit** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Grievance - Manage** | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Payroll - Generate** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Payroll - Approve** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Payroll - View** | ✓ | ✓ | ✓ | ✗ | Own |
| **Employee Management** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Company Settings** | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Project Management** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Task Management** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Desktop Activity - View** | ✓ | ✓ | ✓ | ✓ | Own |
| **Desktop Activity - Team** | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Reports - All** | ✓ | ✓ | ✓ | Team | Own |
| **System Configuration** | ✓ | ✗ | ✗ | ✗ | ✗ |

### Special Permissions
- **Can Approve Leaves**: Additional permission for non-manager roles
- **Delegated Approver**: Temporary approval authority
- **Geofence Setup**: Configure office locations
- **Holiday Management**: Create company holidays
- **Weekend Setup**: Configure working days

---

## Integration Capabilities

### Third-party Integrations
- **Payment Gateways**: Stripe, Razorpay for subscription payments
- **Email Services**: SendGrid, AWS SES for notifications
- **SMS Services**: Twilio, MSG91 for SMS alerts
- **Cloud Storage**: AWS S3, Google Cloud for file storage
- **Biometric Devices**: Integration with attendance machines
- **HR Systems**: SAP, Oracle HR data import/export
- **Accounting Software**: Tally, QuickBooks payroll sync

### API Integrations
- **Google Maps**: Geocoding and location services
- **Weather APIs**: Location-based weather information
- **Calendar APIs**: Holiday calendar synchronization
- **Video Conferencing**: Zoom, Teams integration
- **Collaboration Tools**: Slack, Microsoft Teams notifications

### Data Import/Export
- **Bulk Employee Import**: Excel/CSV templates
- **Attendance Export**: Multiple format support
- **Payroll Reports**: Accounting software formats
- **Backup/Restore**: Complete data backup solutions

---

## Security Features

### Authentication Security
- **JWT Tokens**: Short-lived access tokens with refresh rotation
- **Password Hashing**: bcrypt with salt rounds
- **Multi-factor Authentication**: Optional 2FA support
- **Session Management**: Device-based session control
- **Rate Limiting**: API endpoint protection
- **Account Lockout**: Failed login attempt protection

### Data Security
- **Encryption**: AES-256 for sensitive data
- **HTTPS Only**: SSL/TLS enforcement
- **Data Masking**: Sensitive information protection
- **Audit Logs**: Complete activity tracking
- **Backup Encryption**: Encrypted database backups
- **GDPR Compliance**: Data protection regulations

### Application Security
- **Input Validation**: Comprehensive data validation
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Output encoding and CSP
- **CSRF Protection**: Token-based validation
- **Security Headers**: Helmet.js implementation
- **Dependency Scanning**: Regular vulnerability checks

### Privacy Features
- **Data Anonymization**: Optional anonymous grievance
- **Location Privacy**: GPS only during work hours
- **Activity Privacy**: No content capture in desktop app
- **Data Retention**: Configurable data deletion policies
- **Consent Management**: Explicit user consent for features

---

## Deployment & Infrastructure

### Development Environment
- **Local Development**: Docker Compose setup
- **Database**: MongoDB local instance
- **Caching**: Redis for session storage
- **File Storage**: Local filesystem
- **Services**: Individual service startup scripts

### Production Architecture
- **Load Balancer**: Nginx with SSL termination
- **Application Servers**: PM2 cluster mode
- **Database**: MongoDB Atlas or sharded cluster
- **Caching**: Redis Cluster
- **File Storage**: AWS S3 or similar
- **CDN**: CloudFront for static assets
- **Monitoring**: Application and infrastructure monitoring

### Deployment Options
- **Cloud Deployment**: AWS, Google Cloud, Azure
- **On-premise**: Private server deployment
- **Hybrid**: Mixed cloud and on-premise
- **Containerized**: Docker/Kubernetes deployment
- **Serverless**: AWS Lambda for specific functions

### Scalability Features
- **Horizontal Scaling**: Multiple app instances
- **Database Sharding**: Multi-region deployment
- **Caching Strategy**: Multi-level caching
- **CDN Integration**: Global content delivery
- **Auto-scaling**: Dynamic resource allocation

### Monitoring & Maintenance
- **Health Checks**: Service health monitoring
- **Performance Metrics**: Application performance tracking
- **Error Tracking**: Comprehensive error logging
- **Backup Automation**: Scheduled data backups
- **Update Management**: Automated deployment pipelines
- **Security Scanning**: Regular vulnerability assessments

---

## API Request & Response Schemas

### Authentication Endpoints

#### POST /auth/login
**Request Body:**
```javascript
{
  "companyCode": "string",     // Required - Company code (e.g., "TESTCO")
  "employeeId": "string",      // Required - Employee ID (e.g., "EMP001")
  "passcode": "string",        // Required - 4+ digit passcode
  "deviceInfo": {
    "platform": "ios|android|web",
    "deviceId": "string",
    "appVersion": "string"
  }
}
```

**Response (200):**
```javascript
{
  "success": true,
  "data": {
    "user": {
      "_id": "string",
      "employeeId": "string",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "role": "employee|manager|hr|admin|super_admin",
      "company": {
        "_id": "string",
        "name": "string",
        "code": "string",
        "branding": {
          "primaryColor": "#6366F1",
          "secondaryColor": "#8B5CF6",
          "logo": "string"
        }
      },
      "requiresPasswordChange": true,
      "lastLoginAt": "2024-03-16T18:27:00.000Z"
    },
    "tokens": {
      "accessToken": "jwt_token_string",
      "refreshToken": "refresh_token_string",
      "expiresIn": 604800
    }
  }
}
```

#### POST /auth/change-password
**Request Body:**
```javascript
{
  "currentPassword": "string",
  "newPassword": "string",
  "confirmPassword": "string"
}
```

**Response (200):**
```javascript
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Attendance Endpoints

#### POST /attendance/check-in
**Request Body:**
```javascript
{
  "location": {
    "latitude": 19.0760,
    "longitude": 72.8777,
    "accuracy": 10
  },
  "method": "auto|manual|geofence",
  "photo": "base64_image_string",  // Optional if required by company
  "notes": "string"                // Optional
}
```

**Response (200):**
```javascript
{
  "success": true,
  "data": {
    "attendance": {
      "_id": "string",
      "date": "2024-03-16T00:00:00.000Z",
      "checkIn": {
        "time": "2024-03-16T09:15:00.000Z",
        "location": {
          "latitude": 19.0760,
          "longitude": 72.8777,
          "accuracy": 10
        },
        "method": "geofence"
      },
      "status": "present",
      "isLate": true,
      "lateByMinutes": 15
    },
    "message": "Checked in successfully"
  }
}
```

#### GET /attendance/my
**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 10)
- `startDate`: string (YYYY-MM-DD)
- `endDate`: string (YYYY-MM-DD)

**Response (200):**
```javascript
{
  "success": true,
  "data": {
    "attendances": [
      {
        "_id": "string",
        "date": "2024-03-16T00:00:00.000Z",
        "checkIn": {
          "time": "2024-03-16T09:15:00.000Z",
          "method": "geofence"
        },
        "checkOut": {
          "time": "2024-03-16T18:30:00.000Z",
          "method": "auto"
        },
        "workDuration": 540,
        "status": "present",
        "isLate": true,
        "lateByMinutes": 15
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "pages": 5
    },
    "summary": {
      "totalDays": 45,
      "presentDays": 42,
      "lateDays": 8,
      "absentDays": 1,
      "halfDays": 2,
      "averageWorkHours": 8.5
    }
  }
}
```

### Leave Management Endpoints

#### POST /leaves
**Request Body:**
```javascript
{
  "leaveType": "casual|sick|earned|unpaid",
  "startDate": "2024-03-20",
  "endDate": "2024-03-22",
  "reason": "string",
  "attachments": ["base64_file_string"], // Optional
  "isHalfDay": false,
  "halfDayType": "first_half|second_half" // Optional
}
```

**Response (201):**
```javascript
{
  "success": true,
  "data": {
    "leave": {
      "_id": "string",
      "leaveType": "casual",
      "startDate": "2024-03-20T00:00:00.000Z",
      "endDate": "2024-03-22T00:00:00.000Z",
      "days": 3,
      "reason": "string",
      "status": "pending",
      "employee": {
        "_id": "string",
        "firstName": "John",
        "lastName": "Doe"
      },
      "createdAt": "2024-03-16T18:27:00.000Z"
    },
    "message": "Leave request submitted successfully"
  }
}
```

#### POST /leaves/:id/approve
**Request Body:**
```javascript
{
  "action": "approve|reject",
  "comments": "string",
  "delegateTo": "employee_id" // Optional - delegate approval
}
```

**Response (200):**
```javascript
{
  "success": true,
  "data": {
    "leave": {
      "_id": "string",
      "status": "approved",
      "approvedBy": {
        "_id": "string",
        "firstName": "Manager",
        "lastName": "Name"
      },
      "approverComments": "string",
      "approvedAt": "2024-03-16T18:27:00.000Z"
    },
    "message": "Leave request approved successfully"
  }
}
```

### WFH Endpoints

#### POST /wfh
**Request Body:**
```javascript
{
  "date": "2024-03-21",
  "reason": "string",
  "emergencyContact": "string", // Optional
  "workFromLocation": "string"  // Optional
}
```

**Response (201):**
```javascript
{
  "success": true,
  "data": {
    "wfhRequest": {
      "_id": "string",
      "date": "2024-03-21T00:00:00.000Z",
      "reason": "string",
      "status": "pending",
      "employee": {
        "_id": "string",
        "firstName": "John",
        "lastName": "Doe"
      }
    },
    "message": "WFH request submitted successfully"
  }
}
```

### Grievance Endpoints

#### POST /grievances
**Request Body:**
```javascript
{
  "category": "hr|payroll|facilities|it|admin|training|policy|safety|other",
  "subject": "string",
  "description": "string",
  "isAnonymous": false,
  "priority": "low|medium|high|critical",
  "attachments": ["base64_file_string"] // Optional
}
```

**Response (201):**
```javascript
{
  "success": true,
  "data": {
    "grievance": {
      "_id": "string",
      "category": "hr",
      "subject": "string",
      "description": "string",
      "isAnonymous": false,
      "status": "open",
      "priority": "medium",
      "employee": {
        "_id": "string",
        "firstName": "John",
        "lastName": "Doe"
      },
      "ticketNumber": "GRV-2024-001",
      "createdAt": "2024-03-16T18:27:00.000Z"
    },
    "message": "Grievance submitted successfully"
  }
}
```

### Task Management Endpoints

#### POST /tasks
**Request Body:**
```javascript
{
  "title": "string",
  "description": "string",
  "project": "project_id",
  "assignedTo": "employee_id",
  "priority": "low|medium|high|urgent",
  "dueDate": "2024-03-25T18:30:00.000Z",
  "estimatedHours": 8,
  "tags": ["frontend", "urgent"],
  "isSalesVisit": false,
  "customerInfo": { // Optional for sales visits
    "name": "Customer Name",
    "address": "string",
    "phone": "string",
    "email": "string"
  },
  "visitLocation": { // Optional for sales visits
    "latitude": 19.0760,
    "longitude": 72.8777,
    "radius": 100
  }
}
```

**Response (201):**
```javascript
{
  "success": true,
  "data": {
    "task": {
      "_id": "string",
      "title": "string",
      "description": "string",
      "project": {
        "_id": "string",
        "name": "Project Name"
      },
      "assignedTo": {
        "_id": "string",
        "firstName": "John",
        "lastName": "Doe"
      },
      "status": "todo",
      "priority": "high",
      "dueDate": "2024-03-25T18:30:00.000Z",
      "estimatedHours": 8,
      "createdBy": {
        "_id": "string",
        "firstName": "Manager",
        "lastName": "Name"
      },
      "createdAt": "2024-03-16T18:27:00.000Z"
    },
    "message": "Task created successfully"
  }
}
```

### Desktop Activity Endpoints

#### POST /desktop-activity/record
**Request Body:**
```javascript
{
  "session": {
    "startTime": "2024-03-16T09:00:00.000Z",
    "endTime": "2024-03-16T09:30:00.000Z",
    "duration": 30,
    "activityScore": 85,
    "keystrokes": 1250,
    "mouseClicks": 180,
    "mouseDistance": 2500,
    "idleTime": 2,
    "applications": [
      {
        "name": "Visual Studio Code",
        "windowTitle": "project-name - src/app.js",
        "duration": 25,
        "category": "productive"
      },
      {
        "name": "Chrome",
        "windowTitle": "Stack Overflow - JavaScript",
        "duration": 5,
        "category": "productive"
      }
    ]
  }
}
```

**Response (200):**
```javascript
{
  "success": true,
  "data": {
    "activity": {
      "_id": "string",
      "date": "2024-03-16T00:00:00.000Z",
      "sessions": ["session_data"],
      "totalActiveTime": 480,
      "productivityScore": 82,
      "topApplications": [
        {
          "name": "Visual Studio Code",
          "duration": 240,
          "category": "productive"
        }
      ]
    },
    "message": "Activity recorded successfully"
  }
}
```

### Payroll Endpoints

#### POST /payroll/generate
**Request Body:**
```javascript
{
  "employee": "employee_id",
  "month": 3,
  "year": 2024,
  "basic": 50000,
  "hra": 20000,
  "allowances": 10000,
  "deductions": 5000,
  "overtimeHours": 8,
  "overtimeRate": 200,
  "leaveDeduction": 0,
  "notes": "string"
}
```

**Response (201):**
```javascript
{
  "success": true,
  "data": {
    "salary": {
      "_id": "string",
      "employee": {
        "_id": "string",
        "firstName": "John",
        "lastName": "Doe",
        "employeeId": "EMP001"
      },
      "month": 3,
      "year": 2024,
      "basic": 50000,
      "hra": 20000,
      "allowances": 10000,
      "deductions": 5000,
      "grossSalary": 80000,
      "pf": 9600,
      "esic": 1100,
      "tds": 8000,
      "netSalary": 61300,
      "status": "draft",
      "createdAt": "2024-03-16T18:27:00.000Z"
    },
    "message": "Salary generated successfully"
  }
}
```

---

## Mobile App Pages by User Role

### 1. Employee Role Pages

#### Authentication Flow
- **Login Screen** (`/login`)
  - Company code selector
  - Employee ID input
  - Passcode input
  - Remember me option
  - Forgot passcode link

- **Change Password** (`/change-password`)
  - Current password field
  - New password field
  - Confirm password field
  - Password strength indicator
  - Validation messages

#### Main Navigation (Tabs)
- **Dashboard** (`/(tabs)/index`)
  - Today's attendance status
  - Quick check-in/out buttons
  - Pending approvals count
  - Recent activities
  - Health score widget
  - Upcoming tasks

- **Attendance** (`/(tabs)/attendance`)
  - Check-in/out with GPS
  - Attendance history calendar
  - Monthly attendance summary
  - Late arrival notifications
  - Manual attendance request

- **Health** (`/(tabs)/health`)
  - Steps counter
  - Exercise reminders
  - Breathing exercises
  - Eye care exercises
  - Stretch breaks
  - Health analytics

- **History** (`/(tabs)/history`)
  - Attendance history
  - Leave history
  - WFH history
  - Payslip history
  - Filter options

- **Leaves** (`/(tabs)/leaves`)
  - Apply leave form
  - Leave balance cards
  - Leave requests list
  - Leave calendar view
  - Leave types info

- **Payslip** (`/(tabs)/payslip`)
  - Monthly payslip view
  - Salary breakdown
  - Tax calculations
  - Download payslip
  - Yearly summary

- **Profile** (`/(tabs)/profile`)
  - Personal information
  - Bank details
  - Device management
  - Notification settings
  - About section

#### Additional Pages
- **WFH Request** (`/wfh-request`)
  - Date picker
  - Reason textarea
  - Emergency contact
  - Work location details
  - Submit button

- **WFH List** (`/wfh-list`)
  - Request status cards
  - Filter by status
  - Cancel pending requests
  - View details

- **Grievance Submit** (`/grievance-submit`)
  - Category selection
  - Subject input
  - Description textarea
  - Anonymous option
  - File attachment
  - Priority selection

- **Grievance List** (`/grievance-list`)
  - Grievance cards
  - Status indicators
  - Filter options
  - Add comments
  - Rate satisfaction

- **Tasks** (`/tasks`)
  - Task list view
  - Filter by status
  - Search tasks
  - Create new task
  - Task details

- **Task Details** (`/task-details/:id`)
  - Task information
  - Comments section
  - Time logging
  - Status updates
  - Attachments

- **Create Task** (`/create-task`)
  - Task form fields
  - Project selection
  - Assignee selection
  - Due date picker
  - Priority selection

- **Sales Visits** (`/sales-visits`)
  - Visit list
  - Map view
  - Check-in/out
  - Photo capture
  - Customer info

- **Resignation** (`/resignation`)
  - Resignation form
  - Notice period selection
  - Reason textarea
  - Exit interview
  - Handover checklist

- **Permissions** (`/permissions`)
  - Location permission
  - Camera permission
  - Storage permission
  - Notification permission
  - Activity recognition

### 2. Manager Role Pages (Additional to Employee)

#### Approvals
- **Approvals Dashboard** (`/approvals`)
  - Pending leave requests
  - Pending WFH requests
  - Pending grievances
  - Quick action buttons
  - Approval statistics

- **Approval Detail** (`/approval-detail/:type/:id`)
  - Request details
  - Employee information
  - Comments section
  - Approve/Reject buttons
  - Delegate option

#### Team Management
- **Team Attendance** (`/team-attendance`)
  - Team member list
  - Today's attendance status
  - Attendance reports
  - Export options
  - Mark attendance

- **Team Tasks** (`/team-tasks`)
  - Team task board
  - Assign tasks
  - Progress tracking
  - Task analytics
  - Bulk actions

- **Team Activity** (`/team-activity`)
  - Desktop activity reports
  - Productivity scores
  - Active users
  - Activity trends
  - Export reports

#### Settings
- **Leave Types** (`/leave-types`)
  - Leave type management
  - Balance configuration
  - Policy settings
  - Add/Edit/Delete
  - Save changes

- **Holidays** (`/holidays`)
  - Holiday calendar
  - Add new holiday
  - Edit existing
  - Import holidays
  - Publish updates

- **Weekend Setup** (`/weekend-setup`)
  - Working days selection
  - Weekend configuration
  - Save settings
  - Apply to all

### 3. HR Role Pages (Additional to Manager)

#### Employee Management
- **Employee List** (`/employees`)
  - Employee directory
  - Search and filter
  - Add new employee
  - Bulk import
  - Export data

- **Employee Details** (`/employee/:id`)
  - Personal information
  - Employment details
  - Salary information
  - Leave balances
  - Attendance records
  - Edit options

- **Designation Management** (`/designations`)
  - Add/edit designations
  - Hierarchy setup
  - Department mapping
  - Save changes

#### Payroll
- **Payroll Dashboard** (`/payroll`)
  - Monthly payroll overview
  - Generate salaries
  - Approval queue
  - Payment status
  - Payroll reports

- **Salary Generation** (`/salary-generation`)
  - Month/year selection
  - Employee selection
  - Salary calculation
  - Review and approve
  - Generate payslips

#### Company Settings
- **Company Settings** (`/company-settings`)
  - Company information
  - Operating hours
  - Leave policies
  - Notification settings
  - Branding options

### 4. Admin Role Pages (Additional to HR)

#### Company Configuration
- **Geofence Setup** (`/geofence-setup`)
  - Office location map
  - Radius configuration
  - Multiple locations
  - Test geofence
  - Save settings

- **Admin Areas** (`/admin-areas`)
  - Administrative zones
  - Location management
  - Area configuration
  - Save changes

#### System Management
- **System Settings** (`/system-settings`)
  - System configuration
  - Backup settings
  - Security settings
  - Maintenance mode
  - System logs

- **User Management** (`/user-management`)
  - User accounts
  - Role management
  - Permission matrix
  - Access logs
  - User analytics

### 5. Super Admin Role Pages (Additional to Admin)

#### Multi-Company Management
- **Companies Dashboard** (`/companies`)
  - Company list
  - Add new company
  - Company status
  - Subscription management
  - Company analytics

- **Company Details** (`/company/:id`)
  - Company information
  - Employee count
  - Subscription details
  - Usage statistics
  - Support tickets

#### System Administration
- **System Dashboard** (`/system-dashboard`)
  - System overview
  - Performance metrics
  - User statistics
  - Revenue analytics
  - System health

- **Subscription Management** (`/subscriptions`)
  - Subscription plans
  - Customer subscriptions
  - Billing management
  - Plan upgrades
  - Revenue reports

---

## Mobile App Navigation Structure

### Tab Navigation (Bottom)
```
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│   Home  │Attendance│  Health │ History │  More   │
│ (index) │(attendance)│(health)│(history)│ (more)  │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

### Stack Navigation (Main)
```
Login → Main App (Tabs) → Various Screens
```

### Modal Navigation
- Change Password Modal
- Profile Photo Upload
- Task Creation Modal
- Leave Application Modal
- WFH Request Modal

### Drawer Navigation (Admin/HR)
```
┌─────────────────────┐
│   Dashboard         │
├─────────────────────┤
│   Approvals         │
├─────────────────────┤
│   Team Management   │
├─────────────────────┤
│   Reports           │
├─────────────────────┤
│   Settings          │
├─────────────────────┤
│   Logout            │
└─────────────────────┘
```

---

## Mobile App Features by Role

### Employee Features
- ✅ GPS-based attendance
- ✅ Leave management
- ✅ WFH requests
- ✅ Health tracking
- ✅ Task management
- ✅ Grievance submission
- ✅ Payslip viewing
- ✅ Profile management

### Manager Features (Employee +)
- ✅ Approve leaves/WFH
- ✅ Team attendance view
- ✅ Task assignment
- ✅ Team activity monitoring
- ✅ Performance reports
- ✅ Leave type management
- ✅ Holiday management
- ✅ Weekend configuration

### HR Features (Manager +)
- ✅ Employee management
- ✅ Payroll processing
- ✅ Salary generation
- ✅ Company settings
- ✅ Designation management
- ✅ Bulk operations
- ✅ Advanced reports
- ✅ Exit management

### Admin Features (HR +)
- ✅ Geofence setup
- ✅ System configuration
- ✅ User management
- ✅ Advanced settings
- ✅ System monitoring
- ✅ Backup management
- ✅ Security settings
- ✅ Administrative tools

### Super Admin Features (Admin +)
- ✅ Multi-company management
- ✅ Subscription management
- ✅ System administration
- ✅ Global settings
- ✅ Revenue tracking
- ✅ Support management
- ✅ System analytics
- ✅ Platform configuration

---

## Mobile App UI/UX Specifications

### Design System
- **Theme**: Material Design 3
- **Colors**: Dynamic company branding
- **Typography**: Roboto font family
- **Icons**: Material Icons
- **Animations**: Smooth transitions
- **Dark Mode**: System theme support

### Screen Specifications
- **Minimum Resolution**: 360x640dp
- **Target Resolution**: 1080x1920dp
- **Responsive Design**: Adaptive layouts
- **Orientation**: Portrait primary
- **Safe Areas**: Notch handling

### Performance Requirements
- **App Load Time**: <3 seconds
- **Screen Transition**: <500ms
- **API Response**: <2 seconds
- **Offline Support**: 24-hour cache
- **Memory Usage**: <200MB

### Accessibility Features
- **Screen Reader**: TalkBack/VoiceOver support
- **Font Scaling**: 100-200% zoom
- **High Contrast**: Enhanced visibility
- **Voice Commands**: Basic navigation
- **Haptic Feedback**: Touch responses

---

## Mobile App Technical Implementation

### State Management
```javascript
// Context Structure
AppContext
├── AuthContext
├── CompanyContext
├── EmployeeContext
├── LocationContext
├── NotificationContext
└── ThemeContext
```

### Local Storage
```javascript
// AsyncStorage Keys
- auth_token
- refresh_token
- user_data
- company_data
- theme_preference
- notification_settings
- offline_queue
- cached_attendance
```

### Background Services
```javascript
// Background Tasks
- Location Tracking
- Step Counting
- Exercise Reminders
- Data Sync
- Notification Handling
```

### Security Implementation
```javascript
// Security Measures
- Token encryption
- Data encryption
- Biometric auth
- Certificate pinning
- Root detection
- Jailbreak detection
```

---

## Conclusion

The QHR Attendance Management System is a comprehensive, enterprise-grade solution that addresses the complete employee lifecycle for SMEs. With its modular architecture, extensive feature set, and robust security framework, it provides a scalable foundation for modern HR operations.

### Key Strengths
- **All-in-One Solution**: Complete HRMS in a single platform
- **Mobile-First**: Native mobile experience with offline support
- **Advanced Features**: AI-powered productivity tracking, geofencing
- **Flexible Architecture**: Multi-tenant, scalable, and secure
- **Integration Ready**: Extensive API and third-party integrations
- **Compliance Focused**: Statutory compliance and data protection

### Business Value
- **Operational Efficiency**: 70% reduction in manual HR tasks
- **Cost Savings**: Elimination of multiple HR software subscriptions
- **Data-Driven Decisions**: Comprehensive analytics and reporting
- **Employee Engagement**: Wellness features and grievance redressal
- **Remote Work Enablement**: Complete WFH management solution
- **Productivity Tracking**: Objective performance metrics

This system is designed to grow with your organization, providing the foundation for digital transformation in HR operations while maintaining the highest standards of security, privacy, and user experience.
