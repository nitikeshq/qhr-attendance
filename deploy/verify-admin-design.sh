#!/usr/bin/env bash
# Read-only check that the admin console shipped with the enterprise design
# system compiled in, and that no demo credentials are pre-filled on the
# publicly reachable sign-in form.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr}"
fail=0

echo "=== admin console shell (${BASE}/admin) ==="
html=$(curl -sL "${BASE}/admin")
printf 'bytes: %s\n' "${#html}"

for marker in 'neu-sidebar' 'Sign in to QHR' 'One console for attendance' 'nav-brand-name'; do
  if printf '%s' "$html" | grep -q "$marker"; then
    printf 'ok      %s\n' "$marker"
  else
    printf 'MISSING %s\n' "$marker"
    fail=1
  fi
done

echo
echo "=== seeded credentials must not be pre-filled in the sign-in form ==="
for banned in 'company@example.com' 'password123' 'admin123'; do
  if printf '%s' "$html" | grep -q "$banned"; then
    printf 'LEAKED  %s\n' "$banned"
    fail=1
  else
    printf 'ok      absent: %s\n' "$banned"
  fi
done

echo
echo "=== design system tokens compiled into the stylesheet ==="
sheet=$(printf '%s' "$html" | grep -o '/qhr/admin/_next/static[^"]*\.css' | head -1)
if [ -z "$sheet" ]; then
  echo 'MISSING could not locate the admin stylesheet'
  fail=1
else
  printf 'stylesheet: %s\n' "$sheet"
  css=$(curl -sL "http://127.0.0.1${sheet}")
  printf 'css bytes: %s\n' "${#css}"
  for token in '--nav-bg' '.app-bar' '.card-head' '.rail-item' '.ghost-button' '.shell-width'; do
    if printf '%s' "$css" | grep -q -- "$token"; then
      printf 'ok      %s\n' "$token"
    else
      printf 'MISSING %s\n' "$token"
      fail=1
    fi
  done
fi

echo
if [ "$fail" -eq 0 ]; then
  echo 'ALL ADMIN DESIGN CHECKS PASSED'
else
  echo 'SOME ADMIN DESIGN CHECKS FAILED'
fi
exit "$fail"
