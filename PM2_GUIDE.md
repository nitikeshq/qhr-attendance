# QHR Attendance System - PM2 Setup Guide

## Quick Start

### 1. Make Scripts Executable
```bash
cd /Users/nitikeshd/Projects/qhr-attendance
chmod +x start-pm2.sh stop-pm2.sh
```

### 2. Start Development Services
```bash
./start-pm2.sh
```

### 3. Stop All Services
```bash
./stop-pm2.sh
```

---

## Production PM2

Use `ecosystem.production.config.js` for production-like runs. It starts one backend API from `attendance-mobile/Backend`; every web, mobile, desktop, and landing/demo client should target that backend instead of running a second API.

```bash
cd /Users/nitikeshd/Projects/qhr-attendance
nvm use 24
pm2 start ecosystem.production.config.js
pm2 save
```

The latest backend readiness baseline is 42 passing Jest suites / 396 passing tests, 92.71% statement coverage, 93.17% line coverage, and clean `npm run lint`. Mobile, remaining web, and desktop PM2/build smoke checks are still blocked by low disk headroom.

## What PM2 Does

PM2 (Process Manager 2) manages Node.js applications in a single instance with:

- ✅ **Automatic restarts** if apps crash
- ✅ **Zero downtime reloads** 
- ✅ **Log management** with rotation
- ✅ **Memory monitoring** and auto-restart on leaks
- ✅ **Process monitoring** and health checks
- ✅ **Cluster mode** for production scaling

---

## File Structure

```
/Users/nitikeshd/Projects/qhr-attendance/
├── ecosystem.production.config.js # Production PM2 configuration
├── start-pm2.sh            # Startup script
├── stop-pm2.sh             # Stop script
├── PM2_GUIDE.md            # This guide
├── logs/                   # Auto-created log directory
│   ├── backend-error.log
│   ├── backend-out.log
│   ├── admin-panel-error.log
│   ├── admin-panel-out.log
│   ├── landing-page-error.log
│   ├── landing-page-out.log
│   ├── mobile-app-error.log
│   └── mobile-app-out.log
└── attendance-mobile/      # Your app code
```

---

## Services Managed

| Service | PM2 Name | Port | Description |
|---------|----------|------|-------------|
| Backend API | `qhr-backend` | 5001 | Express.js API server |
| Admin Panel | `qhr-admin-panel` | 3001 | Next.js admin interface |
| Landing Page | `qhr-landing-page` | 3000 | Next.js public website |

The mobile app and desktop tracker should be built/tested as clients of the same backend. Do not add them to production PM2 as long-running development servers.

---

## PM2 Commands

### Basic Commands
```bash
# View all processes
pm2 status

# View real-time logs
pm2 logs

# Monitor all processes
pm2 monit

# Restart all processes
pm2 restart all

# Stop all processes
pm2 stop all

# Delete all processes
pm2 delete all
```

### Individual Service Commands
```bash
# Restart specific service
pm2 restart qhr-backend

# View specific service logs
pm2 logs qhr-admin-panel

# Stop specific service
pm2 stop qhr-backend
```

### Advanced Commands
```bash
# Reload without downtime
pm2 reload all

# Generate startup script
pm2 startup

# Save current process list
pm2 save

# View process details
pm2 show qhr-backend

# View memory usage
pm2 monit
```

---

## Configuration Details

### Environment Variables
The production ecosystem reads secrets and URLs from the shell environment:

```javascript
env: {
  NODE_ENV: 'production',
  PORT: process.env.PORT || 5001,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL
}
```

### Log Management
- **Error logs**: Separate error files for each service
- **Output logs**: Standard output for each service
- **Combined logs**: Merged logs with timestamps
- **Log rotation**: PM2 handles automatic rotation

### Memory Management
- **Auto-restart**: If process exceeds 1GB memory
- **Monitoring**: Real-time memory usage tracking
- **Limits**: Configurable memory thresholds

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Kill processes on ports used by production PM2 services
lsof -ti:3000,3001,5001 | xargs kill -9

# Then restart
./start-pm2.sh
```

#### 2. MongoDB/Redis Not Running
```bash
# Start MongoDB
brew services start mongodb-community

# Start Redis
brew services start redis

# Then restart PM2
pm2 restart all
```

#### 3. Dependencies Missing
```bash
# The start script auto-installs dependencies
# But if needed, install manually:
cd attendance-mobile/Backend && npm install
cd ../admin-panel && npm install
cd ../landing-page && npm install
cd ../.. && npm install
```

#### 4. Mobile/Desktop Verification
```bash
# Mobile checks need dependency and disk headroom first.
cd attendance-mobile
nvm use 24
npm ci
npm run typecheck

# Desktop checks should verify production API URL, token refresh,
# offline replay, consent, retention, and disclosure behavior.
cd ../desktop-app
npm ci
npm run build
```

### View Logs for Debugging
```bash
# View all logs
pm2 logs

# View specific service logs
pm2 logs qhr-backend

# View last 100 lines
pm2 logs qhr-backend --lines 100

# View error logs only
pm2 logs qhr-backend --err
```

### Monitor Performance
```bash
# Open monitoring dashboard
pm2 monit

# Check memory usage
pm2 show qhr-backend

# View process details
pm2 describe qhr-backend
```

---

## 🔄 Development Workflow

### Daily Development
```bash
# Start all services
./start-pm2.sh

# Work on your code...

# Restart specific service after changes
pm2 restart qhr-backend

# View logs to debug
pm2 logs qhr-backend
```

### Before Git Commit
```bash
# Stop all services
./stop-pm2.sh

# Clear logs if needed
rm -rf logs/

# Commit your changes
git add .
git commit -m "Your changes"
```

### Production Deployment
```bash
# Export production secrets first, then start the one-backend config.
pm2 start ecosystem.production.config.js

# Save for auto-restart on server reboot
pm2 save
pm2 startup
```

---

## Access Your Applications

After running `./start-pm2.sh`:

| Application | URL | Description |
|-------------|-----|-------------|
| 🌐 Landing Page | http://localhost:3000 | Public website for demo requests |
| 🖥️ Admin Panel | http://localhost:3001 | Admin dashboard (login required) |
| 🔧 Backend API | http://localhost:5001 | REST API for all services |

---

## Benefits of PM2 Setup

1. **Single Command Start**: `./start-pm2.sh` starts everything
2. **Automatic Recovery**: Services restart if they crash
3. **Centralized Logs**: All logs in one place with timestamps
4. **Memory Management**: Auto-restart on memory leaks
5. **Process Monitoring**: Real-time status and metrics
6. **Production Ready**: Production config keeps a single backend authority
7. **Zero Downtime**: Reload without stopping services

---

## Getting Help

If you face issues:

1. **Check logs**: `pm2 logs`
2. **Check status**: `pm2 status`
3. **Restart services**: `pm2 restart all`
4. **Kill and restart**: `./stop-pm2.sh && ./start-pm2.sh`
5. **Check dependencies**: Ensure MongoDB and Redis are running

For detailed setup, see: `CREDENTIALS.md` for login credentials
