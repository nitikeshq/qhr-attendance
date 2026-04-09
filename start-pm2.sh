#!/bin/bash

# QHR Attendance System - PM2 Startup Script
# This script starts all services using PM2 in a single instance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  QHR Attendance System${NC}"
    echo -e "${BLUE}  PM2 Startup Script${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 is not installed. Installing PM2..."
        npm install -g pm2
        print_status "PM2 installed successfully"
    fi
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    print_status "Node.js version: $NODE_VERSION"
}

# Check if MongoDB is running
check_mongodb() {
    if ! pgrep -x "mongod" > /dev/null; then
        print_warning "MongoDB is not running. Starting MongoDB..."
        
        # Try to start MongoDB (works for macOS with Homebrew)
        if command -v brew &> /dev/null; then
            brew services start mongodb-community
        else
            print_warning "Please start MongoDB manually"
        fi
        
        # Wait a moment for MongoDB to start
        sleep 3
    fi
    
    if pgrep -x "mongod" > /dev/null; then
        print_status "MongoDB is running"
    else
        print_error "MongoDB is not running. Please start it manually."
    fi
}

# Check if Redis is running
check_redis() {
    if ! pgrep -x "redis-server" > /dev/null; then
        print_warning "Redis is not running. Starting Redis..."
        
        # Try to start Redis (works for macOS with Homebrew)
        if command -v brew &> /dev/null; then
            brew services start redis
        else
            print_warning "Please start Redis manually"
        fi
        
        # Wait a moment for Redis to start
        sleep 2
    fi
    
    if pgrep -x "redis-server" > /dev/null; then
        print_status "Redis is running"
    else
        print_error "Redis is not running. Please start it manually."
    fi
}

# Create logs directory
create_logs_dir() {
    if [ ! -d "logs" ]; then
        mkdir -p logs
        print_status "Created logs directory"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Backend dependencies
    if [ -d "attendance-mobile/Backend" ]; then
        cd attendance-mobile/Backend
        if [ ! -d "node_modules" ]; then
            print_status "Installing Backend dependencies..."
            npm install
        fi
        cd ../..
    fi
    
    # Admin Panel dependencies
    if [ -d "attendance-mobile/Backend/admin-panel" ]; then
        cd attendance-mobile/Backend/admin-panel
        if [ ! -d "node_modules" ]; then
            print_status "Installing Admin Panel dependencies..."
            npm install
        fi
        cd ../..
    fi
    
    # Landing Page dependencies
    if [ -d "attendance-mobile/Backend/landing-page" ]; then
        cd attendance-mobile/Backend/landing-page
        if [ ! -d "node_modules" ]; then
            print_status "Installing Landing Page dependencies..."
            npm install
        fi
        cd ../..
    fi
    
    # Mobile App dependencies
    if [ -d "attendance-mobile" ]; then
        cd attendance-mobile
        if [ ! -d "node_modules" ]; then
            print_status "Installing Mobile App dependencies..."
            npm install
        fi
        cd ..
    fi
}

# Kill existing PM2 processes
kill_existing() {
    if pm2 list | grep -q "qhr-"; then
        print_warning "Stopping existing QHR processes..."
        pm2 delete qhr-backend qhr-admin-panel qhr-landing-page qhr-mobile-app 2>/dev/null || true
        sleep 2
    fi
}

# Start all services with PM2
start_services() {
    print_status "Starting all services with PM2..."
    
    # Start the ecosystem
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    print_status "All services started successfully!"
}

# Show status
show_status() {
    echo ""
    print_header
    echo ""
    print_status "Service Status:"
    pm2 status
    
    echo ""
    print_status "Service URLs:"
    echo "  🌐 Landing Page:     http://localhost:3000"
    echo "  🖥️  Admin Panel:      http://localhost:3001"
    echo "  🔧 Backend API:       http://localhost:5001"
    echo "  📱 Mobile App (Web):  http://localhost:8082"
    echo ""
    print_status "Mobile App Development:"
    echo "  📲 Expo Dev Server:  Running on port 8082"
    echo "  📱 Scan QR code in Expo Go app"
    echo ""
    print_status "Useful PM2 Commands:"
    echo "  📊 View logs:        pm2 logs"
    echo "  📈 Monitor:          pm2 monit"
    echo "  🔄 Restart:          pm2 restart all"
    echo "  🛑 Stop:             pm2 stop all"
    echo "  🗑️  Delete:           pm2 delete all"
    echo ""
    print_status "View specific logs:"
    echo "  📋 Backend:          pm2 logs qhr-backend"
    echo "  👥 Admin Panel:       pm2 logs qhr-admin-panel"
    echo "  🏠 Landing Page:      pm2 logs qhr-landing-page"
    echo "  📱 Mobile App:        pm2 logs qhr-mobile-app"
}

# Main execution
main() {
    print_header
    echo ""
    
    # Change to the correct directory
    cd "$(dirname "$0")"
    
    # Run checks
    check_node
    check_pm2
    check_mongodb
    check_redis
    
    # Setup
    create_logs_dir
    install_dependencies
    
    # Clean up existing processes
    kill_existing
    
    # Start services
    start_services
    
    # Show status
    show_status
    
    echo ""
    print_status "🎉 QHR Attendance System is now running!"
    print_status "📋 Check CREDENTIALS.md for login credentials"
}

# Handle script interruption
trap 'print_warning "Script interrupted. Cleaning up..."; pm2 stop all; exit 1' INT

# Run main function
main "$@"
