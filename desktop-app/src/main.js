const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron');
const path = require('path');
const Store = require('electron-store');
const AutoLaunch = require('auto-launch');
const ActivityTracker = require('./services/activityTracker');
const ApiService = require('./services/apiService');

const store = new Store();
let mainWindow = null;
let tray = null;
let activityTracker = null;
let apiService = null;
let isQuitting = false;

const autoLauncher = new AutoLaunch({
  name: 'QHR Desktop',
  isHidden: true,
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 350,
    minHeight: 500,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!store.get('minimizeToTray')) {
      mainWindow.show();
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  let trayIcon;
  
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Status',
      submenu: [
        {
          label: 'Active',
          type: 'radio',
          checked: true,
          click: () => setStatus('active'),
        },
        {
          label: 'Away',
          type: 'radio',
          click: () => setStatus('away'),
        },
        {
          label: 'Do Not Disturb',
          type: 'radio',
          click: () => setStatus('dnd'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Start with System',
      type: 'checkbox',
      checked: store.get('autoStart', true),
      click: (item) => {
        store.set('autoStart', item.checked);
        if (item.checked) {
          autoLauncher.enable();
        } else {
          autoLauncher.disable();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('QHR Desktop - Activity Tracker');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function setStatus(status) {
  store.set('status', status);
  if (activityTracker) {
    activityTracker.setStatus(status);
  }
}

async function initializeServices() {
  const session = store.get('session');
  
  if (session?.token) {
    apiService = new ApiService(store.get('apiUrl'), session.token);
    activityTracker = new ActivityTracker(apiService, store);
    
    await activityTracker.start();
    
    // Send heartbeat every minute
    setInterval(async () => {
      if (apiService) {
        await apiService.sendHeartbeat();
      }
    }, 60000);
  }
}

// IPC Handlers
ipcMain.handle('get-store', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-store', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('login', async (event, { apiUrl, companyCode, employeeId, passcode }) => {
  try {
    const tempApi = new ApiService(apiUrl);
    const result = await tempApi.login(companyCode, employeeId, passcode);
    
    store.set('apiUrl', apiUrl);
    store.set('session', {
      token: result.accessToken,
      refreshToken: result.refreshToken,
      employee: result.employee,
    });
    
    await initializeServices();
    
    return { success: true, employee: result.employee };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('logout', async () => {
  if (activityTracker) {
    await activityTracker.stop();
  }
  store.delete('session');
  apiService = null;
  activityTracker = null;
  return { success: true };
});

ipcMain.handle('get-activity-summary', () => {
  if (activityTracker) {
    return activityTracker.getSummary();
  }
  return null;
});

ipcMain.handle('get-device-info', () => {
  const os = require('os');
  return {
    hostname: os.hostname(),
    platform: process.platform,
    osVersion: os.release(),
    arch: os.arch(),
  };
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.hide();
});

// App Events
app.whenReady().then(async () => {
  createWindow();
  createTray();
  
  // Check for auto-start preference
  const autoStart = store.get('autoStart', true);
  if (autoStart) {
    autoLauncher.enable();
  }
  
  // Initialize services if already logged in
  await initializeServices();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  isQuitting = true;
  if (activityTracker) {
    await activityTracker.stop();
  }
});

// Handle second instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
