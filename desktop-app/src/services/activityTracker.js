const { uIOhook, UiohookKey } = require('uiohook-napi');
const activeWin = require('active-win');

class ActivityTracker {
  constructor(apiService, store) {
    this.apiService = apiService;
    this.store = store;
    this.isTracking = false;
    this.status = 'active';
    
    // Activity counters (reset every snapshot interval)
    this.mouseMovements = 0;
    this.keystrokes = 0;
    this.clicks = 0;
    this.scrollEvents = 0;
    
    // Session tracking
    this.sessionStartTime = null;
    this.lastActivityTime = Date.now();
    this.idleThreshold = 5 * 60 * 1000; // 5 minutes
    this.snapshotInterval = 30 * 1000; // 30 seconds
    
    // Summary for the day
    this.summary = {
      totalActiveTime: 0,
      totalIdleTime: 0,
      totalSystemTime: 0,
      firstActivity: null,
      lastActivity: null,
      totalMouseMovements: 0,
      totalKeystrokes: 0,
      totalClicks: 0,
    };
    
    this.snapshotTimer = null;
    this.activeWindow = null;
  }

  async start() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.sessionStartTime = new Date();
    this.summary.firstActivity = new Date();
    
    // Set up input hooks
    this.setupInputHooks();
    
    // Start snapshot timer
    this.startSnapshotTimer();
    
    // Track active window periodically
    this.startWindowTracker();
    
    // Notify backend of session start
    await this.apiService.recordActivity({
      sessionStart: this.sessionStartTime.toISOString(),
      deviceInfo: this.getDeviceInfo(),
    });
    
    console.log('Activity tracking started');
  }

  async stop() {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    
    // Stop hooks
    try {
      uIOhook.stop();
    } catch (e) {
      console.error('Error stopping hooks:', e);
    }
    
    // Clear timers
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
    }
    if (this.windowTracker) {
      clearInterval(this.windowTracker);
    }
    
    // Send final snapshot and session end
    await this.sendSnapshot();
    await this.apiService.recordActivity({
      sessionEnd: new Date().toISOString(),
    });
    
    console.log('Activity tracking stopped');
  }

  setupInputHooks() {
    uIOhook.on('mousemove', () => {
      this.mouseMovements++;
      this.recordActivity();
    });

    uIOhook.on('click', () => {
      this.clicks++;
      this.recordActivity();
    });

    uIOhook.on('keydown', () => {
      this.keystrokes++;
      this.recordActivity();
    });

    uIOhook.on('wheel', () => {
      this.scrollEvents++;
      this.recordActivity();
    });

    try {
      uIOhook.start();
    } catch (e) {
      console.error('Error starting input hooks:', e);
    }
  }

  recordActivity() {
    this.lastActivityTime = Date.now();
    this.summary.lastActivity = new Date();
  }

  startSnapshotTimer() {
    this.snapshotTimer = setInterval(async () => {
      await this.sendSnapshot();
    }, this.snapshotInterval);
  }

  startWindowTracker() {
    this.windowTracker = setInterval(async () => {
      try {
        const win = await activeWin();
        if (win) {
          this.activeWindow = {
            title: win.title,
            app: win.owner?.name || 'Unknown',
            url: win.url || null,
          };
        }
      } catch (e) {
        // Ignore errors
      }
    }, 5000);
  }

  async sendSnapshot() {
    if (!this.isTracking || this.status === 'dnd') return;
    
    const now = Date.now();
    const idleTime = now - this.lastActivityTime;
    const isActive = idleTime < this.idleThreshold && this.status !== 'away';
    
    // Update summary
    const intervalMinutes = this.snapshotInterval / 60000;
    if (isActive) {
      this.summary.totalActiveTime += intervalMinutes;
    } else {
      this.summary.totalIdleTime += intervalMinutes;
    }
    this.summary.totalSystemTime += intervalMinutes;
    this.summary.totalMouseMovements += this.mouseMovements;
    this.summary.totalKeystrokes += this.keystrokes;
    this.summary.totalClicks += this.clicks;
    
    const snapshot = {
      timestamp: new Date().toISOString(),
      isActive,
      mouseMovements: this.mouseMovements,
      keystrokes: this.keystrokes,
      clicks: this.clicks,
      scrollEvents: this.scrollEvents,
      activeWindow: this.activeWindow,
      idleTime: Math.floor(idleTime / 1000),
    };
    
    // Reset counters
    this.mouseMovements = 0;
    this.keystrokes = 0;
    this.clicks = 0;
    this.scrollEvents = 0;
    
    try {
      await this.apiService.recordActivity({ snapshot });
    } catch (e) {
      console.error('Error sending snapshot:', e);
      // Store offline for later sync
      this.storeOfflineSnapshot(snapshot);
    }
  }

  storeOfflineSnapshot(snapshot) {
    const offlineSnapshots = this.store.get('offlineSnapshots', []);
    offlineSnapshots.push(snapshot);
    // Keep max 1000 offline snapshots
    if (offlineSnapshots.length > 1000) {
      offlineSnapshots.shift();
    }
    this.store.set('offlineSnapshots', offlineSnapshots);
  }

  setStatus(status) {
    this.status = status;
    if (status === 'away') {
      this.lastActivityTime = 0; // Force idle
    }
  }

  getSummary() {
    const now = Date.now();
    const idleTime = now - this.lastActivityTime;
    
    return {
      ...this.summary,
      isCurrentlyActive: idleTime < this.idleThreshold && this.status !== 'away',
      currentIdleTime: Math.floor(idleTime / 1000),
      sessionDuration: this.sessionStartTime 
        ? Math.floor((now - this.sessionStartTime.getTime()) / 60000)
        : 0,
      productivityScore: this.summary.totalSystemTime > 0
        ? Math.round((this.summary.totalActiveTime / this.summary.totalSystemTime) * 100)
        : 0,
    };
  }

  getDeviceInfo() {
    const os = require('os');
    return {
      hostname: os.hostname(),
      platform: process.platform === 'darwin' ? 'macos' : process.platform,
      osVersion: os.release(),
      deviceId: this.store.get('deviceId') || this.generateDeviceId(),
    };
  }

  generateDeviceId() {
    const os = require('os');
    const crypto = require('crypto');
    const machineId = `${os.hostname()}-${os.platform()}-${os.arch()}`;
    const deviceId = crypto.createHash('md5').update(machineId).digest('hex');
    this.store.set('deviceId', deviceId);
    return deviceId;
  }
}

module.exports = ActivityTracker;
