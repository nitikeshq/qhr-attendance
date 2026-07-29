#!/usr/bin/env bash
# Checks that a deep URL into the admin console is served, so refreshing on a
# page keeps you on that page instead of bouncing to the Dashboard.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/admin}"
fail=0

for page in dashboard employees org attendance calendar payroll geofences imports settings; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}?page=${page}")
  if [ "$code" = "200" ]; then
    printf '%-14s %s\n' "?page=${page}" 'ok (200)'
  else
    printf '%-14s %s\n' "?page=${page}" "FAIL (${code})"
    fail=1
  fi
done

# An unknown page must still load the console rather than error; the client
# falls back to the Dashboard and rewrites the address.
code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}?page=not-a-real-page")
if [ "$code" = "200" ]; then
  printf '%-14s %s\n' '?page=bogus' 'ok (200, client falls back)'
else
  printf '%-14s %s\n' '?page=bogus' "FAIL (${code})"
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then echo 'ALL ROUTING CHECKS PASSED'; else echo 'SOME CHECKS FAILED'; fi
exit "$fail"
