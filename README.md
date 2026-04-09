# QHR Attendance Management System

A comprehensive employee attendance tracking system with GPS-based geofencing, leave management, WFH requests, grievance handling, and health & wellness features for SMEs.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Database Schema](#database-schema)
6. [Backend Setup](#backend-setup)
7. [Mobile App Setup](#mobile-app-setup)
8. [Admin Portal Setup](#admin-portal-setup)
9. [Building APK](#building-apk)
10. [Production Deployment](#production-deployment)
11. [API Documentation](#api-documentation)
12. [Test Credentials](#test-credentials)
13. [Configuration](#configuration)
14. [Troubleshooting](#troubleshooting)

---

## Overview

QHR Attendance is a complete HRMS solution designed for Small and Medium Enterprises (SMEs) to manage:
- Employee attendance with GPS-based automatic check-in/check-out
- Leave management with approval workflows
- Work From Home (WFH) requests
- Employee grievance handling
- Health & wellness tracking (steps, exercises, reminders)
- Payroll integration

### Architecture

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
```

---

## Features

### Mobile App Features

#### Authentication
- Company code + Employee ID + Passcode login
- Mandatory password change on first login
- Persistent sessions with JWT refresh tokens

#### Attendance Tracking
- **Automatic geofencing** - Check-in when entering office premises (400-500m radius)
- **Automatic check-out** - Record when leaving the premises
- **Offline support** - Queue attendance when offline, sync when back online
- **GPS scheduling** - Active only during work hours to save battery

#### Leave Management
- Apply for different leave types (Casual, Sick, Earned, Unpaid)
- View leave balance and history
- Cancel pending requests

#### Work From Home (WFH)
- Submit WFH requests with reason
- View request status and history
- Cancel pending requests

#### Grievance System
- Submit grievances in 9 categories
- Anonymous submission option
- Track resolution status
- Rate satisfaction

#### Health & Wellness
- **Pedometer** - Track daily steps, distance, and calories
- **Exercise reminders** - Notifications every 30 minutes
- **Breathing exercises** - Box breathing, 4-7-8, deep belly breathing
- **Eye care** - Blink reminders and 20-20-20 rule
- **Stretch breaks** - Various desk exercises

### CRM / Sales Features (NEW)

#### Task & Project Management
- Create and manage projects
- Assign tasks to team members
- Track task progress with status updates
- Set priorities (Low, Medium, High, Urgent)
- Due date tracking with overdue alerts
- Time logging for tasks
- **Voice comments** - Record and attach voice notes to tasks
- Text comments with mentions

#### Sales Visit Tracking
- **GPS-verified site visits** - Verify presence at customer location
- Configurable visit radius (default 100m)
- Track time spent at each location
- Customer information management
- Visit history with entry/exit timestamps
- Photo attachments with location data

### Desktop App Features (NEW)

#### Activity Tracking (Windows & macOS)
- **Keyboard & mouse monitoring** - Track activity levels
- **Idle detection** - Detect when user is away
- **Active window tracking** - Record application usage
- **Productivity scoring** - Daily productivity metrics
- **Real-time sync** - Data sent to backend in real-time
- **System tray** - Runs minimized, auto-starts with system

### HR/Admin Features (Mobile)
- Pending approvals dashboard
- Approve/reject leaves, WFH, grievances
- Holiday calendar management
- Leave types configuration
- Weekend/working days setup
- Geofence/perimeter setup (Admin only)
- **Team activity monitoring** - View desktop activity reports
- **Sales team tracking** - Monitor visit completion rates

### Admin Portal (Web)
- Dashboard with analytics
- Employee management
- Attendance reports
- Payroll management
- Company settings
- **Desktop activity reports** - View team productivity

---

## Tech Stack

### Backend
| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Framework | Express.js 4.x |
| Database | MongoDB 6+ with Mongoose |
| Real-time | Socket.IO |
| Caching | Redis (optional) |
| Authentication | JWT (jsonwebtoken) |
| Validation | express-validator |
| Process Manager | PM2 |

### Mobile App
| Component | Technology |
|-----------|------------|
| Framework | Expo SDK 54 (React Native) |
| UI Library | React Native Paper (Material Design 3) |
| Navigation | Expo Router |
| State Management | React Context API |
| Storage | AsyncStorage |
| Location | Expo Location with geofencing |
| Sensors | Expo Sensors (Pedometer) |
| Notifications | Expo Notifications |

### Admin Portal
| Component | Technology |
|-----------|------------|
| Framework | React 18 with Vite |
| UI Components | Radix UI + shadcn/ui |
| Styling | TailwindCSS |
| State Management | Zustand |
| Data Fetching | TanStack Query |
| Charts | Recharts |

---

## Project Structure

```
attendance/
├── README.md                    # This file
├── attendance-mobile/           # Main application folder
│   ├── Backend/                 # Node.js Express API
│   │   ├── src/
│   │   │   ├── config/          # Database, Redis, Socket config
│   │   │   ├── controllers/     # Route handlers
│   │   │   ├── middleware/      # Auth, error handling
│   │   │   ├── models/          # Mongoose schemas
│   │   │   ├── routes/          # API routes
│   │   │   ├── utils/           # Logger, helpers
│   │   │   ├── jobs/            # Cron jobs
│   │   │   ├── app.js           # Express app setup
│   │   │   └── server.js        # Server entry point
│   │   ├── .env                 # Environment variables
│   │   └── package.json
│   │
│   ├── app/                     # Expo Router screens
│   │   ├── (tabs)/              # Tab navigation screens
│   │   │   ├── index.tsx        # Home/Dashboard
│   │   │   ├── health.tsx       # Health & Wellness
│   │   │   ├── history.tsx      # Attendance History
│   │   │   ├── more.tsx         # More options menu
│   │   │   └── profile.tsx      # Profile & Settings
│   │   ├── login.tsx            # Login screen
│   │   ├── approvals.tsx        # Pending approvals
│   │   ├── wfh-*.tsx            # WFH screens
│   │   ├── grievance-*.tsx      # Grievance screens
│   │   ├── holidays.tsx         # Holiday management
│   │   └── ...
│   │
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── constants/           # API config, theme, exercises
│   │   ├── context/             # React Context providers
│   │   ├── services/            # API client, storage, location
│   │   └── types/               # TypeScript types
│   │
│   ├── be-portal/               # Admin web portal (React)
│   │   ├── src/
│   │   │   ├── pages/           # Page components
│   │   │   ├── components/      # UI components
│   │   │   ├── services/        # API services
│   │   │   └── stores/          # Zustand stores
│   │   └── package.json
│   │
│   ├── app.json                 # Expo configuration
│   ├── eas.json                 # EAS Build configuration
│   └── package.json
```

---

## Database Schema

### Collections

#### Company
```javascript
{
  name: String,              // Company name
  code: String,              // Unique company code (e.g., "TESTCO")
  address: {
    street, city, state, country, zipCode
  },
  location: {
    latitude: Number,        // Office coordinates
    longitude: Number,
    radius: Number           // Geofence radius (default: 450m)
  },
  operatingHours: {
    startTime: "09:00",
    endTime: "18:00",
    timezone: "Asia/Kolkata",
    workDays: [1,2,3,4,5]    // Mon-Fri
  },
  settings: {
    autoCheckIn: Boolean,
    autoCheckOut: Boolean,
    gpsTrackingEnabled: Boolean
  },
  leaveSettings: {
    casualLeaves: 12,
    sickLeaves: 12,
    earnedLeaves: 15
  },
  branding: {
    logo, primaryColor, secondaryColor
  }
}
```

#### Employee
```javascript
{
  employeeId: String,        // e.g., "EMP001"
  company: ObjectId,         // Reference to Company
  email: String,
  firstName: String,
  lastName: String,
  phone: String,
  designation: String,
  department: String,
  role: "employee" | "manager" | "hr" | "admin" | "super_admin",
  reportingTo: ObjectId,     // Reference to manager
  passcode: String,          // Hashed
  leaveBalance: {
    casual, sick, earned, unpaid
  },
  salary: {
    basic, hra, allowances, deductions, grossSalary
  },
  isActive: Boolean,
  lastLocation: {
    latitude, longitude, timestamp
  }
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
  workDuration: Number,      // Minutes
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
  approverComments: String
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
  reviewComments: String
}
```

#### Grievance
```javascript
{
  employee: ObjectId,
  company: ObjectId,
  category: String,          // 9 categories available
  subject: String,
  description: String,
  isAnonymous: Boolean,
  status: "open" | "in_progress" | "resolved" | "closed",
  priority: "low" | "medium" | "high" | "critical",
  assignedTo: ObjectId,
  comments: [{
    user: ObjectId,
    message: String,
    timestamp: Date
  }],
  satisfaction: Number       // 1-5 rating
}
```

---

## Backend Setup

### Prerequisites
- Node.js 20+ (use nvm: `nvm install 20 && nvm use 20`)
- MongoDB 6+ (local or MongoDB Atlas)
- Redis (optional, for caching)

### Installation

```bash
# Navigate to backend directory
cd attendance-mobile/Backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your settings (see Configuration section)

# Start development server
npm run dev
```

### Environment Variables

Create `.env` file in `Backend/` folder:

```env
# Server Configuration
NODE_ENV=development
PORT=3001

# MongoDB (Local)
MONGODB_URI=mongodb://localhost:27017/attendance_db

# MongoDB (Atlas - Production)
# MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_REFRESH_EXPIRES_IN=30d

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:8081
```

### Seed Test Data

```bash
# Create test company and users
npm run seed

# Or run manually
node src/scripts/seed.js
```

### Available Scripts

```bash
npm start      # Start production server
npm run dev    # Start development server with nodemon
npm run seed   # Seed database with sample data
npm test       # Run tests
npm run lint   # Run ESLint
```

---

## Mobile App Setup

### Prerequisites
- Node.js 20+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android emulator) or Xcode (for iOS simulator)

### Installation

```bash
# Navigate to mobile app directory
cd attendance-mobile

# Install dependencies
npm install

# Configure API URL (if using custom backend)
# Edit src/constants/api.ts

# Start Expo development server
npm start
```

### Running on Emulator

#### Android
```bash
# Start Android emulator first via Android Studio
# Then run:
npm run android
# Or press 'a' in Expo CLI
```

#### iOS (Mac only)
```bash
npm run ios
# Or press 'i' in Expo CLI
```

### API Configuration

Edit `src/constants/api.ts`:

```typescript
// For local development
const PRODUCTION_API_URL = 'https://hr.qwegle.com/api/v1';

const getDevApiUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api/v1';  // Android emulator
  }
  return 'http://localhost:3001/api/v1';    // iOS simulator
};
```

### Required Permissions

#### Android
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`
- `ACTIVITY_RECOGNITION`

#### iOS
- Location (Always and When in Use)
- Motion & Fitness
- Notifications

---

## Admin Portal Setup

```bash
# Navigate to admin portal
cd attendance-mobile/be-portal

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## Building APK

### Method 1: EAS Build (Recommended - Cloud)

```bash
cd attendance-mobile

# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build production APK
eas build --platform android --profile production-apk

# Download APK when ready
eas build:download --platform android --latest
```

Build time: 10-15 minutes

### Method 2: Local Build

Requires Android Studio with SDK configured.

```bash
cd attendance-mobile

# Prebuild for Android
npx expo prebuild --platform android --clean

# Build release APK
cd android
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/release/app-release.apk
```

### Install APK

```bash
# Via ADB
adb install app-release.apk

# Or transfer to device and install manually
```

---

## Production Deployment

### Backend Deployment (Ubuntu Server)

```bash
# 1. Upload backend to server
scp -r attendance-mobile/Backend/ root@your-server:/var/www/qhr-backend

# 2. SSH into server
ssh root@your-server

# 3. Install dependencies
cd /var/www/qhr-backend
npm install --production

# 4. Configure environment
cp .env.production .env
nano .env  # Edit with production values

# 5. Start with PM2
pm2 start src/server.js --name qhr-backend
pm2 save
pm2 startup

# 6. Configure Nginx reverse proxy
# See deployment script for full configuration
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name hr.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL Certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d hr.yourdomain.com
```

---

## API Documentation

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/change-password` | Change password |
| POST | `/api/v1/auth/refresh-token` | Refresh JWT token |
| GET | `/api/v1/auth/me` | Get current user |

### Attendance

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/attendance/check-in` | Check in |
| POST | `/api/v1/attendance/check-out` | Check out |
| GET | `/api/v1/attendance/today` | Today's attendance |
| GET | `/api/v1/attendance/my` | My attendance history |

### Leaves

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/leaves` | Apply for leave |
| GET | `/api/v1/leaves/my` | My leave requests |
| GET | `/api/v1/leaves/balance` | Leave balance |
| POST | `/api/v1/leaves/:id/approve` | Approve/reject leave |

### WFH

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/wfh` | Submit WFH request |
| GET | `/api/v1/wfh/my-requests` | My WFH requests |
| PATCH | `/api/v1/wfh/:id/review` | Review WFH request |

### Grievances

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/grievances` | Submit grievance |
| GET | `/api/v1/grievances/my-grievances` | My grievances |
| PATCH | `/api/v1/grievances/:id/status` | Update status |

### Company Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/companies` | List companies |
| GET | `/api/v1/holidays` | Get holidays |
| GET | `/api/v1/leave-types` | Get leave types |
| GET | `/api/v1/attendance-areas` | Get geofence areas |

---

## Test Credentials

```
Company Code: TESTCO
Passcode: 1234 (same for all users)

┌─────────────────────────────────────────────────────────────┐
│ Role          │ Employee ID │ Email              │ Access   │
├─────────────────────────────────────────────────────────────┤
│ Company Admin │ ADMIN001    │ admin@testco.com   │ Full     │
│ HR Manager    │ HR001       │ hr@testco.com      │ HR+      │
│ Employee      │ EMP001      │ employee@testco.com│ Basic    │
└─────────────────────────────────────────────────────────────┘
```

### Role Permissions

- **Admin**: All features + geofence setup + company settings
- **HR**: Approvals + holidays + leave types + weekend setup
- **Employee**: Apply leaves, WFH, grievances, view attendance

---

## Configuration

### Geofence Settings
- Default radius: 450 meters (configurable 50-5000m)
- GPS active hours: 9:00 AM - 6:00 PM (configurable)

### Notification Settings
- Exercise reminders: Every 30 minutes
- Blink reminders: Every 30 minutes
- Breathing reminders: Every 30 minutes

### Leave Settings (per company)
- Casual leaves: 12 per year
- Sick leaves: 12 per year
- Earned leaves: 15 per year
- Carry forward: Configurable

---

## Troubleshooting

### Backend Issues

**MongoDB connection error:**
```bash
# Check MongoDB status
systemctl status mongod
# Start MongoDB
systemctl start mongod
```

**API not responding:**
```bash
# Check PM2 status
pm2 status
# View logs
pm2 logs qhr-backend
# Restart
pm2 restart qhr-backend
```

### Mobile App Issues

**Cannot connect to API:**
- Check if backend is running: `curl http://localhost:3001/health`
- Verify API URL in `src/constants/api.ts`
- For Android emulator, use `10.0.2.2` instead of `localhost`

**Location not tracking:**
- Ensure location permissions are granted
- Check if GPS is enabled on device
- Verify operating hours configuration

**Login failed:**
- Verify company code and credentials
- Check backend logs for errors
- Ensure test data is seeded

---

## License

Proprietary software. All rights reserved.

---

## Support

For support, contact your IT administrator.
# qhr-attendance
