module.exports = {
  // Production uses one backend API from attendance-mobile/Backend.
  // Mobile, web, desktop, and landing clients must target this service.
  apps: [
    {
      name: 'qhr-backend',
      script: './src/server.js',
      cwd: './attendance-mobile/Backend',
      instances: process.env.WEB_CONCURRENCY || 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.BACKEND_MAX_MEMORY || '1G',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5001,
        MONGODB_URI: process.env.MONGODB_URI,
        REDIS_URL: process.env.REDIS_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
        RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || 900000,
        RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
        GPS_UPDATE_INTERVAL_MS: process.env.GPS_UPDATE_INTERVAL_MS || 30000,
        GEOFENCE_DEFAULT_RADIUS_METERS: process.env.GEOFENCE_DEFAULT_RADIUS_METERS || 500,
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
        MAX_FILE_SIZE_MB: process.env.MAX_FILE_SIZE_MB || 10,
        UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads'
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
