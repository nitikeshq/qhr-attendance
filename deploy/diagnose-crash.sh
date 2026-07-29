#!/usr/bin/env bash
# Collects the signals needed to diagnose a page that fails to load.
set -uo pipefail

echo "=== route status ==="
for path in / /qhr /qhr/admin /qhr/app/ /qhr/register /qhr/demo /qhr/contact /qhr/health /qhr/api/v1; do
  printf '%-18s %s\n' "$path" "$(curl -s -o /dev/null -w '%{http_code}' -L "http://127.0.0.1${path}")"
done

echo
echo "=== admin html sanity ==="
html=$(curl -sL http://127.0.0.1/qhr/admin)
printf 'bytes: %s\n' "${#html}"
printf '%s' "$html" | grep -o '<title>[^<]*</title>' || echo '(no title)'
if printf '%s' "$html" | grep -qi 'application error\|could not load\|internal server error'; then
  echo 'ERROR TEXT PRESENT IN HTML'
fi

echo
echo "=== pm2 process states ==="
pm2 jlist 2>/dev/null | tr ',' '\n' | grep -E '"name"|"status"|"restart_time"' | paste - - - 2>/dev/null | head -20

echo
echo "=== qhr-admin stderr (last 40) ==="
pm2 logs qhr-admin --err --lines 40 --nostream 2>/dev/null | tail -40

echo
echo "=== qhr-backend stderr (last 40) ==="
pm2 logs qhr-backend --err --lines 40 --nostream 2>/dev/null | tail -40

echo
echo "=== qhr-landing stderr (last 20) ==="
pm2 logs qhr-landing --err --lines 20 --nostream 2>/dev/null | tail -20

echo
echo "=== nginx errors (last 20) ==="
sudo tail -n 20 /var/log/nginx/error.log 2>/dev/null || echo '(no access)'
