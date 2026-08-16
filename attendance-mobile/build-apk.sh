#!/bin/bash

echo "========================================"
echo "QHR Attendance - Build Android APK"
echo "========================================"
echo ""

# Check EAS CLI
if ! command -v eas &> /dev/null; then
    echo "EAS CLI not found. Installing..."
    npm install -g eas-cli
fi

echo ""
echo "EAS CLI is installed."
echo ""

# Choose build profile
echo "========================================"
echo "Choose build profile:"
echo "1. Preview (for testing - APK)"
echo "2. Production (for release - AAB)"
echo "========================================"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" == "1" ]; then
    profile="preview"
    echo ""
    echo "Building PREVIEW APK for testing..."
elif [ "$choice" == "2" ]; then
    profile="production"
    echo ""
    echo "Building PRODUCTION bundle..."
else
    echo "Invalid choice. Exiting."
    exit 1
fi

# Check Expo login
echo ""
echo "========================================"
echo "Checking Expo login status..."
echo "========================================"
if ! eas whoami &> /dev/null; then
    echo ""
    echo "Not logged in to Expo. Please login:"
    eas login
fi

# Start build
echo ""
echo "========================================"
echo "Starting Android build with profile: $profile"
echo "========================================"
echo ""
echo "This will take 15-20 minutes."
echo "You will receive an email when the build completes."
echo ""

eas build --platform android --profile $profile

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✅ Build submitted successfully!"
    echo "========================================"
    echo ""
    echo "Your APK will be ready in 15-20 minutes."
    echo "Check your email for the download link."
    echo ""
    echo "Or check build status with: eas build:list"
    echo ""
else
    echo ""
    echo "❌ Build failed! Check the errors above."
    echo ""
    exit 1
fi
