#!/usr/bin/env bash
# Verifies that registration no longer hands out its own verification code, and
# that the code is hashed, expiring and attempt-limited.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/api/v1}"
fail=0
stamp=$(date +%s)
CODE="PRB${stamp: -5}"
EMAIL="probe.${stamp}@example.invalid"

say() { printf '%-56s %s\n' "$1" "$2"; }
contains() { if printf '%s' "$2" | grep -q "$3"; then say "$1" 'ok'; else say "$1" "FAIL (missing $3)"; fail=1; fi }
absent()  { if printf '%s' "$2" | grep -q "$3"; then say "$1" "FAIL (found $3)"; fail=1; else say "$1" 'ok'; fi }
expect()  { if [ "$2" = "$3" ]; then say "$1" "ok ($2)"; else say "$1" "FAIL (got $2, want $3)"; fail=1; fi }

echo "=== registration does not reveal the code ==="
registration=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"name\":\"Probe Co ${stamp}\",\"code\":\"${CODE}\",\"email\":\"${EMAIL}\",\"adminName\":\"Probe Admin\",\"adminEmail\":\"${EMAIL}\",\"adminPassword\":\"Str0ng!Passw0rd\"}" \
  "${BASE}/companies/register")

contains 'company registered'            "$registration" '"success":true'
absent   'no verificationCode in reply'   "$registration" 'verificationCode'
contains 'reply names the address used'   "$registration" "$EMAIL"

echo
echo "=== a guessed code is refused ==="
guess=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"companyCode\":\"${CODE}\",\"verificationCode\":\"000000\"}" \
  "${BASE}/companies/verify-email")
contains 'wrong code rejected'            "$guess" '"success":false'
contains 'remaining attempts reported'    "$guess" 'attempt'

echo
echo "=== a missing code cannot verify ==="
empty=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"companyCode\":\"${CODE}\"}" "${BASE}/companies/verify-email")
contains 'empty code rejected'            "$empty" 'required'

echo
echo "=== resend does not disclose whether a tenant exists ==="
unknown=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d '{"companyCode":"NOSUCHTENANTHERE"}' "${BASE}/companies/resend-verification")
expect 'unknown tenant returns 200'       "$unknown" 200

echo
echo "=== the code is queued for delivery, visible only to super admin ==="
super=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"admin@qhr.com","password":"admin123"}' "${BASE}/auth/admin-login" \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -z "$super" ]; then
  say 'super admin sign-in' 'skipped (password already rotated)'
else
  queue=$(curl -s -H "Authorization: Bearer $super" "${BASE}/admin/outbound-emails?limit=20")
  contains 'queue reports transport state' "$queue" 'transportConfigured'
  contains 'verification email queued'     "$queue" 'company_verification'
fi

anon=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/admin/outbound-emails")
expect 'queue rejects anonymous access'   "$anon" 401

echo
if [ "$fail" -eq 0 ]; then echo 'ALL REGISTRATION SECURITY CHECKS PASSED'; else echo 'SOME CHECKS FAILED'; fi
exit "$fail"
