# Build & Deployment Guide

## 📦 Building Mobile App APK

### Option 1: Build with EAS (Recommended)

#### Prerequisites
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login
```

#### Build Android APK
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile

# Configure EAS (first time only)
eas build:configure

# Build preview APK for testing
eas build --platform android --profile preview

# Build production APK
eas build --platform android --profile production
```

**Build time:** 15-20 minutes

**What you get:**
- Download link sent to your email
- APK file you can install on any Android device
- Includes all geofencing and background features

#### Build iOS (Requires Apple Developer Account)
```bash
# Build for iOS
eas build --platform ios --profile preview

# Submit to TestFlight
eas submit --platform ios
```

### Option 2: Local Build (Advanced)

#### Android Local Build
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile

# Install dependencies
npm install

# Prebuild native code
npx expo prebuild

# Build with Gradle
cd android
.\gradlew assembleRelease

# APK location:
# android\app\build\outputs\apk\release\app-release.apk
```

---

## 🌐 Deploying Backend to Production

### Step 1: Prepare Production Server

**Requirements:**
- Ubuntu 20.04+ or similar Linux server
- Node.js 20+
- PM2 process manager
- Nginx (reverse proxy)
- SSL certificate (Let's Encrypt)

#### Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Install PM2
```bash
sudo npm install -g pm2
```

#### Install Nginx
```bash
sudo apt-get install nginx
```

### Step 2: Upload Code to Server

**Method 1: Git (Recommended)**
```bash
# On server
cd /var/www
git clone https://github.com/yourusername/qhr-attendance.git
cd qhr-attendance/attendance-mobile/Backend
npm install --production
```

**Method 2: SCP/SFTP**
```bash
# From local machine
scp -r c:\Q-Projects\qhr-attendance\attendance-mobile\Backend user@your-server:/var/www/qhr-attendance/
```

### Step 3: Configure Environment Variables

```bash
# On server
cd /var/www/qhr-attendance/attendance-mobile/Backend
nano .env
```

**Production .env:**
```env
NODE_ENV=production
PORT=5000
JWT_SECRET=your-strong-secret-key-min-32-chars
JWT_REFRESH_SECRET=another-strong-secret-key
ALLOWED_ORIGINS=https://admin.yourdomain.com,https://yourdomain.com
DATA_PATH=./data/db.json

# Email (optional but recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Step 4: Start Backend with PM2

```bash
cd /var/www/qhr-attendance/attendance-mobile/Backend

# Start with PM2
pm2 start npm --name "qhr-backend" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Step 5: Configure Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/qhr-backend
```

**Nginx configuration:**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/qhr-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Setup SSL Certificate

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is setup automatically
```

---

## 🖥️ Deploying Admin Panel to Production

### Option 1: Vercel (Easiest)

```bash
cd c:\Q-Projects\qhr-attendance\admin-panel

# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set project name
# - Link to Git (optional)
# - Deploy

# For production:
vercel --prod
```

**Environment Variables (Set in Vercel dashboard):**
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

### Option 2: Build and Deploy to Server

```bash
cd c:\Q-Projects\qhr-attendance\admin-panel

# Set environment variable
echo "NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1" > .env.local

# Build for production
npm run build

# Output is in .next folder
# Upload to server
```

**On server with Nginx:**
```bash
# Install serve (or use Next.js server)
npm install -g serve

# Start with PM2
pm2 start serve --name "qhr-admin" -- -s /var/www/qhr-attendance/admin-panel/.next -l 3000
```

**Nginx configuration:**
```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Setup SSL same as backend.

---

## 📱 Update Mobile App to Use Production API

### Before Building Production APK

**Update API URL:**

**Method 1: Environment Variable**
```bash
cd c:\Q-Projects\qhr-attendance\attendance-mobile

# Create/edit .env
echo "EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1" > .env
```

**Method 2: Direct in Code**

Edit `attendance-mobile/src/api.js`:
```javascript
// Change from
export const API_ROOT = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// To
export const API_ROOT = 'https://api.yourdomain.com/api/v1';
```

**Then build production APK:**
```bash
eas build --platform android --profile production
```

---

## 🔄 Deployment Checklist

### Pre-Deployment

**Backend:**
- [ ] Environment variables configured (.env)
- [ ] JWT secrets are strong (32+ characters)
- [ ] ALLOWED_ORIGINS includes production domains
- [ ] Database backup plan in place
- [ ] SMTP configured for email notifications
- [ ] Rate limiting configured

**Admin Panel:**
- [ ] Built with production API URL
- [ ] Environment variables set
- [ ] No console.logs or debug code
- [ ] Error boundary configured

**Mobile App:**
- [ ] API URL points to production
- [ ] Version number incremented
- [ ] App icons and splash screen set
- [ ] Permissions configured correctly

### Deployment Steps

1. **Deploy Backend First**
   ```bash
   # On server
   cd /var/www/qhr-attendance/attendance-mobile/Backend
   git pull
   npm install --production
   pm2 restart qhr-backend
   ```

2. **Deploy Admin Panel**
   ```bash
   # If using Vercel
   vercel --prod
   
   # If on server
   npm run build
   pm2 restart qhr-admin
   ```

3. **Build & Distribute Mobile App**
   ```bash
   # Build with production API URL
   cd attendance-mobile
   eas build --platform android --profile production
   
   # Download APK from EAS
   # Distribute to users
   ```

