const { electronAPI } = window;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const consentModal = document.getElementById('consent-modal');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

// Window controls
document.getElementById('minimize-btn').addEventListener('click', () => {
  electronAPI.minimizeWindow();
});

document.getElementById('close-btn').addEventListener('click', () => {
  electronAPI.closeWindow();
});

// Consent handlers
let pendingEmployee = null;

document.getElementById('consent-accept')?.addEventListener('click', async () => {
  try {
    await electronAPI.setStore('monitoringConsent', { 
      accepted: true,
      policyVersion: 'desktop-monitoring-v1',
      timestamp: new Date().toISOString() 
    });
    consentModal.classList.add('hidden');
    if (pendingEmployee) {
      showDashboard(pendingEmployee);
      startActivityUpdates();
      pendingEmployee = null;
    }
  } catch (error) {
    loginError.textContent = error.message || 'Unable to record monitoring consent';
    showLogin();
    consentModal.classList.add('hidden');
  }
});

document.getElementById('consent-decline')?.addEventListener('click', async () => {
  consentModal.classList.add('hidden');
  await electronAPI.logout();
  showLogin();
  loginError.textContent = 'You must accept monitoring to use this app during work hours';
  pendingEmployee = null;
});

// Check if already logged in
async function init() {
  const session = await electronAPI.getStore('session');
  const consent = await electronAPI.getStore('monitoringConsent');
  
  if (session?.token) {
    if (consent?.accepted) {
      showDashboard(session.employee);
      startActivityUpdates();
    } else {
      // Show consent modal
      pendingEmployee = session.employee;
      loginScreen.classList.add('hidden');
      dashboardScreen.classList.add('hidden');
      consentModal.classList.remove('hidden');
    }
  } else {
    showLogin();
  }
  
  // Load saved API URL
  const savedApiUrl = await electronAPI.getStore('apiUrl');
  if (savedApiUrl) {
    document.getElementById('api-url').value = savedApiUrl;
  }
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  dashboardScreen.classList.add('hidden');
}

function showDashboard(employee) {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
  
  // Update user info
  const name = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'User';
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-role').textContent = employee.designation || employee.role || 'Employee';
  document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
}

// Login handler
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  
  const apiUrl = document.getElementById('api-url').value.trim();
  const companyCode = document.getElementById('company-code').value.trim().toUpperCase();
  const employeeId = document.getElementById('employee-id').value.trim().toUpperCase();
  const passcode = document.getElementById('passcode').value;
  
  if (!apiUrl || !companyCode || !employeeId || !passcode) {
    loginError.textContent = 'Please fill in all fields';
    return;
  }
  
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';
  
  try {
    const result = await electronAPI.login({
      apiUrl,
      companyCode,
      employeeId,
      passcode,
    });
    
    if (result.success) {
      if (result.apiUrl) {
        document.getElementById('api-url').value = result.apiUrl;
      }

      // Check if consent was previously given
      const consent = await electronAPI.getStore('monitoringConsent');
      if (consent?.accepted) {
        showDashboard(result.employee);
        startActivityUpdates();
      } else {
        // Show consent modal for first-time users
        pendingEmployee = result.employee;
        loginScreen.classList.add('hidden');
        consentModal.classList.remove('hidden');
      }
    } else {
      loginError.textContent = result.error || 'Login failed';
    }
  } catch (error) {
    loginError.textContent = error.message || 'Connection failed';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
  await electronAPI.logout();
  showLogin();
  document.getElementById('passcode').value = '';
});

// Activity updates
let updateInterval;

function startActivityUpdates() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }

  updateActivity();
  updateInterval = setInterval(updateActivity, 5000);
}

async function updateActivity() {
  const summary = await electronAPI.getActivitySummary().catch(() => null);
  if (!summary) return;
  
  // Update stats
  document.getElementById('active-time').textContent = formatTime(summary.totalActiveTime);
  document.getElementById('idle-time').textContent = formatTime(summary.totalIdleTime);
  document.getElementById('productivity-score').textContent = `${summary.productivityScore}%`;
  document.getElementById('session-time').textContent = formatTime(summary.sessionDuration);
  
  // Update activity counts
  document.getElementById('mouse-count').textContent = formatNumber(summary.totalMouseMovements);
  document.getElementById('keystroke-count').textContent = formatNumber(summary.totalKeystrokes);
  document.getElementById('click-count').textContent = formatNumber(summary.totalClicks);
  document.getElementById('ai-work-time').textContent = formatTime(summary.aiWorkMinutes);
  document.getElementById('normal-work-time').textContent = formatTime(summary.normalWorkMinutes);
  document.getElementById('current-app').textContent = summary.currentWindow?.app || '-';
  renderAppUsage(summary.topApps || []);
  
  // Update status
  const statusBadge = document.getElementById('current-status-badge');
  const statusText = document.getElementById('status-text');
  const statusIndicator = document.getElementById('status-indicator');
  
  if (summary.isCurrentlyActive) {
    statusBadge.classList.remove('idle');
    statusText.textContent = 'Tracking Active';
    statusIndicator.classList.add('active');
    statusIndicator.classList.remove('idle');
  } else {
    statusBadge.classList.add('idle');
    statusText.textContent = `Idle for ${formatTime(summary.currentIdleTime / 60)}`;
    statusIndicator.classList.remove('active');
    statusIndicator.classList.add('idle');
  }
}

function renderAppUsage(topApps) {
  const list = document.getElementById('app-usage-list');
  if (!list) return;

  if (!topApps.length) {
    list.innerHTML = '<div class="empty-usage">No app usage yet</div>';
    return;
  }

  list.innerHTML = topApps.map((app) => `
    <div class="usage-row">
      <div class="usage-main">
        <span class="usage-name">${escapeHtml(app.name)}</span>
        <span class="usage-category">${formatCategory(app.category)}</span>
      </div>
      <div class="usage-meta">
        <span>${formatTime(app.duration)}</span>
        <span>${app.percentage || 0}%</span>
      </div>
      <div class="usage-bar"><span style="width: ${Math.min(app.percentage || 0, 100)}%"></span></div>
    </div>
  `).join('');
}

function formatCategory(category) {
  if (category === 'ai_work') return 'AI';
  if (category === 'productive') return 'Work';
  if (category === 'distracting') return 'Distracting';
  if (category === 'neutral') return 'Neutral';
  return 'Untracked';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(minutes) {
  if (!minutes || minutes < 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Listen for activity updates from main process
electronAPI.onActivityUpdate((data) => {
  // Handle real-time updates if needed
});

// Initialize
init();
