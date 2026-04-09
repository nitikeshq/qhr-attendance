# QHR Desktop - Activity Tracker

Desktop application for tracking employee activity on Windows and macOS.

## Features

- **Activity Tracking**: Monitors mouse movements, keystrokes, and clicks
- **Idle Detection**: Detects when user is away from computer
- **Active Window Tracking**: Records which applications are being used
- **Real-time Sync**: Sends activity data to QHR backend
- **System Tray**: Runs minimized in system tray
- **Auto-start**: Optionally starts with system boot

## Installation

### Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev
```

### Building

```bash
# Build for current platform
npm run build

# Build for Windows (EXE)
npm run build:win

# Build for macOS (DMG)
npm run build:mac

# Build for Linux
npm run build:linux
```

## Configuration

On first run, enter:
- **Server URL**: Your QHR backend API URL (e.g., `https://hr.yourcompany.com/api/v1`)
- **Company Code**: Your company code
- **Employee ID**: Your employee ID
- **Passcode**: Your login passcode

## Privacy

This application tracks:
- Keyboard and mouse activity counts (not content)
- Active window titles and application names
- Time spent active vs idle

Data is sent to your company's QHR server and is visible to HR/Admin users.

## Requirements

- Windows 10+ or macOS 10.15+
- Node.js 18+ (for development)
- 100MB disk space
- Internet connection

## Troubleshooting

**App won't start**: Check if another instance is running in system tray.

**Not tracking activity**: Ensure accessibility permissions are granted (macOS).

**Can't connect to server**: Verify the server URL and check your network.
