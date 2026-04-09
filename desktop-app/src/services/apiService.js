const fetch = require('node-fetch');

class ApiService {
  constructor(baseUrl, token = null) {
    this.baseUrl = baseUrl || 'http://localhost:3001/api/v1';
    this.token = token;
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        timeout: 30000,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error.message);
      throw error;
    }
  }

  async login(companyCode, employeeId, passcode) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ companyCode, employeeId, passcode }),
    });
    
    if (response.data) {
      this.token = response.data.accessToken;
    }
    
    return response.data;
  }

  async recordActivity(data) {
    return this.request('/desktop-activity/record', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendHeartbeat() {
    return this.request('/desktop-activity/heartbeat', {
      method: 'POST',
    });
  }

  async getMyActivity(date) {
    const query = date ? `?date=${date}` : '';
    return this.request(`/desktop-activity/my${query}`);
  }

  async refreshToken(refreshToken) {
    const response = await this.request('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    
    if (response.data) {
      this.token = response.data.accessToken;
    }
    
    return response.data;
  }
}

module.exports = ApiService;
