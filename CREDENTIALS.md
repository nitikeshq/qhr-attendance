# QHR Attendance System - Login Credentials

## 📱 Mobile App Login

### Test Companies (for login page)
| Company Name | Code | Description |
|-------------|------|-------------|
| Qwegle Tech Solutions | QHR | Main demo company |
| Test Company 1 | TEST1 | Testing company |
| Demo Corp | DEMO | Demo organization |
| Innovate Solutions | INNO | Innovation company |
| Global Services Ltd | GLOBAL | Global services company |

### Employee Login Credentials

#### Qwegle Tech Solutions (Code: QHR)
| Role | Employee ID | Password | Name |
|------|-------------|----------|------|
| Super Admin | admin@qhr.com | admin123 | Admin User |
| Company Admin | company@example.com | password123 | Company Admin |
| HR Manager | hr@example.com | hr123 | HR Manager |
| Employee | emp001 | emp123 | John Doe |
| Employee | emp002 | emp123 | Jane Smith |

#### Test Company 1 (Code: TEST1)
| Role | Employee ID | Password | Name |
|------|-------------|----------|------|
| Admin | admin@test1.com | admin123 | Test Admin |
| Employee | test001 | test123 | Test Employee |

#### Demo Corp (Code: DEMO)
| Role | Employee ID | Password | Name |
|------|-------------|----------|------|
| Admin | admin@demo.com | admin123 | Demo Admin |
| Employee | demo001 | demo123 | Demo Employee |

#### Innovate Solutions (Code: INNO)
| Role | Employee ID | Password | Name |
|------|-------------|----------|------|
| Admin | admin@inno.com | admin123 | Innovation Admin |
| Employee | inno001 | inno123 | Innovator One |

#### Global Services Ltd (Code: GLOBAL)
| Role | Employee ID | Password | Name |
|------|-------------|----------|------|
| Admin | admin@global.com | admin123 | Global Admin |
| Employee | global001 | global123 | Global Employee |

---

## 🖥️ Admin Panel Login

### Super Admin Account
- **Email:** admin@qhr.com
- **Password:** admin123
- **Access:** Can view all companies, manage subscriptions, demo requests

### Company Admin Accounts
| Company | Email | Password | Access |
|---------|-------|----------|--------|
| Qwegle Tech | company@example.com | password123 | Manage employees, payroll, settings |
| Test Company | admin@test1.com | admin123 | Manage employees, attendance |
| Demo Corp | admin@demo.com | admin123 | Manage employees, reports |

### HR Accounts
| Company | Email | Password | Access |
|---------|-------|----------|--------|
| Qwegle Tech | hr@example.com | hr123 | Manage employees, leaves, attendance |
| Test Company | hr@test1.com | hr123 | Manage leaves, attendance |

---

## 🌐 Landing Page

No login required - public access for:
- Viewing features and pricing
- Requesting a demo
- Company registration

---

## 🗄️ Database Access

### MongoDB
```bash
# Connect to MongoDB
mongosh qhr_attendance

# Collections
- companies
- employees
- attendance
- leaves
- payroll_config
- payslips
- resignations
- demo_requests
- subscription_plans
- company_subscriptions
```

### Redis
```bash
# Connect to Redis
redis-cli

# Keys
- user:* (cached user sessions)
- company:* (cached company data)
```

---

## 🚀 Quick Start Guide

### 1. Start All Services (Recommended: Separate Terminals)

```bash
# Terminal 1 - Backend API
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile/Backend
npm run dev
# Runs on: http://localhost:5001

# Terminal 2 - Admin Panel
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile/Backend/admin-panel
npm run dev
# Runs on: http://localhost:3001

# Terminal 3 - Landing Page
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile/Backend/landing-page
npm run dev
# Runs on: http://localhost:3000

# Terminal 4 - Mobile App
cd /Users/nitikeshd/Desktop/attendance/attendance-mobile
npx expo start
# Runs on: http://localhost:8081 (or 8082 if 8081 is busy)
```

### 2. Single Instance Option (Advanced)

You can use a process manager like `concurrently` or `pm2` to run all services:

```bash
# Install concurrently
npm install -g concurrently

# Create a start script
cd /Users/nitikeshd/Desktop/attendance
cat > start-all.sh << 'EOF'
#!/bin/bash
echo "Starting QHR Attendance System..."

# Start Backend
cd attendance-mobile/Backend
npm run dev &
BACKEND_PID=$!

# Start Admin Panel
cd ../admin-panel
npm run dev &
ADMIN_PID=$!

# Start Landing Page
cd ../landing-page
npm run dev &
LANDING_PID=$!

# Start Mobile App
cd ../../
npx expo start &
MOBILE_PID=$!

echo "All services started!"
echo "Backend: http://localhost:5001"
echo "Admin Panel: http://localhost:3001"
echo "Landing Page: http://localhost:3000"
echo "Mobile App: Running on Expo"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $ADMIN_PID $LANDING_PID $MOBILE_PID; exit" INT
wait
EOF

chmod +x start-all.sh
./start-all.sh
```

---

## 📱 Mobile App Testing

### Using Expo Go App
1. Install Expo Go from Play Store/App Store
2. Scan QR code from terminal
3. Use any of the credentials above

### Using Android Emulator
1. Run `npx expo start --android`
2. Or use development build: `npx expo run:android`

### Using iOS Simulator
1. Run `npx expo start --ios`
2. Or use development build: `npx expo run:ios`

---

## 🔧 Troubleshooting

### Port Conflicts
```bash
# Kill all processes on common ports
lsof -ti:3000,3001,5001,8081,8082 | xargs kill -9

# Or kill specific port
lsof -ti:5001 | xargs kill -9
```

### Clear Cache
```bash
# Clear npm cache
npm cache clean --force

# Clear Expo cache
npx expo start --clear

# Clear node_modules (if needed)
rm -rf node_modules package-lock.json
npm install
```

### Reset Database
```bash
# Clear MongoDB data
mongosh qhr_attendance --eval "db.dropDatabase()"

# Clear Redis data
redis-cli flushall
```

---

## 📋 Features to Test

### Mobile App
- ✅ GPS Attendance with geofencing
- ✅ Desktop Activity tracking
- ✅ Leave requests and approvals
- ✅ Salary slips with PF/ESIC/TDS
- ✅ Exit formalities and F&F
- ✅ iOS glassmorphism design

### Admin Panel
- ✅ Employee management
- ✅ Attendance reports
- ✅ Payroll processing
- ✅ Demo requests (leads)
- ✅ Subscription management
- ✅ Tasks and projects

### Landing Page
- ✅ SME-focused messaging
- ✅ Request a Demo form
- ✅ Geo & desktop monitoring features

---

## 🆘 Support

If you face issues:
1. Check the terminal logs for errors
2. Ensure all services are running on correct ports
3. Verify MongoDB and Redis are running
4. Check network connectivity for mobile app

For detailed setup, see: `START_APPS.md`
