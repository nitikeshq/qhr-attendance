#!/usr/bin/env bash
# Rebuilds the front ends with a RELATIVE API base so the deployment works on the
# public IP, the EC2 DNS name, and any domain added later - with no rebuild needed.
set -eu
ROOT=/home/ubuntu/apps/qhr-attendance
export NEXT_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1 CI=1

# Same-origin API path served by nginx.
API=/api/v1

echo '=== backend allowed origins (IP + DNS) ==='
cd "$ROOT/attendance-mobile/Backend"
python3 - <<'PY'
from pathlib import Path
env = Path('.env')
origins = 'http://3.78.219.190,http://ec2-3-78-219-190.eu-central-1.compute.amazonaws.com'
lines = []
for line in env.read_text().splitlines():
    if line.startswith('ALLOWED_ORIGINS='):
        line = 'ALLOWED_ORIGINS=' + origins
    lines.append(line)
env.write_text('\n'.join(lines) + '\n')
print('ALLOWED_ORIGINS=' + origins)
PY

echo '=== admin panel ==='
cd "$ROOT/admin-panel"
NEXT_PUBLIC_API_URL="$API" NEXT_PUBLIC_BASE_PATH=/admin npm run build 2>&1 | tail -3

echo '=== landing page ==='
cd "$ROOT/landing-page"
NEXT_PUBLIC_API_URL="$API" NEXT_PUBLIC_ADMIN_URL=/admin npm run build 2>&1 | tail -3

echo '=== employee web portal ==='
cd "$ROOT/attendance-mobile"
EXPO_PUBLIC_API_URL="$API" EXPO_BASE_URL=/app npx expo export --platform web 2>&1 | tail -4
chmod -R o+rX dist

echo '=== restart ==='
cd "$ROOT"
pm2 restart qhr-backend qhr-admin qhr-landing --update-env >/dev/null
pm2 save >/dev/null
sleep 5
pm2 list --no-color | grep -E 'qhr-' || true
echo DONE