### Post-Deployment

- [ ] Backend API accessible at https://api.yourdomain.com
- [ ] Admin panel accessible at https://admin.yourdomain.com
- [ ] SSL certificates valid
- [ ] Test login with admin credentials
- [ ] Test mobile app connects to production
- [ ] Monitor logs for errors
- [ ] Verify geofencing works on production
- [ ] Test complete workflows

---

## 📊 Monitoring Production

### PM2 Monitoring

```bash
# View running processes
pm2 list

# View logs
pm2 logs qhr-backend

# View real-time monitoring
pm2 monit

# Restart if needed
pm2 restart qhr-backend

# Stop
pm2 stop qhr-backend
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### Application Logs

```bash
# Backend logs (if file logging enabled)
tail -f /var/www/qhr-attendance/attendance-mobile/Backend/logs/app.log

# PM2 logs
pm2 logs qhr-backend --lines 100
```

---

## 🔐 Production Security Checklist

- [ ] HTTPS enabled (SSL certificates)
- [ ] Strong JWT secrets (32+ characters, random)
- [ ] CORS configured with specific origins
- [ ] Rate limiting enabled
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (input sanitization)
- [ ] File upload restrictions (size, type)
- [ ] Environment variables not in code
- [ ] .env files not in Git
- [ ] Admin password changed from default
- [ ] Database backups scheduled
- [ ] Error messages don't expose internals
- [ ] Logging configured (errors, access)

---

## 🆙 Updating Production

### Backend Updates

```bash
# On server
cd /var/www/qhr-attendance/attendance-mobile/Backend

# Pull latest code
git pull

# Install dependencies
npm install --production

# Run migrations if any
# npm run migrate (if you have migrations)

# Restart
pm2 restart qhr-backend

# Check status
pm2 logs qhr-backend --lines 50
```

### Admin Panel Updates

```bash
# If using Vercel
vercel --prod

# If on server
cd /var/www/qhr-attendance/admin-panel
git pull
npm install
npm run build
pm2 restart qhr-admin
```

### Mobile App Updates

```bash
# Build new version
cd attendance-mobile

# Increment version in app.json
# Edit "version": "1.0.1" (increment)

# Build
eas build --platform android --profile production

# Distribute new APK to users
```

---

## 📱 Distributing Mobile App APK

### Option 1: Direct Distribution (Internal Testing)

1. **Build APK:**
   ```bash
   eas build --platform android --profile preview
   ```

2. **Download APK** from EAS dashboard or email link

3. **Share APK:**
   - Email APK file
   - Upload to company server
   - Share via Google Drive/Dropbox
   - Use QR code generator

4. **User Installation:**
   - Enable "Install from unknown sources"
   - Download APK
   - Tap to install
   - Grant all permissions

### Option 2: Google Play Store (Public Release)

1. **Create Google Play Developer Account** ($25 one-time)

2. **Build Production AAB:**
   ```bash
   eas build --platform android --profile production
   ```

3. **Submit to Play Store:**
   ```bash
   eas submit --platform android
   ```

4. **Complete Play Store Listing:**
   - App description
   - Screenshots
   - Privacy policy
   - Target audience
   - Content rating

5. **Review** (1-3 days)

6. **Publish**

### Option 3: Internal Distribution via Firebase App Distribution

1. **Setup Firebase project**

2. **Build APK**

3. **Upload to Firebase App Distribution**

4. **Invite testers via email**

5. **Testers get app via Firebase App Tester app**

---

## 🚀 Quick Deploy Script

Create `deploy.sh` for easier deployments:

```bash
#!/bin/bash

echo "🚀 Deploying QHR Attendance to Production"

# Pull latest code
echo "📥 Pulling latest code..."
git pull

# Backend
echo "🔧 Updating backend..."
cd attendance-mobile/Backend
npm install --production
pm2 restart qhr-backend

# Admin Panel
echo "💼 Updating admin panel..."
cd ../../admin-panel
npm install
npm run build
pm2 restart qhr-admin

# Done
echo "✅ Deployment complete!"
echo "🔍 Checking status..."
pm2 list

echo "📊 Recent logs:"
pm2 logs --lines 20
```

Make executable:
```bash
chmod +x deploy.sh
```

Run:
```bash
./deploy.sh
```

---

## 📞 Production URLs

After deployment, your production URLs will be:

```
Backend API: https://api.yourdomain.com
Admin Panel: https://admin.yourdomain.com
Mobile App: APK distributed to users
```

Update these in all documentation and communications to users.

---

## ✅ Deployment Verification

After deploying everything:

1. **Test Backend API:**
   ```bash
   curl https://api.yourdomain.com/api/v1/auth/companies
   ```
   Should return company list

2. **Test Admin Panel:**
   - Open https://admin.yourdomain.com
   - Login with admin credentials
   - Verify dashboard loads

3. **Test Mobile App:**
   - Install APK on test device
   - Login with employee credentials
   - Test check-in/check-out
   - Test auto geofencing
   - Test all major features

4. **Monitor for Issues:**
   - Check PM2 logs
   - Check Nginx logs
   - Check for error emails
   - Monitor server resources

---

**Ready to deploy!** Follow these steps sequentially: Backend → Admin → Mobile App
