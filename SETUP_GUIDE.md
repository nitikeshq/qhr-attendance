# QHR Attendance System - Complete Setup Guide

This guide covers setting up the entire QHR Attendance ecosystem including Backend API, Mobile App (APK), and Desktop App (EXE/DMG).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend API Setup](#backend-api-setup)
3. [Mobile App Setup & APK Build](#mobile-app-setup--apk-build)
4. [Desktop App Setup & Build](#desktop-app-setup--build)
5. [Production Deployment](#production-deployment)
6. [Test Credentials](#test-credentials)

---

## Prerequisites

### System Requirements

| Component | Requirement |
|-----------|-------------|
| Node.js | v20.x or higher |
| npm | v10.x or higher |
| MongoDB | v6.x or higher |
| Redis | v7.x (optional) |
| Git | Latest version |

### Development Tools

- **Mobile App**: Android Studio (for Android) or Xcode (for iOS)
- **Desktop App**: No additional tools required
- **Backend**: Any code editor (VS Code recommended)

### Install Node.js

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x
```

---

## Backend API Setup

### Step 1: Navigate to Backend Directory

```bash
cd attendance-mobile/Backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
nano .env  # or use any editor
```

### Key Environment Variables

```env
# Required
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/attendance_db
JWT_SECRET=your-secure-secret-key-min-32-characters
JWT_REFRESH_SECRET=another-secure-secret-key

# Optional but recommended
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Step 4: Start MongoDB

```bash
# macOS (with Homebrew)
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# Verify MongoDB is running
mongosh --eval "db.runCommand({ping: 1})"
```

### Step 5: Seed Test Data

```bash
npm run seed
```

This creates:
- Test company (Code: TESTCO)
- Admin user (ADMIN001)
- HR user (HR001)
- Employee user (EMP001)

### Step 6: Start Backend Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

**Verify**: Open http://localhost:3001/health - should return `{"status":"ok"}`

---

## Mobile App Setup & APK Build

### Step 1: Navigate to Mobile App Directory

```bash
cd attendance-mobile
```

### Step 2: Install Dependencies

```bash
npm install

# Install additional required packages
npx expo install expo-av  # For voice recording in tasks
```

### Step 3: Configure API URL

Edit `src/constants/api.ts`:

```typescript
// For development
const PRODUCTION_API_URL = 'http://YOUR_SERVER_IP:3001/api/v1';

// For production
const PRODUCTION_API_URL = 'https://hr.yourcompany.com/api/v1';
```

### Step 4: Run in Development

```bash
# Start Expo development server
npm start

# Then press:
# 'a' - Open on Android emulator
# 'i' - Open on iOS simulator
# Scan QR code - Open on physical device with Expo Go
```

### Step 5: Build Production APK

#### Method A: EAS Build (Recommended - Cloud Build)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure project (first time only)
eas build:configure

# Build APK
eas build --platform android --profile production-apk

# After build completes (~10-15 min), download APK
eas build:download --platform android --latest
```

#### Method B: Local Build

```bash
# Generate native Android project
npx expo prebuild --platform android --clean

# Build release APK
cd android
./gradlew assembleRelease

# APK location
ls app/build/outputs/apk/release/
```

### Step 6: Install APK

```bash
# Via ADB (with device connected)
adb install app-release.apk

# Or transfer to device and install manually
```

---

## Desktop App Setup & Build

### Step 1: Navigate to Desktop App Directory

```bash
cd desktop-app
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Run in Development

```bash
npm run dev
```

### Step 4: Build for Distribution

#### Windows (EXE)

```bash
# On Windows or using cross-compilation
npm run build:win
```

Output: `dist/QHR Desktop Setup.exe`

#### macOS (DMG)

```bash
# On macOS only
npm run build:mac
```

Output: `dist/QHR Desktop.dmg`

#### Linux

```bash
npm run build:linux
```

Output: `dist/QHR Desktop.AppImage`

### Step 5: Code Signing (Production)

For production releases, you need to sign the applications:

**Windows**: Requires a code signing certificate from a trusted CA.

**macOS**: Requires an Apple Developer account and valid signing identity.

```bash
# Set environment variables before building
export CSC_LINK=path/to/certificate.p12
export CSC_KEY_PASSWORD=certificate_password

npm run build:mac
```

---

## Production Deployment

### Backend Deployment (Ubuntu Server)

#### Quick Deploy Script

```bash
#!/bin/bash
# deploy-backend.sh

# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PM2
sudo npm install -g pm2

# 4. Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# 5. Clone/upload your code to /var/www/qhr-backend

# 6. Install dependencies
cd /var/www/qhr-backend
npm install --production

# 7. Configure environment
cp .env.example .env
nano .env  # Edit with production values

# 8. Start with PM2
pm2 start src/server.js --name qhr-backend
pm2 save
pm2 startup
```

#### Nginx Configuration

```nginx
server {
    listen 80;
    server_name hr.yourcompany.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### SSL Certificate

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d hr.yourcompany.com
```

---

## Test Credentials

After running `npm run seed`, use these credentials:

| Role | Company Code | Employee ID | Passcode |
|------|--------------|-------------|----------|
| Admin | TESTCO | ADMIN001 | 1234 |
| HR Manager | TESTCO | HR001 | 1234 |
| Employee | TESTCO | EMP001 | 1234 |

---

## API Endpoints Summary

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/change-password` - Change password

### Attendance
- `POST /api/v1/attendance/check-in` - Check in
- `POST /api/v1/attendance/check-out` - Check out
- `GET /api/v1/attendance/today` - Today's attendance

### Tasks & Projects (CRM)
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/tasks` - List tasks
- `POST /api/v1/tasks` - Create task
- `POST /api/v1/tasks/:id/verify-visit` - Verify sales visit

### Desktop Activity
- `POST /api/v1/desktop-activity/record` - Record activity snapshot
- `POST /api/v1/desktop-activity/heartbeat` - Send heartbeat
- `GET /api/v1/desktop-activity/team` - Get team activity (HR/Admin)

---

## Troubleshooting

### Backend Issues

**MongoDB connection failed**:
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod
```

**Port already in use**:
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Mobile App Issues

**Metro bundler errors**:
```bash
# Clear cache and restart
npx expo start --clear
```

**Build fails**:
```bash
# Clear native builds
rm -rf android ios
npx expo prebuild --clean
```

### Desktop App Issues

**Activity tracking not working (macOS)**:
- Go to System Preferences > Security & Privacy > Privacy
- Add the app to Accessibility permissions

**Can't connect to server**:
- Verify the API URL is correct
- Check if backend is running
- Ensure firewall allows connection

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs: `pm2 logs qhr-backend`
3. Check mobile app logs in Expo DevTools
4. Contact your IT administrator
