#!/usr/bin/env bash
# Post-deployment smoke check for the QHR server. Read-only.
set -u
ORIGIN="${1:-http://127.0.0.1}"

# Pass the project base, e.g. ./verify.sh http://127.0.0.1/qhr
echo "=== HTTP status via nginx ($ORIGIN) ==="
for path in / /admin /app/ /health /api/v1; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -L "$ORIGIN$path")
  printf '%-14s %s\n' "$path" "$code"
done

echo
echo "=== admin login ==="
token=$(curl -s -X POST "$ORIGIN/api/v1/auth/admin-login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"company@example.com","password":"password123"}' \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -n "$token" ]; then
  echo "admin login: OK"
  echo -n "payroll endpoint: "
  curl -s -o /dev/null -w '%{http_code}\n' "$ORIGIN/api/v1/payroll" -H "Authorization: Bearer $token"
  echo -n "org endpoint:     "
  curl -s -o /dev/null -w '%{http_code}\n' "$ORIGIN/api/v1/org" -H "Authorization: Bearer $token"
  echo -n "assets endpoint:  "
  curl -s -o /dev/null -w '%{http_code}\n' "$ORIGIN/api/v1/assets" -H "Authorization: Bearer $token"
else
  echo "admin login: FAILED"
fi

echo
echo "=== employee login ==="
curl -s -X POST "$ORIGIN/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"companyCode":"TESTCO","employeeId":"EMP001","passcode":"1234"}' \
  | sed -n 's/.*"employeeId":"\([^"]*\)".*/employee login OK: \1/p' | head -1

echo
echo "=== unauthenticated tenant data must be blocked ==="
echo -n "GET /api/v1/holidays -> "
curl -s -o /dev/null -w '%{http_code}\n' "$ORIGIN/api/v1/holidays"

echo
echo "=== pm2 ==="
pm2 list --no-color | grep -E 'qhr-|name' || true
