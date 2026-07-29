module.exports = {
  // Production uses one backend API from attendance-mobile/Backend.
  // Mobile, web, desktop, and landing clients must target this service.
  apps: [
    {
      name: 'qhr-backend',
      script: './src/server.js',
      cwd: './attendance-mobile/Backend',
      // JSON persistence is process-local. Keep one backend instance until the database migration is complete.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.BACKEND_MAX_MEMORY || '1G',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5001,
        QHR_DATA_FILE: process.env.QHR_DATA_FILE || './data/db.json',
        TRUST_PROXY: process.env.TRUST_PROXY || 'true',
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
        MAX_JSON_BODY: process.env.MAX_JSON_BODY || '10mb',
        ACCESS_TOKEN_TTL_MS: process.env.ACCESS_TOKEN_TTL_MS || 86400000,
        REFRESH_TOKEN_TTL_MS: process.env.REFRESH_TOKEN_TTL_MS || 2592000000,
        RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || 900000,
        RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || 300,
        AUTH_RATE_LIMIT_WINDOW_MS: process.env.AUTH_RATE_LIMIT_WINDOW_MS || 900000,
        AUTH_RATE_LIMIT_MAX_ATTEMPTS: process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || 10
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'qhr-admin-panel',
      script: 'npm',
      args: 'start',
      cwd: './admin-panel',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.ADMIN_MAX_MEMORY || '512M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.ADMIN_PORT || 3003,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      },
      error_file: './logs/admin-panel-error.log',
      out_file: './logs/admin-panel-out.log',
      log_file: './logs/admin-panel-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'qhr-landing-page',
      script: 'npm',
      args: 'start',
      cwd: './landing-page',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.LANDING_MAX_MEMORY || '512M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.LANDING_PORT || 3002,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
      },
      error_file: './logs/landing-page-error.log',
      out_file: './logs/landing-page-out.log',
      log_file: './logs/landing-page-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
