const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, safeStorage } = require('electron');
const path = require('path');
const Store = require('electron-store');
const AutoLaunch = require('auto-launch');
const ActivityTracker = require('./services/activityTracker');
const ApiService = require('./services/apiService');

const store = new Store();
const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;
let tray = null;
let activityTracker = null;
let apiService = null;
let isQuitting = false;
let heartbeatTimer = null;
let shutdownInProgress = false;

const autoLauncher = new AutoLaunch({
  name: 'QHR Desktop',
  isHidden: true,
});

function canUseSafeStorage() {
  return Boolean(safeStorage?.isEncryptionAvailable?.());
}

function setSession(session) {
  if (canUseSafeStorage()) {
    const encrypted = safeStorage.encryptString(JSON.stringify(session)).toString('base64');
    store.set('sessionEncrypted', encrypted);
    store.delete('session');
    store.delete('sessionStorageWarning');
    return;
  }

  store.set('session', session);
  store.set('sessionStorageWarning', {
    message: 'OS secure storage is unavailable; session is stored with reduced protection.',
    timestamp: new Date().toISOString(),
  });
}

function getSession() {
  const encrypted = store.get('sessionEncrypted');
  if (encrypted && canUseSafeStorage()) {
    try {
      return JSON.parse(safeStorage.decryptString(Buffer.from(encrypted, 'base64')));
    } catch (error) {
      console.error('Failed to decrypt stored session:', error.message);
      store.delete('sessionEncrypted');
    }
  }

  const legacySession = store.get('session');
  if (legacySession?.token) {
    setSession(legacySession);
    return legacySession;
  }

  return null;
}

function deleteSession() {
  store.delete('session');
  store.delete('sessionEncrypted');
}

function getDeviceInfo() {
  const os = require('os');
  return {
    hostname: os.hostname(),
    platform: process.platform,
    osVersion: os.release(),
    arch: os.arch(),
  };
}

async function setAutoStart(enabled) {
  try {
    if (enabled) {
      await autoLauncher.enable();
    } else {
      await autoLauncher.disable();
    }
    store.set('autoStart', enabled);
    return true;
  } catch (error) {
    console.error('Failed to update auto-start:', error.message);
    store.set('autoStartError', {
      enabled,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
    return false;
  }
}

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

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (isDev) {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    }
  });

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
      click: async (item) => {
        const enabled = await setAutoStart(item.checked);
        if (!enabled) {
          item.checked = !item.checked;
          tray.setContextMenu(contextMenu);
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
  const session = getSession();
  const consent = store.get('monitoringConsent');
  
  if (!session?.token || !consent?.accepted) {
    await stopServices();
    return;
  }

  if (activityTracker?.isTracking) {
    return;
  }

  apiService = createApiService(session);
  activityTracker = new ActivityTracker(apiService, store);
  activityTracker.setStatus(store.get('status', 'active'));

  await activityTracker.start();

  heartbeatTimer = setInterval(async () => {
    if (apiService) {
      try {
        await apiService.sendHeartbeat();
      } catch (error) {
        console.error('Heartbeat failed:', error.message);
      }
    }
  }, 60000);
}

async function stopServices() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  if (activityTracker) {
    try {
      await activityTracker.stop();
    } catch (error) {
      console.error('Failed to stop activity tracker:', error.message);
    }
  }

  activityTracker = null;
  apiService = null;
}

function createApiService(session) {
  return new ApiService(store.get('apiUrl'), session.token, {
    refreshToken: session.refreshToken,
    onTokenRefresh: ({ accessToken, refreshToken }) => {
      setSession({
        ...getSession(),
        token: accessToken,
        refreshToken,
      });
    },
  });
}

// IPC Handlers
ipcMain.handle('get-store', (event, key) => {
  if (key === 'session') {
    return getSession();
  }
  return store.get(key);
});

ipcMain.handle('set-store', async (event, key, value) => {
  if (key === 'monitoringConsent') {
    const session = getSession();

    if (value?.accepted && !session?.token) {
      throw new Error('Login is required before monitoring consent can be recorded');
    }

    if (session?.token) {
      const api = createApiService(session);
      await api.recordMonitoringConsent({
        accepted: Boolean(value?.accepted),
        acceptedAt: value?.timestamp || new Date().toISOString(),
        policyVersion: value?.policyVersion || 'desktop-monitoring-v1',
        deviceInfo: getDeviceInfo(),
      });
      value = {
        ...value,
        policyVersion: value?.policyVersion || 'desktop-monitoring-v1',
        syncedAt: new Date().toISOString(),
      };
    }
  }

  if (key === 'session') {
    setSession(value);
    return true;
  }

  store.set(key, value);
  if (key === 'monitoringConsent') {
    await initializeServices();
  }
  return true;
});

ipcMain.handle('login', async (event, { apiUrl, companyCode, employeeId, passcode }) => {
  try {
    const tempApi = new ApiService(apiUrl);
    const result = await tempApi.login(companyCode, employeeId, passcode);
    const normalizedApiUrl = tempApi.baseUrl;
    
    store.set('apiUrl', normalizedApiUrl);
    setSession({
      token: result.accessToken,
      refreshToken: result.refreshToken,
      employee: result.employee,
    });

    if (store.get('monitoringConsent')?.accepted) {
      await initializeServices();
    }
    
    return { success: true, employee: result.employee, apiUrl: normalizedApiUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-companies', async (event, { apiUrl } = {}) => {
  const candidates = [];
  if (apiUrl) candidates.push(apiUrl);
  if (store.get('apiUrl')) candidates.push(store.get('apiUrl'));
  candidates.push(undefined);

  let lastError = null;

  for (const candidate of [...new Set(candidates)]) {
    try {
      const api = new ApiService(candidate);
      if (isDev) console.log(`Loading companies from ${api.baseUrl}`);
      const companies = await api.getCompanies();
      store.set('apiUrl', api.baseUrl);
      if (isDev) console.log(`Loaded ${companies.length} companies from ${api.baseUrl}`);
      return {
        success: true,
        companies,
        apiUrl: api.baseUrl,
      };
    } catch (error) {
      if (isDev) console.log(`Company load failed for ${candidate || 'default API'}: ${error.message}`);
      lastError = error;
    }
  }

  return { success: false, error: lastError?.message || 'Unable to load companies' };
});

ipcMain.handle('logout', async () => {
  await stopServices();
  deleteSession();
  return { success: true };
});

ipcMain.handle('get-activity-summary', () => {
  if (activityTracker) {
    return activityTracker.getSummary();
  }
  return null;
});

ipcMain.handle('get-device-info', () => {
  return getDeviceInfo();
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
  await setAutoStart(autoStart);
  
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

app.on('before-quit', (event) => {
  isQuitting = true;
  if (activityTracker && !shutdownInProgress) {
    event.preventDefault();
    shutdownInProgress = true;
    stopServices().finally(() => app.quit());
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
