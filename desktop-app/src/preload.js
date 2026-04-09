const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Store access
  getStore: (key) => ipcRenderer.invoke('get-store', key),
  setStore: (key, value) => ipcRenderer.invoke('set-store', key, value),
  
  // Auth
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  
  // Activity
  getActivitySummary: () => ipcRenderer.invoke('get-activity-summary'),
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Events
  onActivityUpdate: (callback) => {
    ipcRenderer.on('activity-update', (event, data) => callback(data));
  },
  onStatusChange: (callback) => {
    ipcRenderer.on('status-change', (event, status) => callback(status));
  },
});
