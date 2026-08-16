@echo off
setlocal enabledelayedexpansion

echo ========================================
echo QHR Attendance - Deploy to Live Server
echo ========================================
echo.
echo Server: 3.78.219.190 (AWS EC2)
echo Live URL: http://3.78.219.190/qhr
echo.

REM Check if SSH key exists
if not exist "%USERPROFILE%\.ssh\qwegle.pem" (
    echo ❌ ERROR: SSH key not found at %USERPROFILE%\.ssh\qwegle.pem
    echo.
    echo Please ensure your SSH key is at:
    echo %USERPROFILE%\.ssh\qwegle.pem
    echo.
    pause
    exit /b 1
)

echo ========================================
echo Step 1: Creating deployment bundle
echo ========================================
echo.
echo Excluding: node_modules, .next, dist, logs, data
echo.

REM Create temp directory if it doesn't exist
if not exist "%TEMP%\qhr-deploy" mkdir "%TEMP%\qhr-deploy"

REM Create tar archive
tar --exclude-vcs -czf "%TEMP%\qhr-deploy.tar.gz" ^
    --exclude=node_modules ^
    --exclude=.next ^
    --exclude=dist ^
    --exclude=.expo ^
    --exclude=*.log ^
    --exclude=attendance-mobile\Backend\data ^
    --exclude=test-results ^
    --exclude=playwright-report ^
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
    deploy\check-sample-residue.sh

if errorlevel 1 (
    echo ❌ Failed to create deployment bundle
    pause
    exit /b 1
)

echo ✅ Bundle created: %TEMP%\qhr-deploy.tar.gz
echo.

echo ========================================
echo Step 2: Uploading to server
echo ========================================
echo.
echo Uploading to: ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com
echo.

scp -i "%USERPROFILE%\.ssh\qwegle.pem" ^
    "%TEMP%\qhr-deploy.tar.gz" ^
    ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com:/home/ubuntu/apps/qhr-attendance/

if errorlevel 1 (
    echo ❌ Failed to upload bundle to server
    pause
    exit /b 1
)

echo ✅ Bundle uploaded successfully
echo.

echo ========================================
echo Step 3: Deploying on server
echo ========================================
echo.
echo Running deployment script on server...
echo This will:
echo - Extract code
echo - Install dependencies (if package.json changed)
echo - Rebuild admin panel under /qhr/admin
echo - Rebuild landing page under /qhr
echo - Rebuild mobile web under /qhr/app
echo - Restart PM2 processes (qhr-backend, qhr-admin, qhr-landing)
echo - Reload nginx
echo - Verify deployment
echo.

ssh -i "%USERPROFILE%\.ssh\qwegle.pem" ^
    ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com ^
    "cd /home/ubuntu/apps/qhr-attendance && chmod +x redeploy.sh install-multi-project.sh verify.sh && ./redeploy.sh"

if errorlevel 1 (
    echo.
    echo ❌ Deployment failed!
    echo.
    echo Check the error messages above.
    echo You can SSH into the server to investigate:
    echo ssh -i "%USERPROFILE%\.ssh\qwegle.pem" ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ DEPLOYMENT SUCCESSFUL!
echo ========================================
echo.
echo Your application is now live at:
echo.
echo 🌐 Landing Page:  http://3.78.219.190/qhr
echo 💼 Admin Panel:   http://3.78.219.190/qhr/admin
echo 📱 Mobile Web:    http://3.78.219.190/qhr/app
echo 🔌 Backend API:   http://3.78.219.190/qhr/api/v1
echo.
echo ========================================
echo Test Credentials:
echo ========================================
echo.
echo Admin Login (http://3.78.219.190/qhr/admin):
echo Email: admin@qhr.com
echo Password: admin123
echo.
echo OR
echo.
echo Email: company@example.com
echo Password: password123
echo.
echo Mobile/Desktop Login:
echo Company Code: TESTCO
echo Employee ID: EMP001
echo Passcode: 1234
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo.
echo 1. Test the live site:
echo    - Open http://3.78.219.190/qhr in your browser
echo    - Login to admin panel
echo    - Test all features
echo.
echo 2. Build mobile APK with production URL:
echo    cd attendance-mobile
echo    echo EXPO_PUBLIC_API_URL=http://3.78.219.190/qhr/api/v1 ^> .env
echo    build-apk.bat
echo.
echo 3. Monitor server:
echo    ssh -i "%USERPROFILE%\.ssh\qwegle.pem" ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com
echo    pm2 list
echo    pm2 logs qhr-backend
echo.
echo ========================================
echo SECURITY NOTES:
echo ========================================
echo.
echo ⚠️  HTTP ONLY - No HTTPS yet!
echo    - Set up domain and SSL for production
echo.
echo ⚠️  Change default passwords before real use!
echo    - admin@qhr.com / admin123
echo    - company@example.com / password123
echo    - Employee passcode: 1234
echo.
echo ⚠️  JSON file storage - Migrate to database for production
echo.
pause
