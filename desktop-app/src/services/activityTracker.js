const { uIOhook } = require('uiohook-napi');
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
    this.windowTracker = null;
    this.activeWindow = null;
    this.isFlushingOfflineSnapshots = false;
    this.appUsage = {};
    this.categoryUsage = {};
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
    
    try {
      await this.apiService.recordActivity({
        sessionStart: this.sessionStartTime.toISOString(),
        deviceInfo: this.getDeviceInfo(),
      });
    } catch (e) {
      console.error('Error recording session start:', e.message);
    }
    
    console.log('Activity tracking started');
  }

  async stop() {
    if (!this.isTracking) return;
    
    // Stop hooks
    try {
      uIOhook.stop();
      uIOhook.removeAllListeners();
    } catch (e) {
      console.error('Error stopping hooks:', e);
    }
    
    // Clear timers
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
    }
    if (this.windowTracker) {
      clearInterval(this.windowTracker);
      this.windowTracker = null;
    }
    
    // Send final snapshot and session end
    await this.sendSnapshot({ force: true });

    try {
      await this.apiService.recordActivity({
        sessionEnd: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error recording session end:', e.message);
    }

    this.isTracking = false;
    
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
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
    }

    this.snapshotTimer = setInterval(async () => {
      try {
        await this.sendSnapshot();
      } catch (e) {
        console.error('Snapshot timer failed:', e.message);
      }
    }, this.snapshotInterval);
  }

  startWindowTracker() {
    if (this.windowTracker) {
      clearInterval(this.windowTracker);
    }

    this.windowTracker = setInterval(async () => {
      try {
        const win = await activeWin();
        if (win) {
          this.activeWindow = {
            title: win.title,
            app: win.owner?.name || 'Unknown',
            url: win.url || null,
          };
          this.activeWindow.category = this.classifyWindow(this.activeWindow).category;
          this.activeWindow.isAiTool = this.activeWindow.category === 'ai_work';
        }
      } catch (e) {
        // Ignore errors
      }
    }, 5000);
  }

  async sendSnapshot(options = {}) {
    if ((!this.isTracking && !options.force) || this.status === 'dnd') return;
    
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
      workCategory: this.activeWindow?.category || 'untracked',
      idleTime: Math.floor(idleTime / 1000),
    };

    if (isActive) {
      this.recordAppUsage(snapshot.activeWindow, this.snapshotInterval / 60000);
    }
    
    // Reset counters
    this.mouseMovements = 0;
    this.keystrokes = 0;
    this.clicks = 0;
    this.scrollEvents = 0;
    
    try {
      await this.apiService.recordActivity({ snapshot });
      await this.apiService.updateAppUsage(this.getTopApps(), this.getCategoryBreakdown());
      await this.flushOfflineSnapshots();
    } catch (e) {
      console.error('Error sending snapshot:', e.message);
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

  async flushOfflineSnapshots() {
    if (this.isFlushingOfflineSnapshots) return;

    const offlineSnapshots = this.store.get('offlineSnapshots', []);
    if (!offlineSnapshots.length) return;

    this.isFlushingOfflineSnapshots = true;
    const remainingSnapshots = [...offlineSnapshots];
    const batch = remainingSnapshots.splice(0, 25);

    try {
      for (let index = 0; index < batch.length; index++) {
        try {
          await this.apiService.recordActivity({ snapshot: batch[index] });
        } catch (e) {
          this.store.set('offlineSnapshots', [...batch.slice(index), ...remainingSnapshots]);
          throw e;
        }
      }

      this.store.set('offlineSnapshots', remainingSnapshots);
    } catch (e) {
      console.error('Error flushing offline snapshots:', e.message);
    } finally {
      this.isFlushingOfflineSnapshots = false;
    }
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
      currentWindow: this.activeWindow,
      topApps: this.getTopApps(),
      categoryBreakdown: this.getCategoryBreakdown(),
      aiWorkMinutes: this.categoryUsage.ai_work || 0,
      normalWorkMinutes: Math.max((this.summary.totalActiveTime || 0) - (this.categoryUsage.ai_work || 0), 0),
    };
  }

  classifyWindow(activeWindow) {
    const app = String(activeWindow?.app || '').toLowerCase();
    const title = String(activeWindow?.title || '').toLowerCase();
    const url = String(activeWindow?.url || '').toLowerCase();
    const text = `${app} ${title} ${url}`;

    const aiPatterns = [
      'chatgpt', 'openai', 'claude', 'anthropic', 'gemini', 'bard',
      'copilot', 'cursor', 'perplexity', 'poe.com', 'midjourney',
      'windsurf', 'bolt.new', 'v0.dev', 'lovable',
    ];
    if (aiPatterns.some(pattern => text.includes(pattern))) {
      return { category: 'ai_work' };
    }

    const productivePatterns = [
      'code', 'visual studio', 'xcode', 'terminal', 'iterm', 'github',
      'gitlab', 'jira', 'linear', 'notion', 'slack', 'figma', 'postman',
      'chrome', 'safari', 'firefox', 'edge', 'excel', 'word', 'sheets',
    ];
    if (productivePatterns.some(pattern => text.includes(pattern))) {
      return { category: 'productive' };
    }

    const distractingPatterns = [
      'youtube', 'netflix', 'instagram', 'facebook', 'twitter', 'x.com',
      'reddit', 'spotify', 'prime video', 'hotstar',
    ];
    if (distractingPatterns.some(pattern => text.includes(pattern))) {
      return { category: 'distracting' };
    }

    return { category: activeWindow?.app ? 'neutral' : 'untracked' };
  }

  recordAppUsage(activeWindow, durationMinutes) {
    const classification = this.classifyWindow(activeWindow);
    const category = classification.category;
    const appName = activeWindow?.app || 'Unknown';

    this.categoryUsage[category] = (this.categoryUsage[category] || 0) + durationMinutes;
    this.appUsage[appName] = this.appUsage[appName] || {
      name: appName,
      duration: 0,
      category,
      windowTitles: {},
    };
    this.appUsage[appName].duration += durationMinutes;
    this.appUsage[appName].category = category;

    const title = activeWindow?.title;
    if (title) {
      this.appUsage[appName].windowTitles[title] = (this.appUsage[appName].windowTitles[title] || 0) + durationMinutes;
    }
  }

  getTopApps() {
    const total = Object.values(this.appUsage).reduce((sum, item) => sum + item.duration, 0);
    return Object.values(this.appUsage)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 8)
      .map(item => ({
        name: item.name,
        duration: Math.round(item.duration * 10) / 10,
        percentage: total > 0 ? Math.round((item.duration / total) * 100) : 0,
        category: item.category,
      }));
  }

  getCategoryBreakdown() {
    const total = Object.values(this.categoryUsage).reduce((sum, duration) => sum + duration, 0);
    return Object.entries(this.categoryUsage)
      .sort((a, b) => b[1] - a[1])
      .map(([category, duration]) => ({
        category,
        duration: Math.round(duration * 10) / 10,
        percentage: total > 0 ? Math.round((duration / total) * 100) : 0,
      }));
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
