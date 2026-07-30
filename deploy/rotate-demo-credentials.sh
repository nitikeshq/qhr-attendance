#!/usr/bin/env bash
# Rotates the seeded demo passwords on a running server.
#
# The demo accounts ship with published passwords (admin123, password123) and are
# still valid on any database that was seeded before demo seeding was gated. This
# changes them through the API, so the running process and its in-memory cache
# stay consistent — editing data/db.json by hand would be overwritten.
#
# New passwords are printed once. Capture them before closing the terminal.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/api/v1}"
fail=0

# email:current-password pairs for the seeded accounts.
ACCOUNTS='
admin@qhr.com:admin123
company@example.com:password123
company-admin@qhr.com:password123
hr@testco.com:password123
manager@testco.com:password123
'

generate() {
  # 20 URL-safe characters plus symbols, satisfying the 10+ mixed-case, digit and
  # special-character policy the API enforces.
  local body
  body=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 18)
  printf 'Qh%s#7' "$body"
}

printf '%-28s %-12s %s\n' 'ACCOUNT' 'RESULT' 'NEW PASSWORD'
printf '%.0s-' {1..78}; printf '\n'

for pair in $ACCOUNTS; do
  [ -z "$pair" ] && continue
  email="${pair%%:*}"
  current="${pair##*:}"

  token=$(curl -s -X POST -H 'Content-Type: application/json' \
    -d "{\"email\":\"${email}\",\"password\":\"${current}\"}" \
    "${BASE}/auth/admin-login" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

  if [ -z "$token" ]; then
    printf '%-28s %-12s %s\n' "$email" 'skipped' 'already rotated, or no such account'
    continue
  fi

  fresh=$(generate)
  response=$(curl -s -X POST -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${token}" \
    -d "{\"currentPassword\":\"${current}\",\"newPassword\":\"${fresh}\",\"confirmPassword\":\"${fresh}\"}" \
    "${BASE}/auth/change-password")

  if printf '%s' "$response" | grep -q '"success":true'; then
    printf '%-28s %-12s %s\n' "$email" 'rotated' "$fresh"
  else
    reason=$(printf '%s' "$response" | grep -o '"message":"[^"]*' | cut -d'"' -f4)
    printf '%-28s %-12s %s\n' "$email" 'FAILED' "${reason:-unknown error}"
    fail=1
  fi
done

echo
echo 'Employee passcode 1234 is separate: reset it per employee from the admin console.'
if [ "$fail" -eq 0 ]; then echo 'ROTATION COMPLETE'; else echo 'SOME ACCOUNTS FAILED'; fi
exit "$fail"
