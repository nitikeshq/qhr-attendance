# QHR Desktop - Activity Tracker

Desktop application for tracking employee activity on Windows and macOS.

## Features

- **Activity Tracking**: Monitors mouse movements, keystrokes, and clicks
- **Idle Detection**: Detects when user is away from computer
- **Active Window Tracking**: Records which applications are being used
- **App Usage Analytics**: Calculates per-app time, percentage usage, and current app
- **AI Tool Classification**: Separates time spent in known AI tools such as ChatGPT, Claude, Gemini, Copilot, Cursor, and similar tools from normal work time
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

The desktop app resolves the QHR server from `QHR_API_URL`, or from the local development default `http://localhost:5001/api/v1`.

On first run, employees enter:
- **Company**: Select from the active company list loaded from the configured QHR server
- **Employee ID**: Your employee ID
- **Passcode**: Your login passcode

## Privacy

This application tracks:
- Keyboard and mouse activity counts (not content)
- Active window titles and application names
- App usage duration and broad work category, including AI-tool usage
- Time spent active vs idle

The AI/normal split is rule-based from the active app, window title, and browser URL. It measures time spent in AI tools; it does not judge whether the work output was good or bad.

Data is sent to your company's QHR server and is visible to HR/Admin users.

## Requirements

- Windows 10+ or macOS 10.15+
- Node.js 24+ (for development)
- 100MB disk space
- Internet connection

## Troubleshooting

**App won't start**: Check if another instance is running in system tray.

**Not tracking activity**: Ensure accessibility permissions are granted (macOS).

**Can't connect to server**: Ask HR/IT to verify the configured QHR server URL and network access.
