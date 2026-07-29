#!/usr/bin/env bash
set -u
echo '=== direct upstream checks (bypassing nginx) ==='
for u in "http://127.0.0.1:3002/qhr" "http://127.0.0.1:3002/qhr/" \
         "http://127.0.0.1:3003/qhr/admin" "http://127.0.0.1:3003/qhr/admin/" \
         "http://127.0.0.1:3003/admin" "http://127.0.0.1:3003/"; do
  printf '%-40s %s %s\n' "$u" \
    "$(curl -s -o /dev/null -w '%{http_code}' "$u")" \
    "$(curl -s -o /dev/null -w '%{redirect_url}' "$u")"
done

echo
echo '=== admin runtime env ==='
pm2 env 1 2>/dev/null | grep -E 'NEXT_PUBLIC_BASE_PATH|NEXT_PUBLIC_API_URL' || echo 'none'

echo
echo '=== landing runtime env ==='
pm2 env 2 2>/dev/null | grep -E 'NEXT_PUBLIC_BASE_PATH|NEXT_PUBLIC_API_URL' || echo 'none'

echo
echo '=== admin log tail ==='
tail -5 /home/ubuntu/apps/qhr-attendance/logs/admin.out.log 2>/dev/null
