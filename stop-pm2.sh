#!/bin/bash

# QHR Attendance System - PM2 Stop Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Stopping QHR Attendance System${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Change to the correct directory
cd "$(dirname "$0")"

print_header
echo ""

# Check if PM2 is running any QHR processes
if pm2 list | grep -q "qhr-"; then
    print_status "Stopping all QHR processes..."
    pm2 stop qhr-backend qhr-admin-panel qhr-landing-page qhr-mobile-app 2>/dev/null || true
    pm2 delete qhr-backend qhr-admin-panel qhr-landing-page qhr-mobile-app 2>/dev/null || true
    print_status "All QHR processes stopped"
else
    print_warning "No QHR processes are currently running"
fi

echo ""
print_status "PM2 processes remaining:"
pm2 status 2>/dev/null || echo "No PM2 processes running"

echo ""
print_status "✅ QHR Attendance System stopped successfully!"
