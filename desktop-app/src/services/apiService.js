const fetch = require('node-fetch');

const DEFAULT_BASE_URL = 'http://localhost:5001/api/v1';

class ApiService {
  constructor(baseUrl, token = null, options = {}) {
    this.baseUrl = ApiService.normalizeBaseUrl(baseUrl);
    this.token = token;
    this.refreshTokenValue = options.refreshToken || null;
    this.onTokenRefresh = options.onTokenRefresh || null;
  }

  static normalizeBaseUrl(baseUrl) {
    let trimmedUrl = String(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');

    if (!trimmedUrl) {
      return DEFAULT_BASE_URL;
    }

    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(trimmedUrl)) {
      trimmedUrl = `http://${trimmedUrl}`;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch (error) {
      throw new Error('Server URL must be a valid HTTP or HTTPS URL');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Server URL must use HTTP or HTTPS');
    }

    if (/\/api(\/v\d+)?$/i.test(parsedUrl.pathname)) {
      return parsedUrl.toString().replace(/\/+$/, '');
    }

    parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/+$/, '')}/api/v1`;
    return parsedUrl.toString().replace(/\/+$/, '');
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}, retry = true) {
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

      const data = await this.parseResponse(response);

      if (!response.ok) {
        if (
          response.status === 401 &&
          retry &&
          this.refreshTokenValue &&
          endpoint !== '/auth/refresh-token'
        ) {
          await this.refreshToken(this.refreshTokenValue);
          return this.request(endpoint, options, false);
        }

        throw new Error(data.message || `HTTP error ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error.message);
      throw error;
    }
  }

  async parseResponse(response) {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return {
        message: response.ok ? undefined : `Unexpected response from server (${response.status})`,
        raw: text,
      };
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

  async updateAppUsage(topApps, topCategories) {
    return this.request('/desktop-activity/apps', {
      method: 'PUT',
      body: JSON.stringify({ topApps, topCategories }),
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
      this.refreshTokenValue = response.data.refreshToken;
      if (this.onTokenRefresh) {
        this.onTokenRefresh(response.data);
      }
    }
    
    return response.data;
  }
}

module.exports = ApiService;
