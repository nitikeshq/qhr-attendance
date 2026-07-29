#!/usr/bin/env bash
# Checks the data-migration surface on the running server: template download,
# reference data, dry-run validation that writes nothing, and permission gating.
set -uo pipefail

BASE="${1:-http://127.0.0.1/qhr/api/v1}"
fail=0

say() { printf '%-52s %s\n' "$1" "$2"; }
expect() {
  if [ "$2" = "$3" ]; then say "$1" "ok ($2)"; else say "$1" "FAIL (got $2, want $3)"; fail=1; fi
}

echo "=== sign in ==="
admin=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"company@example.com","password":"password123"}' \
  "${BASE}/auth/admin-login")
token=$(printf '%s' "$admin" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -z "$token" ]; then echo 'FAIL could not sign in as company admin'; exit 1; fi
say 'company admin token' 'ok'

echo
echo "=== template ==="
code=$(curl -s -o /tmp/qhr-template.csv -w '%{http_code}' -H "Authorization: Bearer $token" \
  "${BASE}/imports/employees/template")
expect 'GET /imports/employees/template' "$code" 200
if head -1 /tmp/qhr-template.csv | grep -q 'workLocationCode'; then
  say 'template carries workLocationCode' 'ok'
else
  say 'template carries workLocationCode' 'FAIL'; fail=1
fi

echo
echo "=== reference ==="
ref=$(curl -s -H "Authorization: Bearer $token" "${BASE}/imports/employees/reference")
if printf '%s' "$ref" | grep -q '"workLocations"'; then
  say 'reference lists work locations' 'ok'
else
  say 'reference lists work locations' 'FAIL'; fail=1
fi

echo
echo "=== dry run must not write ==="
before=$(curl -s -H "Authorization: Bearer $token" "${BASE}/employees" | grep -o '"_id"' | wc -l)
dry=$(curl -s -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" \
  -d '{"csv":"firstName,lastName,email\nVerify,Probe,verify.probe@qhr-check.test\n"}' \
  "${BASE}/imports/employees/validate")
if printf '%s' "$dry" | grep -q '"summary"'; then
  say 'POST /imports/employees/validate' 'ok'
else
  say 'POST /imports/employees/validate' "FAIL ($dry)"; fail=1
fi
after=$(curl -s -H "Authorization: Bearer $token" "${BASE}/employees" | grep -o '"_id"' | wc -l)
expect 'employee count unchanged by dry run' "$after" "$before"

echo
echo "=== bad file is rejected ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" -d '{"csv":"nope,nada\n1,2\n"}' \
  "${BASE}/imports/employees/validate")
expect 'missing required columns -> 400' "$code" 400

echo
echo "=== manager must be refused ==="
mgr=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"manager@testco.com","password":"password123"}' "${BASE}/auth/admin-login")
mtoken=$(printf '%s' "$mgr" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -n "$mtoken" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $mtoken" -d '{"csv":"firstName,email\nA,a@b.test\n"}' \
    "${BASE}/imports/employees/validate")
  expect 'manager import -> 403' "$code" 403
else
  say 'manager sign-in' 'skipped (no seeded manager on this tenant)'
fi

rm -f /tmp/qhr-template.csv
echo
if [ "$fail" -eq 0 ]; then echo 'ALL MIGRATION CHECKS PASSED'; else echo 'SOME MIGRATION CHECKS FAILED'; fi
exit "$fail"
