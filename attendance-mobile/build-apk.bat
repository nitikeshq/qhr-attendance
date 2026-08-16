@echo off
echo ========================================
echo QHR Attendance - Build Android APK
echo ========================================
echo.

echo Checking EAS CLI installation...
call eas --version >nul 2>&1
if errorlevel 1 (
    echo EAS CLI not found. Installing...
    call npm install -g eas-cli
)

echo.
echo EAS CLI is installed.
echo.

echo ========================================
echo Choose build profile:
echo 1. Preview (for testing - APK)
echo 2. Production (for release - AAB)
echo ========================================
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    set profile=preview
    echo.
    echo Building PREVIEW APK for testing...
) else if "%choice%"=="2" (
    set profile=production
    echo.
    echo Building PRODUCTION bundle...
) else (
    echo Invalid choice. Exiting.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Checking Expo login status...
echo ========================================
call eas whoami
if errorlevel 1 (
    echo.
    echo Not logged in to Expo. Please login:
    call eas login
)

echo.
echo ========================================
echo Starting Android build with profile: %profile%
echo ========================================
echo.
echo This will take 15-20 minutes.
echo You will receive an email when the build completes.
echo.

call eas build --platform android --profile %profile%

if errorlevel 1 (
    echo.
    echo ❌ Build failed! Check the errors above.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ Build submitted successfully!
echo ========================================
echo.
echo Your APK will be ready in 15-20 minutes.
echo Check your email for the download link.
echo.
echo Or check build status with: eas build:list
echo.
pause
