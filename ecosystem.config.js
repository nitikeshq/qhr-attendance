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
        QHR_DATA_FILE: './data/dev-db.json',
        TRUST_PROXY: 'false',
        ALLOWED_ORIGINS: 'http://localhost:3002,http://localhost:3003,http://localhost:8082,http://127.0.0.1:3002,http://127.0.0.1:3003,http://127.0.0.1:8082',
        MAX_JSON_BODY: '10mb',
        ACCESS_TOKEN_TTL_MS: 86400000,
        REFRESH_TOKEN_TTL_MS: 2592000000,
        RATE_LIMIT_WINDOW_MS: 900000,
        RATE_LIMIT_MAX_REQUESTS: 300,
        AUTH_RATE_LIMIT_WINDOW_MS: 900000,
        AUTH_RATE_LIMIT_MAX_ATTEMPTS: 10
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
      cwd: './admin-panel',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3003,
        NEXT_PUBLIC_API_URL: 'http://localhost:5001'
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
      cwd: './landing-page',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
        NEXT_PUBLIC_API_URL: 'http://localhost:5001'
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
