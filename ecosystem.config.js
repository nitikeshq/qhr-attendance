module.exports = {
  apps: [
    {
      name: 'qhr-backend',
      script: './src/server.js',
      cwd: './attendance-mobile/Backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5001,
        MONGODB_URI: 'mongodb://localhost:27017/attendance',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'your-jwt-secret-key-change-in-production',
        JWT_EXPIRES_IN: '7d',
        JWT_REFRESH_SECRET: 'your-refresh-secret-key-change-in-production',
        JWT_REFRESH_EXPIRES_IN: '30d',
        RATE_LIMIT_WINDOW_MS: 900000,
        RATE_LIMIT_MAX_REQUESTS: 100,
        GPS_UPDATE_INTERVAL_MS: 30000,
        GEOFENCE_DEFAULT_RADIUS_METERS: 500,
        LOG_LEVEL: 'info',
        ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:3001,exp://192.168.29.69:8081,exp://192.168.29.69:8082',
        MAX_FILE_SIZE_MB: 10,
        UPLOAD_PATH: './uploads'
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
      args: 'run dev',
      cwd: './attendance-mobile/Backend/admin-panel',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        NEXT_PUBLIC_API_URL: 'http://localhost:5001/api'
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
      args: 'run dev',
      cwd: './attendance-mobile/Backend/landing-page',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'http://localhost:5001/api'
      },
      error_file: './logs/landing-page-error.log',
      out_file: './logs/landing-page-out.log',
      log_file: './logs/landing-page-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'qhr-mobile-app',
      script: 'npx',
      args: 'expo start --web --port 8082',
      cwd: './attendance-mobile',
      instances: 1,
      autorestart: false, // Expo doesn't handle restarts well
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        EXPO_DEVTOOLS_LISTEN_ADDRESS: '0.0.0.0',
        EXPO_WEB_PORT: 8082
      },
      error_file: './logs/mobile-app-error.log',
      out_file: './logs/mobile-app-out.log',
      log_file: './logs/mobile-app-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/attendance.git',
      path: '/var/www/attendance',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'StrictHostKeyChecking=no'
    }
  }
};
