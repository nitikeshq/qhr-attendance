#!/usr/bin/env bash
# Read-only check of the public marketing routes: the landing page plus the
# dedicated registration, demo and contact flows.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr}"
fail=0

echo "=== route status (${BASE}) ==="
for path in "" /register /demo /contact; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}${path}")
  printf '%-12s %s\n' "${path:-/}" "$code"
  [ "$code" = "200" ] || fail=1
done

echo
echo "=== registration wizard content ==="
body=$(curl -sL "${BASE}/register")
for marker in 'Account setup' 'Company profile' 'Registered company name' 'Company sign-in code' 'Administrator' 'Activate' 'Workspace ready' 'Encrypted in transit'; do
  if printf '%s' "$body" | grep -q "$marker"; then
    printf 'ok      %s\n' "$marker"
  else
    printf 'MISSING %s\n' "$marker"
    fail=1
  fi
done

echo
echo "=== asset prefix must include the /qhr basePath ==="
if printf '%s' "$body" | grep -q '/qhr/_next/'; then
  echo 'ok      assets served from /qhr/_next/'
else
  echo 'MISSING /qhr/_next/ asset prefix'
  fail=1
fi

echo
echo "=== landing page no longer inlines the three-column form block ==="
# Next normalises /qhr/ -> /qhr, so request the bare prefix and follow redirects.
home=$(curl -sL "${BASE}")
printf 'landing bytes: %s\n' "${#home}"
[ "${#home}" -gt 10000 ] || fail=1
if printf '%s' "$home" | grep -q 'Confirm password'; then
  echo 'UNEXPECTED registration fields still inline on the landing page'
  fail=1
else
  echo 'ok      landing page links out instead of embedding forms'
fi

echo
echo "=== landing page sections ==="
for marker in 'One system of record' 'Eight modules that share one data model' \
              'What every group actually gets' 'Live in five steps' \
              'Built for data you cannot afford to leak' 'Transparent tiers' \
              'The questions buyers actually ask' 'Start with attendance today' \
              'Skip to content'; do
  if printf '%s' "$home" | grep -q "$marker"; then
    printf 'ok      %s\n' "$marker"
  else
    printf 'MISSING %s\n' "$marker"
    fail=1
  fi
done

echo
echo "=== retired copy and the internal API URL must not be published ==="
for banned in 'Doc-aligned' 'placeholder marketing shell' 'API mode' 'Connected to' 'blue-chip'; do
  if printf '%s' "$home" | grep -q "$banned"; then
    printf 'LEAKED  %s\n' "$banned"
    fail=1
  else
    printf 'ok      absent: %s\n' "$banned"
  fi
done

echo
echo "=== CTA links point at the prefixed routes ==="
for href in '/qhr/register' '/qhr/demo' '/qhr/contact'; do
  if printf '%s' "$home" | grep -q "\"$href\""; then
    printf 'ok      %s\n' "$href"
  else
    printf 'MISSING %s\n' "$href"
    fail=1
  fi
done

# Non-destructive contract check: the registration endpoint must reject an
# incomplete payload rather than creating a half-built tenant.
echo
echo "=== registration endpoint rejects incomplete payloads ==="
reject=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"companyName":"","companyCode":"","adminEmail":""}' \
  "${BASE}/api/v1/companies/register")
printf 'POST /companies/register (empty) -> %s\n' "$reject"
case "$reject" in
  4*) echo 'ok      rejected as expected' ;;
  *) echo 'UNEXPECTED status'; fail=1 ;;
esac

echo
if [ "$fail" -eq 0 ]; then
  echo 'ALL PUBLIC PAGE CHECKS PASSED'
else
  echo 'SOME PUBLIC PAGE CHECKS FAILED'
fi
exit "$fail"
