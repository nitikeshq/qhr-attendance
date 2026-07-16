# QHR PM2 Guide

PM2 runs one backend plus the two production web applications. Mobile and desktop are client applications and should be built or launched separately.

## Services

| Service | PM2 name | Port | Working directory |
|---|---|---:|---|
| Backend API | `qhr-backend` | 5001 | `attendance-mobile/Backend` |
| Landing page | `qhr-landing-page` | 3002 | `landing-page` |
| Admin portal | `qhr-admin-panel` | 3003 | `admin-panel` |

## Development

Install PM2 once, install each application's dependencies, and start the development ecosystem:

```bash
npm install -g pm2
cd attendance-mobile/Backend && npm install && cd ../..
cd admin-panel && npm install && cd ..
cd landing-page && npm install && cd ..
pm2 start ecosystem.config.js
pm2 save
```

The included `start-pm2.sh` performs these steps on macOS/Linux. It does not require MongoDB or Redis; the recovered local backend persists to `attendance-mobile/Backend/data/dev-db.json`.

## Production-Like Run

Build both web apps before starting the production ecosystem:

```bash
cd admin-panel && npm run build && cd ..
cd landing-page && npm run build && cd ..
pm2 start ecosystem.production.config.js
pm2 save
```

Set `NEXT_PUBLIC_API_URL` before building the web apps when the API is not on `http://localhost:5001`. Public Next.js environment values are embedded at build time.

## Operations

```bash
pm2 status
pm2 logs
pm2 restart qhr-backend qhr-admin-panel qhr-landing-page
pm2 stop qhr-backend qhr-admin-panel qhr-landing-page
pm2 delete qhr-backend qhr-admin-panel qhr-landing-page
```

Use `stop-pm2.sh` to stop and remove all QHR processes. See [CURRENT_IMPLEMENTATION.md](CURRENT_IMPLEMENTATION.md) for validation results and production integration requirements.
