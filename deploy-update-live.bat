@echo off
setlocal enabledelayedexpansion

echo ========================================
echo QHR Attendance - UPDATE Live Server
echo ========================================
echo.
echo Server: 3.78.219.190 (AWS EC2)
echo Live URL: http://3.78.219.190/qhr
echo.
echo ⚠️  IMPORTANT: This will update the live server
echo    while preserving existing data!
echo.
set /p confirm="Continue with deployment? (yes/no): "
if /i not "%confirm%"=="yes" (
    echo Deployment cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo Step 0: Backup live data
echo ========================================
echo.

ssh -i "%USERPROFILE%\.ssh\qwegle.pem" ^
    ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com ^
    "cd /home/ubuntu/apps/qhr-attendance/attendance-mobile/Backend/data && cp db.json db.json.backup-%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2% 2>nul || cp db.json db.json.backup-latest"

echo ✅ Data backed up
echo.

echo ========================================
echo Step 1: Creating deployment bundle
echo ========================================
echo.

tar --exclude-vcs -czf "%TEMP%\qhr-deploy.tar.gz" ^
    --exclude=node_modules ^
    --exclude=.next ^
    --exclude=dist ^
    --exclude=.expo ^
    --exclude=*.log ^
    --exclude=attendance-mobile\Backend\data ^
    --exclude=test-results ^
    --exclude=playwright-report ^
    --exclude=.agents ^
    --exclude=.runtime-logs ^
    --exclude=.vscode ^
    admin-panel ^
    landing-page ^
    attendance-mobile ^
    deploy\ecosystem.server.config.js ^
    deploy\nginx-shared-host.conf ^
    deploy\nginx-project-qhr.conf ^
    deploy\install-multi-project.sh ^
    deploy\redeploy.sh ^
    deploy\verify.sh ^
    deploy\verify-onboarding.sh ^
    deploy\verify-public-pages.sh ^
    deploy\verify-admin-design.sh ^
    deploy\verify-migration.sh ^
    deploy\verify-calendar-and-plans.sh ^
    deploy\verify-employee-lifecycle.sh ^
    deploy\verify-notifications.sh ^
    deploy\verify-locations-and-guidance.sh ^
    deploy\verify-admin-bundle.sh ^
    deploy\verify-payroll-preview.sh ^
    deploy\verify-payslip-and-paydate.sh ^
    deploy\verify-work-week.sh ^
    deploy\verify-registration-security.sh ^
    deploy\verify-dashboard.sh ^
    deploy\verify-admin-routing.sh ^
    deploy\check-sample-residue.sh

if errorlevel 1 (
    echo ❌ Failed to create deployment bundle
    pause
    exit /b 1
)

echo ✅ Bundle created
echo.

echo ========================================
echo Step 2: Uploading to server
echo ========================================
echo.

scp -i "%USERPROFILE%\.ssh\qwegle.pem" ^
    "%TEMP%\qhr-deploy.tar.gz" ^
    ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com:/home/ubuntu/apps/qhr-attendance/

if errorlevel 1 (
    echo ❌ Failed to upload bundle
    pause
    exit /b 1
)

echo ✅ Bundle uploaded
echo.

echo ========================================
echo Step 3: Deploying on server
echo ========================================
echo.
echo This will:
echo - Extract new code
echo - Preserve existing data/db.json
echo - Install updated dependencies
echo - Rebuild all frontends
echo - Restart PM2 processes
echo - Verify deployment
echo.

ssh -i "%USERPROFILE%\.ssh\qwegle.pem" ^
    ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com ^
    "cd /home/ubuntu/apps/qhr-attendance && chmod +x redeploy.sh install-multi-project.sh verify.sh verify-*.sh check-sample-residue.sh && ./redeploy.sh"

if errorlevel 1 (
    echo.
    echo ❌ Deployment failed!
    echo.
    echo The data backup is still on the server.
    echo You can restore it if needed:
    echo ssh -i "%USERPROFILE%\.ssh\qwegle.pem" ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com
    echo cd /home/ubuntu/apps/qhr-attendance/attendance-mobile/Backend/data
    echo cp db.json.backup-latest db.json
    echo pm2 restart qhr-backend
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ DEPLOYMENT SUCCESSFUL!
echo ========================================
echo.
echo Your application is updated and running!
echo.
echo 🌐 Landing Page:  http://3.78.219.190/qhr
echo 💼 Admin Panel:   http://3.78.219.190/qhr/admin
echo 📱 Mobile Web:    http://3.78.219.190/qhr/app
echo 🔌 Backend API:   http://3.78.219.190/qhr/api/v1
echo.
echo ========================================
echo What was updated:
echo ========================================
echo.
echo ✅ Latest auto check-in geofencing code
echo ✅ All admin panel improvements
echo ✅ Mobile app enhancements
echo ✅ Backend API updates
echo ✅ All bug fixes and features
echo.
echo ⚠️  Data preserved: Your live data was NOT touched
echo.
echo ========================================
echo Check server status:
echo ========================================
echo.

ssh -i "%USERPROFILE%\.ssh\qwegle.pem" ^
    ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com ^
    "pm2 list"

echo.
echo ========================================
echo Next Steps:
echo ========================================
echo.
echo 1. Test the updated site:
echo    http://3.78.219.190/qhr/admin
echo.
echo 2. Build mobile APK with live URL:
echo    cd attendance-mobile
echo    echo EXPO_PUBLIC_API_URL=http://3.78.219.190/qhr/api/v1 ^> .env
echo    build-apk.bat
echo.
echo 3. Monitor logs if needed:
echo    ssh -i "%USERPROFILE%\.ssh\qwegle.pem" ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com
echo    pm2 logs qhr-backend --lines 50
echo.
echo 4. View data backups on server:
echo    ssh to server and: ls -lh attendance-mobile/Backend/data/
echo.
pause
