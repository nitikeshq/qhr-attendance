// PM2 configuration for the QHR EC2 deployment.
// Every process name is prefixed with `qhr-` so it never collides with other
// applications that may later share this server.
const root = '/home/ubuntu/apps/qhr-attendance';
// This project is mounted under a path prefix on a shared host, so the API base is
// relative. That keeps it working on the IP, the EC2 DNS name, or a future domain.
const basePath = process.env.QHR_BASE_PATH || '/qhr';
const apiUrl = `${basePath}/api/v1`;

module.exports = {
  apps: [
    {
      name: 'qhr-backend',
      cwd: `${root}/attendance-mobile/Backend`,
      script: 'src/server.js',
      // JSON persistence is process-local: keep a single instance until the
      // database migration lands.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        HOST: '127.0.0.1',
      },
      error_file: `${root}/logs/backend.err.log`,
      out_file: `${root}/logs/backend.out.log`,
      time: true,
    },
    {
      name: 'qhr-admin',
      cwd: `${root}/admin-panel`,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3003 -H 127.0.0.1',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_BASE_PATH: `${basePath}/admin`,
        NEXT_PUBLIC_API_URL: apiUrl,
      },
      error_file: `${root}/logs/admin.err.log`,
      out_file: `${root}/logs/admin.out.log`,
      time: true,
    },
    {
      name: 'qhr-landing',
      cwd: `${root}/landing-page`,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002 -H 127.0.0.1',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_BASE_PATH: basePath,
        NEXT_PUBLIC_API_URL: apiUrl,
        NEXT_PUBLIC_ADMIN_URL: `${basePath}/admin`,
      },
      error_file: `${root}/logs/landing.err.log`,
      out_file: `${root}/logs/landing.out.log`,
      time: true,
    },
  ],
};
