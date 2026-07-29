#!/usr/bin/env bash
# Converts the server to a shared multi-project layout and moves QHR under /qhr.
# Safe to re-run. Only touches the shared host file, this project's route file,
# and this project's own build output.
set -eu
ROOT=/home/ubuntu/apps/qhr-attendance
export NEXT_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1 CI=1

PREFIX=/qhr
API="$PREFIX/api/v1"

echo '=== nginx: shared host + per-project route files ==='
sudo mkdir -p /etc/nginx/projects.d /var/www/shared-host
sudo cp "$ROOT/nginx-shared-host.conf" /etc/nginx/sites-available/00-shared-host
sudo cp "$ROOT/nginx-project-qhr.conf" /etc/nginx/projects.d/qhr-attendance.conf
sudo ln -sfn /etc/nginx/sites-available/00-shared-host /etc/nginx/sites-enabled/00-shared-host
# Retire the single-project site this project previously owned.
sudo rm -f /etc/nginx/sites-enabled/qhr-attendance /etc/nginx/sites-enabled/default

if [ ! -f /var/www/shared-host/index.html ]; then
  sudo tee /var/www/shared-host/index.html >/dev/null <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deployed applications</title>
<style>
body{margin:0;padding:48px 20px;background:#f5f7fa;color:#172033;
font-family:"Segoe UI",system-ui,Arial,sans-serif;line-height:1.5}
main{max-width:640px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}
p{color:#596579;margin:0 0 24px;font-size:15px}
ul{list-style:none;padding:0;margin:0;display:grid;gap:10px}
a{display:block;padding:14px 16px;background:#fff;border:1px solid #d8dee6;
border-radius:8px;text-decoration:none;color:#0f6cbd;font-weight:600}
a:hover{border-color:#0f6cbd}small{display:block;color:#596579;font-weight:400}
</style></head><body><main>
<h1>Deployed applications</h1>
<p>Each application on this host is served from its own path prefix.</p>
<ul>
<li><a href="/qhr/">QHR Attendance &amp; Payroll<small>/qhr &middot; admin at /qhr/admin &middot; employee portal at /qhr/app</small></a></li>
</ul>
</main></body></html>
HTML
fi

echo '=== rebuild front ends under the /qhr prefix ==='
cd "$ROOT/admin-panel"
NEXT_PUBLIC_API_URL="$API" NEXT_PUBLIC_BASE_PATH="$PREFIX/admin" npm run build 2>&1 | tail -3

cd "$ROOT/landing-page"
NEXT_PUBLIC_API_URL="$API" NEXT_PUBLIC_BASE_PATH="$PREFIX" \
  NEXT_PUBLIC_ADMIN_URL="$PREFIX/admin" npm run build 2>&1 | tail -3

cd "$ROOT/attendance-mobile"
EXPO_PUBLIC_API_URL="$API" EXPO_BASE_URL="$PREFIX/app" npx expo export --platform web 2>&1 | tail -3
chmod -R o+rX dist

echo '=== pm2: recreate this project only, so new env is picked up ==='
cd "$ROOT"
# `pm2 restart --update-env` keeps the env captured at first start, so the apps are
# deleted and re-created from the ecosystem file. Only qhr-* processes are touched.
pm2 delete qhr-backend qhr-admin qhr-landing >/dev/null 2>&1 || true
pm2 start ecosystem.server.config.js >/dev/null
pm2 save >/dev/null

echo '=== nginx reload ==='
sudo nginx -t 2>&1 | tail -1
sudo systemctl reload nginx
sleep 5
pm2 list --no-color | grep -E 'qhr-' || true
echo DONE
